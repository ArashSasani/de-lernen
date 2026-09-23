import {
  sessionStats,
  selectQuizTopics,
  tier,
  difficultyFor,
  QUIZ_SESSION_SIZE,
} from './page.helpers';
import { allQuizzableTopicIds } from '@/lib/grammar-quiz';

describe('sessionStats', () => {
  it('returns zeros for empty results', () => {
    expect(sessionStats([])).toEqual({ total: 0, correct: 0, pct: 0 });
  });

  it('computes correct count and percentage', () => {
    expect(sessionStats([true, false, true, true])).toEqual({
      total: 4,
      correct: 3,
      pct: 75,
    });
  });

  it('rounds percentage', () => {
    expect(sessionStats([true, false, false])).toEqual({
      total: 3,
      correct: 1,
      pct: 33,
    });
  });

  it('returns 100% for all correct', () => {
    expect(sessionStats([true, true, true])).toEqual({
      total: 3,
      correct: 3,
      pct: 100,
    });
  });
});

describe('tier', () => {
  const now = Date.now();

  it('ranks struggling (attempts>=2, accuracy<0.7) as tier 0', () => {
    expect(tier({ attempts: 4, correct: 1, lastSeen: now }, now)).toBe(0);
  });

  it('ranks never-seen as tier 1', () => {
    expect(tier({ attempts: 0, correct: 0, lastSeen: 0 }, now)).toBe(1);
  });

  it('ranks stale (>3 days) as tier 2', () => {
    const lastSeen = now - 4 * 24 * 60 * 60 * 1000;
    expect(tier({ attempts: 3, correct: 3, lastSeen }, now)).toBe(2);
  });

  it('ranks everything else as tier 3', () => {
    expect(tier({ attempts: 3, correct: 3, lastSeen: now }, now)).toBe(3);
  });
});

describe('difficultyFor', () => {
  it('returns easy for a never-attempted topic', () => {
    expect(
      difficultyFor({ attempts: 0, correct: 0, streak: 0, lastSeen: 0 }),
    ).toBe('easy');
  });

  it('holds medium for a struggling topic rather than dropping to easy', () => {
    expect(
      difficultyFor({ attempts: 4, correct: 1, streak: 0, lastSeen: 0 }),
    ).toBe('medium');
  });

  it('returns hard for a well-performing topic with a strong recent run', () => {
    expect(
      difficultyFor({ attempts: 10, correct: 9, streak: 5, lastSeen: 0 }, [
        true,
        true,
        true,
      ]),
    ).toBe('hard');
  });

  it('does not jump to hard on a weak recent run despite good history', () => {
    expect(
      difficultyFor({ attempts: 10, correct: 9, streak: 0, lastSeen: 0 }, [
        false,
        false,
        true,
      ]),
    ).toBe('medium');
  });
});

describe('selectQuizTopics', () => {
  it('places a struggling topic ahead of a never-seen one', () => {
    const now = Date.now();
    const topicIds = allQuizzableTopicIds();
    const strugglingId = topicIds[0];
    const progress = {
      [strugglingId]: { attempts: 4, correct: 1, streak: 0, lastSeen: now },
    };
    const plan = selectQuizTopics(progress, {
      now,
      order: (ids) => [...ids],
    });
    const strugglingIndex = plan.findIndex((p) => p.topicId === strugglingId);
    expect(strugglingIndex).toBe(0);
    expect(plan[0].tier).toBe(0);
  });

  it('keeps never-seen topics in shuffle (injected order) order, untouched by the accuracy tiebreak', () => {
    const now = Date.now();
    const topicIds = allQuizzableTopicIds().slice(0, 6);
    const identityOrder = (ids: string[]) => [...ids];
    const plan = selectQuizTopics({}, { now, order: identityOrder });
    const planIds = plan.map((p) => p.topicId);
    expect(planIds.slice(0, topicIds.length)).toEqual(
      topicIds.slice(0, planIds.length),
    );
  });

  it('never exceeds QUIZ_SESSION_SIZE total count', () => {
    const plan = selectQuizTopics({});
    const total = plan.reduce((sum, p) => sum + p.count, 0);
    expect(total).toBeLessThanOrEqual(QUIZ_SESSION_SIZE);
  });
});
