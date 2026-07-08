# ADR 010 — Grammar Practice Quiz

**Status:** Accepted  
**Implementation:** `src/types/grammar-quiz.ts` (question + progress types),
`src/lib/grammar-quiz.ts` (template question generators + registry),
`src/lib/grammar-quiz-sync.ts` (IndexedDB load/save, local-only),
`src/hooks/useGrammarQuizProgress.ts` (`recordAttempt` glue),
`src/app/grammar/quiz/` (page + helpers + tests),
`src/components/GrammarQuizCard/` (multiple-choice card + helpers + tests),
`src/app/grammar/page.tsx` (per-topic + smart-quiz entry points),
`src/lib/idb.ts` (`grammar-quiz` object store)

## Context

The grammar reference (ADR 009) is read-only: a learner can consult it but cannot _practice_.
Reading "weak verbs add `-st` in the 2nd person" doesn't build the recall that conjugating
`du ___ (arbeiten)` does. We want an interactive quiz on top of the existing grammar content so
the learner can test each topic and get a smart mix of the topics they're weakest on.

Three constraints shape the design — the same ones that shape every other feature here:

- **Invariant 1 — zero runtime LLM.** Questions must be generated on-device from data already in
  the repo (`grammar.json`, `words.json`). No question-generation API call, ever.
- **Mirror the dictation track's shape (ADR 008), not the Leitner track.** Like dictation, quiz
  practice is a self-test with attempts/correct/streak counters — not a spaced-repetition schedule.
  Unlike dictation, though, the quiz track stays **local-only** with no KV sync: the data is cheap
  to regenerate, low-stakes, and not worth the per-device merge complexity. (Dictation itself was
  later upgraded to KV sync — see ADR 008 — but the quiz track has not, and that asymmetry is
  intentional.)
- **Build on the grammar content already authored.** No new authored artifact — the quiz reads
  the same `data/grammar.json` the reference page renders.

## Decision

### Template question generators — zero runtime LLM

`src/lib/grammar-quiz.ts` holds ~20 small, pure generator functions, one family per grammar
shape (conjugation, modal verb, article gender, case declension, pronoun, preposition,
Perfekt haben/sein, negation, separable verb, Imperativ, Partizip II, possessive, temporal/lokal
preposition, W-Fragen…). Each takes a `GrammarTopic` and returns a `QuizQuestion` — a prompt, a
set of multiple-choice `choices`, and the `correctIndex` — built deterministically from the
topic's tables/examples plus, where useful, real nouns from `words.json` (e.g. article-gender
questions pull actual `pos: 'noun'` words with a known `article`). A `GENERATORS` registry maps
`topicId → generator`; any topic without a bespoke generator falls back to `generateFromExample`,
which turns one of the topic's `{ de, en }` examples into a blank-the-key-word question.
`allQuizzableTopicIds()` is the set of topics that either have a generator or ≥3 examples.

This is the build-time-LLM / zero-runtime-LLM split (ADR 002) taken one step further: here there
is **no** LLM at any stage — the questions are computed from already-authored data by ordinary
code. Randomness (`shuffle`, distractor `pick`) means repeated visits to a topic vary.

### Multiple-choice only

`QuizQuestion` carries `choices` + `correctIndex` — every question is multiple-choice. A
free-text fill-in mode was considered and **not** built: it needs answer-normalization (umlauts,
articles, capitalization, synonyms) that is exactly the fuzzy work this app pushes to build time
elsewhere, and the dictation track (ADR 008) already covers exact-spelling recall. Multiple-choice
keeps grading trivially deterministic and the card simple. (`QuizQuestion.hint` exists in the type
but the card does not render it — an English gloss was tried and removed as clutter.)

### Two entry points, one route

Both entry points live on the existing `/grammar` page (ADR 009):

- **Per-topic quiz** — each topic card links to `/grammar/quiz?topic=<id>` → `buildTopicQuiz`
  generates up to 10 questions for that one topic.
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
so equal-priority topics rotate. It then generates ~2 questions per topic until the session size
(`QUIZ_SESSION_SIZE = 12`) is filled, and shuffles the result. This mirrors the dictation
queue-builder's intent (ADR 008) — weak and unseen items first — adapted to per-topic counters.

> Note the tier ordering is load-bearing: a unit test pins **struggling above never-seen**, so a
> topic the learner keeps missing is never crowded out by untouched topics.

### Progress: local-only `grammar-quiz` IndexedDB store

```ts
interface GrammarQuizTopicProgress {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number; // timestamp ms
}
type GrammarQuizProgressMap = Record<string, GrammarQuizTopicProgress>; // keyed by topicId
```

Identical shape to `DictationWordProgress` (ADR 008), but **keyed by `topicId`**, not word id —
the unit of mastery is a grammar topic, not a word. Stored in its own IndexedDB object store
(`grammar-quiz`) under a single `'data'` key via `grammar-quiz-sync.ts`; the
`useGrammarQuizProgress` hook's `recordAttempt(topicId, correct)` updates the counters and writes
through on every answer. **No KV sync, no server route, no change to the auth or `mergeProgress`
layers** (ADR 004 / ADR 006) — strictly additive, exactly like dictation.

The store is added to the existing `de-flashcards` IndexedDB database in `idb.ts` alongside
`progress` and `dictation`. (The shared `getDB()` handle gained the `grammar-quiz` store via the
normal `upgrade` callback; new stores are created idempotently if missing.)

### Offline availability

`/grammar/quiz` is added to the `PRECACHE` list in `public/sw.js` and the cache version constant
is bumped, so the quiz is available offline after first load — consistent with `/grammar` and the
other routes (ADR 005 / ADR 009).

## Consequences

- **Invariants hold.** Zero runtime LLM (questions are computed from committed data);
  offline-safe (generators + bundled JSON, precached route); no KV/auth/server changes.
- **Practice without new content.** The quiz reuses `grammar.json` and `words.json` — adding or
  editing a grammar topic automatically changes what can be quizzed; no second artifact to keep
  in sync.
- **Coverage scales with generators, with a safe floor.** A topic with a bespoke generator gets
  rich, varied questions; any topic with ≥3 examples still gets `generateFromExample`. Adding a
  new question style is one function + one registry entry.
- **Local-only is a deliberate limitation.** Quiz history does not follow the learner across
  devices. Accepted for the same reasons as dictation (ADR 008): low-stakes, regenerable, and not
  worth merge complexity. If this ever needs syncing, it would extend the KV schema the same way
  the Leitner track does (ADR 004).
- **Multiple-choice ceiling.** No production-style recall (typing the form). Mitigated by
  dictation covering exact spelling; revisit only if recall practice is explicitly wanted.
