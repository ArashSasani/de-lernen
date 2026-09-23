import type { QuizPlan, QuizQuestion, QuizState } from '@/types/grammar-quiz';
import {
  initialQuizState,
  nextFillIndex,
  phaseOf,
  planFor,
  quizReducer,
  totalOf,
} from '@/lib/quiz-session';
import { allQuizzableTopicIds, bankPoolSize } from '@/lib/grammar-quiz';
import { QUIZ_SESSION_SIZE } from '@/app/grammar/quiz/page.helpers';
import { GRAMMAR_BATCH_SIZE_MAX } from '@/constants';

const q = (id: string): QuizQuestion => ({
  id,
  topicId: 't',
  level: 'a1',
  difficulty: 'medium',
  prompt: `prompt ${id}`,
  choices: ['a', 'b', 'c'],
  correctIndex: 0,
  explanation: 'because',
});

const slot = (count: number): QuizPlan => ({
  topicId: 't',
  count,
  tier: 3,
  difficulty: 'medium',
});

function state(partial: Partial<QuizState> & { landed?: number[] }): QuizState {
  const { landed = [], ...rest } = partial;
  return {
    ...initialQuizState,
    plan: [],
    landedBatches: new Set(landed),
    ...rest,
  };
}

const qs = (n: number) => Array.from({ length: n }, (_, i) => q(`q${i}`));

describe('quizReducer', () => {
  it('starts a run with the starter as batch 0', () => {
    const plan = [slot(4), slot(4)];
    const s = quizReducer(initialQuizState, {
      type: 'started',
      plan,
      starter: qs(4),
    });
    expect(s.plan).toBe(plan);
    expect(s.queue).toHaveLength(4);
    expect([...s.landedBatches]).toEqual([0]);
    expect(s.index).toBe(0);
  });

  it('starts an empty plan with nothing landed', () => {
    const s = quizReducer(initialQuizState, {
      type: 'started',
      plan: [],
      starter: [],
    });
    expect(s.landedBatches.size).toBe(0);
  });

  it('wipes the previous run on start', () => {
    const prev = state({
      plan: [slot(2)],
      queue: qs(2),
      index: 2,
      results: [true, false],
      landed: [0],
      filledBatches: new Set([1]),
      degraded: true,
    });
    const s = quizReducer(prev, {
      type: 'started',
      plan: [slot(3)],
      starter: [q('fresh')],
    });
    expect(s.index).toBe(0);
    expect(s.results).toEqual([]);
    expect(s.degraded).toBe(false);
    expect(s.filledBatches.size).toBe(0);
    expect(s.queue.map((x) => x.id)).toEqual(['fresh']);
  });

  it('appends a landed batch once, ignoring a duplicate slot', () => {
    const s0 = state({
      plan: [slot(1), slot(1)],
      queue: [q('a')],
      landed: [0],
    });
    const s1 = quizReducer(s0, {
      type: 'batch-landed',
      batchIdx: 1,
      questions: [q('b')],
    });
    const s2 = quizReducer(s1, {
      type: 'batch-landed',
      batchIdx: 1,
      questions: [q('c')],
    });
    expect(s1.queue.map((x) => x.id)).toEqual(['a', 'b']);
    expect(s2).toBe(s1);
  });

  it('records an empty landed batch as landed', () => {
    const s0 = state({ plan: [slot(1), slot(1)], landed: [0] });
    const s1 = quizReducer(s0, {
      type: 'batch-landed',
      batchIdx: 1,
      questions: [],
    });
    expect(s1.landedBatches.has(1)).toBe(true);
    expect(s1.queue).toHaveLength(0);
  });

  it('appends filler once per slot and drops it for a slot that already landed', () => {
    const s0 = state({ plan: [slot(1), slot(1)], landed: [0] });
    const filled = quizReducer(s0, {
      type: 'filler-landed',
      batchIdx: 1,
      questions: [q('f')],
    });
    expect(filled.queue.map((x) => x.id)).toEqual(['f']);
    expect(
      quizReducer(filled, {
        type: 'filler-landed',
        batchIdx: 1,
        questions: [q('g')],
      }),
    ).toBe(filled);
    expect(
      quizReducer(s0, {
        type: 'filler-landed',
        batchIdx: 0,
        questions: [q('h')],
      }),
    ).toBe(s0);
  });

  it('still appends the real batch after filler bridged its slot', () => {
    const s0 = state({ plan: [slot(1), slot(1)], landed: [0] });
    const filled = quizReducer(s0, {
      type: 'filler-landed',
      batchIdx: 1,
      questions: [q('f')],
    });
    const real = quizReducer(filled, {
      type: 'batch-landed',
      batchIdx: 1,
      questions: [q('r')],
    });
    expect(real.queue.map((x) => x.id)).toEqual(['f', 'r']);
    expect(real.landedBatches.has(1)).toBe(true);
  });

  it('records answers, advances, and latches degraded', () => {
    let s = state({ plan: [slot(2)], queue: qs(2), landed: [0] });
    s = quizReducer(s, { type: 'answered', correct: true });
    s = quizReducer(s, { type: 'advanced' });
    s = quizReducer(s, { type: 'degraded' });
    expect(s.results).toEqual([true]);
    expect(s.index).toBe(1);
    expect(s.degraded).toBe(true);
    expect(quizReducer(s, { type: 'degraded' })).toBe(s);
  });

  it('never mutates the state it is given', () => {
    const s0 = Object.freeze(
      state({ plan: [slot(1), slot(1)], queue: [q('a')], landed: [0] }),
    );
    const landed = s0.landedBatches;
    quizReducer(s0, { type: 'batch-landed', batchIdx: 1, questions: [q('b')] });
    quizReducer(s0, {
      type: 'filler-landed',
      batchIdx: 1,
      questions: [q('c')],
    });
    expect(s0.queue).toHaveLength(1);
    expect([...landed]).toEqual([0]);
  });
});

