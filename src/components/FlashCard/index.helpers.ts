import type { WordProgress, Box } from '@/types';
import type { Grade } from '@/types/grade';
import { onGood, onMiss, onEasy } from '@/lib/leitner';
export { ARTICLE_COLOR } from '@/constants';

// Plurals always take "die" in German, but use yellow to distinguish from
// feminine "die" (a common mnemonic in A1 teaching).
export const PLURAL_COLOR = 'text-yellow-400';

// Returns a Tailwind text-size class scaled to the displayed word length so
// long German compound words shrink to fit instead of overflowing the card.
// Three tiers keep the card readable across the full range of A1–B1 vocabulary:
//   ≤14 chars → text-4xl, 15–20 chars → text-2xl, >20 chars → text-xl
export function lemmaFontSize(article: string | null, lemma: string): string {
  const len = (article ? article.length + 1 : 0) + lemma.length;
  if (len > 20) return 'text-xl';
  if (len > 14) return 'text-2xl';
  return 'text-4xl';
}

// The box each grade would move the card to, used to label the grade buttons.
export function resultBoxes(progress: WordProgress): Record<Grade, Box> {
  return {
    miss: onMiss(progress).box,
    good: onGood(progress).box,
    easy: onEasy(progress).box,
  };
}
