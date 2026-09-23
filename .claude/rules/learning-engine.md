# Learning engine: Leitner + sync

## Leitner spec (`src/lib/leitner.ts`)

See **[ADR 001](../../docs/adrs/001-leitner-spaced-repetition.md)** for the full rationale and grading
rules. Key facts:

- Boxes 1–5 with intervals in days: **1 / 3 / 7 / 16 / 30** (single `INTERVALS` constant).
- **Got it** → advance one box; **Miss** → back to box 1; **Easy** → jump to box 5.
- Daily queue = due cards (`nextDue <= now`), sorted `nextDue asc`, then `box asc`.

## Sync / merge spec

See **[ADR 004](../../docs/adrs/004-offline-first-progress-sync.md)** for the full rationale, the
multi-device worked example, and the tradeoffs (clock-dependence, per-word granularity). Key facts:

- KV holds one key, `user:progress`, containing the whole `ProgressMap`.
- `mergeProgress(local, remote)`: start from remote; for each word in local, take local if it's
  new or has a strictly newer `lastReviewed`. Pure function, no side effects. Every track's merge
  lives **once** in `src/lib/merge.ts` (dependency-free) and is re-exported by both `src/lib/db.ts`
  (server) and the client `*-sync.ts` modules, so the two sides cannot drift.
- Client flow: load IndexedDB → fetch remote → merge → save merged locally and PUT to server.
  On every grade: write IndexedDB immediately, debounce (~2s) the remote PUT. The three keyed
  tracks run this through one generic hook, `useSyncedMap`; the push lifecycle itself (dirty ids,
  debounce, keepalive flush) is `useDebouncedPush`, which the mistakes corpus shares too.
- **Durability against the iOS PWA lifecycle.** A backgrounded/killed PWA never runs its debounce
  timer or React unmount, so the last grades would otherwise be lost — and once iOS evicts
  IndexedDB, a graded high-box card silently reverts to box 1. To prevent this, flush the pending
  PUT **synchronously on `visibilitychange` (hidden) and `pagehide`** using `fetch` with
  `keepalive: true` (survives teardown, keeps the Bearer header — unlike `sendBeacon`), and request
  **persistent storage** (`navigator.storage.persist()`) on load to make eviction less likely.
