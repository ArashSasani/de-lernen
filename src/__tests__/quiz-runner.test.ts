import type {
  QuizEvent,
  QuizPlan,
  QuizQuestion,
  QuizRunContext,
} from '@/types/grammar-quiz';
import {
  createBankCursor,
  createLatch,
  NOTES_READY_TIMEOUT_MS,
  startRun,
} from '@/lib/quiz-runner';

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

const aiItem = (n: number): QuizQuestion => ({
  ...bankItem('t', n),
  id: `ai-t-${n}`,
  prompt: `generated ${n}`,
});

let bankPool = 10;
jest.mock('../lib/grammar-quiz', () => ({
  generateQuestionsForTopic: (
    topicId: string,
    count: number,
    excludeIds?: ReadonlySet<string>,
  ) =>
    Array.from({ length: bankPool }, (_, i) => bankItem(topicId, i))
      .filter((q) => !excludeIds?.has(q.id))
      .slice(0, count),
}));

const sourceQuestions = jest.fn();
jest.mock('../lib/grammar-quiz-ai', () => ({
  sourceQuestions: (...args: unknown[]) => sourceQuestions(...args),
}));

const getServedAt = jest.fn(() => new Map([['t-00', 5]]));
const markServed = jest.fn();
jest.mock('../lib/bank-rotation', () => ({
  getServedAt: () => getServedAt(),
  markServed: (...args: unknown[]) => markServed(...args),
}));

let token: string | null = 'token';
jest.mock('../lib/sync', () => ({ getToken: () => token }));

const slot = (count: number, topicId = 't'): QuizPlan => ({
  topicId,
  count,
  tier: 3,
  difficulty: 'medium',
});

async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function setup(
  plan: QuizPlan[],
  ctx: Partial<QuizRunContext> = {},
  notesOpen = true,
) {
  const events: QuizEvent[] = [];
  const controller = new AbortController();
  const context: QuizRunContext = {
    progress: {},
    aiEnabled: false,
    online: true,
    results: [],
    ...ctx,
  };
  const notes = createLatch(notesOpen);
  const run = startRun({
    plan,
    getContext: () => context,
    dispatch: (e) => events.push(e),
    signal: controller.signal,
    notes,
  });
  const landed = () =>
    events.filter(
      (e): e is Extract<QuizEvent, { type: 'batch-landed' }> =>
        e.type === 'batch-landed',
    );
  return { events, controller, context, notes, run, landed };
}

beforeEach(() => {
  bankPool = 10;
  token = 'token';
  sourceQuestions.mockReset();
  markServed.mockReset();
  getServedAt.mockClear();
});

afterEach(() => jest.useRealTimers());

