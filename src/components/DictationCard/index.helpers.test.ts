import { checkAnswer, fullDisplay, gapInputWidth } from './index.helpers';
import type { Word } from '@/types';

function w(overrides: Partial<Word> = {}): Word {
  return {
    id: 'test',
    lemma: 'Test',
    article: null,
    plural: null,
    en: 'test',
    pos: 'noun',
    examples: [],
    sources: [],
    ...overrides,
  };
}

describe('checkAnswer', () => {
  it('accepts exact match', () => {
    expect(checkAnswer('ä', 'ä')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(checkAnswer('A', 'a')).toBe(true);
    expect(checkAnswer('ä', 'Ä')).toBe(true);
  });

  it('trims whitespace', () => {
    expect(checkAnswer('  ie ', 'ie')).toBe(true);
  });

  it('rejects wrong answer', () => {
    expect(checkAnswer('a', 'ä')).toBe(false);
    expect(checkAnswer('ss', 'ß')).toBe(false);
  });

  it('rejects empty input', () => {
    expect(checkAnswer('', 'ie')).toBe(false);
  });
});

describe('fullDisplay', () => {
  it('includes article when present', () => {
    expect(fullDisplay(w({ article: 'der', lemma: 'Tisch' }))).toBe('der Tisch');
    expect(fullDisplay(w({ article: 'die', lemma: 'Frau' }))).toBe('die Frau');
    expect(fullDisplay(w({ article: 'das', lemma: 'Kind' }))).toBe('das Kind');
  });

  it('omits article when null', () => {
    expect(fullDisplay(w({ article: null, lemma: 'gehen' }))).toBe('gehen');
  });
});

describe('gapInputWidth', () => {
  it('is at least 3ch', () => {
    expect(gapInputWidth(1)).toBe('3ch');
  });

  it('adds 1ch buffer', () => {
    expect(gapInputWidth(2)).toBe('3ch');
    expect(gapInputWidth(3)).toBe('4ch');
    expect(gapInputWidth(4)).toBe('5ch');
  });
});