describe('phaseOf', () => {
  it.each<[string, QuizState, string]>([
    ['no run yet', { ...initialQuizState }, 'booting'],
    ['an empty plan', state({ plan: [] }), 'empty'],
    [
      'starter on screen',
      state({ plan: [slot(2), slot(2)], queue: qs(2), landed: [0] }),
      'active',
    ],
    [
      'an empty starter, single batch',
      state({ plan: [slot(2)], landed: [0] }),
      'empty',
    ],
    [
      'an empty starter, more to come',
      state({ plan: [slot(2), slot(2)], landed: [0] }),
      'loading-first',
    ],
    [
      'every batch empty',
      state({ plan: [slot(2), slot(2)], landed: [0, 1] }),
      'empty',
    ],
    [
      'outran the prefetch',
      state({ plan: [slot(2), slot(2)], queue: qs(2), index: 2, landed: [0] }),
      'waiting-batch',
    ],
    [
      'filler bridged the gap',
      state({
        plan: [slot(2), slot(2)],
        queue: qs(3),
        index: 2,
        landed: [0],
        filledBatches: new Set([1]),
      }),
      'active',
    ],
    [
      'last question showing',
      state({ plan: [slot(2)], queue: qs(2), index: 1, landed: [0] }),
      'active',
    ],
    [
      'past the end, all landed',
      state({
        plan: [slot(2), slot(2)],
        queue: qs(2),
        index: 2,
        landed: [0, 1],
      }),
      'finished',
    ],
    // A trailing empty batch while the learner waits ends the session, not a blank card.
    [
      'waiting when the last batch lands empty',
      state({
        plan: [slot(4), slot(4), slot(2)],
        queue: qs(8),
        index: 8,
        landed: [0, 1, 2],
      }),
      'finished',
    ],
  ])('%s → %s', (_name, s, expected) => {
    expect(phaseOf(s)).toBe(expected);
  });
});

describe('totalOf', () => {
  it('is zero before a run', () => {
    expect(totalOf(initialQuizState)).toBe(0);
  });

  it('reports what was requested while batches are pending', () => {
    expect(
      totalOf(
        state({ plan: [slot(4), slot(4), slot(2)], queue: qs(4), landed: [0] }),
      ),
    ).toBe(10);
  });

  it('grows past the request when filler adds extra', () => {
    expect(
      totalOf(state({ plan: [slot(2), slot(2)], queue: qs(6), landed: [0] })),
    ).toBe(6);
  });

  it('is the served count once every batch has landed', () => {
    expect(
      totalOf(
        state({
          plan: [slot(4), slot(4), slot(2)],
          queue: qs(7),
          landed: [0, 1, 2],
        }),
      ),
    ).toBe(7);
  });
});

describe('nextFillIndex', () => {
  it('points at the first slot that has not landed', () => {
    expect(
      nextFillIndex(
        state({ plan: [slot(1), slot(1), slot(1)], landed: [0, 1] }),
      ),
    ).toBe(2);
  });
});

describe('planFor', () => {
  const topic = allQuizzableTopicIds()[0];

  it('chunks a per-topic session into batches of at most the AI batch size', () => {
    const plan = planFor(topic, 10, {}, true);
    expect(plan.map((p) => p.count)).toEqual([4, 4, 2]);
    expect(plan.every((p) => p.topicId === topic)).toBe(true);
    expect(Math.max(...plan.map((p) => p.count))).toBeLessThanOrEqual(
      GRAMMAR_BATCH_SIZE_MAX,
    );
  });

  it('clamps a per-topic session to the bank pool when AI is off', () => {
    const total = (p: QuizPlan[]) => p.reduce((n, x) => n + x.count, 0);
    expect(total(planFor(topic, 50, {}, false))).toBe(bankPoolSize(topic));
    expect(total(planFor(topic, 50, {}, true))).toBe(50);
  });

  it('starts a per-topic session at the topic’s own difficulty', () => {
    const fresh = planFor(topic, 4, {}, true);
    const strong = planFor(
      topic,
      4,
      { [topic]: { attempts: 20, correct: 19, streak: 5, lastSeen: 1 } },
      true,
    );
    expect(fresh[0].difficulty).toBe('easy');
    expect(strong[0].difficulty).toBe('hard');
  });

  it('plans an empty session for a topic with no bank items and no AI', () => {
    expect(planFor('no-such-topic', 10, {}, false)).toEqual([]);
  });

  it('plans a capped smart mix across several topics', () => {
    const plan = planFor(null, 10, {}, true);
    const total = plan.reduce((n, p) => n + p.count, 0);
    expect(total).toBeLessThanOrEqual(QUIZ_SESSION_SIZE);
    expect(new Set(plan.map((p) => p.topicId)).size).toBeGreaterThan(1);
  });
});
