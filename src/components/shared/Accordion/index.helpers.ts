/**
 * Exclusive-open toggle. Opening an item collapses the others; closing one
 * leaves the rest alone — so a deliberately "everything open" state (grammar's
 * search mode) degrades one item at a time as the user closes what they don't
 * need, instead of snapping shut on the first click.
 */
export function toggleExclusive(
  openIds: readonly string[],
  id: string,
): string[] {
  return openIds.includes(id) ? openIds.filter((x) => x !== id) : [id];
}
