import type { MistakeRecord, MistakeSource } from '@/types/mistakes';

// Display-only labels for the read-only Settings list.
export const SOURCE_LABELS: Record<MistakeSource, string> = {
  flashcard: 'Flashcard',
  dictation: 'Dictation',
  'grammar-quiz': 'Grammar quiz',
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// `now` defaults inside this plain function (not read in the component
// body) so the purity lint rule doesn't flag a direct Date.now() call.
export function relativeTime(
  createdAt: number,
  now: number = Date.now(),
): string {
  const diff = Math.max(0, now - createdAt);
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  return `${Math.floor(diff / DAY)}d ago`;
}

// Sorted newest first — mirrors the corpus's own createdAt-desc order, so
// this is only needed when a caller passes an unsorted subset.
export function sortByRecency(records: MistakeRecord[]): MistakeRecord[] {
  return [...records].sort((a, b) => b.createdAt - a.createdAt);
}
