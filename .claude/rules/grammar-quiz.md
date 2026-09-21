---
paths:
  - 'src/lib/grammar-quiz*.ts'
  - 'src/app/grammar/**'
  - 'src/hooks/useGrammarQuizSync.ts'
  - 'src/hooks/useQuizQueue.ts'
  - 'src/hooks/useMistakeNotes*.ts'
  - 'src/lib/mistakes-prompt.ts'
  - 'src/app/api/grammar-quiz/**'
  - 'scripts/build-grammar-bank.mjs'
  - 'data/sources/grammar-bank.src.json'
---

# Grammar quiz spec (`src/lib/grammar-quiz.ts`)

Static, build-time-verified item bank, plus an online adaptive generator layered on top. See
**[ADR 010](../../docs/adrs/010-grammar-quiz.md)** and
**[ADR 012](../../docs/adrs/012-online-grammar-practice.md)**. Key facts:

- **Zero runtime LLM by default; the bank is the offline fallback for the online tier.** Each bank
  item is `{ id, topicId, level, difficulty, prompt, choices, correctIndex, explanation }`, plus
  an optional `acceptableIndices?: number[]` (defaults to `[correctIndex]`) every item shares.
  Bank items are authored once into `data/sources/grammar-bank.src.json`, grounded in each topic's
  `grammar.json` title/explanation/tables/examples, and frozen by
  `scripts/build-grammar-bank.mjs` into `data/grammar-bank.json` (imported like
  `words.json`/`daily-texts.json`).
- **Verification = a deterministic hard gate, not build-time answer-proving**, for the bank.
  The build script checks topicId validity + quizzability, level/difficulty enums, 3–4 unique
  non-empty choices, `correctIndex` in range, non-empty `explanation`, globally unique `id`, no
  duplicate prompt per topic, and a min-items-per-topic floor (8) — exits non-zero on any problem.
  Correctness itself is human/AI-reviewed once during authoring and frozen, like V1's hand-written
  `GOETHE_EN`. **Multiple-choice only** (`choices` + `correctIndex`/`acceptableIndices`) — no
  free-text fill-in.
- **`src/lib/grammar-quiz.ts` is a thin lookup** over the frozen bank: `generateQuestionsForTopic`
  filters by `topicId` + shuffles + slices; `allQuizzableTopicIds` returns the distinct topic ids
  present in the bank; `isQuizzableTopic` checks bank membership. No `GENERATORS` registry, no
  `Math.random` distractor-picking.
- **Two entry points, one route.** `/grammar` links to a per-topic quiz
  (`/grammar/quiz?topic=<id>`, up to 10 questions) and a smart mix (`/grammar/quiz`, ~12
  questions). The single page branches on `searchParams.get('topic')` — no `[topicId]` segment.
- **`selectQuizTopics` (pure planner) + `sourceQuestions` (async sourcer, `lib/grammar-quiz-ai.ts`).**
  `selectQuizTopics(progress, opts?)` tiers topics **struggling-first** — (0) struggling
  `attempts≥2 & accuracy<0.7` (tiebreak: accuracy), (1) never-seen `attempts===0` (tiebreak: none,
  stays in shuffle order), (2) stale `>3d`, (3) rest — and returns a `QuizPlan[]` of
  `{ topicId, count, tier, difficulty }`. The plan's `difficulty` is a starting point:
  `useQuizQueue` re-derives it per batch from live progress plus the session's recent results, so
  a hot streak escalates mid-session. `sourceQuestions(plan, opts)` never throws: not
  online → the bank; otherwise call `/api/ai`'s `grammar` intent, re-validate every item
  client-side, and on any failure/invalid shape return the bank slice with `degraded: true`.
- **One batch, one topic; `useQuizQueue` owns the batch pipeline.** Each AI request generates 3–4
  questions for exactly one topic (`GRAMMAR_BATCH_SIZE_MIN`/`MAX`). **Batch 0 is served from the
  bank synchronously** so the first question renders with no wait; generation starts at batch 1
  and has the whole of batch 0's answering time to land. Further batches chain, so a later one
  loads while the learner answers the current one. A batch that stalls past a short timeout falls
  back to the bank **for that batch only** — the generator stays enabled for the rest of the run,
  since outrunning one slow response is ordinary and must not cost the whole session.
  AI-generated items get `id: ai-<topicId>-<uuid8>` (stamped client-side from the validated
  response, never the model) — cannot collide with the bank's `<slug>-<2 digits>` shape, and
  `isAiGenerated()` reads that `AI_QUESTION_ID_PREFIX` to mark a generated card with a **sparkle
  icon** (bank cards carry no marker), so the learner can always tell which tier a question came
  from. Generated `explanation` text is **English**, matching the bank's voice — the German is in
  the prompt and choices. Bank picks are deduped across
  batches (`generateQuestionsForTopic(..., excludeIds)`) — each call reshuffles the whole topic
  pool, so a chunked per-topic session would otherwise repeat items.
- **Difficulty skews harder than the bank's resting distribution** (`difficultyFor`): `easy` only
  for a never-attempted topic; a struggling topic holds `medium` (scaffolding via explanation and
  injected mistake notes, not an easier question) rather than dropping to `easy`; a well-performing
  topic with a strong recent run escalates to `hard`. A topic's own `level` is always a difficulty
  _ceiling_ — the Settings learner-level pref raises explanation register only, never question
  difficulty.
- **Synced progress**, keyed by topic id, in its own `grammar-quiz` IndexedDB store and **KV**
  (`user:grammar-quiz` via `api/grammar-quiz`) — newest-wins by `lastSeen`, mirroring dictation
  (ADR 008) but without the `starred` OR-merge (the type has no such field). AI answers and bank
  answers share this one map (see ADR 012's named tradeoff).
- **A missed question can author a mistakes-corpus note** (`useMistakeNotes.ts`), once per topic
  per session under `MAX_NOTES_PER_SESSION` — see `.claude/rules/data-model.md` for the corpus
  itself.
