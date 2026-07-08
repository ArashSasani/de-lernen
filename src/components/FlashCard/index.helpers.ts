import type { WordProgress, Box } from '@/types';
import type { Grade } from '@/types/grade';
import { onGood, onMiss, onEasy } from '@/lib/leitner';
export { ARTICLE_COLOR } from '@/constants';

// Plurals always take "die" in German, but use yellow to distinguish from
// feminine "die" (a common mnemonic in A1 teaching).
export const PLURAL_COLOR = 'text-yellow-400';

// Returns a Tailwind text-size class scaled to the displayed word length so
// long German compound words shrink to fit instead of overflowing the card.
export function lemmaFontSize(article: string | null, lemma: string): string {
  const len = (article ? article.length + 1 : 0) + lemma.length;
  return len > 20 ? 'text-xl' : 'text-4xl';
}

// The box each grade would move the card to, used to label the grade buttons.
export function resultBoxes(progress: WordProgress): Record<Grade, Box> {
  return {
    miss: onMiss(progress).box,
    good: onGood(progress).box,
    easy: onEasy(progress).box,
  };
}
