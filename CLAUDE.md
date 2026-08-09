# CLAUDE.md — project context for the agent

This file is the **source of truth** for the project's spec and invariants — the data model,
the Leitner / sync / auth specs, the data-pipeline design, and the corrections policy. It is
self-contained.

## What this is

A single-user, offline-first, installable PWA for studying German vocabulary (A1, A2;
extensible to further levels) with Leitner-box spaced repetition. Vocabulary is compiled
**once** from source PDFs into a static `data/words.json`. The deployed app makes **zero LLM calls**.

User: one person. No multi-user auth, no user database. A single password gate is enough.

## Hard invariants (do not violate)

1. **No LLM/translation API in the running app or on Vercel.** All translation/fixing and text
   authoring happens in the one-time local data build, whose output lives in the repo as static
   files. Vercel only ever sees source code, `words.json`, `daily-texts.json`, `grammar.json`,
   and env-var secrets.
2. **Secrets only in env.** `APP_PASSWORD`, `TOKEN_SECRET`, `KV_*` live in `.env.local`
   (gitignored) and the Vercel dashboard. Never commit them. Never hardcode them.
3. **Static word data is immutable at runtime.** The app never writes to `words.json`. The only
   mutable, synced state is the user's `ProgressMap`.
4. **Offline must work.** Studying, grading, and local persistence must function with no network.
   Sync is best-effort on top.
5. **Deploy is Vercel CLI, not GitHub.** No `.github/`, no Actions. (User may add GitHub later.)
6. **Git commits are the user's call, not the agent's.** The repo is git-initialized, but the
   agent must **not** run `git commit`/`git push`, create branches, or prompt the user to commit
   unless explicitly asked — just leave finished work in the working tree. `.gitignore` keeps
   secrets, build output, and generated caches out of any commit the user makes. See README →
   "Git".
7. **No private-planning language in tracked docs.** `docs/new/` and any other private/scratch
   spec directories are gitignored and stay that way. Tracked docs (README.md, CLAUDE.md,
   `docs/adrs/*.md`) must **never** reference internal milestone labels (`M1`, `M2`, "v2 spec",
   "next-phase plan", etc.) or link to gitignored paths. Describe features in their finished
   state, not by the increment that delivered them — a reader coming to the repo cold shouldn't
   see planning artifacts. When implementing a milestone from `docs/new/`, land the code and
   update tracked docs to describe the resulting behavior; leave the milestone label in the
   private spec.

## Architecture

- **Next.js App Router + TypeScript.** Client components for the study UI; three serverless
  routes for auth and sync (`api/login`, `api/progress`, `api/dictation`).
- **Rendering: static shell + client-side app, no per-request SSR.** See
  **[ADR 003](docs/adrs/003-static-rendering-client-app.md)**. Pages are prerendered to a static
  shell at build time (SSG) and run on the client (CSR); `words.json` is a bundled `import`, not a
  server fetch. The layout is a static server component (document shell + PWA metadata); the only
  per-request server code is `api/login`, `api/progress`, and `api/dictation` (JSON, not HTML). Don't add
  `force-dynamic` or server-side page data fetching — it would break the offline guarantee.
- **Persistence split:** static word data (bundled JSON) is separate from progress (mutable).
  Progress lives in **IndexedDB** locally and a single **Vercel KV** key remotely.
- **Sync model:** offline-first. Local is authoritative offline; on load / on change (debounced)
  / on reconnect, push changed progress and merge **newest-wins per word** by `lastReviewed`.
  Implement the same merge on client and server so neither device clobbers the other.

## Data model (`src/types`)

```ts
type Article = 'der' | 'die' | 'das';
type Pos = 'noun' | 'verb' | 'adj' | 'adv' | 'other';
type Box = 1 | 2 | 3 | 4 | 5;
type Level = 'a1' | 'a2' | 'b1';

interface Word {
  id: string; // slug of lemma: lowercase, ä→ae ö→oe ü→ue ß→ss, non-alnum→'-'
  lemma: string; // "Abend", "aufstehen", "zu Hause"
  article: Article | null;
  plural: string | null; // full plural form for nouns, else null
  en: string; // English translation
  pos: Pos;
  examples: string[]; // example sentences (may be empty)
  sources: string[]; // any of: 'telc-a1.1' | 'telc-a1.2' | 'goethe' | 'telc-a2.1' | 'telc-a2.2' | 'goethe-a2'
  levels: Level[]; // every level whose source material includes this word; merge-on-id accumulates this
  corrected?: boolean; // true if its English/example was fixed in the build
}

interface WordProgress {
  box: Box;
  lastReviewed: number;
  nextDue: number;
} // timestamps in ms
type ProgressMap = Record<string, WordProgress>; // keyed by Word.id

interface DictationWordProgress {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number; // timestamp ms
  starred?: boolean; // bookmarked for focused practice
}
type DictationProgressMap = Record<string, DictationWordProgress>; // keyed by Word.id

interface GrammarQuizTopicProgress {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number; // timestamp ms
}
type GrammarQuizProgressMap = Record<string, GrammarQuizTopicProgress>; // keyed by topicId
```

