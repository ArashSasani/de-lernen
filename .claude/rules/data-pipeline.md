---
paths:
  - 'scripts/**'
  - 'data/**'
---

# Data pipeline (build-time, `scripts/` + `data/`)

See **[ADR 002](../../docs/adrs/002-build-time-data-pipeline.md)** for the full rationale (why zero
runtime LLM, why `pdftotext` not vision, the two-build split). Key facts — two stages, keep messy
extraction separate from deterministic merge:

1. **Extract (text-layer parse + targeted AI cleanup, once per source):** source PDFs live in
   `data/sources/<level>/` (`a1/`, `a2/`, …), namespaced per level — the author drops a level's
   PDFs into its own folder; adding a new level is a drop-in, no code change. All of them have a
   clean embedded text layer — **do not vision-read them** (huge context, slow; that's what stalls
   this step). Extract with `pdftotext -layout` (poppler) and parse into a faithful normalized file
   alongside its PDFs: `data/sources/a1/telc-a1-1.json`, `data/sources/a2/telc-a2-1.json`, etc.
   Deterministic parsers (`scripts/extract-telc.mjs --source <level>.<part> [--level <level>]`,
   `scripts/extract-goethe.mjs --level <level>`) take the level as an argument rather than
   hardcoding A1; a PDF whose layout differs enough from its sibling levels gets its own small
   variant script (e.g. `scripts/extract-goethe-a2.mjs`) rather than forcing one parser to cover
   every edition. Rows the parser can't confidently parse get pushed to a
   `data/sources/<level>/<source>_flagged.json` sidecar and AI resolves only those. One source per
   session, finishing and verifying each before moving on (no git commit — see invariant 6).
   - Telc rows are tabular: `Artikel | Deutsch | Plural | Englisch | Beispielsatz` (fixed column
     offsets; some cells wrap across physical lines — merge continuations onto the prior row).
   - Goethe is alphabetical with `r/e/s` = der/die/das, plural notation like `ä, -e`, example
     sentences, and **no English** — leave `en` empty here.
   - Also capture Goethe word-groups (numbers, colors, months, days, family, professions,
     countries) as `categories`.
2. **Refine + merge (deterministic, re-runnable):** `scripts/build-words.mjs` globs
   `data/sources/*/*.json` (skipping `*_flagged.json`), tagging each source by its folder's level —
   adding a level's extracts to the build needs no code edit.
   - Fill `en` for entries missing it (Goethe-only). These are all A1/A2 words — translate directly.
   - Apply **only obvious** corrections (see below); set `corrected: true`; append to changelog.
   - Merge on `id` (slug). Combine `sources` and `levels` (accumulate every level a word's source
     material appears in); reconcile `article`/`plural` conflicts (Goethe's r/e/s markers are a
     reliable tiebreaker); dedupe examples. (Goethe word-groups are captured in the source file but
     not carried into `words.json`.)
   - Emit `data/words.json` and `data/changelog.json`.
3. **Daily reading corpus (built after `words.json` is final):** the agent authors A1 and A2
   exam-style texts once into `data/sources/daily-texts.src.json` (each entry carries a `level`,
   and each text records the exact surface form of every embedded word). Author A2 texts so their
   target vocabulary is predominantly **A2-specific** — words whose `levels` are `['a2']` only, not
   the `['a1','a2']` words already scoped under A1. Then the deterministic, re-runnable
   `scripts/build-daily-texts.mjs` resolves those words against `words.json` and turns the surfaces
   into highlight spans, emitting `data/daily-texts.json`. Same build-time-LLM / zero-runtime-LLM
   split as above; the running app only matches box-1 words to pre-annotated texts. See
   **[ADR 007](../../docs/adrs/007-daily-reading-corpus.md)**.

## Corrections policy: "only obvious"

Fix clear mistranslations and OCR slips; leave correct-but-loose entries alone. Record every
change in `changelog.json` as `{ lemma, from, to }`.

Confirmed fixes:

- `zahlen`: "to count" → **"to pay"**
- `Schnupfen`: "to sniff" → **"cold / runny nose"** (it's a noun, der Schnupfen)
- `kreativ`: "people" → **"creative"** (row was misaligned with _die Leute = people_)
- `verzögern`: "to hesitate" → **"to delay"**
- example typo: "Der Zug nach Basel **fahrt** über Stuttgart" → **"fährt"**

Verify against the PDF, then fix sensibly:

- `die Position` glossed as "police station" — Position means _position/location_; a police
  station is _Polizeiwache/Polizeistation_. Decide from context whether the German lemma or the
  English is wrong, and correct the mismatch.

Leave as-is (acceptable): `Becher → container`, `Dose → jar`.

## Publishing for runtime fetch

`scripts/sync-public-data.mjs` copies `words.json`, `daily-texts.json` and `grammar-bank.json`
from `data/` to `public/data/` (gitignored) — wired into `predev` and `prebuild`, so a rebuilt
corpus is picked up by the next `npm run dev`/`build` with no extra step. `data/` stays the only
tracked copy. See [ADR 013](../../docs/adrs/013-runtime-fetched-corpora.md).
