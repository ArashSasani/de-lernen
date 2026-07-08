import wordsData from '../../data/words.json';
import type { Word } from '@/types';

export const allWords: Word[] = wordsData as Word[];

export function wordById(id: string): Word | undefined {
  return allWords.find((w) => w.id === id);
}

export function filterWords(source?: string): Word[] {
  return allWords.filter((w) => {
    if (source && source !== 'all') {
      if (!w.sources.includes(source)) return false;
    }
    return true;
  });
}
