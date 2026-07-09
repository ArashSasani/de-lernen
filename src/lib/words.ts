import wordsData from '../../data/words.json';
import type { Word, Level } from '@/types';
import { LEVELS } from '@/constants';

export const allWords: Word[] = wordsData as Word[];

export function wordById(id: string): Word | undefined {
  return allWords.find((w) => w.id === id);
}

// A word first appearing at a1 and reused at a2 carries levels: ['a1', 'a2'];
// its "home" level for filtering purposes is the lowest one, so it shows up
// once (under a1) instead of duplicating across every level it's reused in.
export function wordLevel(word: Word): Level {
  return LEVELS.find((l) => word.levels.includes(l)) ?? word.levels[0];
}

export function filterWords(source?: string, level?: Level): Word[] {
  return allWords.filter((w) => {
    if (source && source !== 'all') {
      if (!w.sources.includes(source)) return false;
    }
    if (level && wordLevel(w) !== level) return false;
    return true;
  });
}
