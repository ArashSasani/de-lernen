import { wordLevel, filterWords, allWords } from '@/lib/words';
import type { Word } from '@/types';

const word = (levels: Word['levels']): Word => ({
  id: 'x',
  lemma: 'x',
  article: null,
  plural: null,
  en: 'x',
  pos: 'other',
  examples: [],
  sources: [],
  levels,
});

describe('wordLevel', () => {
  it('returns the only level for a single-level word', () => {
    expect(wordLevel(word(['a2']))).toBe('a2');
  });

  it('returns the lowest level for a word reused across levels', () => {
    expect(wordLevel(word(['a1', 'a2']))).toBe('a1');
    expect(wordLevel(word(['a2', 'b1']))).toBe('a2');
  });
});

describe('filterWords level filtering', () => {
  it('matches words by their lowest level, not every level they appear at', () => {
    const a1a2 = allWords.find(
      (w) => w.levels.length > 1 && wordLevel(w) === 'a1',
    );
    if (a1a2) {
      expect(filterWords(undefined, 'a1')).toContain(a1a2);
      expect(filterWords(undefined, 'a2')).not.toContain(a1a2);
    }
  });
});
