import { resultBoxes, ARTICLE_COLOR, lemmaFontSize } from './index.helpers';
import type { WordProgress } from '@/types';

const at = (box: WordProgress['box']): WordProgress => ({
  box,
  lastReviewed: 0,
  nextDue: 0,
});

describe('resultBoxes', () => {
  it('miss always returns box 1', () => {
    expect(resultBoxes(at(1)).miss).toBe(1);
    expect(resultBoxes(at(5)).miss).toBe(1);
  });

  it('good advances one box, capped at 5', () => {
    expect(resultBoxes(at(1)).good).toBe(2);
    expect(resultBoxes(at(4)).good).toBe(5);
    expect(resultBoxes(at(5)).good).toBe(5);
  });

  it('easy always jumps to box 5', () => {
    expect(resultBoxes(at(1)).easy).toBe(5);
    expect(resultBoxes(at(3)).easy).toBe(5);
  });
});

describe('ARTICLE_COLOR', () => {
  it('maps each article to a colour class', () => {
    expect(ARTICLE_COLOR.der).toContain('text-');
    expect(ARTICLE_COLOR.die).toContain('text-');
    expect(ARTICLE_COLOR.das).toContain('text-');
  });
});

describe('lemmaFontSize', () => {
  it('returns text-4xl for words up to 14 chars', () => {
    expect(lemmaFontSize(null, 'Hund')).toBe('text-4xl'); // 4 chars
    expect(lemmaFontSize('der', 'Hund')).toBe('text-4xl'); // 8 chars
    expect(lemmaFontSize('der', 'Abend')).toBe('text-4xl'); // 9 chars
  });

  it('returns text-2xl for words 15–20 chars', () => {
    expect(lemmaFontSize('der', 'Zusammenhang')).toBe('text-2xl'); // 16 chars
    expect(lemmaFontSize(null, 'Verantwortlichkeit')).toBe('text-2xl'); // 18 chars
    expect(lemmaFontSize(null, 'Zahlungsempfänger/in')).toBe('text-2xl'); // 20 chars
  });

  it('returns text-xl for words over 20 chars', () => {
    expect(lemmaFontSize('der', 'Schienenersatzverkehr')).toBe('text-xl'); // 25 chars
    expect(lemmaFontSize(null, 'Aufmerksamkeitsdefizit')).toBe('text-xl'); // 22 chars
  });
});
