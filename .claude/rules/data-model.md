# Data model (`src/types`)

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
  starredAt?: number; // when `starred` was last set — the bookmark's own merge clock
}
type DictationProgressMap = Record<string, DictationWordProgress>; // keyed by Word.id

interface GrammarQuizTopicProgress {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number; // timestamp ms
}
type GrammarQuizProgressMap = Record<string, GrammarQuizTopicProgress>; // keyed by topicId

type MistakeSource = 'flashcard' | 'dictation' | 'grammar-quiz';

interface MistakeRecord {
  id: string; // `${source}:${ref}:${createdAt}` — deterministic, not a uuid
  source: MistakeSource;
  text: string; // the payload — a short clause, e.g. "asked why mit takes Dativ"
  wordId?: string;
  topicId?: string;
  level?: Level;
  createdAt: number; // ms
  confidence?: number; // local-only debug field, NEVER synced
}
type MistakeCorpus = MistakeRecord[]; // an append-only log, not a keyed map
```

`words.json` stays a **single flat array** across all levels — a word reused across levels (e.g.
introduced at A1, reappearing in A2 source material) is one merged entry whose `levels[]` accumulates
every level it appears in, not split per-level files. For filtering, `lib/words.ts`'s `wordLevel(word)`
resolves a word's **lowest** level (`a1` < `a2` < `b1`), so a word tagged `['a1', 'a2']` is scoped under
the A1 filter only — levels never overlap in the study queue. `FilterBar` exposes this as a "Level" chip
row (`@/constants`'s `LEVEL_CHIPS`) alongside Box/Type; `b1` is hidden from the chips
until a B1 source is extracted (nothing currently carries that level).

Dictation progress is a **separate track** from the Leitner `ProgressMap` — stored in its own
IndexedDB object store (`dictation`) and **synced to KV** (`user:dictation`). Merge strategy:
newest-wins by `lastSeen` for the counters; the bookmark merges **on its own clock**, newest
`starredAt` wins, so an un-star propagates like a star does. An entry with no `starredAt` (written
before the field existed) can only be OR-merged, so a bookmark without a clock is never lost.
See [ADR 008](../../docs/adrs/008-dictation-spelling-exercise.md).

Grammar quiz progress is a **third track**, keyed by topic id instead of word id — stored in its
own IndexedDB object store (`grammar-quiz`) and **synced to KV** (`user:grammar-quiz`). Merge
strategy: newest-wins by `lastSeen` (no `starred` field, so no OR-merge needed). See
[ADR 010](../../docs/adrs/010-grammar-quiz.md).

Grammar types (`GrammarCategory`, `GrammarTable`, `GrammarExample`, `GrammarTopic`) live in
`src/types/index.ts` and are imported from `data/grammar.json` by `src/lib/grammar.ts`. Every
`GrammarTopic` carries a `level: Level` (like `DailyText.level` — one level per topic, not
`Word.levels[]`, since a hand-authored topic isn't merged across sources); `/grammar` exposes an
All/A1/A2 chip row (`LEVEL_CHIPS` in `page.helpers.ts`) alongside the category accordions. Grammar
**reference** is read-only with no progress track. The grammar **quiz** (`QuizQuestion`,
`GrammarQuizTopicProgress`, `GrammarQuizProgressMap` in `src/types/grammar-quiz.ts`) adds a third
progress track — its own IndexedDB store (`grammar-quiz`), keyed by topic id, synced to KV. See
[ADR 009](../../docs/adrs/009-grammar-reference.md) and [ADR 010](../../docs/adrs/010-grammar-quiz.md).

The four IndexedDB object stores in the `de-flashcards` database (`src/lib/idb.ts`): `progress`
(Leitner, synced to KV `user:progress`), `dictation` (synced to KV `user:dictation`),
`grammar-quiz` (synced to KV `user:grammar-quiz`), and `mistakes` (synced to KV `user:mistakes`).

The mistakes corpus is a **fourth track**, and the odd one out: a growing log of AI-authored
qualitative notes about the learner's recurring gaps, not a `Record<id, entry>` progress map. It's
a real **keyed** IndexedDB store (`keyPath: 'id'`, indexes on `createdAt`/`source`), not a blob at
key `'data'` like the other three, and its sync merge is a **union by id** (records are immutable,
so there's no newest-wins field to reconcile) rather than newest-wins-per-field. Every record must
pass a write-time quality gate (`src/lib/mistakes-gate.ts`) before it's stored. **Grammar quiz is
the first producer** (`src/hooks/useMistakeNotes.ts`): a missed question — bank or AI-generated —
can author a note via `useMistakes().addRecord()`, once per topic per session under a
session-wide cap. A tap-a-word question is deliberately not a source: asking about a word is a
quick check, not a mistake. See [ADR 011](../../docs/adrs/011-personal-mistakes-corpus.md) and
[ADR 012](../../docs/adrs/012-online-grammar-practice.md).
