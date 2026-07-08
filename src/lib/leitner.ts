import type { Box, WordProgress, ProgressMap } from '@/types';

export const INTERVALS: Record<Box, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 16,
  5: 30,
};

export const BOX_LABELS: Record<Box, string> = {
  1: 'every day',
  2: 'every other day',
  3: 'once a week',
  4: 'every other week',
  5: 'once a month',
};

export function defaultProgress(): WordProgress {
  return { box: 1, lastReviewed: 0, nextDue: 0 };
}

export function isDue(p: WordProgress, now = Date.now()): boolean {
  return p.nextDue <= now;
}

function scheduleFrom(box: Box, now: number): number {
  return now + INTERVALS[box] * 24 * 60 * 60 * 1000;
}

export function onGood(p: WordProgress, now = Date.now()): WordProgress {
  const box = Math.min(p.box + 1, 5) as Box;
  return { box, lastReviewed: now, nextDue: scheduleFrom(box, now) };
}

export function onMiss(p: WordProgress, now = Date.now()): WordProgress {
  return { box: 1, lastReviewed: now, nextDue: scheduleFrom(1, now) };
}

export function onEasy(p: WordProgress, now = Date.now()): WordProgress {
  return { box: 5, lastReviewed: now, nextDue: scheduleFrom(5, now) };
}

export function boxCounts(progress: ProgressMap): Record<Box, number> {
  const counts: Record<Box, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const p of Object.values(progress)) {
    counts[p.box] = (counts[p.box] ?? 0) + 1;
  }
  return counts;
}

export function dueCount(progress: ProgressMap, now = Date.now()): number {
  return Object.values(progress).filter((p) => isDue(p, now)).length;
}

export function nextDueLabel(progress: ProgressMap, now = Date.now()): string {
  const upcoming = Object.values(progress)
    .filter((p) => !isDue(p, now))
    .map((p) => p.nextDue);
  if (upcoming.length === 0) return 'None';
  const next = Math.min(...upcoming);
  const diffMs = next - now;
  const diffH = Math.round(diffMs / (1000 * 60 * 60));
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return `${diffD}d`;
}