describe('createLatch', () => {
  it('resolves at once when already open', async () => {
    const latch = createLatch(true);
    let done = false;
    void latch.wait(1000).then(() => (done = true));
    await flush();
    expect(done).toBe(true);
  });

  it('releases every waiter when opened', async () => {
    const latch = createLatch();
    let n = 0;
    void latch.wait(1000).then(() => n++);
    void latch.wait(1000).then(() => n++);
    await flush();
    expect(n).toBe(0);
    latch.open();
    await flush();
    expect(n).toBe(2);
  });

  it('gives up waiting after the timeout', async () => {
    jest.useFakeTimers();
    const latch = createLatch();
    let done = false;
    void latch.wait(500).then(() => (done = true));
    jest.advanceTimersByTime(499);
    await flush();
    expect(done).toBe(false);
    jest.advanceTimersByTime(1);
    await flush();
    expect(done).toBe(true);
  });

  it('clears its timer when opened first', () => {
    jest.useFakeTimers();
    const latch = createLatch();
    void latch.wait(500);
    latch.open();
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('createBankCursor', () => {
  it('snapshots rotation once and never repeats a served item', () => {
    const cursor = createBankCursor();
    const a = cursor.draw('t', 4);
    const b = cursor.draw('t', 4);
    expect(getServedAt).toHaveBeenCalledTimes(1);
    expect(cursor.servedAt.get('t-00')).toBe(5);
    expect(new Set([...a, ...b].map((q) => q.id)).size).toBe(8);
    expect(markServed).toHaveBeenCalledWith(a.map((q) => q.id));
  });

  it('books bank results for rotation but generated ones for dedupe only', () => {
    const cursor = createBankCursor();
    cursor.absorb({ questions: [aiItem(1)], source: 'ai', degraded: false });
    expect(cursor.served.has('ai-t-1')).toBe(true);
    expect(markServed).not.toHaveBeenCalled();

    cursor.absorb({
      questions: [bankItem('t', 9)],
      source: 'bank',
      degraded: true,
    });
    expect(markServed).toHaveBeenCalledWith(['t-09']);
  });
});

describe('startRun', () => {
  it('dispatches the bank starter synchronously', () => {
    const { events } = setup([slot(4), slot(4)]);
    expect(events[0]).toMatchObject({ type: 'started' });
    const started = events[0] as Extract<QuizEvent, { type: 'started' }>;
    expect(started.starter.map((q) => q.id)).toEqual([
      't-00',
      't-01',
      't-02',
      't-03',
    ]);
  });

  it('starts an empty plan without chaining anything', async () => {
    const { events } = setup([]);
    await flush();
    expect(events).toEqual([{ type: 'started', plan: [], starter: [] }]);
  });

  it('lands every remaining batch in plan order from the bank when AI is off', async () => {
    const { landed } = setup([slot(4), slot(4), slot(2)]);
    await flush();
    expect(landed().map((e) => e.batchIdx)).toEqual([1, 2]);
    expect(landed()[1].questions.map((q) => q.id)).toEqual(['t-08', 't-09']);
    expect(sourceQuestions).not.toHaveBeenCalled();
  });

  it.each<[string, Partial<QuizRunContext>, string | null]>([
    ['offline', { aiEnabled: true, online: false }, 'token'],
    ['signed out', { aiEnabled: true }, null],
  ])('uses the bank when %s', async (_name, ctx, t) => {
    token = t;
    const { landed } = setup([slot(4), slot(4)], ctx);
    await flush();
    expect(sourceQuestions).not.toHaveBeenCalled();
    expect(landed()).toHaveLength(1);
  });

  it('asks the generator with the session’s live context', async () => {
    let excludedAtCall: string[] = [];
    sourceQuestions.mockImplementation(
      async (_p: unknown, o: { excludeIds: ReadonlySet<string> }) => {
        excludedAtCall = [...o.excludeIds];
        return { questions: [aiItem(1)], source: 'ai', degraded: false };
      },
    );
    const getNotes = jest.fn(() => ['a note']);
    const results = [true, true, true, true, true, true, true, false];
    setup([slot(4), slot(4)], {
      aiEnabled: true,
      results,
      getNotes,
      progress: { t: { attempts: 20, correct: 19, streak: 3, lastSeen: 1 } },
    });
    await flush();

    const [plan, opts] = sourceQuestions.mock.calls[0];
    expect(plan.difficulty).toBe('hard');
    expect(opts.recentResults).toEqual(results.slice(-6));
    expect(opts.notes).toEqual(['a note']);
    expect(opts.alreadyAsked).toEqual([
      't prompt 0',
      't prompt 1',
      't prompt 2',
      't prompt 3',
    ]);
    expect(excludedAtCall).toEqual(['t-00', 't-01', 't-02', 't-03']);
  });

  it('switches to the bank for the rest of the run after a generator failure', async () => {
    sourceQuestions.mockResolvedValue({
      questions: [bankItem('t', 4)],
      source: 'bank',
      degraded: true,
    });
    const { events, landed } = setup([slot(4), slot(1), slot(1)], {
      aiEnabled: true,
    });
    await flush();
    expect(sourceQuestions).toHaveBeenCalledTimes(1);
    expect(events.filter((e) => e.type === 'degraded')).toHaveLength(1);
    expect(landed()).toHaveLength(2);
    expect(landed()[1].questions[0].id).toBe('t-05');
  });

  it('reads the AI toggle per batch', async () => {
    sourceQuestions.mockResolvedValue({
      questions: [aiItem(1)],
      source: 'ai',
      degraded: false,
    });
    const { context } = setup([slot(4), slot(1), slot(1)], {
      aiEnabled: true,
    });
    context.aiEnabled = false;
    await flush();
    expect(sourceQuestions).toHaveBeenCalledTimes(1);
  });

  it('waits for the notes corpus before generating', async () => {
    sourceQuestions.mockResolvedValue({
      questions: [],
      source: 'ai',
      degraded: false,
    });
    const { notes } = setup([slot(4), slot(4)], { aiEnabled: true }, false);
    await flush();
    expect(sourceQuestions).not.toHaveBeenCalled();
    notes.open();
    await flush();
    expect(sourceQuestions).toHaveBeenCalledTimes(1);
  });

  it('generates anyway once the notes wait times out', async () => {
    jest.useFakeTimers();
    sourceQuestions.mockResolvedValue({
      questions: [],
      source: 'ai',
      degraded: false,
    });
    setup([slot(4), slot(4)], { aiEnabled: true }, false);
    jest.advanceTimersByTime(NOTES_READY_TIMEOUT_MS);
    await flush();
    expect(sourceQuestions).toHaveBeenCalledTimes(1);
  });

  it('goes silent once aborted, even if a fetch resolves late', async () => {
    let resolve!: (v: unknown) => void;
    sourceQuestions.mockImplementation(() => new Promise((r) => (resolve = r)));
    const { events, controller } = setup([slot(4), slot(4), slot(2)], {
      aiEnabled: true,
    });
    await flush();
    controller.abort();
    markServed.mockClear();
    resolve({ questions: [bankItem('t', 7)], source: 'bank', degraded: true });
    await flush();

    expect(events.map((e) => e.type)).toEqual(['started']);
    expect(markServed).not.toHaveBeenCalled();
    expect(sourceQuestions).toHaveBeenCalledTimes(1);
  });

  it('fills an outrun slot with unserved bank items', async () => {
    sourceQuestions.mockImplementation(() => new Promise(() => {}));
    const { events, run } = setup([slot(4), slot(4)], { aiEnabled: true });
    await flush();
    run.fill(1);
    const filler = events.at(-1) as Extract<
      QuizEvent,
      { type: 'filler-landed' }
    >;
    expect(filler.type).toBe('filler-landed');
    expect(filler.batchIdx).toBe(1);
    expect(filler.questions.map((q) => q.id)).toEqual([
      't-04',
      't-05',
      't-06',
      't-07',
    ]);
  });

  it('ignores a fill for a missing slot or a dead run', () => {
    const { events, run, controller } = setup([slot(4), slot(4)]);
    const before = events.length;
    run.fill(9);
    controller.abort();
    run.fill(1);
    expect(events).toHaveLength(before);
  });
});
