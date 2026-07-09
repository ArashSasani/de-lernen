# de·lernen — German Flashcard based app

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8)](#stack)

A single-user, offline-first flashcard app for German vocabulary (A1, with A2 added), using
Leitner-box spaced repetition. Vocabulary is compiled once per level from source PDFs (Telc + Goethe
wordlists) into a static dataset. There is **no runtime LLM** — the app just reads a committed
`words.json`.

Built to run as an installable PWA on mobile and desktop, with progress synced across both devices.

- **Study** (`/study`) — Leitner-box flashcards: German ↔ English, graded Miss / Got it / Easy.
- **Lesen** (`/read`) — daily A1/A2 reading text, auto-picked and highlighted around your
  struggling words, with tap-for-gloss translations; browse the full corpus by level and topic.
- **Diktat** (`/dictation`) — spelling/dictation drills targeting tricky German patterns
  (umlauts, ß, ie/ei, silent-h).
- **Grammatik** (`/grammar`) — browsable A1 grammar reference plus an on-device,
  multiple-choice practice quiz.

<img width="1660" height="1200" alt="merged-mobile_images_1" src="https://github.com/user-attachments/assets/7107e87a-2444-4fc7-93b6-512b9e8b3f3b" />
<br>
<img width="2214" height="1200" alt="merged-mobile_images_2" src="https://github.com/user-attachments/assets/7322b29c-b6d2-492d-912c-e2ddbf6df434" />

---

## Contents

- [Stack](#stack)
- [How it's put together](#how-its-put-together-the-important-idea)
- [Quick start (local)](#quick-start-local)
- [Deploy (Vercel CLI)](#deploy-vercel-cli)
- [Project layout](#project-layout)
- [Daily use](#daily-use)

---

## Stack

- **Next.js (App Router) + TypeScript** — statically-rendered shell + client-side app, plus three serverless API routes (login, progress, dictation; no per-request SSR; see [ADR 003](docs/adrs/003-static-rendering-client-app.md))
- **Tailwind CSS** — styling
- **Heroicons** — SVG icon set (MIT, by the Tailwind team)
- **Vercel KV (Upstash Redis)** — cross-device progress sync (single key, single user)
- **IndexedDB** — offline-first local progress cache
- **jose** — single-password auth (signed JWT, no user database)
- **Web Speech API** — German pronunciation (browser built-in, offline, no API key)
- **PWA** — manifest + minimal service worker (installable, works offline)
- **Hosting** — Vercel (deployed via the Vercel CLI, **not** GitHub)

Running cost target: **\$0** on Vercel Hobby + KV free tier. A custom domain is the only thing that would cost money.

---

## How it's put together (the important idea)

There are **two separate builds**, and only one ever touches an LLM:

1. **Data build (one-time, local).** Parse each level's source PDFs (`data/sources/<level>/`) →
   merge → fix obvious errors → fill missing English → emit `data/words.json` + `data/changelog.json`.
   A word reused across levels is one merged entry whose `levels[]` accumulates every level it
   appears in — adding a level (drop PDFs into a new `data/sources/<level>/` folder) needs no code
   change to the merge step. Then author the
   daily reading corpus once and annotate it into `data/daily-texts.json` (see below). Run
   rarely (only if the source lists change). Output is committed. This is the _only_ place any
   LLM/text-authoring work happens.
2. **App build (every deploy, on Vercel).** Bundles the already-committed `words.json`,
   `daily-texts.json`, and `grammar.json` into the PWA. No PDFs, no LLM, no secrets beyond the
   env vars set in the Vercel dashboard.

`words.json`, `daily-texts.json`, and `grammar.json` are the handoff artifacts between the two.

The **daily reading** feature follows the same rule: once a day a short A1/A2 text is surfaced,
chosen because it contains the box-1 words you're struggling with, and its target vocabulary is
highlighted and tap-to-gloss. The corpus spans both levels — A1 texts and A2 texts whose target
vocabulary is predominantly A2-specific. The texts are authored once at build time and
pre-annotated with exact highlight offsets, so the running app does **zero NLP and zero LLM** — it
just matches your box-1 words to pre-built texts. See [ADR 007](docs/adrs/007-daily-reading-corpus.md).

---

## Quick start (local)

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env.local
#   - APP_PASSWORD: whatever you want to type to log in
#   - TOKEN_SECRET: openssl rand -hex 32
#   - KV_*: leave blank for now (sync just no-ops without them; everything else works)

# 3. (One-time) build the static datasets from the sources
npm run build:words   # merge the source PDFs' extracts → words.json
npm run build:daily   # annotate + validate the daily reading corpus → daily-texts.json

# 4. Run
npm run dev      # http://localhost:3000

# Tests (Jest): pure logic in lib/ and component helpers
npm test
```

Without KV configured, the app is fully usable on one device — progress persists in IndexedDB.
Cross-device sync turns on once `KV_*` is set.

---

## Deploy (Vercel CLI)

```bash
npm i -g vercel          # or use npx vercel
vercel login
vercel link              # create/link the project

# In the Vercel dashboard: Storage → create a KV (Upstash) store, attach to the project.
vercel env pull .env.local   # pull the KV_* vars locally

# Set the two app secrets in the dashboard (Settings → Environment Variables):
#   APP_PASSWORD, TOKEN_SECRET

vercel --prod            # deploy
```

Then on mobile (Safari/Chrome → Share → Add to Home Screen) and desktop (Safari/Chrome → Install) to get
the installable app.

## Project layout

```
de-lernen/
├─ CLAUDE.md                ← durable spec / rules for the AI agent
├─ README.md                ← you are here
├─ docs/adrs/               ← Architecture Decision Records (design rationale)
├─ data/
│  ├─ sources/<level>/            ← put each level's source PDFs here (you provide them), e.g. a1/, a2/
│  ├─ sources/<level>/*.json      ← normalized per-source extracts (generated), incl. `*_flagged.json`
│  ├─ sources/daily-texts.src.json ← authored daily reading texts (source, stays at root)
│  ├─ words.json                 ← final merged dataset across all levels (generated, committed)
│  ├─ daily-texts.json           ← annotated daily reading corpus (generated, committed)
│  ├─ grammar.json               ← A1 grammar reference (authored once, committed)
│  └─ changelog.json             ← record of every correction made (generated, committed)
├─ scripts/build-words.mjs       ← deterministic merge → words.json (globs data/sources/*/*.json)
├─ scripts/extract-telc.mjs      ← --source <level>.<part> [--level <level>] → data/sources/<level>/telc-*.json
├─ scripts/extract-goethe.mjs    ← --level <level> → data/sources/<level>/goethe-<level>.json (A1 layout)
├─ scripts/extract-goethe-a2.mjs ← A2 layout variant of the Goethe extractor → data/sources/a2/goethe-a2.json
├─ scripts/build-daily-texts.mjs ← annotate + validate → daily-texts.json
├─ scripts/gen-icons.mjs         ← generate PWA icons + apple-touch-icon.png
├─ public/                       ← manifest.json, sw.js, icons
└─ src/
   ├─ app/                  ← routes (study, login, read, dictation, grammar, grammar/quiz) + api/{login,progress,dictation}
   ├─ components/           ← AppNav, FlashCard, DictationCard, FilterBar (box/type/level), LeitnerStats, DailyReading, GrammarTableView, GrammarExampleView, GrammarQuizCard, SpeakButton
   ├─ lib/                  ← leitner, shuffle, dictation, grammar, grammar-quiz, auth, db (KV), sync (IndexedDB+remote), dictation-sync (IndexedDB+remote), grammar-quiz-sync (IndexedDB-only), words (incl. wordLevel), daily, daily-texts, speech
   ├─ hooks/                ← useProgressSync, useDictationSync, useDictationProgress, useGrammarQuizProgress, useSpeech
   └─ types/
```

---

## Daily use

- Open the app → it shows cards **due today** (Leitner schedule).
- Tap a card to flip German → English + example.
- Before flipping: tap **Skip** to move past the card without grading it (box unchanged, stays due).
- After flipping, grade: **Miss** (back to box 1), **Got it** (next box), **Easy** (jump to box 5).
- Tap the speaker icon on any card or gloss popover to hear the German pronunciation
  (uses the browser's built-in speech synthesis — works offline, no API key).
- Filter by box (or "Due"), word type (noun / verb / adj), and level (A1 / A2 — a word reused
  across levels only counts under the lowest one, so the level filters never overlap).
- Progress syncs to KV in the background and merges across mobile + desktop.
- Open **Diktat** (`/dictation`) for dictation practice: hear a word, fill in the missing
  letters (targeting the hardest German spelling patterns — umlauts, ß, ie/ei, silent-h, sch,
  double consonants). Sessions are 15 words, prioritizing never-seen and weak words. Dictation
  progress is tracked separately from Leitner boxes (its own IndexedDB store) but still synced
  across devices via its own `user:dictation` KV key; you can star words for focused practice.
- Once a day on open, a **daily reading** pops up: a short A1/A2 text chosen for your box-1
  (struggling) words, with only those words highlighted — tap one for its translation. Open
  **Lesen** (the `/read` route) anytime to reread today's text or browse the full corpus, filtered
  by level (A1 / A2) and grouped by topic; there, every annotated word is tappable but struggling
  words are indigo and the rest are slate.
- Open **Grammatik** (`/grammar`) for a browsable A1 grammar reference: verb conjugation,
  articles & cases, pronouns, sentence structure, prepositions, and negation. Topics are grouped
  by category with expandable cards showing rules, conjugation/declension tables, examples, and
  tips. Read-only — no progress tracking, no sync. Content is authored once as static JSON
  (`data/grammar.json`), bundled at build time. See
  [ADR 009](docs/adrs/009-grammar-reference.md).
- From **Grammatik**, practice with the **grammar quiz**: tap **Quiz** on any topic for a
  10-question drill on that topic, or **Smart Quiz** in the header for a ~12-question mix that
  prioritizes the topics you're weakest on (struggling first, then never-seen, then stale).
  Questions are multiple-choice and generated on-device from the grammar tables and your
  vocabulary — **no runtime LLM**. Quiz progress is tracked separately and stored locally in
  IndexedDB (no KV sync), like dictation. See [ADR 010](docs/adrs/010-grammar-quiz.md).

See `CLAUDE.md` for the data model, and `docs/adrs/` for the design rationale behind each major
decision:

- [ADR 001](docs/adrs/001-leitner-spaced-repetition.md) — Leitner spaced-repetition design
- [ADR 002](docs/adrs/002-build-time-data-pipeline.md) — build-time data pipeline, zero runtime LLM
- [ADR 003](docs/adrs/003-static-rendering-client-app.md) — static rendering + client-side app (no per-request SSR)
- [ADR 004](docs/adrs/004-offline-first-progress-sync.md) — offline-first progress sync across devices
- [ADR 005](docs/adrs/005-minimal-service-worker-pwa.md) — minimal hand-written service worker
- [ADR 006](docs/adrs/006-single-password-stateless-auth.md) — single-password, stateless JWT auth
- [ADR 007](docs/adrs/007-daily-reading-corpus.md) — daily contextual reading corpus (build-time, zero-runtime matching)
- [ADR 008](docs/adrs/008-dictation-spelling-exercise.md) — Dictation spelling exercise (gap algorithm, separate KV-synced progress track)
- [ADR 009](docs/adrs/009-grammar-reference.md) — A1 grammar reference (static JSON, read-only, no progress)
- [ADR 010](docs/adrs/010-grammar-quiz.md) — grammar practice quiz (on-device template questions, local-only progress)
