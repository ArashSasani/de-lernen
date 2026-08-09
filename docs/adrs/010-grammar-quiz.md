# ADR 010 — Grammar Practice Quiz

**Status:** Accepted  
**Implementation:** `src/types/grammar-quiz.ts` (question + progress types),
`src/lib/grammar-quiz.ts` (thin lookup over the frozen item bank),
`src/lib/grammar-quiz-sync.ts` (IndexedDB load/save + remote KV sync + merge),
`src/hooks/useGrammarQuizSync.ts` (`recordAttempt` glue, debounced KV push,
keepalive flush on hide/pagehide),
`src/app/api/grammar-quiz/route.ts` (auth + merge-write KV),
`src/lib/db.ts` (`loadGrammarQuiz`/`saveGrammarQuiz`/`mergeGrammarQuiz`, server),
`src/app/grammar/quiz/` (page + helpers + tests),
`src/components/GrammarQuizCard/` (multiple-choice card + helpers + tests),
`src/app/grammar/page.tsx` (per-topic + smart-quiz entry points),
`src/lib/idb.ts` (`grammar-quiz` object store),
`data/sources/grammar-bank.src.json` (authored source),
`data/grammar-bank.json` (frozen build output),
`scripts/build-grammar-bank.mjs` (build-time validation + freeze)

## Context

The grammar reference (ADR 009) is read-only: a learner can consult it but cannot _practice_.
Reading "weak verbs add `-st` in the 2nd person" doesn't build the recall that conjugating
`du ___ (arbeiten)` does. We want an interactive quiz on top of the existing grammar content so
the learner can test each topic and get a smart mix of the topics they're weakest on.

Three constraints shape the design — the same ones that shape every other feature here:

- **Invariant 1 — zero runtime LLM.** Questions are frozen data, not generated code. No
  question-generation API call, ever.
- **Mirror the dictation track's shape (ADR 008), including KV sync.** Like dictation, quiz
  practice is a self-test with attempts/correct/streak counters — not a spaced-repetition schedule
  — and like dictation it's synced to KV so progress follows the learner across devices, keyed by
  topic id instead of word id. There's no `starred` field, so the merge is a plain newest-wins by
  `lastSeen` with no OR-merge step.
- **Follow the build-time data pipeline pattern (ADR 002).** Author content once into a source
  file, validate and freeze it with a deterministic build script, import the frozen output at
  runtime — the same discipline used for `words.json` and `daily-texts.json`.

## Decision

### Static, build-time-verified item bank — zero runtime LLM

Each quiz item is a `{ id, topicId, level, difficulty, prompt, choices, correctIndex,
explanation }` record. Items are authored once into `data/sources/grammar-bank.src.json`, grounded
in each topic's `grammar.json` title/explanation/tables/examples. The deterministic build script
`scripts/build-grammar-bank.mjs` (`npm run build:grammar-bank`) validates every item and freezes
the bank into `data/grammar-bank.json` — a committed build artifact imported at runtime by
`src/lib/grammar-quiz.ts`, like `words.json` and `daily-texts.json`.

`src/lib/grammar-quiz.ts` is a thin lookup over the frozen bank: `generateQuestionsForTopic`
filters by `topicId` + shuffles + slices; `allQuizzableTopicIds` returns the distinct topic ids
present in the bank; `isQuizzableTopic` checks bank membership. Randomness (shuffle) means
repeated visits to a topic vary the question order.

### Build-time validation — deterministic hard gate

The build script checks every item against:

- `topicId` exists in `data/grammar.json` and isn't in `NO_QUIZ_TOPICS` (`nomen-grossschreibung`
  is reference-only)
- `level` ∈ `{a1, a2, b1}`, `difficulty` ∈ `{easy, medium, hard}`
- `choices` has 3–4 unique, non-empty strings
- `correctIndex` is an integer in range `[0, choices.length)`
- `prompt` and `explanation` are non-empty
- `id` is globally unique
- `prompt` is unique within its `topicId` (no duplicate prompts per topic)
- every quizzable topic has ≥ 8 items (the min-items floor)

On any problem, the script prints all problems and exits non-zero. On success, it sorts items by
`topicId` then `id`, writes `data/grammar-bank.json`, and prints a coverage summary (counts by
topic, level, difficulty). Correctness itself is human-reviewed once during authoring and frozen,
like the hand-written translations in `words.json`.

### Multiple-choice only

`QuizQuestion` carries `choices` + `correctIndex` — every question is multiple-choice. A
free-text fill-in mode was considered and **not** built: it needs answer-normalization (umlauts,
articles, capitalization, synonyms) that is exactly the fuzzy work this app pushes to build time
elsewhere, and the dictation track (ADR 008) already covers exact-spelling recall. Multiple-choice
keeps grading trivially deterministic and the card simple.

