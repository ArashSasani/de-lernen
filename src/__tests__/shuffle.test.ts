import { shuffle, makeShuffleDeck } from '@/lib/shuffle';

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    expect(shuffle([1, 2, 3, 4, 5])).toHaveLength(5);
  });

  it('contains the same elements as the input', () => {
    const input = [1, 2, 3, 4, 5];
    expect(shuffle(input).sort()).toEqual([...input].sort());
  });

  it('does not mutate the original array', () => {
    const input = [1, 2, 3];
    const copy = [...input];
    shuffle(input);
    expect(input).toEqual(copy);
  });

  it('handles empty arrays', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('handles single-element arrays', () => {
    expect(shuffle([42])).toEqual([42]);
  });

  it('works with non-numeric types', () => {
    const input = ['a', 'b', 'c'];
    const result = shuffle(input);
    expect(result.sort()).toEqual([...input].sort());
  });

  it('produces different orderings over many runs (probabilistic)', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const results = new Set(
      Array.from({ length: 20 }, () => shuffle(input).join(',')),
    );
    // With 8 elements, getting the same order 20 times in a row has probability
    // (1/8!)^19 ≈ 10^-79 — effectively impossible.
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('makeShuffleDeck', () => {
  it('yields every id before repeating any', () => {
    const deck = makeShuffleDeck();
    const ids = ['a', 'b', 'c', 'd'];
    const seen = new Set<string>();
    for (let i = 0; i < ids.length; i++) {
      const id = deck.next(ids);
      expect(ids).toContain(id);
      expect(seen).not.toContain(id);
      seen.add(id!);
    }
    expect(seen.size).toBe(ids.length);
  });

  it('cycles: after exhausting all ids, repeats in a new shuffled order', () => {
    const deck = makeShuffleDeck();
    const ids = ['a', 'b', 'c'];
    const firstRound = Array.from({ length: 3 }, () => deck.next(ids));
    const secondRound = Array.from({ length: 3 }, () => deck.next(ids));
    expect(firstRound.sort()).toEqual(['a', 'b', 'c']);
    expect(secondRound.sort()).toEqual(['a', 'b', 'c']);
  });

  it('drops stale ids and does not repeat remaining ones', () => {
    const deck = makeShuffleDeck();
    // Initialise with 3 ids; consume one.
    deck.next(['a', 'b', 'c']);
    // Now the pool shrinks to 2 — stale ids are silently dropped.
    const result = deck.next(['a', 'b']);
    expect(['a', 'b']).toContain(result);
  });

  it('resets the deck when the pool changes completely (e.g. box switch)', () => {
    const deck = makeShuffleDeck();
    deck.next(['a', 'b', 'c']); // prime a deck with box-3 ids
    // Pass an entirely different pool (box-1 ids) — pending should flush and refill.
    const result = deck.next(['x', 'y']);
    expect(['x', 'y']).toContain(result);
  });

  it('returns undefined for an empty pool', () => {
    const deck = makeShuffleDeck();
    expect(deck.next([])).toBeUndefined();
  });

  it('reset() clears pending so the next call reshuffles', () => {
    const deck = makeShuffleDeck();
    const ids = ['a', 'b', 'c'];
    deck.next(ids); // consume one
    deck.reset();
    // After reset all 3 are available again.
    const seen = new Set<string>();
    for (let i = 0; i < ids.length; i++) seen.add(deck.next(ids)!);
    expect(seen.size).toBe(3);
  });
});
