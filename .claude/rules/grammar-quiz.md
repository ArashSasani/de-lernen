---
paths:
  - 'src/lib/grammar-quiz*.ts'
  - 'src/app/grammar/**'
  - 'src/hooks/useGrammarQuizSync.ts'
  - 'src/app/api/grammar-quiz/**'
  - 'scripts/build-grammar-bank.mjs'
  - 'data/sources/grammar-bank.src.json'
---

# Grammar quiz spec (`src/lib/grammar-quiz.ts`)

Static, build-time-verified item bank. See **[ADR 010](../../docs/adrs/010-grammar-quiz.md)**. Key facts:

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
- **Synced progress**, keyed by topic id, in its own `grammar-quiz` IndexedDB store and **KV**
  (`user:grammar-quiz` via `api/grammar-quiz`) — newest-wins by `lastSeen`, mirroring dictation
  (ADR 008) but without the `starred` OR-merge (the type has no such field).
