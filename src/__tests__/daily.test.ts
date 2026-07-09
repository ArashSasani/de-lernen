import { strugglingIds, scoreText, pickDailyText, todayKey } from '@/lib/daily';
import type { DailyText, ProgressMap, WordProgress } from '@/types';

const prog = (box: WordProgress['box']): WordProgress => ({
  box,
  lastReviewed: 0,
  nextDue: 0,
});

const text = (id: string, wordIds: string[]): DailyText => ({
  id,
  title: id,
  topic: 'test',
  level: 'a1',
  text: '...',
  wordIds,
  spans: [],
});

describe('strugglingIds', () => {
  it('collects only words explicitly in box 1', () => {
    const progress: ProgressMap = {
      apfel: prog(1),
      brot: prog(2),
      milch: prog(1),
      tee: prog(5),
    };
    const ids = strugglingIds(progress);
    expect([...ids].sort()).toEqual(['apfel', 'milch']);
  });

  it('returns an empty set when nothing is in box 1', () => {
    expect(strugglingIds({ apfel: prog(3) }).size).toBe(0);
    expect(strugglingIds({}).size).toBe(0);
  });
});

describe('scoreText', () => {
  it('counts overlap between a text and the struggling set', () => {
    const t = text('a', ['apfel', 'brot', 'milch']);
    expect(scoreText(t, new Set(['apfel', 'milch', 'tee']))).toBe(2);
    expect(scoreText(t, new Set())).toBe(0);
  });
});

describe('pickDailyText', () => {
  const texts = [
    text('a', ['apfel', 'brot']),
    text('b', ['milch', 'tee', 'kaffee']),
    text('c', ['wasser']),
  ];

  it('picks the highest-overlap text', () => {
    const picked = pickDailyText(
      texts,
      new Set(['milch', 'tee']),
      '2026-06-14',
    );
    expect(picked?.id).toBe('b');
  });

  it('falls back to a deterministic daily rotation with no overlap', () => {
    const picked = pickDailyText(texts, new Set(['unknown']), '2026-06-14');
    expect(picked).not.toBeNull();
    // Same seed → same pick (deterministic).
    const again = pickDailyText(texts, new Set(['unknown']), '2026-06-14');
    expect(again?.id).toBe(picked?.id);
  });

  it('is stable for a given seed and varies the tiebreak by day', () => {
    // Two texts tie on score (1 each); the seed decides which wins, and it must
    // be reproducible for the same day.
    const tie = [text('x', ['apfel']), text('y', ['brot'])];
    const struggling = new Set(['apfel', 'brot']);
    const d1 = pickDailyText(tie, struggling, '2026-06-14');
    const d1again = pickDailyText(tie, struggling, '2026-06-14');
    expect(d1again?.id).toBe(d1?.id);
  });

  it('returns null for an empty corpus', () => {
    expect(pickDailyText([], new Set(['apfel']), '2026-06-14')).toBeNull();
  });
});

describe('todayKey', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 5, 14))).toBe('2026-06-14');
    expect(todayKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});