After answering, the card shows an explanation panel: "Richtig!" or the correct answer on wrong,
plus the item's `explanation` text — reinforcing _why_ the answer is what it is.

### Two entry points, one route

Both entry points live on the existing `/grammar` page (ADR 009):

- **Per-topic quiz** — each topic card links to `/grammar/quiz?topic=<id>` → `buildTopicQuiz`
  picks up to 10 questions for that one topic.
- **Smart mix** — the header links to `/grammar/quiz` (no `topic` param) → `buildSmartQuiz`
  builds a ~12-question session across topics, prioritized.

There is a **single route**, `src/app/grammar/quiz/page.tsx`, that branches on
`searchParams.get('topic')` — no `[topicId]` dynamic segment. The page reads the param inside a
`Suspense` boundary (required for `useSearchParams` in a statically-rendered client page, ADR 003).

### Smart-mix prioritization — tiered, struggling-first

`buildSmartQuiz` (in `page.helpers.ts`) sorts quizzable topics into four tiers and fills the
session from the top:

0. **Struggling** — `attempts ≥ 2` and accuracy `< 0.7` (fix errors before adding new topics)
1. **Never seen** — `attempts === 0`
2. **Stale** — last seen > 3 days ago
3. **Everything else**

Within a tier it breaks ties by accuracy (tier 1) or `lastSeen` (tiers 2–3), over a shuffled base
so equal-priority topics rotate. It then picks ~2 questions per topic until the session size
(`QUIZ_SESSION_SIZE = 12`) is filled, and shuffles the result. This mirrors the dictation
queue-builder's intent (ADR 008) — weak and unseen items first — adapted to per-topic counters.

> Note the tier ordering is load-bearing: a unit test pins **struggling above never-seen**, so a
> topic the learner keeps missing is never crowded out by untouched topics.

### Progress: synced `grammar-quiz` IndexedDB store + KV

```ts
interface GrammarQuizTopicProgress {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number; // timestamp ms
}
type GrammarQuizProgressMap = Record<string, GrammarQuizTopicProgress>; // keyed by topicId
```

Identical shape to `DictationWordProgress` (ADR 008) minus `starred`, and **keyed by `topicId`**,
not word id — the unit of mastery is a grammar topic, not a word. Stored in its own IndexedDB
object store (`grammar-quiz`) under a single `'data'` key via `grammar-quiz-sync.ts`; the
`useGrammarQuizSync` hook's `recordAttempt(topicId, correct)` updates the counters, writes
through to IndexedDB immediately, and debounces (~2s) a push of the changed topic(s) to a new KV
key, `user:grammar-quiz`, via `GET`/`PUT /api/grammar-quiz` (auth'd the same way as
`api/dictation`). Merge is newest-wins by `lastSeen` (`mergeGrammarQuiz` in `db.ts`, mirrored
client-side in `grammar-quiz-sync.ts`) — no OR-merge step since there's no `starred` field to
preserve. Like the other two tracks, the pending push is flushed synchronously on
`visibilitychange`/`pagehide` with `fetch(..., { keepalive: true })` so a backgrounded/killed PWA
doesn't lose the last few answers (see the durability note in the sync spec, ADR 004).

The store is added to the existing `de-flashcards` IndexedDB database in `idb.ts` alongside
`progress` and `dictation`. (The shared `getDB()` handle gained the `grammar-quiz` store via the
normal `upgrade` callback; new stores are created idempotently if missing.)

### Offline availability

`/grammar/quiz` is added to the `PRECACHE` list in `public/sw.js` and the cache version constant
is bumped, so the quiz is available offline after first load — consistent with `/grammar` and the
other routes (ADR 005 / ADR 009).

## Consequences

- **Invariants hold.** Zero runtime LLM (questions are frozen committed data);
  offline-safe (bundled JSON, precached route); auth reuses the existing JWT gate (ADR 006), no
  new secrets or user model.
- **Correctness is reviewable.** Every question is visible in the source file — unlike generated
  questions, there is no hidden logic that could silently produce a wrong answer. The build gate
  catches structural problems; content correctness is reviewed once during authoring.
- **Adding content = editing one file + rebuilding.** New questions, new topics, or new levels are
  added to `grammar-bank.src.json` and frozen with `npm run build:grammar-bank`. No code changes
  needed, and the same min-8-per-topic gate applies uniformly across every level.
- **Quiz history follows the learner across devices**, same as dictation (ADR 008) and Leitner
  (ADR 004) — a third KV key (`user:grammar-quiz`) alongside `user:progress` and `user:dictation`.
- **Multiple-choice ceiling.** No production-style recall (typing the form). Mitigated by
  dictation covering exact spelling; revisit only if recall practice is explicitly wanted.
