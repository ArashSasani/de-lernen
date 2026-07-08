# ADR 002 — Build-Time Data Pipeline, Zero Runtime LLM

**Status:** Accepted  
**Implementation:** `scripts/extract-telc.mjs`, `scripts/extract-goethe.mjs`,
`scripts/build-words.mjs`, `scripts/lib/{pdf-text,flag}.mjs` → `data/words.json` + `data/changelog.json`

## Context

The vocabulary comes from three source PDFs (Telc A1.1, Telc A1.2, Goethe _Fit in Deutsch 1_).
Turning them into clean, merged, translated flashcard data needs real language work — fixing
mistranslations, filling missing English for the Goethe list, reconciling articles and plurals.
That work wants an LLM.

But the running app must make **zero LLM calls** (invariant 1): no translation API on Vercel, no
per-request AI. Reasons — cost ($0 target on Hobby + KV free tier), latency, offline operation
(invariant 4: studying must work with no network), and determinism (the same card shouldn't render
differently run to run). The dataset is also essentially **static**: ~1,200 A1 words that change
only if the source lists change.

A naive extraction approach — vision-reading the PDFs — was tried and **stalls**: page images cost
enormous context and are slow. But all three PDFs have a clean embedded text layer, so vision is
unnecessary.

## Decision

Compile the vocabulary **once, locally, offline-from-the-app**, into a static `data/words.json`
that is committed and bundled. The deployed app only ever reads that JSON. All LLM/translation work
happens exclusively in this build.

### Two separated builds

1. **Data build (one-time, local).** PDFs → `words.json` + `changelog.json`. The _only_ place an
   LLM is used. Run rarely.
2. **App build (every Vercel deploy).** Bundles the already-committed `words.json`. No PDFs, no LLM,
   no secrets beyond env vars. `words.json` is the handoff artifact between the two.

### Two-stage data build (messy extraction kept separate from deterministic merge)

- **Stage 1 — Extract (per source).** Pull text with `pdftotext -layout` (poppler), cached to a
  gitignored `data/sources/_text/`; **never vision-read the PDFs**. Deterministic parsers do the
  bulk; rows they can't confidently parse are pushed to a `<source>_flagged.json` sidecar, and AI
  resolves **only those flagged rows**. Output: one faithful JSON per source. Do one source per
  session so context never accumulates.
- **Stage 2 — Refine + merge (deterministic, re-runnable).** `build-words.mjs` fills missing English
  (Goethe-only), applies **only obvious** corrections (recorded in `changelog.json`), merges by
  `id` (slug) unioning sources and reconciling article/plural conflicts, and emits the final
  `words.json`. Re-running with the same inputs produces the same output.

### "Only obvious" corrections

Fix clear mistranslations and OCR slips; leave correct-but-loose glosses alone; record every change
as `{lemma, from, to}` in `changelog.json` so corrections are auditable rather than silent.

## Consequences

- **$0, fast, offline, deterministic at runtime:** the app is a static-data reader. No API keys ship
  to Vercel, nothing to rate-limit, and a card renders identically every time — directly enabling
  the offline guarantee ([ADR 004](004-offline-first-progress-sync.md)).
- **Auditable data:** `changelog.json` is the paper trail for every edit, which keeps the
  "only obvious" policy honest and reversible.
- **Re-runnable merge:** separating extraction from merge means Stage 2 can be re-run freely
  (e.g. to tweak `pos` inference or add a correction) without re-doing the expensive Stage 1.
- **Stale-on-source-change:** because the data is frozen at build time, changes to the source lists
  require re-running the build and re-deploying. Fine — A1 lists are stable; this is rare.
- **Build complexity lives outside the app:** the parsers/flagging machinery are non-trivial, but
  they're isolated in `scripts/` and never shipped, so they add nothing to the app's runtime or
  bundle.
- **No git step:** finishing the build is a "done-when-verified" unit, not a commit (CLAUDE.md
  invariant 6); the user wires up version control later.
