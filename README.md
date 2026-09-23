# de·lernen — German Flashcard based app

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8)](#stack)

## Life gets busy, and finding time to learn German isn't always easy! 🇩🇪

If you've got a few spare minutes—like some dead time on the **S-Bahn**—this tool might help you learn something new or simply test what you already know.
It's a fun vibe project, born from lots of brainstorming, and it's still a work in progress that I'm building in my spare time. The goal is to cover the **A1–B1** German levels, mainly to help people prepare for the exams.
Feel free to fork the project, contribute, or share your ideas. Thanks! 😊

## What is this app anyway!

A single-user, offline-first flashcard app for German vocabulary (A1, with A2 added), using
Leitner-box spaced repetition. Vocabulary is compiled once per level from source PDFs (Telc + Goethe
wordlists) into a static dataset. The deterministic core (flashcards, dictation, reading, grammar
reference) ships **zero runtime LLM calls** — it just reads a committed `words.json`. On top of that,
an **optional, BYOK (bring-your-own-key) AI layer** powers tap-a-word chips on the daily reading
text and, online, an adaptive grammar-practice generator layered on top of the same frozen quiz
bank: the app itself still ships no inference capability or AI secret — every call runs through
your own JWT-gated serverless function and your own paid Anthropic key, degrades gracefully offline,
and can be switched off entirely in Settings.

Built to run as an installable PWA on mobile and desktop, with progress synced across both devices.

- **Study** (`/study`) — Leitner-box flashcards: German ↔ English, graded Miss / Got it / Easy.
- **Lesen** (`/read`) — daily A1/A2 reading text, auto-picked and highlighted around your
  struggling words, with tap-for-gloss translations plus optional AI chips (Genitiv, Konjugation,
  Komparativ, Beispiel, Erklären, free-ask) when a key is configured.
- **Diktat** (`/dictation`) — spelling/dictation drills targeting tricky German patterns
  (umlauts, ß, ie/ei, silent-h).
- **Grammatik** (`/grammar`) — browsable A1/A2 grammar reference, filterable by level, plus a
  multiple-choice practice quiz. Offline or with AI off it draws from the frozen item bank; online
  with a key configured it generates questions adapted to the topic and your recent performance,
  including items with more than one acceptable answer.
- **Einstellungen** (`/settings`) — per-device prefs: AI features on/off, learner level.

<img width="1660" height="1200" alt="merged-mobile_images_1" src="https://github.com/user-attachments/assets/7107e87a-2444-4fc7-93b6-512b9e8b3f3b" />
<br>
<img width="2214" height="1200" alt="merged-mobile_images_2" src="https://github.com/user-attachments/assets/7322b29c-b6d2-492d-912c-e2ddbf6df434" />

---

## Contents

- [Stack](#stack)
- [How it's put together](#how-its-put-together-the-important-idea)
- [Optional AI features (BYOK)](#optional-ai-features-byok)
- [Quick start (local)](#quick-start-local)
- [Deploy (Vercel CLI)](#deploy-vercel-cli)
- [Project layout](#project-layout)
- [Daily use](#daily-use)

---

## Stack

- **Next.js (App Router) + TypeScript** — statically-rendered shell + client-side app, plus serverless API routes (login, progress, dictation, grammar-quiz, mistakes, and the BYOK AI proxy at `/api/ai`; no per-request SSR; see [ADR 003](docs/adrs/003-static-rendering-client-app.md))
- **Anthropic API (BYOK)** — powers the optional tap-a-word AI chips; your own key, server-side only, never in the client bundle or KV
- **Tailwind CSS** — styling
- **Heroicons** — SVG icon set (MIT, by the Tailwind team)
- **Vercel KV (Upstash Redis)** — cross-device progress sync (single key, single user)
- **IndexedDB** — offline-first local progress cache
- **jose** — single-password auth (signed JWT, no user database; failed logins are rate-limited per client via KV)
- **Web Speech API** — German pronunciation (browser built-in, offline, no API key)
- **PWA** — manifest + minimal service worker (installable, works offline)
- **Hosting** — Vercel (deployed via the Vercel CLI, **not** GitHub)

Running cost target: **\$0** on Vercel Hobby + KV free tier. A custom domain is the only thing that would cost money.

---

## How it's put together (the important idea)

There are **two separate builds**, and only one ever touches an LLM at build time. A third,
entirely optional piece adds _runtime_ AI behind your own key — see
[Optional AI features](#optional-ai-features-byok) below.

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

## Optional AI features (BYOK)

Tapping a highlighted word in **Lesen** shows the same offline gloss as before (article, plural,
meaning, pronunciation) plus a row of AI chips — Genitiv, Konjugation, Komparativ, Beispiel,
Erklären — and a free-ask field, when a key is configured. Online, with AI on, the **Grammatik**
quiz also draws on a live question generator instead of only the frozen bank. `POST /api/ai` is
the app's only runtime AI surface:

- **`POST /api/ai`** is a single JWT-gated Edge route that every chip/free-ask/quiz-generation call
  goes through — streaming plain text for the tap-a-word chips, structured JSON for grammar-quiz
  generation and the mistakes pipeline's note authoring. It owns the prompt, model, and token cap
  for each request — the client only ever sends a word/topic and an intent, never a free-form
  prompt.
- **BYOK, no shared secrets.** The key (`ANTHROPIC_API_KEY`) lives only in your own `.env.local` /
  Vercel env — never in the client bundle, never in KV. Without a key set, the route responds
  `503` and the chips grey out; nothing else in the app is affected.
- **Token spend is yours, and this layer is experimental.** Every AI call bills your own key.
  Usage isn't metered or capped by the app, and quiz generation in particular is the heaviest
  caller. Turning **AI features** off in Settings stops all of it; the deterministic core is
  unaffected. Watch your own Anthropic usage — no cost estimate here is a guarantee.
- **Degrades gracefully.** Chips grey out automatically when offline or when AI is turned off in
  **Einstellungen** (`/settings`); the grammar quiz falls back to the frozen bank on the same
  conditions, silently, with no error shown — the deterministic core above it always works
  regardless. See [ADR 012](docs/adrs/012-online-grammar-practice.md).
- **Cheap facts stay data-backed.** Article, plural, and meaning always come from `words.json`;
  only the generative chips, quiz generation, and free-ask call the model.
- **Multiple acceptable answers.** A generated quiz item can mark more than one choice correct
  where German genuinely allows it (e.g. "gehe" vs "fahre" nach Hause) and explain the difference —
  something the frozen bank's single `correctIndex` can't express. See
  [ADR 012](docs/adrs/012-online-grammar-practice.md).
- **Learning memory.** A personal, synced log of short notes about what you keep getting wrong
  ("confused Akkusativ and Dativ after mit"), authored from a missed grammar-quiz question and
  screened by a write-time quality gate so a note is never accepted on the model's inference alone.
  Read-only in **Einstellungen** → Learning memory. See
  [ADR 011](docs/adrs/011-personal-mistakes-corpus.md) and
  [ADR 012](docs/adrs/012-online-grammar-practice.md).

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
#   - ANTHROPIC_API_KEY: your own Anthropic key (optional — tap-a-word AI chips no-op without it)

# 3. (One-time) build the static datasets from the sources
npm run build:words          # merge the source PDFs' extracts → words.json
npm run build:daily          # annotate + validate the daily reading corpus → daily-texts.json
npm run build:grammar-bank   # validate + freeze the grammar quiz item bank → grammar-bank.json

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

# Set the app secrets in the dashboard (Settings → Environment Variables):
#   APP_PASSWORD, TOKEN_SECRET
#   ANTHROPIC_API_KEY (optional — omit to ship without the tap-a-word AI chips)

vercel --prod            # deploy
```

Then on mobile (Safari/Chrome → Share → Add to Home Screen) and desktop (Safari/Chrome → Install) to get
the installable app.

## Project layout

```
de-lernen/
├─ CLAUDE.md                ← durable spec / rules for the AI agent (core + rules map)
├─ .claude/rules/           ← topic-scoped spec files loaded alongside CLAUDE.md
├─ README.md                ← you are here
├─ docs/adrs/               ← Architecture Decision Records (design rationale)
├─ data/
│  ├─ sources/<level>/            ← put each level's source PDFs here (you provide them), e.g. a1/, a2/
│  ├─ sources/<level>/*.json      ← normalized per-source extracts (generated), incl. `*_flagged.json`
│  ├─ sources/daily-texts.src.json ← authored daily reading texts (source, stays at root)
│  ├─ sources/grammar-bank.src.json ← authored grammar quiz items (source, stays at root)
│  ├─ words.json                 ← final merged dataset across all levels (generated, committed)
│  ├─ daily-texts.json           ← annotated daily reading corpus (generated, committed)
│  ├─ grammar.json               ← A1/A2 grammar reference (authored once, committed)
│  ├─ grammar-bank.json          ← frozen grammar quiz item bank (generated, committed)
│  └─ changelog.json             ← record of every correction made (generated, committed)
├─ scripts/build-words.mjs       ← deterministic merge → words.json (globs data/sources/*/*.json)
├─ scripts/extract-telc.mjs      ← --source <level>.<part> [--level <level>] → data/sources/<level>/telc-*.json
├─ scripts/extract-goethe.mjs    ← --level <level> → data/sources/<level>/goethe-<level>.json (A1 layout)
├─ scripts/extract-goethe-a2.mjs ← A2 layout variant of the Goethe extractor → data/sources/a2/goethe-a2.json
├─ scripts/build-daily-texts.mjs ← annotate + validate → daily-texts.json
├─ scripts/build-grammar-bank.mjs ← validate + freeze → grammar-bank.json
├─ scripts/gen-icons.mjs         ← generate PWA icons + apple-touch-icon.png
├─ public/                       ← manifest.json, sw.js, icons
└─ src/
   ├─ app/                  ← routes (study, login, read, dictation, grammar, grammar/quiz, settings) + api/{login,progress,dictation,grammar-quiz,mistakes,ai}
   ├─ components/           ← AppNav, FlashCard, DictationCard, FilterBar (box/type/level), LeitnerStats, DailyReading, WordPopover, GrammarTableView, GrammarExampleView, GrammarQuizCard, SpeakButton
   ├─ lib/                  ← leitner, shuffle, dictation, grammar, grammar-quiz, auth, auth-security (login rate limit), db (KV), sync (IndexedDB+remote), dictation-sync (IndexedDB+remote), grammar-quiz-sync (IndexedDB+remote), mistakes-sync (IndexedDB+remote), mistakes-gate (write-time quality gate), words (incl. wordLevel), daily, daily-texts, speech, ai-prefs, ai/{models,prompts,validate,client}
   ├─ hooks/                ← useSyncedMap + useDebouncedPush (shared sync lifecycle), useProgressSync, useDictationSync, useGrammarQuizSync, useSpeech, useAiChat, useAiConfigured, useOnline
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
  words are indigo and the rest are slate. Tapping a word also offers AI chips (Genitiv,
  Konjugation, Komparativ, Beispiel, Erklären) and a free-ask field when a key is configured — see
  [Optional AI features](#optional-ai-features-byok).
- Open **Grammatik** (`/grammar`) for a browsable A1/A2 grammar reference: verb conjugation,
  articles & cases, pronouns, sentence structure, prepositions, negation, adjectives, and more.
  Topics are grouped by category with expandable cards showing rules, conjugation/declension
  tables, examples, and tips, and can be filtered by level (All / A1 / A2). Read-only — no
  progress tracking, no sync. Content is authored once as static JSON (`data/grammar.json`),
  bundled at build time. See [ADR 009](docs/adrs/009-grammar-reference.md).
- From **Grammatik**, practice with the **grammar quiz**: tap **Quiz** on any topic for a
  10-question drill on that topic, or **Smart Quiz** in the header for a ~12-question mix that
  prioritizes the topics you're weakest on (struggling first, then never-seen, then stale).
  Questions are multiple-choice, authored once into a static item bank and frozen at build
  time — offline, or with AI off, that bank is the whole session, **no runtime LLM**. Online with
  a key configured and AI on, each batch of questions for a topic is instead generated fresh,
  adapted to that topic's own level and your recent performance in the session, and can mark more
  than one choice acceptable where German allows it; any failure (offline mid-session, a bad
  response, the deployment having no key) falls back to the same bank silently. A missed generated
  or bank question can, once per topic per session, author a short note in **Learning memory**
  about the specific confusion. Quiz progress is tracked separately, keyed by topic in its own
  IndexedDB store and synced across devices via its own `user:grammar-quiz` KV key, like dictation.
  See [ADR 010](docs/adrs/010-grammar-quiz.md) and
  [ADR 012](docs/adrs/012-online-grammar-practice.md).
- Open **Einstellungen** (`/settings`) to turn AI features on/off, set your learner level, and
  optionally turn on a second AI verification pass before a learning-memory note is saved
  (off by default). The learner level raises how advanced AI explanations get — never below a
  word's own level, and never above it unless you explicitly ask about a higher-level
  construction, which is then explained at your level. Grammar-quiz _questions_ stay at the
  topic's own level regardless of this pref — only the explanation register moves. All three are
  per-device prefs — stored locally, never synced.

See `CLAUDE.md` and `.claude/rules/` (e.g. `data-model.md`) for the data model, and `docs/adrs/`
for the design rationale behind each major decision:

- [ADR 001](docs/adrs/001-leitner-spaced-repetition.md) — Leitner spaced-repetition design
- [ADR 002](docs/adrs/002-build-time-data-pipeline.md) — build-time data pipeline, zero runtime LLM
- [ADR 003](docs/adrs/003-static-rendering-client-app.md) — static rendering + client-side app (no per-request SSR)
- [ADR 004](docs/adrs/004-offline-first-progress-sync.md) — offline-first progress sync across devices
- [ADR 005](docs/adrs/005-minimal-service-worker-pwa.md) — minimal hand-written service worker
- [ADR 006](docs/adrs/006-single-password-stateless-auth.md) — single-password, stateless JWT auth
- [ADR 007](docs/adrs/007-daily-reading-corpus.md) — daily contextual reading corpus (build-time, zero-runtime matching)
- [ADR 008](docs/adrs/008-dictation-spelling-exercise.md) — Dictation spelling exercise (gap algorithm, separate KV-synced progress track)
- [ADR 009](docs/adrs/009-grammar-reference.md) — A1/A2 grammar reference (static JSON, read-only, no progress)
- [ADR 010](docs/adrs/010-grammar-quiz.md) — grammar practice quiz (static build-time-verified item bank, KV-synced per-topic progress)
- [ADR 011](docs/adrs/011-personal-mistakes-corpus.md) — personal mistakes corpus (write-time quality gate, union-by-id KV sync)
- [ADR 012](docs/adrs/012-online-grammar-practice.md) — online adaptive grammar practice (AI-generated batches over the frozen bank)
- [ADR 013](docs/adrs/013-runtime-fetched-corpora.md) — corpora fetched at runtime and SW-precached, not bundled into the JS
