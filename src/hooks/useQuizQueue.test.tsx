/**
 * @jest-environment jsdom
 */
import { StrictMode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { QuizQuestion } from '@/types/grammar-quiz';
import { useQuizQueue } from './useQuizQueue';

// The batch pipeline is the most stateful thing in the app: six phases, a
// bank-seeded batch 0 and a chained prefetch. Driven through the hook with
// its seams stubbed — the bank lookup, the AI sourcer, and rotation.

const bankItem = (topicId: string, n: number): QuizQuestion => ({
  id: `${topicId}-0${n}`,
  topicId,
  level: 'a1',
  difficulty: 'medium',
  prompt: `${topicId} prompt ${n}`,
  choices: ['a', 'b', 'c'],
  correctIndex: 0,
  explanation: 'because',
});

let bankPool = 10;

jest.mock('../lib/grammar-quiz', () => ({
  bankPoolSize: () => bankPool,
  generateQuestionsForTopic: (
    topicId: string,
    count: number,
    excludeIds?: ReadonlySet<string>,
  ) =>
    Array.from({ length: bankPool }, (_, i) => bankItem(topicId, i))
      .filter((q) => !excludeIds?.has(q.id))
      .slice(0, count),
  allQuizzableTopicIds: () => ['topic-a', 'topic-b'],
}));

const sourceQuestions = jest.fn();
jest.mock('../lib/grammar-quiz-ai', () => ({
  sourceQuestions: (...args: unknown[]) => sourceQuestions(...args),
}));

const markServed = jest.fn();
jest.mock('../lib/bank-rotation', () => ({
  getServedAt: () => new Map(),
  markServed: (...args: unknown[]) => markServed(...args),
}));

jest.mock('../lib/sync', () => ({ getToken: () => 'token' }));

let online = true;
jest.mock('./useOnline', () => ({ useOnline: () => online }));

const aiItem = (n: number): QuizQuestion => ({
  ...bankItem('topic-a', n),
  id: `ai-topic-a-${n}`,
  prompt: `generated prompt ${n}`,
});

interface Deferred {
  resolve: (value: unknown) => void;
  signal: AbortSignal;
}

// Each generator call parks here until the test settles it, in call order.
let pending: Deferred[] = [];
function parkGenerator() {
  sourceQuestions.mockImplementation(
    (_plan: unknown, opts: { signal: AbortSignal }) =>
      new Promise((resolve) => pending.push({ resolve, signal: opts.signal })),
  );
}

async function settle(call: number, value: unknown) {
  await act(async () => {
    pending[call].resolve(value);
  });
  await flush();
}

const aiBatch = (...ns: number[]) => ({
  questions: ns.map(aiItem),
  source: 'ai',
  degraded: false,
});

function answerAll(result: { current: ReturnType<typeof useQuizQueue> }) {
  while (result.current.current) act(() => result.current.next());
}

// Batches 1+ chain through promises, so every run leaves updates queued past
// the assertion; draining them inside act() keeps them wrapped.
async function flush() {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

function renderQueue(opts: Parameters<typeof useQuizQueue>[0]) {
  return renderHook(() => useQuizQueue(opts));
}

beforeEach(() => {
  bankPool = 10;
  online = true;
  pending = [];
  markServed.mockReset();
  sourceQuestions.mockReset();
  // Hangs unless a test says otherwise.
  sourceQuestions.mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe('useQuizQueue', () => {
  it('serves the first question from the bank with no wait', async () => {
    const { result } = renderQueue({
      topicId: 'topic-a',
      progress: {},
      aiEnabled: true,
    });
    expect(result.current.phase).toBe('active');
    expect(result.current.current?.topicId).toBe('topic-a');
    expect(result.current.index).toBe(0);
    await flush();
  });

  it('clamps a per-topic session to the bank pool when AI is off', async () => {
    bankPool = 8;
    const { result } = renderQueue({
      topicId: 'topic-a',
      topicCount: 10,
      progress: {},
      aiEnabled: false,
    });
    await flush();
    expect(result.current.total).toBe(8);
  });

  it('keeps the full session length when AI can top the bank up', async () => {
    bankPool = 8;
    const { result } = renderQueue({
      topicId: 'topic-a',
      topicCount: 10,
      progress: {},
      aiEnabled: true,
    });
    expect(result.current.total).toBe(10);
    await flush();
  });

  it('never re-serves a bank item inside one session', async () => {
    const { result } = renderQueue({
      topicId: 'topic-a',
      topicCount: 10,
      progress: {},
      aiEnabled: false,
    });
    await flush();

    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const q = result.current.current;
      if (!q) break;
      expect(seen.has(q.id)).toBe(false);
      seen.add(q.id);
      act(() => result.current.next());
    }
    expect(seen.size).toBe(10);
  });

  it('records results and finishes once the queue is exhausted', async () => {
    bankPool = 3;
    const { result } = renderQueue({
      topicId: 'topic-a',
      topicCount: 3,
      progress: {},
      aiEnabled: false,
    });
    await flush();

    for (let i = 0; i < 3; i++) {
      act(() => result.current.recordResult(i === 0));
      act(() => result.current.next());
    }
    await waitFor(() => expect(result.current.phase).toBe('finished'));
    expect(result.current.results).toEqual([true, false, false]);
  });

  it('marks the run degraded when the generator fails, without breaking it', async () => {
    sourceQuestions.mockResolvedValueOnce({
      questions: [bankItem('topic-a', 7)],
      source: 'bank',
      degraded: true,
    });
    const { result } = renderQueue({
      topicId: 'topic-a',
      progress: {},
      aiEnabled: true,
    });
    await flush();

    expect(result.current.degraded).toBe(true);
    expect(result.current.phase).toBe('active');
    expect(result.current.current).not.toBeNull();
  });

  it('reports an empty session when the bank has nothing for the topic', async () => {
    bankPool = 0;
    const { result } = renderQueue({
      topicId: 'topic-a',
      topicCount: 10,
      progress: {},
      aiEnabled: false,
    });
    await flush();

    expect(result.current.phase).toBe('empty');
    expect(result.current.current).toBeNull();
  });

  it('restarts into a fresh run', async () => {
    const { result } = renderQueue({
      topicId: 'topic-a',
      topicCount: 6,
      progress: {},
      aiEnabled: false,
    });
    await flush();

    act(() => result.current.recordResult(true));
    act(() => result.current.next());
    expect(result.current.index).toBe(1);

    act(() => result.current.restart());
    expect(result.current.index).toBe(0);
    expect(result.current.results).toEqual([]);
    expect(result.current.phase).toBe('active');
    await flush();
  });

  it('does not call the generator at all when AI is off', async () => {
    renderQueue({ topicId: 'topic-a', progress: {}, aiEnabled: false });
    await flush();
    expect(sourceQuestions).not.toHaveBeenCalled();
  });

  it('records bank picks for cross-session rotation', async () => {
    renderQueue({
      topicId: 'topic-a',
      topicCount: 4,
      progress: {},
      aiEnabled: false,
    });
    await flush();

    const served = markServed.mock.calls.flatMap((c) => c[0] as string[]);
    expect(served.length).toBe(4);
    for (const id of served) expect(id.startsWith('topic-a-')).toBe(true);
  });

  it('passes the topic its own mistake notes when generating', async () => {
    const getNotes = jest.fn(() => ['confused Akkusativ and Dativ after mit']);
    sourceQuestions.mockResolvedValueOnce({
      questions: [],
      source: 'ai',
      degraded: false,
    });
    renderQueue({
      topicId: 'topic-a',
      progress: {},
      aiEnabled: true,
      getNotes,
      notesReady: true,
    });
    await flush();

    expect(sourceQuestions).toHaveBeenCalled();
    expect(sourceQuestions.mock.calls[0][1].notes).toEqual([
      'confused Akkusativ and Dativ after mit',
    ]);
  });

  it('bridges an outrun prefetch with bank filler, then still appends the real batch once', async () => {
    jest.useFakeTimers();
    parkGenerator();
    const { result } = renderQueue({
      topicId: 'topic-a',
      topicCount: 10,
      progress: {},
      aiEnabled: true,
    });
    await flush();
    answerAll(result);
    expect(result.current.phase).toBe('waiting-batch');

    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    expect(result.current.phase).toBe('active');
    expect(result.current.current?.id).toBe('topic-a-04');

    await settle(0, aiBatch(1, 2, 3, 4));
    const ids: string[] = [];
    while (result.current.current) {
      ids.push(result.current.current.id);
      act(() => result.current.next());
    }
    expect(ids.filter((id) => id.startsWith('ai-'))).toEqual([
      'ai-topic-a-1',
      'ai-topic-a-2',
      'ai-topic-a-3',
      'ai-topic-a-4',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not let an abandoned run disable the generator for its replacement', async () => {
    parkGenerator();
    const { result } = renderQueue({
      topicId: 'topic-a',
      topicCount: 10,
      progress: {},
      aiEnabled: true,
    });
    await flush();
    act(() => result.current.restart());
    await flush();
    expect(pending[0].signal.aborted).toBe(true);

    await settle(0, { questions: [], source: 'bank', degraded: true });
    expect(result.current.degraded).toBe(false);

    await settle(1, aiBatch(1, 2, 3, 4));
    expect(sourceQuestions).toHaveBeenCalledTimes(3);
    expect(result.current.degraded).toBe(false);
  });

  it('ignores whatever an abandoned run fetches', async () => {
    parkGenerator();
    const { result } = renderQueue({
      topicId: 'topic-a',
      topicCount: 10,
      progress: {},
      aiEnabled: true,
    });
    await flush();
    act(() => result.current.restart());
    await flush();
    await settle(0, aiBatch(1, 2, 3, 4));

    const ids: string[] = [];
    while (result.current.current) {
      ids.push(result.current.current.id);
      act(() => result.current.next());
    }
    expect(ids.some((id) => id.startsWith('ai-'))).toBe(false);
  });

  it('runs one live session under Strict Mode', async () => {
    parkGenerator();
    const { result } = renderHook(
      () =>
        useQuizQueue({
          topicId: 'topic-a',
          topicCount: 10,
          progress: {},
          aiEnabled: true,
        }),
      { wrapper: StrictMode },
    );
    await flush();
    expect(result.current.phase).toBe('active');
    expect(result.current.index).toBe(0);
    const live = pending.filter((d) => !d.signal.aborted);
    expect(live).toHaveLength(1);
  });

  it('holds generation until the notes corpus is ready', async () => {
    const getNotes = jest.fn(() => ['a note']);
    sourceQuestions.mockResolvedValue(aiBatch(1));
    const { rerender } = renderHook((props) => useQuizQueue(props), {
      initialProps: {
        topicId: 'topic-a',
        progress: {},
        aiEnabled: true,
        getNotes,
        notesReady: false,
      } as Parameters<typeof useQuizQueue>[0],
    });
    await flush();
    expect(sourceQuestions).not.toHaveBeenCalled();

    rerender({
      topicId: 'topic-a',
      progress: {},
      aiEnabled: true,
      getNotes,
      notesReady: true,
    });
    await flush();
    expect(sourceQuestions).toHaveBeenCalled();
    expect(sourceQuestions.mock.calls[0][1].notes).toEqual(['a note']);
  });

  it('generates without notes when the corpus never loads', async () => {
    jest.useFakeTimers();
    sourceQuestions.mockResolvedValue(aiBatch(1));
    renderQueue({
      topicId: 'topic-a',
      progress: {},
      aiEnabled: true,
      notesReady: false,
    });
    await flush();
    expect(sourceQuestions).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await flush();
    expect(sourceQuestions).toHaveBeenCalled();
  });

  it('plans a smart mix across several topics', async () => {
    const { result } = renderQueue({
      topicId: null,
      progress: {},
      aiEnabled: false,
    });
    await flush();
    expect(result.current.total).toBe(4);

    const topics = new Set<string>();
    while (result.current.current) {
      topics.add(result.current.current.topicId);
      act(() => result.current.next());
    }
    expect(topics).toEqual(new Set(['topic-a', 'topic-b']));
    expect(result.current.phase).toBe('finished');
  });

  it('draws from the bank without calling the generator while offline', async () => {
    online = false;
    const { result } = renderQueue({
      topicId: 'topic-a',
      topicCount: 10,
      progress: {},
      aiEnabled: true,
    });
    await flush();
    expect(sourceQuestions).not.toHaveBeenCalled();
    expect(result.current.total).toBe(10);
    expect(result.current.degraded).toBe(false);
  });

  it('applies an AI toggle flip to the next batch without restarting', async () => {
    parkGenerator();
    const props = {
      topicId: 'topic-a',
      topicCount: 10,
      progress: {},
      aiEnabled: true,
    };
    const { result, rerender } = renderHook((p) => useQuizQueue(p), {
      initialProps: props as Parameters<typeof useQuizQueue>[0],
    });
    await flush();
    act(() => result.current.next());
    rerender({ ...props, aiEnabled: false });
    await settle(0, aiBatch(1, 2, 3, 4));

    expect(sourceQuestions).toHaveBeenCalledTimes(1);
    expect(result.current.index).toBe(1);
    expect(result.current.total).toBe(10);
  });

  it('waits on the first generated batch when the bank has nothing to start with', async () => {
    bankPool = 0;
    parkGenerator();
    const { result } = renderQueue({
      topicId: 'topic-a',
      topicCount: 10,
      progress: {},
      aiEnabled: true,
    });
    await flush();
    expect(result.current.phase).toBe('loading-first');
    expect(result.current.current).toBeNull();

    await settle(0, aiBatch(1, 2, 3, 4));
    expect(result.current.phase).toBe('active');
    expect(result.current.current?.id).toBe('ai-topic-a-1');
  });

  it('reports the requested total while loading and the served total once loaded', async () => {
    parkGenerator();
    const { result } = renderQueue({
      topicId: 'topic-a',
      topicCount: 10,
      progress: {},
      aiEnabled: true,
    });
    await flush();
    expect(result.current.total).toBe(10);

    await settle(0, aiBatch(1, 2));
    expect(result.current.total).toBe(10);
    await settle(1, aiBatch(3));
    expect(result.current.total).toBe(7);
  });

  it('finishes instead of stalling when the last batches land empty while waiting', async () => {
    jest.useFakeTimers();
    bankPool = 8;
    parkGenerator();
    const { result } = renderQueue({
      topicId: 'topic-a',
      topicCount: 10,
      progress: {},
      aiEnabled: true,
    });
    await flush();
    answerAll(result);
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    answerAll(result);
    expect(result.current.phase).toBe('waiting-batch');

    await settle(0, { questions: [], source: 'bank', degraded: true });
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    await flush();
    expect(result.current.phase).toBe('finished');
  });

  it('starts a restarted run with no recent results from the last one', async () => {
    parkGenerator();
    const { result } = renderQueue({
      topicId: 'topic-a',
      topicCount: 10,
      progress: {},
      aiEnabled: true,
    });
    await flush();
    act(() => result.current.recordResult(true));
    act(() => result.current.recordResult(true));
    act(() => result.current.restart());
    await flush();

    const last = sourceQuestions.mock.calls.at(-1)!;
    expect(last[1].recentResults).toEqual([]);
  });
});
