# ADR 011 — Personal Mistakes Corpus

**Status:** Accepted
**Implementation:** `src/types/mistakes.ts` (data model), `src/lib/mistakes-gate.ts` (ingestion
gate), `src/lib/mistakes-sync.ts` (IndexedDB + KV sync + merge), `src/app/api/mistakes/route.ts`
(KV route), `src/hooks/useMistakes.ts` (React hook), `src/lib/idb.ts` (store),
`src/lib/db.ts` (server load/save/merge), `src/lib/ai/{prompts,validate,client,models}.ts` (the
`note`/`judge` structured intents), `src/components/MistakesList/` (read-only Settings view)

## Context

The three existing progress maps (`ProgressMap`, `DictationProgressMap`, `GrammarQuizProgressMap`)
record **which** items are hard — a box number, an accuracy ratio. None of them can say **what**
the learner keeps getting wrong. A qualitative log of specific gaps ("asked why _mit_ takes
Dativ") is a different signal, and it's the one that later lets grammar practice and any future
tutoring target real weaknesses instead of just re-shuffling due cards.

This ADR builds that log's full path — store, sync route, merge, and the write-time quality gate —
**without a producer**. Nothing writes to it yet. That split is deliberate: the transport and the
correctness gate are the parts that are expensive to retrofit and cheap to get right while the
corpus is empty, and the first producer (grammar practice) needs the gate to already exist.

## Decision

### Two failure modes, two defenses

A free-text, AI-authored corpus has exactly two ways to go wrong, and they need different tools:

1. **Bad notes** — the model writes something plausible but false. This is a **write-path**
   problem: cosine similarity or any retrieval scheme can only ever _organize_ notes, never judge
   whether one is true. So correctness has to be enforced before a note is stored, not after.
2. **Duplication** — near-identical notes pile up and bloat any future prompt that injects them.
   This is a **read-path** organization problem, solved by clustering/retrieval — deliberately out
   of scope here (see Rollout below).

### What counts as a mistake — and what doesn't

A note requires an interaction with **real right/wrong ground truth**: a graded flashcard, a
dictation attempt, a quiz item with a correct choice and the learner's actual pick. Those are the
three `MistakeSource` values, and the gate's `GroundTruth` type is shaped to match.

**A tap-a-word question was considered as a source and rejected.** It is the one place the learner
types free text about a word, which makes it tempting — but asking what a word means is a quick
check, not evidence of a gap, and there is nothing in such an exchange to contradict the model:
asked to name a knowledge gap from a question it just answered, it will invent one confidently and
on-topic every time. Grading data can say "the learner picked Akkusativ and the answer was Dativ";
a curiosity question can't say anything. Anchoring the corpus to gradeable events is what makes
the grounded validation below a real entailment check rather than an attention check.

### The write-time gate — `lib/mistakes-gate.ts`

A pure function, `gateCandidate(candidate, groundTruth, now)`, runs three cheap layers before
anything is stored, each short-circuiting so a reject never pays for the next check:

1. **The model's escape hatch.** The note-authoring call returns a `found: boolean`; most
   exchanges are ordinary curiosity and `found` is false, so nothing is recorded.
2. **Hygiene.** Length cap, no control characters, no directive-looking phrases (`ignore
previous`, `` ` ``, `<`, …). This is the corpus's defense against second-order prompt injection:
   the note is model-authored from a learner-controlled string, persisted, synced, and will
   eventually be injected into other prompts as trusted-looking app state — so it can't be allowed
   to carry an embedded instruction.
3. **Grounded validation** against the interaction's ground truth: a note is rejected if the
   learner actually answered correctly, or if it contradicts the recorded answer (claiming the
   correct choice was wrong, or the learner's pick was right).
4. **A confidence floor** on the model's own self-report.

An **LLM-as-judge** (a second, cheap model call that adversarially checks the note against the
interaction) is available as a fourth layer via `gateCandidateWithJudge`. Judge failure (timeout,
error, unavailable) **fails open** — an optional verification step must never make the corpus
emptier because of a network blip. It has no UI toggle: the producer that will decide whether to
run it doesn't exist yet, and a switch that controls nothing is worse than no switch.

Per-producer rate limiting (dedup, a recency floor, a daily cap on model calls) belongs with the
producer, not here — the right key and cadence depend on what's being graded.

### Data model — a keyed log, not a blob

```ts
// The graded tracks a note can be authored from. Not tap-a-word: asking
// about a word is a quick check, not a mistake.
type MistakeSource = 'flashcard' | 'dictation' | 'grammar-quiz';

interface MistakeRecord {
  id: string; // `${source}:${ref}:${createdAt}` — deterministic
  source: MistakeSource;
  text: string; // the payload — a short clause
  wordId?: string;
  topicId?: string;
  level?: Level;
  createdAt: number;
  confidence?: number; // local-only debug field, never synced
}
```

Unlike the three existing tracks (each a `Record<id, entry>` blob stored whole at IndexedDB key
`'data'`), this is a genuinely **keyed object store** (`mistakes`, `keyPath: 'id'`, indexes on
`createdAt`/`source`) — a growing append-only log, not a map that gets rewritten in place. This is
an **IndexedDB version bump, 2 → 3**, purely additive: existing stores are untouched, and — since
the version had never changed before — a `blocking` handler was added to `getDB()` so a stale tab
in another window can't hang the upgrade for every store, including the unrelated Leitner one.

### Sync — union by id, not newest-wins

Records are **immutable**, so the merge across devices is a plain union by id rather than the
newest-wins-per-field merge the other three tracks use — no tombstones, no field reconciliation.
The corpus is capped at 500 records (oldest dropped) so an unbounded log doesn't grow the KV value
forever. The PUT payload strips local-only fields (`confidence`, and Phase-2 fields below) before
leaving the device, and the server strips them again defensively on receipt.

`api/mistakes/route.ts` is the one sync route in the app that **validates the PUT body**, not just
merges it unchecked like the other three — because this is the one synced track whose content will
eventually be read by a model prompt, so a forged request with a leaked token must not be able to
smuggle a directive into the corpus.

### Level signal

`level?` is optional and set by whichever mediator authored the note, not derived from a computed
learner model — it's a qualitative tag ("this exchange looked A2"), not an input into any scoring.

## Rollout — infrastructure first, producer second

**Nothing writes to the corpus yet.** The store, route, sync, merge, gate, and the `note`/`judge`
structured AI intents are all built and tested; `useMistakes` exposes `addRecord(record)`, which
takes an already-gated record and owns persistence only. Grammar practice is the intended first
producer: it has a correct answer and the learner's actual pick, which is exactly the shape
`GroundTruth` takes. `GroundTruth` is a discriminated union of one member for that reason — a
second graded track adds a variant rather than forcing a reshape.

The `note` prompt in `lib/ai/prompts.ts` is currently written around a word-and-exchange shape and
will be rewritten by that first producer; the surrounding plumbing (route branch, structured
output parsing, re-validation) is producer-agnostic and stays.

**Deduplication and retrieval are out of scope.** Near-duplicate notes about the same recurring
gap are tolerated for now — acceptable while the corpus is small, and a read-only Settings list is
the only place anything reads it back. A future revision could add embedding-based dedup-merge on
write and similarity-ranked retrieval on read, entirely additively: the record shape already
reserves optional, never-synced `seenCount`/`lastSeen`/`embedding` fields for exactly that, so
switching it on needs no IndexedDB migration.

## Consequences

- **A genuinely new signal, not a restatement of box state.** The corpus records what a learner
  was actually confused about, in their own words, which nothing else in the app captures.
- **Grounded in graded events, not curiosity.** Restricting sources to interactions with a real
  right/wrong answer is what makes the grounding layer a genuine entailment check. It costs corpus
  volume, which is the intended trade.
- **A new injection surface, defended at both ends.** Model-authored text that is later injected
  into other prompts is a second-order risk beyond the direct-request validation every other AI
  route already does; the gate's hygiene layer and the route's own validation both exist because
  of this, not for tidiness.
- **Shipped empty, on purpose.** With no producer, the corpus stays at zero records and the
  Settings list shows its empty state. The cost of that is a visibly inert feature; the benefit is
  that the transport and the gate are settled before any note exists, so the first producer adds
  one call site instead of a subsystem.
- **Unproven end to end.** Merge, sync, and gate are unit-tested, but no real record has traversed
  the full path. The first producer should expect to shake out integration bugs the tests don't
  reach.
