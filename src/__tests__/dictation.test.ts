import { generateGap } from '@/lib/dictation';
import type { Word } from '@/types';

function w(lemma: string): Word {
  return {
    id: lemma.toLowerCase(),
    lemma,
    article: null,
    plural: null,
    en: '',
    pos: 'noun',
    examples: [],
    sources: [],
  };
}

describe('generateGap', () => {
  it('gaps umlaut (rule 1)', () => {
    const g = generateGap(w('Mädchen'));
    expect(g.gap).toBe('ä');
    expect(g.hintType).toBe('umlaut');
    expect(g.before + g.gap + g.after).toBe('Mädchen');
  });

  it('gaps ß (rule 2)', () => {
    const g = generateGap(w('Fuß'));
    expect(g.gap).toBe('ß');
    expect(g.hintType).toBe('eszett');
  });

  it('gaps ie (rule 3)', () => {
    const g = generateGap(w('Brief'));
    expect(g.gap).toBe('ie');
    expect(g.hintType).toBe('ie/ei');
  });

  it('gaps ei (rule 4)', () => {
    // "heißen" has ß (rule 2), not useful; "Wein" has only "ei" — no ie, no umlaut, no ß
    const g = generateGap(w('Wein'));
    expect(g.gap).toBe('ei');
    expect(g.hintType).toBe('ie/ei');
    expect(g.before + g.gap + g.after).toBe('Wein');
  });

  it('umlaut takes priority over ei', () => {
    const g = generateGap(w('Häuser'));
    expect(g.hintType).toBe('umlaut');
    expect(g.gap).toBe('ä');
  });

  it('gaps silent-h (rule 5)', () => {
    const g = generateGap(w('Bahn'));
    expect(g.gap).toBe('ah');
    expect(g.hintType).toBe('silent-h');
  });

  it('gaps sch (rule 6)', () => {
    const g = generateGap(w('Deutsch'));
    expect(g.hintType).toBe('sch');
    expect(g.gap).toBe('sch');
  });

  it('gaps ch (rule 7)', () => {
    const g = generateGap(w('auch'));
    expect(g.gap).toBe('ch');
    expect(g.hintType).toBe('ch');
  });

  it('sch takes priority over ch', () => {
    const g = generateGap(w('Schule'));
    expect(g.hintType).toBe('sch');
  });

  it('gaps tz (rule 8)', () => {
    const g = generateGap(w('Katze'));
    expect(g.gap).toBe('tz');
    expect(g.hintType).toBe('tz');
  });

  it('gaps ck (rule 9)', () => {
    const g = generateGap(w('backen'));
    expect(g.gap).toBe('ck');
    expect(g.hintType).toBe('ck');
  });

  it('gaps double consonant (rule 10)', () => {
    const g = generateGap(w('alle'));
    expect(g.gap).toBe('ll');
    expect(g.hintType).toBe('double');
  });

  it('gaps z (rule 11)', () => {
    // "Zug" has no umlaut/ß/ie/ei/silent-h/sch/ch/tz/ck/double — z fires
    const g = generateGap(w('Zug'));
    expect(g.gap.toLowerCase()).toBe('z');
    expect(g.hintType).toBe('z');
    expect(g.before + g.gap + g.after).toBe('Zug');
  });

  it('falls back to vowel cluster (rule 12)', () => {
    const g = generateGap(w('Hund'));
    expect(g.hintType).toBe('vowel');
    expect(g.gap).toBe('u');
  });

  it('reassembles correctly: before + gap + after === target token', () => {
    const words = [
      'Mädchen',
      'Brief',
      'Fuß',
      'Schule',
      'backen',
      'alle',
      'Hund',
    ];
    for (const lemma of words) {
      const g = generateGap(w(lemma));
      expect(g.before + g.gap + g.after).toBe(lemma);
      expect(g.fullLemma).toBe(lemma);
    }
  });

  it('handles multi-word lemma: gaps the longest token', () => {
    const g = generateGap(w('zu Hause'));
    // "Hause" is longer; "au" is a vowel cluster (no higher rule matches)
    expect(g.before + g.gap + g.after).toBe('zu Hause');
    expect(g.fullLemma).toBe('zu Hause');
  });

  it('handles separable prefix verb: strips prefix, applies rule to stem', () => {
    const g = generateGap(w('aufstehen'));
    // stem "stehen": "eh" is followed by another vowel "e" so silent-h lookahead fails;
    // falls back to vowel "e". Reassembly must still equal the original lemma.
    expect(g.before + g.gap + g.after).toBe('aufstehen');
  });

  it('handles separable prefix verb: abfahren', () => {
    const g = generateGap(w('abfahren'));
    // stem "fahren" has silent-h: "ah"
    expect(g.hintType).toBe('silent-h');
    expect(g.before + g.gap + g.after).toBe('abfahren');
  });

  it('handles very short word (2 chars)', () => {
    const g = generateGap(w('ab'));
    expect(g.before + g.gap + g.after).toBe('ab');
  });

  it('handles short word with no vowel cluster edge case', () => {
    const g = generateGap(w('ich'));
    expect(g.before + g.gap + g.after).toBe('ich');
  });

  it('fullLemma is always the original lemma unchanged', () => {
    const g = generateGap(w('Kühlschrank'));
    expect(g.fullLemma).toBe('Kühlschrank');
  });
});
