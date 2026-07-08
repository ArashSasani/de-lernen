import type { Box, ProgressMap, Word, WordProgress } from '@/types';
import type { Filter } from '@/types/filter';
import type { Grade } from '@/types/grade';
import { defaultProgress, isDue, onGood, onMiss, onEasy } from '@/lib/leitner';
import { filterWords } from '@/lib/words';
import { shuffle } from '@/lib/shuffle';
import { GRADE, FILTER } from '@/constants';

// Progress for a word, falling back to a fresh box-1 default for never-seen words.
export function progressFor(progress: ProgressMap, id: string): WordProgress {
  return progress[id] ?? defaultProgress();
}

export { shuffle };

// Map a grade to the Leitner transition for a single word. The map-level update
// (spread + dirty tracking) lives in useProgressSync; this stays pure.
export function gradeWord(prev: WordProgress, grade: Grade): WordProgress {
  return grade === GRADE.MISS
    ? onMiss(prev)
    : grade === GRADE.GOOD
      ? onGood(prev)
      : onEasy(prev);
}

// Build the study queue: filter by pos + box, shuffle, then sort due-first
// (nextDue asc, then box asc). `words` is injectable for testing.
export function buildQueue(
  filter: Filter,
  progress: ProgressMap,
  words: Word[] = filterWords(),
): Word[] {
  const base = words.filter(
    (w) => filter.pos === FILTER.ALL || w.pos === filter.pos,
  );

  const withProgress = base.map((w) => ({ w, p: progressFor(progress, w.id) }));

  const matched = withProgress.filter(({ p }) => {
    if (filter.box === FILTER.DUE) return isDue(p);
    if (filter.box === FILTER.ALL) return true;
    return p.box === filter.box;
  });

  const shuffled = shuffle(matched);
  shuffled.sort((a, b) => a.p.nextDue - b.p.nextDue || a.p.box - b.p.box);
  return shuffled.map(({ w }) => w);
}

// Count how many cards remain per box in the slice of the queue starting at `fromIndex`.
export function queueBoxCounts(
  queue: Word[],
  fromIndex: number,
  progress: ProgressMap,
): Record<Box, number> {
  const counts: Record<Box, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const w of queue.slice(fromIndex)) {
    const box = progressFor(progress, w.id).box;
    counts[box]++;
  }
  return counts;
}
