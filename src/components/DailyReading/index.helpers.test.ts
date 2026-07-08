import { toSegments, glossFor, resolveHighlight } from './index.helpers';
import type { DailyTextSpan } from '@/types';

describe('toSegments', () => {
  it('splits a text into plain and highlighted segments', () => {
    const text = 'Ich kaufe Brot.';
    const spans: DailyTextSpan[] = [
      { start: 4, end: 9, wordId: 'kaufen' }, // "kaufe"
      { start: 10, end: 14, wordId: 'brot' }, // "Brot"
    ];
    expect(toSegments(text, spans)).toEqual([
      { text: 'Ich ' },
      { text: 'kaufe', wordId: 'kaufen' },
      { text: ' ' },
      { text: 'Brot', wordId: 'brot' },
      { text: '.' },
    ]);
  });

  it('reassembles to the original text', () => {
    const text = 'Heute ist es kalt und es regnet.';
    const spans: DailyTextSpan[] = [
      { start: 13, end: 17, wordId: 'kalt' },
      { start: 25, end: 31, wordId: 'regnen' },
    ];
    const joined = toSegments(text, spans)
      .map((s) => s.text)
      .join('');
    expect(joined).toBe(text);
  });

  it('handles a text with no spans as one plain segment', () => {
    expect(toSegments('Hallo', [])).toEqual([{ text: 'Hallo' }]);
  });

  it('sorts spans before segmenting', () => {
    const text = 'ab cd';
    const spans: DailyTextSpan[] = [
      { start: 3, end: 5, wordId: 'second' },
      { start: 0, end: 2, wordId: 'first' },
    ];
    expect(toSegments(text, spans)).toEqual([
      { text: 'ab', wordId: 'first' },
      { text: ' ' },
      { text: 'cd', wordId: 'second' },
    ]);
  });
});

describe('resolveHighlight', () => {
  const struggling = new Set(['kaufen', 'brot']);

  it('highlights everything as struggling when no strugglingIds provided', () => {
    expect(resolveHighlight('any-word')).toEqual({
      shouldHighlight: true,
      isStruggling: true,
    });
  });

  it('highlights and marks as struggling when word is in the set', () => {
    expect(resolveHighlight('kaufen', struggling)).toEqual({
      shouldHighlight: true,
      isStruggling: true,
    });
  });

  it('does not highlight non-struggling word when highlightAll is false', () => {
    expect(resolveHighlight('hund', struggling, false)).toEqual({
      shouldHighlight: false,
      isStruggling: false,
    });
  });

  it('highlights non-struggling word as slate when highlightAll is true', () => {
    expect(resolveHighlight('hund', struggling, true)).toEqual({
      shouldHighlight: true,
      isStruggling: false,
    });
  });

  it('highlights struggling word as indigo even when highlightAll is true', () => {
    expect(resolveHighlight('kaufen', struggling, true)).toEqual({
      shouldHighlight: true,
      isStruggling: true,
    });
  });
});

describe('glossFor', () => {
  it('returns lemma, article and English for a real word id', () => {
    const g = glossFor('apfel');
    expect(g).toBeDefined();
    expect(g?.lemma).toBe('Apfel');
    expect(g?.article).toBe('der');
    expect(typeof g?.en).toBe('string');
  });

  it('returns undefined for an unknown id', () => {
    expect(glossFor('not-a-real-id')).toBeUndefined();
  });
});
