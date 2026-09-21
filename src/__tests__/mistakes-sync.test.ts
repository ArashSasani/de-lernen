import { pickNewMistakes, pickUnpushed, stripLocal } from '@/lib/mistakes-sync';
import type { MistakeCorpus, MistakeRecord } from '@/types/mistakes';

const record = (
  id: string,
  overrides: Partial<MistakeRecord> = {},
): MistakeRecord => ({
  id,
  source: 'grammar-quiz',
  text: `note ${id}`,
  createdAt: 1700000000000,
  ...overrides,
});

describe('pickNewMistakes', () => {
  it('returns only the requested ids', () => {
    const corpus: MistakeCorpus = [record('a'), record('b'), record('c')];
    expect(pickNewMistakes(corpus, ['a', 'c'])).toEqual([corpus[0], corpus[2]]);
  });

  it('skips ids with no matching record', () => {
    const corpus: MistakeCorpus = [record('a')];
    expect(pickNewMistakes(corpus, ['a', 'missing'])).toEqual([corpus[0]]);
  });

  it('returns an empty array for no ids', () => {
    expect(pickNewMistakes([record('a')], [])).toEqual([]);
  });

  // Same rationale as pickChanged in lib/sync.ts: the keepalive PUT body must
  // stay under the Fetch spec's 64KB cap regardless of corpus size, since
  // only newly-inserted ids are ever pushed.
  it('keeps the flush payload far under the 64KB keepalive limit', () => {
    const corpus: MistakeCorpus = Array.from({ length: 500 }, (_, i) =>
      record(`r${i}`),
    );
    expect(JSON.stringify(corpus).length).toBeGreaterThan(1024);

    const justInserted = ['r10', 'r20', 'r30'];
    const payload = pickNewMistakes(corpus, justInserted);
    expect(JSON.stringify(payload).length).toBeLessThan(1024);
  });
});

// A full sync must PUT only the delta: the route caps the body at
// MISTAKES_MAX_CORPUS, and pushing an already-synced corpus is pure waste.
describe('pickUnpushed', () => {
  it('returns only the records the server is missing', () => {
    const merged: MistakeCorpus = [record('a'), record('b'), record('c')];
    const remote: MistakeCorpus = [record('a'), record('c')];
    expect(pickUnpushed(merged, remote)).toEqual([merged[1]]);
  });

  it('returns nothing when the server already has everything', () => {
    const merged: MistakeCorpus = [record('a')];
    expect(pickUnpushed(merged, [record('a')])).toEqual([]);
  });

  it('returns the whole corpus against an empty remote', () => {
    const merged: MistakeCorpus = [record('a'), record('b')];
    expect(pickUnpushed(merged, [])).toEqual(merged);
  });
});

describe('stripLocal', () => {
  it('drops embedding/confidence/seenCount/lastSeen before PUT', () => {
    const full = record('a', {
      confidence: 0.9,
      seenCount: 2,
      lastSeen: 1700000001000,
      embedding: [0.1, 0.2, 0.3],
    });
    const stripped = stripLocal(full);
    expect(stripped).toEqual({
      id: 'a',
      source: 'grammar-quiz',
      text: 'note a',
      createdAt: 1700000000000,
    });
  });

  it('is a no-op on a record with no local-only fields', () => {
    const clean = record('a');
    expect(stripLocal(clean)).toEqual(clean);
  });
});
