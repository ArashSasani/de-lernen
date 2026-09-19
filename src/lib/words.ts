import wordsData from '../../data/words.json';
import type { Word, Level } from '@/types';
import { LEVELS } from '@/constants';

export const allWords: Word[] = wordsData as Word[];

// O(1) lookup — WordPopover calls this per highlighted span per render, and
// an O(n) `.find()` over 2,500+ words adds up fast on a text with many spans.
const WORDS_BY_ID = new Map(allWords.map((w) => [w.id, w]));

export function wordById(id: string): Word | undefined {
  return WORDS_BY_ID.get(id);
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
