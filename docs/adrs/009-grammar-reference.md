# ADR 009 — Grammar Reference Section

**Status:** Accepted  
**Implementation:** `data/grammar.json` (agent-authored static content),
`src/lib/grammar.ts` (static import + helpers), `src/app/grammar/` (page + helpers + tests),
`src/components/AppNav/` (nav entry + icon), `src/types/index.ts` (GrammarTopic types)

## Context

Learners drilling Leitner flashcards need a reference they can consult when they don't understand
_why_ a word behaves a certain way — e.g. why "aufstehen" separates, or which article a noun takes.
A concise, offline-available A1 grammar reference fills this need without adding runtime complexity.

Two constraints shape the design:

- **Invariant 1 — zero runtime LLM.** Grammar explanations are prose authored once; there is
  nothing algorithmic to compute at build time (unlike `words.json` which parses PDFs, or
  `daily-texts.json` which computes highlight spans). A build script would be pure boilerplate
  with no value.
- **Read-only, no progress track.** Unlike Leitner boxes (ADR 001/004) and Dictation (ADR 008),
  grammar reference has no per-item state to track or sync.

## Decision

### Directly-authored static artifact — no build script

`data/grammar.json` is authored directly (agent or human) as a JSON array of `GrammarTopic`
objects and committed to the repo. The running app imports it as a bundled module — the same
pattern as `words.json` and `daily-texts.json` (see ADR 002, ADR 007). There is no
`scripts/build-grammar.mjs` because nothing deterministic needs computing: the content is the
artifact.

This extends ADR 002's precedent for build-time-LLM / zero-runtime-LLM without adding a new
pipeline stage. The content authoring step (LLM writes the JSON) is one-time and reviewed, just
like the `en`-fill and flagged-row cleanup described in ADR 002, and the corpus authoring in
ADR 007.

### Data shape

```ts
type GrammarCategory =
  | 'verben'
  | 'nomen-artikel'
  | 'pronomen'
  | 'satzbau'
  | 'praepositionen'
  | 'negation';

interface GrammarTopic {
  id: string; // stable slug
  category: GrammarCategory;
  title: string; // e.g. "Präsens — regelmäßige Verben"
  summary: string; // one-line description shown in collapsed card
  explanation: string; // prose; \n\n = paragraph break
  tables: GrammarTable[]; // optional conjugation / declension grids
  examples: GrammarExample[]; // { de, en } pairs
  tips: string[]; // bullet-list notes
}
```

All types live in `src/types/index.ts` per project convention.

### UI — category sections with accordion cards

`/grammar` is a `'use client'` page following the dictation/read page skeleton:
token guard → `/login`, `AppNav` header, responsive `main` (`max-w-md` / `md:max-w-xl`).

Layout:

- **Per-category sections** (labelled headings) contain **expandable topic cards** (accordion):
  collapsed shows `title` + `summary`; expanded shows explanation paragraphs, tables
  (`GrammarTableView`), examples (`GrammarExampleView`), and tips.
- Pure logic (accordion toggle, paragraph split, active-group filter) lives in
  `src/app/grammar/page.helpers.ts` with unit tests, keeping JSX free of logic per project
  convention.

### No progress tracking, no KV sync

Grammar is reference material. There is no `WordProgress`-equivalent, no IndexedDB store, no
`useProgressSync` hook, and no change to the KV schema (ADR 004). This feature is strictly
additive and does not touch the sync or auth layers.

### Offline availability

`/grammar` is added to the `PRECACHE` list in `public/sw.js` so it is available offline after
first load, consistent with other routes (ADR 005). The cache version constant is bumped to
force re-installation of the updated shell.

## Consequences

- **Invariants hold.** Zero runtime LLM; offline-safe (static JSON bundled); no KV changes;
  no new server routes.
- **No pipeline complexity.** Skipping a build script means `grammar.json` is edited directly.
  When content is updated, redeploy — same as any static file change.
- **Data integrity net.** `page.helpers.test.ts` asserts every topic `id` is unique and every
  `category` is in the allowed set, catching hand-edit mistakes before they reach production.
- **Stale-on-schema-change.** If `GrammarTopic` needs a new field, update the type and the
  JSON together — no migration needed since there is no runtime database.
- **Precedent for future static reference sections** (e.g. numbers, phrases, verb tables) —
  the same pattern (author JSON → import → display) scales without framework changes.