`words.json` stays a **single flat array** across all levels — a word reused across levels (e.g.
introduced at A1, reappearing in A2 source material) is one merged entry whose `levels[]` accumulates
every level it appears in, not split per-level files. For filtering, `lib/words.ts`'s `wordLevel(word)`
resolves a word's **lowest** level (`a1` < `a2` < `b1`), so a word tagged `['a1', 'a2']` is scoped under
the A1 filter only — levels never overlap in the study queue. `FilterBar` exposes this as a "Level" chip
row (`FilterBar/index.helpers.ts`'s `LEVEL_CHIPS`) alongside Box/Type; `b1` is hidden from the chips
until a B1 source is extracted (nothing currently carries that level).

Dictation progress is a **separate track** from the Leitner `ProgressMap` — stored in its own
IndexedDB object store (`dictation`) and **synced to KV** (`user:dictation`). Merge strategy:
newest-wins by `lastSeen`; `starred` is OR-merged so a bookmark is never lost across devices.
See [ADR 008](docs/adrs/008-dictation-spelling-exercise.md).

Grammar types (`GrammarCategory`, `GrammarTable`, `GrammarExample`, `GrammarTopic`) live in
`src/types/index.ts` and are imported from `data/grammar.json` by `src/lib/grammar.ts`. Every
`GrammarTopic` carries a `level: Level` (like `DailyText.level` — one level per topic, not
`Word.levels[]`, since a hand-authored topic isn't merged across sources); `/grammar` exposes an
All/A1/A2 chip row (`LEVEL_CHIPS` in `page.helpers.ts`) alongside the category accordions. Grammar
**reference** is read-only with no progress track. The grammar **quiz** (`QuizQuestion`,
`GrammarQuizTopicProgress`, `GrammarQuizProgressMap` in `src/types/grammar-quiz.ts`) adds a third
**local-only** progress track — its own IndexedDB store (`grammar-quiz`), keyed by topic id, no
KV sync. See [ADR 009](docs/adrs/009-grammar-reference.md) and
[ADR 010](docs/adrs/010-grammar-quiz.md).

The three IndexedDB object stores in the `de-flashcards` database (`src/lib/idb.ts`): `progress`
(Leitner, synced to KV `user:progress`), `dictation` (synced to KV `user:dictation`),
`grammar-quiz` (local-only).

## Leitner spec (`src/lib/leitner.ts`)

See **[ADR 001](docs/adrs/001-leitner-spaced-repetition.md)** for the full rationale and grading
rules. Key facts:

- Boxes 1–5 with intervals in days: **1 / 3 / 7 / 16 / 30** (single `INTERVALS` constant).
- **Got it** → advance one box; **Miss** → back to box 1; **Easy** → jump to box 5.
- Daily queue = due cards (`nextDue <= now`), sorted `nextDue asc`, then `box asc`.

## Sync / merge spec

See **[ADR 004](docs/adrs/004-offline-first-progress-sync.md)** for the full rationale, the
multi-device worked example, and the tradeoffs (clock-dependence, per-word granularity). Key facts:

- KV holds one key, `user:progress`, containing the whole `ProgressMap`.
- `mergeProgress(local, remote)`: start from remote; for each word in local, take local if it's
  new or has a strictly newer `lastReviewed`. Pure function, no side effects — share it between
  `src/lib/db.ts` (server) and a client-safe copy used by `src/lib/sync.ts`.
- Client flow: load IndexedDB → fetch remote → merge → save merged locally and PUT to server.
  On every grade: write IndexedDB immediately, debounce (~2s) the remote PUT.
- **Durability against the iOS PWA lifecycle.** A backgrounded/killed PWA never runs its debounce
  timer or React unmount, so the last grades would otherwise be lost — and once iOS evicts
  IndexedDB, a graded high-box card silently reverts to box 1. To prevent this, flush the pending
  PUT **synchronously on `visibilitychange` (hidden) and `pagehide`** using `fetch` with
  `keepalive: true` (survives teardown, keeps the Bearer header — unlike `sendBeacon`), and request
  **persistent storage** (`navigator.storage.persist()`) on load to make eviction less likely.

## Auth spec

See **[ADR 006](docs/adrs/006-single-password-stateless-auth.md)** for the full rationale and
tradeoffs (no refresh tokens, stolen-token window, `localStorage` vs cookie). Key facts:

- `POST /api/login {password}` → compare to `APP_PASSWORD` → on match, sign a JWT
  (jose, HS256, 30-day expiry, `TOKEN_SECRET`) and return it. Client stores it in localStorage.
- `GET /api/progress` / `PUT /api/progress` → require `Authorization: Bearer <jwt>`, verify, then
  read/merge-write KV. 401 on missing/invalid token; client clears the token and routes to login.
- No refresh tokens, no sessions table. Stateless JWT is fine for one user.

## Grammar quiz spec (`src/lib/grammar-quiz.ts`)

Static, build-time-verified item bank. See **[ADR 010](docs/adrs/010-grammar-quiz.md)**. Key facts:

- **Zero runtime LLM, questions are frozen data, not generated code.** Each item is
  `{ id, topicId, level, difficulty, prompt, choices, correctIndex, explanation }`. Authored once
  into `data/sources/grammar-bank.src.json`, grounded in each topic's `grammar.json`
  title/explanation/tables/examples, and frozen by `scripts/build-grammar-bank.mjs` into
  `data/grammar-bank.json` (imported like `words.json`/`daily-texts.json`).
- **Verification = a deterministic hard gate, not build-time answer-proving.** The build script
  checks topicId validity + quizzability, level/difficulty enums, 3–4 unique non-empty choices,
  `correctIndex` in range, non-empty `explanation`, globally unique `id`, no duplicate prompt per
  topic, and a min-items-per-topic floor (8) — exits non-zero on any problem. Correctness itself is
  human/AI-reviewed once during authoring and frozen, like V1's hand-written `GOETHE_EN`.
  **Multiple-choice only** (`choices` + `correctIndex`) — no free-text fill-in.
- **`src/lib/grammar-quiz.ts` is a thin lookup** over the frozen bank: `generateQuestionsForTopic`
  filters by `topicId` + shuffles + slices; `allQuizzableTopicIds` returns the distinct topic ids
  present in the bank; `isQuizzableTopic` checks bank membership. No `GENERATORS` registry, no
  `Math.random` distractor-picking.
- **Two entry points, one route.** `/grammar` links to a per-topic quiz
  (`/grammar/quiz?topic=<id>`, up to 10 questions) and a smart mix (`/grammar/quiz`, ~12
  questions). The single page branches on `searchParams.get('topic')` — no `[topicId]` segment.
- **Smart-mix prioritization** (`buildSmartQuiz`, unchanged by the bank swap): tiered,
  **struggling-first** — (0) struggling `attempts≥2 & accuracy<0.7`, (1) never-seen
  `attempts===0`, (2) stale `>3d`, (3) rest; ~2 questions/topic until `QUIZ_SESSION_SIZE = 12`.
- **Local-only progress**, keyed by topic id, in its own `grammar-quiz` IndexedDB store. No KV
  sync, no server route, no auth/merge change — additive, like dictation.

## Data pipeline (build-time, `scripts/` + `data/`)

See **[ADR 002](docs/adrs/002-build-time-data-pipeline.md)** for the full rationale (why zero
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
   **[ADR 007](docs/adrs/007-daily-reading-corpus.md)**.

### Corrections policy: "only obvious"

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

## Project structure

```
src/
  app/
    layout.tsx           # static server component: PWA meta, fonts, renders <ServiceWorkerInit/>
    ServiceWorkerInit.tsx # client island: registers the service worker on mount
    page.tsx             # redirect → /study
    login/
      page.tsx           # password form
      page.helpers.ts    # requestLogin() — POST /api/login, map result
      page.helpers.test.ts
    study/
      page.tsx           # main: queue, grading, filter, stats, daily-reading modal (sync via useProgressSync)
      page.helpers.ts    # gradeWord / buildQueue / queueBoxCounts / progressFor (shuffle re-exported from lib/shuffle)
      page.helpers.test.ts
    read/
      page.tsx           # daily reading: today's pick + browsable list of all texts
      page.helpers.ts    # groupByTopic()
      page.helpers.test.ts
    dictation/
      page.tsx           # dictation exercise: gap-fill cards, session queue, stats
      page.helpers.ts    # buildDictationQueue / sessionStats
      page.helpers.test.ts
    grammar/
      page.tsx           # read-only grammar reference: category sections + expandable topic cards; per-topic + smart-quiz links
      page.helpers.ts    # activeGroups / toggleOpen / splitParagraphs
      page.helpers.test.ts
      quiz/
        page.tsx         # grammar quiz: per-topic (?topic=id) or smart-mix session; queue, grading, stats
        page.helpers.ts  # buildSmartQuiz (tiered, struggling-first) / buildTopicQuiz / sessionStats / QUIZ_SESSION_SIZE
        page.helpers.test.ts
    api/login/route.ts
    api/progress/route.ts
    api/dictation/route.ts
  components/             # one folder per component: index.tsx + index.helpers.ts + test
    AppNav/              # hamburger menu (mobile) + inline links (desktop); logout; active-route highlight
    DailyReading/        # daily A1/A2 text: highlighted target words, tap-for-gloss popover
      index.tsx          # props: text, strugglingIds?, highlightAll? (filter vs two-tier mode)
      index.helpers.ts   # toSegments() / glossFor() / resolveHighlight()
      index.helpers.test.ts
    FlashCard/           # 3D flip, German front / English+example back, Skip pre-flip / grade buttons post-flip
      index.tsx
      index.helpers.ts   # article/plural colours, resultBoxes()
      index.helpers.test.ts
    FilterBar/           # box (incl. "Due") / type / level chips
      index.tsx
      index.helpers.ts   # POS_CHIPS, BOX_CHIPS, LEVEL_CHIPS
      index.helpers.test.ts
    LeitnerStats/        # box distribution bars
      index.tsx
      index.helpers.ts   # statBars()
      index.helpers.test.ts
    DictationCard/       # gap-fill dictation card: question → result with article + gap highlight
      index.tsx
      index.helpers.ts   # checkAnswer() / fullDisplay() / gapInputWidth() / ARTICLE_COLOR
      index.helpers.test.ts
    GrammarTableView/    # renders a GrammarTable as a styled grid
      index.tsx
    GrammarExampleView/  # renders a GrammarExample (de + muted en)
      index.tsx
    GrammarQuizCard/     # multiple-choice quiz card: prompt → choice buttons → result; Skip / Next; keyboard 1–N + Enter
      index.tsx
      index.helpers.ts   # choiceStyle()
      index.helpers.test.ts
    SpeakButton/         # pronunciation button (Web Speech API, German voice)
      index.tsx
      index.helpers.ts   # speakButtonClass()
      index.helpers.test.ts
  constants/
    index.ts             # GRADE / POS / ARTICLE / ARTICLE_COLOR / BOXES / LEVELS / FILTER value constants
  lib/
    words.ts             # import words.json; wordById + source-filter helper
    daily-texts.ts       # import daily-texts.json; dailyTexts, dailyTextById
    grammar.ts           # import grammar.json; grammarTopics, topicsByCategory, grammarTopicById
    grammar-quiz.ts      # thin lookup over the frozen grammar-bank.json; generateQuestionsForTopic / allQuizzableTopicIds / isQuizzableTopic
    grammar-quiz-sync.ts # IndexedDB load/save for GrammarQuizProgressMap (local-only, no KV)
    daily.ts             # strugglingIds / scoreText / pickDailyText + once-per-day localStorage gating
    leitner.ts           # intervals, isDue, onGood/onMiss/onEasy, counts
    shuffle.ts           # shuffle(): Fisher–Yates array shuffle (re-exported by study/page.helpers)
    dictation.ts         # generateGap(): ranked spelling-difficulty ruleset → Gap
    auth.ts              # signToken / verifyToken (jose)
    idb.ts               # shared IndexedDB handle (getDB) — stores: progress, dictation, grammar-quiz
    db.ts                # KV load/save + mergeProgress + loadDictation/saveDictation/mergeDictation (server)
    sync.ts              # IndexedDB + remote load/sync + token storage + pickChanged/SYNC_DEBOUNCE_MS (client)
    dictation-sync.ts    # IndexedDB load/save + remote sync + mergeDictation for DictationProgressMap
    speech.ts            # Web Speech API: getGermanVoice / speakDE (offline, no API key)
    service-worker.ts    # shouldRegisterServiceWorker / registerServiceWorker
  hooks/                 # React hooks (stateful glue), kept out of lib/ which is framework-agnostic logic
    useProgressSync.ts   # shared study/read sync: debounced KV push + keepalive flush on hide/pagehide/unmount
    useDictationSync.ts  # dictation sync: recordAttempt + toggleStar → IndexedDB + KV (mirrors useProgressSync)
    useDictationProgress.ts # local dictation progress state: recordAttempt → IndexedDB only (no KV, no star)
    useGrammarQuizProgress.ts # grammar-quiz progress: recordAttempt(topicId, correct) → IndexedDB (no KV sync)
    useSpeech.ts         # German pronunciation: available/speaking state + speak(text)
  types/
    index.ts             # Word, WordProgress, ProgressMap, Article, Pos, Box, DailyText, DailyTextSpan, GrammarTopic (+ related)
    grade.ts             # Grade
    filter.ts            # Filter, BoxFilter, PosFilter, LevelFilter
    stats.ts             # StatBar
    auth.ts              # LoginResult
    dictation.ts         # DictationWordProgress, DictationProgressMap
    grammar-quiz.ts      # QuizQuestion, QuizDifficulty, GrammarQuizTopicProgress, GrammarQuizProgressMap
  __tests__/             # lib-level Jest tests (not co-located)
    leitner.test.ts      # Leitner transition assertions
    merge.test.ts        # mergeProgress newest-wins assertions
    sync.test.ts         # pickChanged subset + partial-push merge assertions
    service-worker.test.ts # registration-guard assertions
    daily.test.ts        # strugglingIds / scoreText / pickDailyText assertions
    dictation.test.ts    # generateGap ruleset assertions
    shuffle.test.ts      # shuffle permutation/immutability assertions
    words.test.ts        # wordById / wordLevel / source-filter assertions
public/  manifest.json, sw.js, icons/, apple-touch-icon.png
scripts/
  lib/pdf-text.mjs       # pdftotext -layout wrapper + _text/ cache
  lib/flag.mjs           # push uncertain rows to <source>_flagged.json
  extract-telc.mjs       # parse telc text → telc-a1-{1,2}.json
  extract-goethe.mjs     # parse goethe text → goethe-a1.json (A1 layout)
  extract-goethe-a2.mjs  # parse goethe A2 text → goethe-a2.json (A2 layout variant)
  build-words.mjs        # refine + merge → words.json + changelog.json
  build-daily-texts.mjs  # annotate + validate daily-texts.src.json → daily-texts.json
  build-grammar-bank.mjs # hard-gate validate + freeze grammar-bank.src.json → grammar-bank.json
  gen-icons.mjs          # generate PWA icons + apple-touch-icon.png
data/    sources/ (<level>/*.pdf + *.json per level, e.g. a1/, a2/; _text/ [gitignored]; daily-texts.src.json and grammar-bank.src.json stay at root), words.json, changelog.json, daily-texts.json, grammar.json, grammar-bank.json
```

## PWA notes

See **[ADR 005](docs/adrs/005-minimal-service-worker-pwa.md)** for the full rationale (why a
hand-written SW over `next-pwa`, cache-busting tradeoff). Key facts:

- Prefer a **minimal hand-written service worker** (cache app shell + `words.json`; never cache
  `/api/*`) over heavy plugins — `next-pwa` has App Router rough edges.
- iOS: needs `manifest.json`, `apple-touch-icon.png`, `theme-color`, and
  `apple-mobile-web-app-capable`. Installed-to-home-screen storage is more durable than a browser
  tab, but iOS can still evict IndexedDB under pressure — which is exactly why KV sync exists.

## Conventions

- TypeScript strict. Path alias `@/* → src/*`.
- Keep components small and client-only where they touch state. Pure logic (leitner, merge) stays
  in `lib/` and is unit-testable; `lib/` is framework-agnostic, so React hooks (stateful glue with
  `useRef`/`useEffect`) live in `src/hooks/`, not `lib/`.
- **Components/pages hold only JSX + hooks; their pure logic and constants live in a co-located
  helper.** Each component is a folder `Name/` with `index.tsx`, `index.helpers.ts`, and
  `index.helpers.test.ts`. Route files must stay `page.tsx` (Next.js), so pages pair with
  `page.helpers.ts` + `page.helpers.test.ts` in the same route folder. Every helper module has a
  unit-test suite.
- **All exported types and interfaces live in `src/types/`.** Import them with `@/types/...`
  directly — not re-exported through helpers or component index files.
- Tailwind for styling; dark theme by default; mobile-first (this lives on a phone).
- **Icons: use `@heroicons/react` only. Never write raw inline SVG for icons.** Use the `/24/outline` set by default; `/24/solid` only where fill is intentional (e.g. `SpeakerWaveIcon`). Size with Tailwind (`h-4 w-4`, etc.), always add `aria-hidden="true"`.
- Don't introduce a backend framework or DB beyond KV. Don't add user accounts.
