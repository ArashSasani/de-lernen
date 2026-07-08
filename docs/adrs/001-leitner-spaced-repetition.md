# ADR 001 — Leitner Box Spaced-Repetition Design

**Status:** Accepted  
**Implementation:** `src/lib/leitner.ts`

## Context

The app is a single-user flashcard tool for studying German A1 vocabulary. Spaced repetition
maximises retention by scheduling reviews at increasing intervals as a word becomes more familiar.
We need a simple, tuneable scheme that works fully offline and fits into a small TypeScript module.

## Decision

Use a classic 5-box Leitner system with fixed per-box review intervals.

### Box intervals

| Box | Interval | Label              |
| --- | -------- | ------------------ |
| 1   | 1 day    | practice every day |
| 2   | 3 days   | every other day    |
| 3   | 7 days   | once a week        |
| 4   | 16 days  | every other week   |
| 5   | 30 days  | once a month       |

Intervals are kept in a single `INTERVALS` constant so they can be retuned before an exam without
touching logic.

### Grading rules

- **Got it** → advance one box (`min(box + 1, 5)`), reschedule by the new box's interval.
- **Miss** → return to box 1, reschedule by box 1's interval.
- **Easy** → jump directly to box 5, reschedule by box 5's interval.

### Queue

- A card is _due_ when `nextDue <= now` (millisecond epoch).
- New cards start in box 1 with `nextDue = 0` (immediately due).
- The daily queue is all due cards, sorted by `nextDue asc` then `box asc` (oldest and lowest-box
  first — surfaces struggling cards before comfortable ones at the same due time).

## Consequences

- **Simple:** five constants, three grading functions, one sort predicate. No decay curves or
  probability models to maintain.
- **Tuneable:** changing `INTERVALS` is a one-line edit — safe to adjust before a test date.
- **Easy jump:** the _Easy_ shortcut lets the user fast-track words they already know from prior
  study, which is why box 5 may fill up faster than boxes 3–4 early on (expected behaviour, not
  a bug).
- **Offline-safe:** all scheduling is pure arithmetic on timestamps; no server involvement.
