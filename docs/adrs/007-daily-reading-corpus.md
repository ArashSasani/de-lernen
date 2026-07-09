# ADR 007 — Daily Contextual Reading Corpus

**Status:** Accepted
**Implementation:** `scripts/build-daily-texts.mjs` →
`data/sources/daily-texts.src.json` (agent-authored) → `data/daily-texts.json`;
`src/lib/daily.ts`, `src/lib/daily-texts.ts`, `src/components/DailyReading/`,
`src/app/read/`, and the once-per-day modal in `src/app/study/page.tsx`

## Context

Drilling isolated flashcards never shows a word in context. We want **passive
reading exposure**: once a day, surface a short German text (A1 or A2) that
naturally contains the words the user is currently struggling with (Leitner box
1), with the text's target words highlighted and tap-to-gloss.

Two constraints shape the design:

- **Invariant 1 — zero runtime LLM.** Generating natural A1/A2 prose wants an LLM,
  but the deployed app must make no LLM calls (cost, latency, offline, and
  determinism — see [ADR 002](002-build-time-data-pipeline.md)).
- **German inflects.** "fährt" ← _fahren_, "Häuser" ← _Haus_. Matching a lemma
  against raw text at runtime is fragile and would mis-highlight.

## Decision

Treat the reading corpus exactly like `words.json`: a **static artifact compiled
once at build time** and committed, which the deployed app only ever reads. This
extends ADR 002's pipeline with a third stage rather than changing it.

### Build-time corpus, same extract→refine split as ADR 002

1. **Author (one-time, agent).** From a compact projection of `words.json`, the
   agent writes A1 and A2 exam-style texts into `data/sources/daily-texts.src.json`,
   each entry tagged with its `level` and recording the **exact surface form** of
   every embedded word (`used: [{ wordId, surface }]`). A2 texts are authored so
   their target vocabulary is predominantly **A2-specific** (words whose `levels`
   are `['a2']` only) rather than the `['a1','a2']` words already scoped under A1 —
   otherwise an "A2" text just re-drills A1 vocabulary. This is the only LLM step —
   same precedent as ADR 002's flagged-row cleanup / `en`-fill. Not deterministic;
   done once and reviewed.
2. **Annotate + validate (deterministic, re-runnable).**
   `scripts/build-daily-texts.mjs` resolves each `wordId` against `words.json` and
   locates each `surface` with boundary-aware matching to compute exact character
   `spans`, emitting `data/daily-texts.json`. It is a hard gate: it exits non-zero
   on any unknown id or unfound surface. Re-running on the same source is
   idempotent.

### Runtime: pure, deterministic matching (no NLP)

Each text ships pre-annotated with `wordIds` (drives scoring) and `spans` (exact
highlight offsets). At runtime the app only:

- computes the **struggling set** = words explicitly graded into box 1
  (`progress[id]?.box === 1`); ungraded words are excluded on purpose,
- scores each text by overlap (`scoreText`) and picks the best
  (`pickDailyText`), with a **deterministic daily rotation** fallback when the
  overlap is empty so there is always a reading,
- renders pre-computed spans as highlights with a tap-for-gloss popover. Two visual tiers:
  on the study-page modal only struggling words are highlighted (others are plain text);
  on the `/read` page every annotated word is highlighted but struggling ones use indigo
  and the rest use slate, so the user can see both reading context and personal weak spots.

### Local-only surfacing state

The once-per-day gate and the cached "today's pick" live in `localStorage`
(`daily_read_shown_date`, `daily_read_today`) — **not** in Vercel KV. This state
is disposable: losing it across devices just means the modal might show again,
which is harmless. KV stays exactly the single `ProgressMap` key from
[ADR 004](004-offline-first-progress-sync.md).

### Surfacing

A once-per-day modal on the study page (gated by `getShownDate()`), plus a
dedicated `/read` route to reopen today's pick or browse the corpus filtered by
level (A1 / A2) and grouped by topic. Both read the same cached pick so they agree.
The daily pick itself is drawn from the whole corpus by struggling-word overlap,
so it is not restricted to a single level.

`DailyReading` accepts an optional `strugglingIds` set and a `highlightAll` flag
that together control which words are highlighted and how. The study modal passes
only `strugglingIds` (filter mode: non-struggling words are plain text). The `/read`
page passes both (tier mode: all annotated words are highlighted, struggling=indigo,
others=slate). `resolveHighlight()` in `index.helpers.ts` encodes this logic and is
unit-tested independently of the JSX.

## Consequences

- **Invariants hold.** Zero runtime LLM; offline-safe (everything bundled);
  deterministic render. `daily-texts.json` is a second committed static artifact
  alongside `words.json`, and is the only new thing Vercel sees.
- **No existing ADR changes.** ADR 002's pipeline gains a third stage; ADRs
  001/003/004/005/006 are untouched. Auth, sync, KV, and the Leitner model are
  unaffected — the feature is a read-only consumer of existing progress.
- **Robust highlighting.** Pre-recording surface forms at authoring time makes
  span computation an exact string search; the validator guarantees every
  highlight slices to real text and every target word exists.
- **Stale-on-vocab-change.** Like `words.json`, the corpus is frozen at build
  time. When the vocabulary grows significantly, re-author/extend the source and
  re-run `npm run build:daily`, then redeploy.
- **Targets real weaknesses.** Because the struggling set is "explicitly missed"
  rather than "all box 1," a fresh user with no misses gets a rotating text;
  targeting sharpens as misses accumulate.
