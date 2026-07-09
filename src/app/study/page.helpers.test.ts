import { progressFor, shuffle, buildQueue, gradeWord } from './page.helpers';
import type { ProgressMap, Word, WordProgress } from '@/types';
import type { Filter } from '@/types/filter';

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const word = (id: string, pos: Word['pos']): Word => ({
  id,
  lemma: id,
  article: null,
  plural: null,
  en: id,
  pos,
  examples: [],
  sources: [],
  levels: ['a1'],
});

const prog = (box: WordProgress['box'], nextDue: number): WordProgress => ({
  box,
  lastReviewed: now,
  nextDue,
});

describe('progressFor', () => {
  it('returns the stored entry when present', () => {
    const p = prog(4, now);
    expect(progressFor({ a: p }, 'a')).toBe(p);
  });

  it('returns a fresh box-1 default for unseen words', () => {
    const d = progressFor({}, 'missing');
    expect(d.box).toBe(1);
    expect(d.nextDue).toBe(0);
  });
});

describe('shuffle', () => {
  it('preserves length and membership', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect(out).toHaveLength(5);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not mutate the input', () => {
    const input = [1, 2, 3];
    shuffle(input);
    expect(input).toEqual([1, 2, 3]);
  });
});

describe('buildQueue', () => {
  const words: Word[] = [
    word('noun1', 'noun'),
    word('verb1', 'verb'),
    word('adj1', 'adj'),
  ];

  it('filters by part of speech', () => {
    const filter: Filter = { box: 'all', pos: 'verb', level: 'all' };
    const q = buildQueue(filter, {}, words);
    expect(q.map((w) => w.id)).toEqual(['verb1']);
  });

  it('"due" returns only cards whose nextDue has passed', () => {
    const progress: ProgressMap = {
      noun1: prog(2, now - DAY), // due
      verb1: prog(2, now + DAY), // not due
      // adj1 has no entry → default (nextDue 0) → due
    };
    const filter: Filter = { box: 'due', pos: 'all', level: 'all' };
    const ids = buildQueue(filter, progress, words).map((w) => w.id);
    expect(ids).toContain('noun1');
    expect(ids).toContain('adj1');
    expect(ids).not.toContain('verb1');
  });

  it('a specific box filter matches only that box', () => {
    const progress: ProgressMap = {
      noun1: prog(3, now),
      verb1: prog(5, now),
    };
    const filter: Filter = { box: 3, pos: 'all', level: 'all' };
    expect(buildQueue(filter, progress, words).map((w) => w.id)).toEqual([
      'noun1',
    ]);
  });

  it('sorts due-first by nextDue ascending', () => {
    const progress: ProgressMap = {
      noun1: prog(1, now - 1 * DAY),
      verb1: prog(1, now - 3 * DAY),
      adj1: prog(1, now - 2 * DAY),
    };
    const filter: Filter = { box: 'all', pos: 'all', level: 'all' };
    expect(buildQueue(filter, progress, words).map((w) => w.id)).toEqual([
      'verb1',
      'adj1',
      'noun1',
    ]);
  });

  it('filters by level', () => {
    const leveled: Word[] = [
      { ...word('a1word', 'noun'), levels: ['a1'] },
      { ...word('a2word', 'noun'), levels: ['a2'] },
    ];
    const filter: Filter = { box: 'all', pos: 'all', level: 'a2' };
    expect(buildQueue(filter, {}, leveled).map((w) => w.id)).toEqual([
      'a2word',
    ]);
  });
});

describe('gradeWord', () => {
  it('miss sends any box back to 1', () => {
    expect(gradeWord(prog(4, now), 'miss').box).toBe(1);
  });

  it('good advances box by one', () => {
    expect(gradeWord(prog(2, now), 'good').box).toBe(3);
  });

  it('easy jumps to box 5', () => {
    expect(gradeWord(prog(1, now), 'easy').box).toBe(5);
  });

  it('good from box 1 advances to box 2', () => {
    expect(gradeWord(prog(1, now), 'good').box).toBe(2);
  });

  it('does not mutate the input', () => {
    const input = prog(2, now);
    gradeWord(input, 'good');
    expect(input.box).toBe(2);
  });
});
