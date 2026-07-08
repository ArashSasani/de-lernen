import { statBars } from './index.helpers';
import type { Box } from '@/types';

const counts = (c: Partial<Record<Box, number>>): Record<Box, number> => ({
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
  ...c,
});

describe('statBars', () => {
  it('returns one bar per box in order', () => {
    const bars = statBars(counts({}));
    expect(bars.map((b) => b.box)).toEqual([1, 2, 3, 4, 5]);
  });

  it('scales pct against the fullest box', () => {
    const bars = statBars(counts({ 1: 10, 2: 5 }));
    expect(bars[0].pct).toBe(100); // box 1 is the max
    expect(bars[1].pct).toBe(50); // box 2 is half of the max
    expect(bars[4].pct).toBe(0); // empty box
  });

  it('avoids divide-by-zero when all boxes are empty', () => {
    const bars = statBars(counts({}));
    expect(bars.every((b) => b.pct === 0)).toBe(true);
  });

  it('passes the raw count through unchanged', () => {
    const bars = statBars(counts({ 3: 7 }));
    expect(bars[2].n).toBe(7);
  });
});
