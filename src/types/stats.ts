import type { Box } from '@/types';

export interface StatBar {
  box: Box;
  n: number;
  pct: number; // bar height as a percentage of the tallest box
}
