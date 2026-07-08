import type { Word } from '@/types';

export { ARTICLE_COLOR } from '@/constants';

export function checkAnswer(input: string, expected: string): boolean {
  return input.trim().toLowerCase() === expected.toLowerCase();
}

export function fullDisplay(word: Word): string {
  return word.article ? `${word.article} ${word.lemma}` : word.lemma;
}

export function gapInputWidth(gapLength: number): string {
  return `${Math.max(gapLength + 1, 3)}ch`;
}
