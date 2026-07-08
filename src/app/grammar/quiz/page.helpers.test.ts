import { sessionStats, buildTopicQuiz, buildSmartQuiz, QUIZ_SESSION_SIZE } from './page.helpers';

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

describe('buildTopicQuiz', () => {
  it('returns questions for a known topic', () => {
    const qs = buildTopicQuiz('sein-praesens');
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.length).toBeLessThanOrEqual(10);
  });

  it('sets topicId on all returned questions', () => {
    const qs = buildTopicQuiz('haben-praesens');
    for (const q of qs) {
      expect(q.topicId).toBe('haben-praesens');
    }
  });

  it('each question has choices and a valid correctIndex', () => {
    const qs = buildTopicQuiz('praesens-regelmaessig');
    for (const q of qs) {
      expect(q.choices.length).toBeGreaterThanOrEqual(3);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.choices.length);
    }
  });

  it('returns empty array for unknown topic', () => {
    expect(buildTopicQuiz('does-not-exist')).toHaveLength(0);
  });
});

describe('buildSmartQuiz', () => {
  it('returns a non-empty quiz with empty progress', () => {
    const qs = buildSmartQuiz({});
    expect(qs.length).toBeGreaterThan(0);
  });

  it('respects the session size cap', () => {
    const qs = buildSmartQuiz({});
    expect(qs.length).toBeLessThanOrEqual(QUIZ_SESSION_SIZE);
  });

  it('each question has valid structure', () => {
    const qs = buildSmartQuiz({});
    for (const q of qs) {
      expect(typeof q.topicId).toBe('string');
      expect(typeof q.prompt).toBe('string');
      expect(Array.isArray(q.choices)).toBe(true);
      expect(q.choices.length).toBeGreaterThanOrEqual(3);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.choices.length);
    }
  });

  it('prioritises topics with low accuracy over never-seen topics', () => {
    const progress = {
      'sein-praesens': { attempts: 5, correct: 1, streak: 0, lastSeen: Date.now() - 1000 },
    };
    const qs = buildSmartQuiz(progress);
    // The low-accuracy topic should appear in the quiz
    const topicIds = qs.map((q) => q.topicId);
    expect(topicIds).toContain('sein-praesens');
  });
});
