import {
  mergeDictation,
  mergeGrammarQuiz,
  mergeMistakes,
  mergeProgress,
  pickEntries,
  stripLocal,
} from '@/lib/merge';
import * as db from '@/lib/db';
import * as sync from '@/lib/sync';
import * as dictationSync from '@/lib/dictation-sync';
import * as grammarQuizSync from '@/lib/grammar-quiz-sync';
import * as mistakesSync from '@/lib/mistakes-sync';
import type { DictationWordProgress } from '@/types/dictation';
import type { MistakeRecord } from '@/types/mistakes';

jest.mock('@vercel/kv', () => ({ kv: { get: jest.fn(), set: jest.fn() } }));

// lib/merge.ts is the single definition both sides of the sync run. These
// pin that the server and client modules really do re-export it, and cover
// the bookmark clock the dictation merge gained.

describe('one merge, both sides', () => {
  it('server and client export the same function objects', () => {
    expect(db.mergeProgress).toBe(mergeProgress);
    expect(sync.mergeProgress).toBe(mergeProgress);
    expect(db.mergeDictation).toBe(mergeDictation);
    expect(dictationSync.mergeDictation).toBe(mergeDictation);
    expect(db.mergeGrammarQuiz).toBe(mergeGrammarQuiz);
    expect(grammarQuizSync.mergeGrammarQuiz).toBe(mergeGrammarQuiz);
    expect(mistakesSync.mergeMistakes).toBe(mergeMistakes);
  });

  it('every track picks its dirty subset with the same helper', () => {
    expect(sync.pickChanged).toBe(pickEntries);
    expect(dictationSync.pickDictationChanged).toBe(pickEntries);
    expect(grammarQuizSync.pickGrammarQuizChanged).toBe(pickEntries);
  });
});

const entry = (
  overrides: Partial<DictationWordProgress> = {},
): DictationWordProgress => ({
  attempts: 3,
  correct: 2,
  streak: 1,
  lastSeen: 1000,
  ...overrides,
});

describe('mergeDictation — bookmark clock', () => {
  it('propagates an un-star that is newer than the other device’s star', () => {
    const local = { w: entry({ starred: false, starredAt: 2000 }) };
    const remote = { w: entry({ starred: true, starredAt: 1500 }) };
    expect(mergeDictation(local, remote).w.starred).toBe(false);
  });

  it('keeps a remote star that is newer than the local un-star', () => {
    const local = { w: entry({ starred: false, starredAt: 1500 }) };
    const remote = { w: entry({ starred: true, starredAt: 2000 }) };
    expect(mergeDictation(local, remote).w).toMatchObject({
      starred: true,
      starredAt: 2000,
    });
  });

  it('merges the star independently of which side has the newer attempt', () => {
    // Remote practised later; local toggled the star later.
    const local = {
      w: entry({ lastSeen: 1000, starred: true, starredAt: 3000 }),
    };
    const remote = {
      w: entry({
        lastSeen: 5000,
        attempts: 9,
        starred: false,
        starredAt: 2000,
      }),
    };
    const merged = mergeDictation(local, remote).w;
    expect(merged.attempts).toBe(9);
    expect(merged.lastSeen).toBe(5000);
    expect(merged.starred).toBe(true);
  });

  it('prefers a timestamped star state over an untimestamped one', () => {
    const local = { w: entry({ starred: false, starredAt: 2000 }) };
    const remote = { w: entry({ starred: true }) };
    expect(mergeDictation(local, remote).w.starred).toBe(false);
  });

  it('OR-merges when neither side carries a clock, so no bookmark is lost', () => {
    const local = { w: entry({ starred: true }) };
    const remote = { w: entry() };
    expect(mergeDictation(local, remote).w.starred).toBe(true);
    expect(mergeDictation(remote, local).w.starred).toBe(true);
  });

  it('adds no star fields to an entry that was never starred', () => {
    const merged = mergeDictation({ w: entry() }, { w: entry() }).w;
    expect('starred' in merged).toBe(false);
    expect('starredAt' in merged).toBe(false);
  });

  it('keeps remote-only entries untouched', () => {
    const remote = { r: entry({ starred: true, starredAt: 1 }) };
    expect(mergeDictation({}, remote)).toEqual(remote);
  });
});

describe('mergeMistakes — per-side strip', () => {
  const rec = (id: string, createdAt: number): MistakeRecord => ({
    id,
    source: 'grammar-quiz',
    text: 'confused Akkusativ and Dativ after mit',
    createdAt,
    confidence: 0.9,
  });

  it('keeps confidence on the client, strips it on the server', () => {
    expect(mistakesSync.mergeMistakes([rec('a', 1)], [])[0].confidence).toBe(
      0.9,
    );
    expect('confidence' in db.mergeMistakes([rec('a', 1)], [])[0]).toBe(false);
  });

  it('stripLocal drops only local-only fields', () => {
    expect(stripLocal(rec('a', 1))).toEqual({
      id: 'a',
      source: 'grammar-quiz',
      text: 'confused Akkusativ and Dativ after mit',
      createdAt: 1,
    });
  });
});
