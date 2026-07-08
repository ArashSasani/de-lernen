import type { Box } from '@/types';
import type { StatBar } from '@/types/stats';

const BOXES: Box[] = [1, 2, 3, 4, 5];

// Box counts → bar descriptors, scaling each bar against the fullest box.
export function statBars(counts: Record<Box, number>): StatBar[] {
  const max = Math.max(1, ...BOXES.map((b) => counts[b]));
  return BOXES.map((b) => {
    const n = counts[b];
    return { box: b, n, pct: Math.round((n / max) * 100) };
  });
}
