import { mergeMistakes } from '@/lib/mistakes-sync';
import { MISTAKES_MAX_CORPUS } from '@/constants';
import type { MistakeRecord } from '@/types/mistakes';

const record = (
  id: string,
  createdAt: number,
  overrides: Partial<MistakeRecord> = {},
): MistakeRecord => ({
  id,
  source: 'grammar-quiz',
  text: `note ${id}`,
  createdAt,
  ...overrides,
});

describe('mergeMistakes', () => {
  it('unions disjoint local and remote records', () => {
    const merged = mergeMistakes([record('a', 1)], [record('b', 2)]);
    expect(merged.map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  it('is a first-write-wins union on id collision — remote wins (records are immutable)', () => {
    const local = [record('a', 1, { text: 'local version' })];
    const remote = [record('a', 1, { text: 'remote version' })];
    const merged = mergeMistakes(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe('remote version');
  });

  it('sorts newest first', () => {
    const merged = mergeMistakes(
      [record('old', 100)],
      [record('new', 200), record('mid', 150)],
    );
    expect(merged.map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });

  it('caps the corpus, dropping the oldest', () => {
    const many = Array.from({ length: MISTAKES_MAX_CORPUS + 1 }, (_, i) =>
      record(`r${i}`, i),
    );
    const merged = mergeMistakes([], many);
    expect(merged).toHaveLength(MISTAKES_MAX_CORPUS);
    // r0 has the smallest createdAt, so it's the oldest and gets dropped.
    expect(merged.find((r) => r.id === 'r0')).toBeUndefined();
    expect(
      merged.find((r) => r.id === `r${MISTAKES_MAX_CORPUS}`),
    ).toBeDefined();
  });

  it('returns an empty array for two empty inputs', () => {
    expect(mergeMistakes([], [])).toEqual([]);
  });

  it('includes local-only and remote-only records together', () => {
    const merged = mergeMistakes(
      [record('local-only', 1)],
      [record('remote-only', 2)],
    );
    expect(merged).toHaveLength(2);
  });
});
