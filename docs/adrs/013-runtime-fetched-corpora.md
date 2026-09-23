# ADR 013 — Runtime-Fetched Corpora

**Status:** Accepted
**Implementation:** `scripts/sync-public-data.mjs` (publishes `data/*.json` → `public/data/`,
wired into `predev`/`prebuild`), `src/lib/dataset.ts` (`loadDataset`, `hydrateDataset`, the
in-place arrays), `src/lib/words.ts` / `daily-texts.ts` / `grammar-quiz.ts` (thin accessors over
it), `public/sw.js` (precache + stale-while-revalidate for `/data/*`), `jest.dataset.ts`
(hydrates the corpora from disk under Jest). Amends [ADR 003](003-static-rendering-client-app.md).

## Context

ADR 003 made the corpora bundled `import`s so the client never needs a server data fetch. That
held the offline guarantee, but it inlined every corpus into the client JS: `words.json` (750 KB),
`daily-texts.json` (302 KB) and `grammar-bank.json` (180 KB) — about 1.2 MB of JSON that every
page parsed as JavaScript before it could paint, and 2.5 MB of static chunks overall because
separate entry graphs each carried their own copy.

## Decision

The three large corpora are **static assets fetched at runtime**, not modules:

- `data/` stays the single, tracked source of truth. `scripts/sync-public-data.mjs` copies the
  three files to `public/data/` (gitignored) on every `dev` and `build`.
- `src/lib/dataset.ts` owns `allWords`, `dailyTexts` and `grammarBank` as exported arrays
  **populated in place** by `loadDataset()`. They keep a stable identity, so every existing
  consumer (`wordById`, queue builders, `useMemo` deps) stays synchronous and unchanged. Each page
  that reads a corpus awaits `loadDataset()` inside the init effect that already gates its UI
  behind `ready`.
- `loadDataset()` memoizes and **never rejects**: a failed fetch leaves the arrays empty, which
  each page already renders as its own empty state, and drops the memo so the next navigation
  retries.
- The service worker **precaches** `/data/*.json` on install and serves them
  **stale-while-revalidate**. Offline behaviour is unchanged from a bundle; the paths are unhashed,
  so revalidation (not a cache-name bump) is what lets a rebuilt corpus land on the next load.

`grammar.json` (95 KB) stays a bundled import: `/api/ai` resolves topic prose from it server-side
on the Edge runtime, where fetching the app's own origin would be a needless round trip.

Tests don't fetch: `jest.dataset.ts` runs as a `setupFiles` entry and calls
`hydrateDataset()` with the real corpora from disk, so suites exercise the same accessors the app
does.

## Consequences

- Static chunks drop from 2.5 MB to 1.1 MB; no chunk carries a corpus.
- A first visit makes three extra requests (parallel, cached thereafter). The SW precache
  means an installed PWA never waits on them again.
- Nothing may read a corpus before `loadDataset()` resolves. Every current reader is behind a
  page's `ready` flag; a new one has to be too, or it silently sees an empty array.

## Alternatives considered

- **Split the bundle per level** (`words-a1.json`, `words-a2.json`) and keep static imports. Rejected:
  each page still needs every level (the study queue and the level chips span all of them), so it
  would add chunks without removing bytes from any page.
- **Dynamic `import()` of the JSON.** Rejected: it still ships the data as a JS chunk to be parsed
  as code, and its hashed name would need the SW's cache-first path to learn about it lazily —
  the offline guarantee then depends on a chunk having been fetched once, which is exactly what
  ADR 003's architecture note warns against.
