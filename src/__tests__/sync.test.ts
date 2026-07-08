import { pickChanged, mergeProgress } from '@/lib/sync';
import type { ProgressMap, WordProgress } from '@/types';

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const prog = (box: WordProgress['box'], nextDue: number): WordProgress => ({
  box,
  lastReviewed: now,
  nextDue,
});

describe('pickChanged', () => {
  it('returns only the requested ids', () => {
    const full: ProgressMap = {
      a: prog(2, now),
      b: prog(3, now),
      c: prog(4, now),
    };
    expect(pickChanged(full, ['a', 'c'])).toEqual({ a: full.a, c: full.c });
  });

  it('skips ids with no entry', () => {
    const full: ProgressMap = { a: prog(2, now) };
    expect(pickChanged(full, ['a', 'missing'])).toEqual({ a: full.a });
  });

  it('returns an empty map for no ids', () => {
    expect(pickChanged({ a: prog(2, now) }, [])).toEqual({});
  });

  // The bug this fixes: a full ~1300-word map is ~93KB, over the 64KB cap on
  // `keepalive` fetch bodies, so the on-hide flush silently rejected and graded
  // cards reverted to box 1. The changed-only payload must stay tiny regardless
  // of how many words have been graded.
  it('keeps the flush payload far under the 64KB keepalive limit', () => {
    const full: ProgressMap = {};
    for (let i = 0; i < 1300; i++) {
      full[`word-number-${i}`] = prog(3, now);
    }
    expect(JSON.stringify(full).length).toBeGreaterThan(64 * 1024); // full map would reject

    // A realistic flush carries only the handful graded since the last push.
    const justGraded = ['word-number-10', 'word-number-20', 'word-number-30'];
    const payload = pickChanged(full, justGraded);
    expect(JSON.stringify(payload).length).toBeLessThan(1024);
  });

  // A partial push is still correct: the server merges it onto the full KV map,
  // so unsent words survive and the graded word is applied (newest-wins).
  it('a partial push merges onto the full remote map without dropping words', () => {
    const stale = (box: WordProgress['box']): WordProgress => ({
      box,
      lastReviewed: now - DAY,
      nextDue: now,
    });
    const remoteKV: ProgressMap = { a: stale(1), b: stale(1), c: stale(1) };
    // Locally we advanced only `b` to box 3 just now (newer lastReviewed).
    const local: ProgressMap = {
      ...remoteKV,
      b: { box: 3, lastReviewed: now, nextDue: now + 7 * DAY },
    };
    const payload = pickChanged(local, ['b']);

    const merged = mergeProgress(payload, remoteKV); // server-side merge
    expect(merged.a.box).toBe(1); // untouched word preserved
    expect(merged.c.box).toBe(1); // untouched word preserved
    expect(merged.b.box).toBe(3); // graded word applied
  });
});
