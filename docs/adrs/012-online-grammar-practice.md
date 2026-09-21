# ADR 012 — Online Adaptive Grammar Practice

**Status:** Accepted
**Implementation:** `src/types/ai.ts` (`GrammarIntentRequest`, `GeneratedQuizItem`,
`QuizMissContext`), `src/types/grammar-quiz.ts` (`QuizQuestion.acceptableIndices`),
`src/lib/ai/{prompts,validate,models}.ts` (the `grammar` structured intent; the reshaped
`note`/`judge` intents), `src/app/api/ai/route.ts` (the `grammar` branch, topic resolution),
`src/lib/grammar-quiz-ai.ts` (`sourceQuestions`), `src/app/grammar/quiz/page.helpers.ts`
(`selectQuizTopics`, `difficultyFor`), `src/hooks/useQuizQueue.ts` (the batch pipeline),
`src/hooks/useMistakeNotes.ts` (the mistakes corpus's first producer),
`src/lib/mistakes-prompt.ts` (`notesForPrompt`), `src/lib/ai-prefs.ts` (the judge pref),
`src/components/GrammarQuizCard/` (`isAcceptable`, the alternative-answer line)

## Context

The grammar quiz (ADR 010) draws from a frozen, human-verified item bank: 492 items across 54
topics, split 199 `easy` / 237 `medium` / 56 `hard`. It works offline and calls no model, but a
frozen pool is one-size-fits-all forever — it can't react to how a learner is doing within a
session, and its `hard` band barely exists.

Two pieces already shipped without ever being composed: the BYOK `/api/ai` Edge proxy (ADR 006),
proven on tap-a-word chips, and the personal-mistakes corpus (ADR 011), which shipped with a
store, sync route, and quality gate but **no producer** — ADR 011 named grammar practice as the
intended first one, because a quiz miss has exactly the graded ground truth (`correctIndex` vs.
the learner's pick) the gate's `GroundTruth` type is shaped around.

This composes both, behind the same Settings AI toggle and the existing Smart Quiz / per-topic
entry points: online, with a key configured, question generation and note authoring layer on top
of the bank instead of replacing it. Offline, AI off, or any failure, the session is exactly the
bank experience ADR 010 shipped.

## Decision

### Three capabilities justify a live generator over a bigger frozen pool

A frozen pool, however large, can't do any of these:

1. **Multiple acceptable answers.** German sometimes genuinely allows more than one correct
   answer (`Ich gehe/fahre nach Hause`). A human author of frozen content has to pick one in
   advance, which pushes every item toward removing ambiguity rather than teaching it.
2. **Real difficulty within a level.** The bank's `hard` band is 56 items total. A generator can
   use the full band for any topic, any time.
3. **In-session adaptivity.** A generated batch can react to the learner's most recent answers,
   not just their lifetime topic accuracy.

If a generated batch reads like a bank drill, the feature has failed — that's a prompt-quality
bar checked against real output, not something the structural gate below can enforce.

### A selected level caps difficulty; register still floats to the ceiling

**A learner's selected level is a ceiling on question difficulty, never raised by the Settings
learner-level pref.** An A1 topic generates A1 questions even at `learnerLevel: 'a2'` — a learner
is tested on what they chose to practice. The challenge axis is _within_ the level: a realistic
stem instead of `du ___ (arbeiten)`, distractors that encode mistakes a learner at that level
actually makes, and free use of the `hard` band.

**Register is a separate axis and is unaffected.** `ceilingLevel(level, learnerLevel)` — the same
function tap-a-word already uses — still returns `max(level, learnerLevel)` for the
_explanation's_ register only. An A1 topic at `learnerLevel: 'a2'` yields A1-difficulty questions
explained in A2-register language.

This principle applies to every graded track where a level is selectable, not just grammar
practice — flashcards and dictation should inherit it if either grows an AI path later: content
level bounds difficulty, the learner-level pref only ever raises explanatory register.

### `difficultyFor` skews harder than the bank's resting distribution

A pure function, `difficultyFor(topicProgress, recentResults)` (`page.helpers.ts`), picks each
batch's difficulty band: `easy` only for a topic genuinely new to the learner (`attempts === 0`);
a struggling topic (`accuracy < 0.7`) **holds** `medium` rather than dropping to `easy` — the
explanation and any injected mistake notes do the scaffolding, not a softer question; a
well-performing topic with a strong recent run escalates to `hard`. `easy` is treated as the
exception, not the default resting state.

### Answers aren't set in stone — `acceptableIndices`

`QuizQuestion` gains an optional `acceptableIndices?: number[]`, defaulting to `[correctIndex]`
when absent — the 492 bank items and `build-grammar-bank.mjs` need no change. Grading becomes
`acceptableIndices.includes(choiceIndex)` (`isAcceptable`, `GrammarQuizCard/index.helpers.ts`)
instead of `=== correctIndex`; picking a different acceptable answer still grades correct, and the
result panel names the alternative ("Richtig! — ›gehe‹ wäre auch möglich.") rather than treating
one correct answer as more correct than another.

Two structural guards, enforced in `parseGeneratedQuestions` (`lib/ai/validate.ts`):
`correctIndex` must be a member of `acceptableIndices`, and `acceptableIndices.length <=
choices.length - 2` — at least two choices must stay clearly wrong, so marking too many acceptable
is a giveaway and the item is discarded outright rather than repaired. The prompt asks the model
to mark every genuinely correct choice and explain the difference, deliberately not "resolve to
one defensible answer," which would flatten the exact ambiguity this feature exists to represent.

### One batch, one topic; one plan, two sourcers

A smart-mix session spans several topics but the `grammar` intent's request payload carries one
`topicId`. Resolved by making a batch cover exactly one topic — better grounding (one topic's
`grammar.json` entry per prompt), fewer tokens, and a **local** fallback: a failed batch is
replaced by the same plan slice served from the bank, not the whole session.

`selectQuizTopics(progress, opts?)` (`page.helpers.ts`) is the pure planner, unchanged in
behaviour from ADR 010's tiering: struggling → never-seen → stale → rest. It now returns a
`QuizPlan[]` of `{ topicId, count, tier, difficulty }` — ids _and_ counts _and_ a difficulty hint,
since the AI path needs `tier`/`difficulty` to write a useful prompt and the bank fallback needs
to serve the identical slice. `now`/`order` are injectable so the tier logic tests without mocking
`Date.now()`/`shuffle()`. The plan's `difficulty` is a starting point only — `useQuizQueue`
re-derives it per batch from live progress plus the session's recent results, since the plan is
built before the session has produced any.

This replaces ADR 010's `buildSmartQuiz`/`buildTopicQuiz`, which built a whole session's
questions from the bank in one call. The bank is still the fallback, but it is reached per batch
through `sourceQuestions`/`generateQuestionsForTopic`, so a session can mix generated and bank
questions instead of being wholly one or the other.

`sourceQuestions(plan, opts)` (`lib/grammar-quiz-ai.ts`) is the async sourcer: **never throws** —
not online → bank; otherwise POST `/api/ai` with the `grammar` intent, re-validate every item
client-side with the same rules the server already applied, and on any failure/abort/invalid
shape return the bank slice with `degraded: true`. All error handling lives here, so
`useQuizQueue` has no error branch for sourcing.

While splitting the planner out, a latent no-op was fixed: the accuracy tiebreak lived in tier 1
(`attempts === 0`, so it evaluated `NaN`, which `Array.sort` treats as 0). Accuracy is the
meaningful tiebreak for tier 0 (struggling); it now sits there, tier 1 stays in shuffle order, and
both are pinned by tests.

### Trust boundaries on generated items

The model returns only `prompt`, `choices`, `correctIndex`, `acceptableIndices`, `explanation`.
The **server stamps** `id`/`topicId`/`level`/`difficulty` from the already-validated request — a
model that names the wrong topic cannot write into another topic's progress. The route resolves
`topicId` against `grammar.json` itself (400 on unknown) and passes the resolved `GrammarTopic` to
the prompt builder, so topic prose in the prompt never comes from the client. Generated ids are
`ai-<topicId>-<uuid8>` — the prefix and hex suffix can't collide with the bank's `<slug>-<2
digits>` shape.

`parseGeneratedQuestions` drops malformed items and keeps good ones (returning `[]` only when
nothing survives is the caller's fallback signal) — one bad item shouldn't cost the rest of a
batch. The exception is _within_ an item: a bad field there is dropped whole, since renumbering
choices after removing one would desync `correctIndex`/`acceptableIndices`.

### The token budget covers reasoning, not just the JSON

`max_tokens` on the `grammar` intent is **8000** — roughly five times the visible output. The
model's reasoning tokens are charged against the same ceiling and vary widely per call: measured
at 592, 866 and 2111 reasoning tokens for the same prompt, against ~800–900 of actual JSON. A
budget sized to the JSON alone is therefore fine most of the time and truncates mid-string
whenever the model deliberates longer than usual, which surfaces as an unparseable body and a
silent degrade to the bank. `max_tokens` is a ceiling rather than a charge — only real tokens are
billed — so the headroom costs nothing and buys determinism.

**Rejected alternative: disabling reasoning** (`thinking: { type: 'disabled' }`). It removes the
variance, cuts output tokens ~64% and halves latency, but the model then works through
subject-verb agreement _inside_ the `explanation` field — producing visible self-correction
("…wait, family is singular so it's 'fährt'…") and, worse, mismarking `correctIndex` on items
whose correct form wasn't even among the choices. A wrong answer key teaches the wrong thing; an
occasional bank fallback does not. Reliability was not worth buying with correctness.

### The mistakes corpus's first producer

A missed quiz question — bank or generated — can author a note in the personal-mistakes corpus
(ADR 011), once per topic per session, under a session-wide cap
(`MAX_NOTES_PER_SESSION`, `src/constants/index.ts`). `useMistakeNotes.ts` is fire-and-forget: the
quiz card never waits on it. The budget is checked and reserved **synchronously before any
fetch**, via two asymmetric refs — `attemptedTopics` (a `Set`, one shot per topic, never
released) and `authored` (a count, incremented only on an `insert` verdict, so a rejected
candidate doesn't spend the cap). Both survive "Practice again": the budget is per page-mount, not
per run.

**The `note`/`judge` AI intents are reshaped**, not extended. ADR 011 built them around a
word-and-exchange shape (`claimedLemma`, `evidence` = "a substring of the learner's question") —
concepts tap-a-word has and a quiz miss doesn't. Since tap-a-word is deliberately excluded from
`MistakeSource` and can never become a producer, that shape had no caller; this is the reshape ADR
011 said the first producer would make. Both intents now take a `QuizMissContext` (the missed
item's prompt/choices/correct answer/learner's pick/explanation) instead. `GroundTruth` gains the
same optional `acceptableIndices` the question carries, and the gate's grounded-validation layer
checks set membership instead of `=== correctIndex` — without this, picking an acceptable
alternative would grade correct on screen yet still read as a miss to the gate, authoring a false
note about a mistake the learner didn't make.

**Notes are read back in, scoped to the current batch.** `notesForPrompt(corpus, topicIds, opts?)`
(`lib/mistakes-prompt.ts`) filters to the batch's topics, takes newest-first with a per-topic cap
(2) under a total cap (5), drops very old records, and **re-asserts the gate's hygiene checks
(`hasControlChars`/`isDirectiveLike`) at injection time** — a record can reach this device via
`fullMistakesSync` from another device running an older gate, so the write-time check alone isn't
sufficient for a read-time injection surface.

**An opt-in judge.** `gateCandidateWithJudge` (ADR 011) already existed with no caller; a new
per-device Settings pref, `isJudgeEnabled` (default **off**, `src/lib/ai-prefs.ts`), now controls
whether `useMistakeNotes` runs it. Default off because the pure gate already covers the common
failure modes and the judge is an extra model call per authored note.

### Named risk: wrong answer keys

A structurally valid generated question can still mark the wrong answer, and a correct answer
graded wrong dents that topic's accuracy in an unattributed aggregate (ADR 010's single
`GrammarQuizProgressMap` — AI answers and bank answers share one counter set, by the same
one-progress-map reasoning ADR 010 already made: AI answers not counting would freeze topic
selection stale for anyone who defaults to online-with-AI-on). This is mildly self-amplifying
(a wrongly-struggling topic gets served more) but bounded: `acceptableIndices` removes the
dominant cause (genuine ambiguity), server-side stamping confines any damage to the topic actually
requested, and client-side re-validation catches shape problems. What survives all three is the
mechanical slip — an explanation describing a different form than the marked index — and its
first-order harm is teaching false German on screen for one question, which no progress-map policy
touches; it is inherent to generating questions at all, not specific to this design.

## Consequences

- **The offline core never regresses.** The bank stays the default and the fallback; every AI
  failure — offline, no key, a bad response, an unknown topic — degrades silently to it, with no
  error UI and no blocked session.
- **The mistakes corpus stops being empty on purpose.** Grammar practice is its first real
  producer and consumer, closing the loop ADR 011 opened. Expect integration bugs the unit tests
  don't reach — ADR 011 already flagged this as unproven end to end.
- **A genuinely richer practice mode, gated behind a cost the learner controls.** Every capability
  here — multiple answers, real difficulty, adaptivity — costs a model call the single operator's
  own key pays for, which is why it's additive to the free bank rather than a replacement.
- **Blandness, not breakage, is the main risk.** Everything here can pass its tests and still ship
  questions indistinguishable from the bank; that failure mode is only visible by reading real
  output, not by any test in this repo.
