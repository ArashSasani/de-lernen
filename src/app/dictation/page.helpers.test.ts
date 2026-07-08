import {
  buildDictationQueue,
  sessionStats,
  DICTATION_SESSION_SIZE,
} from './page.helpers';
import type { Word } from '@/types';
import type { DictationProgressMap } from '@/types/dictation';

function makeWords(n: number): Word[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `word${i}`,
    lemma: `Wort${i}lang`,
    article: null,
    plural: null,
    en: `word${i}`,
    pos: 'noun' as const,
    examples: [],
    sources: [],
  }));
}

describe('buildDictationQueue', () => {
  it('returns at most DICTATION_SESSION_SIZE words', () => {
    const words = makeWords(100);
    const q = buildDictationQueue({}, { words });
    expect(q.length).toBeLessThanOrEqual(DICTATION_SESSION_SIZE);
  });

  it('excludes comma-containing lemmas', () => {
    const words: Word[] = [
      {
        id: 'a',
        lemma: 'dein, deine',
        article: null,
        plural: null,
        en: 'your',
        pos: 'other',
        examples: [],
        sources: [],
      },
      {
        id: 'b',
        lemma: 'Tisch',
        article: 'der',
        plural: 'Tische',
        en: 'table',
        pos: 'noun',
        examples: [],
        sources: [],
      },
    ];
    const q = buildDictationQueue({}, { words });
    expect(q.some((w) => w.lemma.includes(','))).toBe(false);
    expect(q.some((w) => w.id === 'b')).toBe(true);
  });

  it('excludes words with target token <= 2 chars', () => {
    const words: Word[] = [
      {
        id: 'ab',
        lemma: 'ab',
        article: null,
        plural: null,
        en: 'from',
        pos: 'other',
        examples: [],
        sources: [],
      },
      {
        id: 'tisch',
        lemma: 'Tisch',
        article: 'der',
        plural: null,
        en: 'table',
        pos: 'noun',
        examples: [],
        sources: [],
      },
    ];
    const q = buildDictationQueue({}, { words });
    expect(q.some((w) => w.id === 'ab')).toBe(false);
    expect(q.some((w) => w.id === 'tisch')).toBe(true);
  });

  it('prioritizes never-seen words (tier 0) over seen', () => {
    const seen: DictationProgressMap = {
      word0: { attempts: 5, correct: 5, streak: 5, lastSeen: Date.now() },
    };
    const words = makeWords(2);
    const q = buildDictationQueue(seen, { words });
    // word1 is never-seen so should appear before word0
    expect(q[0].id).toBe('word1');
  });

  it('starredOnly returns only starred words', () => {
    const progress: DictationProgressMap = {
      word0: { attempts: 1, correct: 1, streak: 1, lastSeen: 1, starred: true },
      word1: { attempts: 1, correct: 0, streak: 0, lastSeen: 1 },
    };
    const words = makeWords(3);
    const q = buildDictationQueue(progress, { words, starredOnly: true });
    expect(q.every((w) => progress[w.id]?.starred === true)).toBe(true);
    expect(q.some((w) => w.id === 'word0')).toBe(true);
    expect(q.some((w) => w.id === 'word1')).toBe(false);
  });

  it('starredOnly returns empty array when no words are starred', () => {
    const words = makeWords(5);
    const q = buildDictationQueue({}, { words, starredOnly: true });
    expect(q).toHaveLength(0);
  });
});

describe('sessionStats', () => {
  it('calculates correct stats', () => {
    const s = sessionStats([true, true, false, true]);
    expect(s.total).toBe(4);
    expect(s.correct).toBe(3);
    expect(s.pct).toBe(75);
  });

  it('handles empty results', () => {
    const s = sessionStats([]);
    expect(s.total).toBe(0);
    expect(s.pct).toBe(0);
  });

  it('handles all correct', () => {
    expect(sessionStats([true, true, true]).pct).toBe(100);
  });

  it('handles all wrong', () => {
    expect(sessionStats([false, false]).pct).toBe(0);
  });
});
