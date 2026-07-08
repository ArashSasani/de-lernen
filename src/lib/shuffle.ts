export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Stateful deck for exhaustive shuffle: cycles through all ids before repeating.
// Pass the current valid ids on each next() call; stale ids are silently dropped.
// When the pool changes (e.g. box switch), pending empties and the new pool is reshuffled.
export function makeShuffleDeck() {
  let pending: string[] = [];

  return {
    next(validIds: readonly string[]): string | undefined {
      if (validIds.length === 0) return undefined;
      const valid = new Set(validIds);
      pending = pending.filter((id) => valid.has(id));
      if (pending.length === 0) pending = shuffle([...validIds]);
      return pending.shift();
    },
    reset() {
      pending = [];
    },
  };
}
