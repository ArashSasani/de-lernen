import { mergeProgress } from '@/lib/sync';

const t1 = 1700000001000;
const t2 = 1700000002000;

const entry = (box: 1 | 2 | 3 | 4 | 5, t: number) => ({
  box,
  lastReviewed: t,
  nextDue: t + 1,
});

describe('mergeProgress', () => {
  it('local entry wins when it has a newer lastReviewed', () => {
    const result = mergeProgress({ a: entry(2, t2) }, { a: entry(1, t1) });
    expect(result.a.box).toBe(2);
  });

  it('remote entry wins when it has a newer lastReviewed', () => {
    const result = mergeProgress({ a: entry(1, t1) }, { a: entry(3, t2) });
    expect(result.a.box).toBe(3);
  });

  it('remote entry wins on equal lastReviewed (strictly newer required)', () => {
    const result = mergeProgress({ a: entry(2, t1) }, { a: entry(1, t1) });
    expect(result.a.box).toBe(1);
  });

  it('includes local-only words', () => {
    const result = mergeProgress({ b: entry(2, t1) }, { a: entry(1, t1) });
    expect(result.a).toBeDefined();
    expect(result.b).toBeDefined();
  });

  it('includes remote-only words', () => {
    const result = mergeProgress({}, { c: entry(4, t1) });
    expect(result.c).toBeDefined();
  });

  it('does not clobber when both sides have distinct words', () => {
    const result = mergeProgress({ x: entry(1, t2) }, { y: entry(2, t1) });
    expect(result.x).toBeDefined();
    expect(result.y).toBeDefined();
  });

  it('returns empty object for two empty inputs', () => {
    expect(mergeProgress({}, {})).toEqual({});
  });
});
