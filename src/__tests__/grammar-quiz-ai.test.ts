import { sourceQuestions, isAiGenerated } from '@/lib/grammar-quiz-ai';
import { generateQuestionsForTopic } from '@/lib/grammar-quiz';
import type { QuizPlan } from '@/app/grammar/quiz/page.helpers';

const plan: QuizPlan = {
  topicId: 'sein-praesens',
  count: 2,
  tier: 1,
  difficulty: 'easy',
};

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('sourceQuestions', () => {
  it('falls back to the bank for an unknown topic', async () => {
    const result = await sourceQuestions(
      { ...plan, topicId: 'does-not-exist' },
      { token: 'x' },
    );
    expect(result.source).toBe('bank');
    expect(result.degraded).toBe(false);
    expect(result.questions.length).toBeGreaterThanOrEqual(0);
  });

  it('falls back to the bank, degraded, when the request fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 });
    const result = await sourceQuestions(plan, { token: 'x' });
    expect(result.source).toBe('bank');
    expect(result.degraded).toBe(true);
    expect(result.questions.length).toBeGreaterThan(0);
  });

  it('falls back to the bank, degraded, on a network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const result = await sourceQuestions(plan, { token: 'x' });
    expect(result.source).toBe('bank');
    expect(result.degraded).toBe(true);
  });

  it('falls back to the bank, degraded, on a malformed response body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ not: 'an array' }),
    });
    const result = await sourceQuestions(plan, { token: 'x' });
    expect(result.source).toBe('bank');
    expect(result.degraded).toBe(true);
  });

  it('stamps generated items with a topic-scoped ai- id and returns them', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          prompt: 'Ich ___ Student.',
          choices: ['bin', 'bist', 'ist'],
          correctIndex: 0,
          acceptableIndices: [0],
          explanation: 'ich bin.',
        },
      ],
    });
    const result = await sourceQuestions(plan, { token: 'x' });
    expect(result.source).toBe('ai');
    expect(result.degraded).toBe(false);
    expect(result.questions[0].id).toMatch(/^ai-sein-praesens-[0-9a-f]{8}$/);
    expect(result.questions[0].topicId).toBe('sein-praesens');
  });

  it('tops up from the bank when the AI batch is short of the requested count', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          prompt: 'Ich ___ Student.',
          choices: ['bin', 'bist', 'ist'],
          correctIndex: 0,
          acceptableIndices: [0],
          explanation: 'ich bin.',
        },
      ],
    });
    const result = await sourceQuestions({ ...plan, count: 3 }, { token: 'x' });
    expect(result.questions.length).toBe(3);
  });
});

describe('isAiGenerated', () => {
  it('flags a stamped generated id', () => {
    expect(isAiGenerated({ id: 'ai-sein-praesens-9f2c1b04' })).toBe(true);
  });

  it('does not flag a frozen bank id', () => {
    expect(isAiGenerated({ id: 'sein-praesens-03' })).toBe(false);
  });

  it('labels every question sourceQuestions actually returns', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          prompt: 'Ich ___ Student.',
          choices: ['bin', 'bist', 'ist'],
          correctIndex: 0,
          acceptableIndices: [0],
          explanation: 'ich bin.',
        },
      ],
    });
    // count 3 forces one generated item plus a two-item bank top-up, so the
    // mixed batch must not be labelled uniformly.
    const { questions } = await sourceQuestions(
      { ...plan, count: 3 },
      { token: 'x' },
    );
    expect(questions.filter(isAiGenerated)).toHaveLength(1);
    expect(questions.filter((q) => !isAiGenerated(q))).toHaveLength(2);
  });
});

describe('generateQuestionsForTopic excludeIds', () => {
  it('never re-serves an excluded item', () => {
    const first = generateQuestionsForTopic('sein-praesens', 4);
    expect(first.length).toBeGreaterThan(0);
    const exclude = new Set(first.map((q) => q.id));
    const second = generateQuestionsForTopic('sein-praesens', 4, exclude);
    for (const q of second) expect(exclude.has(q.id)).toBe(false);
  });

  it('returns nothing once the whole topic pool is excluded', () => {
    const all = generateQuestionsForTopic('sein-praesens', 1000);
    const exclude = new Set(all.map((q) => q.id));
    expect(generateQuestionsForTopic('sein-praesens', 4, exclude)).toEqual([]);
  });
});
