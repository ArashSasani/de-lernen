# ADR 008 — Dictation Spelling Exercise

**Status:** Accepted  
**Implementation:** `src/lib/dictation.ts` (gap algorithm), `src/components/DictationCard/` (UI),
`src/app/dictation/` (page + queue), `src/lib/dictation-sync.ts` (IndexedDB + KV sync + merge),
`src/app/api/dictation/route.ts` (KV route), `src/hooks/useDictationSync.ts` (React hook)

## Context

The Leitner flashcard flow tests recognition (see a German word, recall the English). It does not
exercise _production_ — the user never types German. German A1 spelling has specific difficulty
clusters (umlauts, ß vs ss, ie vs ei, silent-h, sch/ch, double consonants) that trip up learners
even when they can read and recognise the words.

A dictation exercise fills this gap: hear a word, see it with a strategic letter gap, type the
missing letters. The exercise should feel lightweight — a quick drill, not a second spaced-repetition
system — so it has a simpler progress model (attempt counts, not a Leitner schedule). It is a
**separate progress track** from the Leitner boxes but is still synced across devices.

## Decision

### Gap generation — ranked spelling-difficulty ruleset

`generateGap(word: Word)` applies a priority-ordered list of 12 German spelling patterns to produce
exactly one gap per word. The first matching rule wins:

| #   | Pattern                                   | hintType | Example      |
| --- | ----------------------------------------- | -------- | ------------ |
| 1   | `ä`, `ö`, `ü` (single umlaut)             | umlaut   | M**ä**dchen  |
| 2   | `ß`                                       | eszett   | Fu**ß**      |
| 3   | `ie`                                      | ie/ei    | Br**ie**f    |
| 4   | `ei`                                      | ie/ei    | B**ei**spiel |
| 5   | vowel + h before consonant/end (silent-h) | silent-h | B**ah**n     |
| 6   | `sch`                                     | sch      | Deut**sch**  |
| 7   | `ch` (not part of sch)                    | ch       | au**ch**     |
| 8   | `tz`                                      | tz       | Ka**tz**e    |
| 9   | `ck`                                      | ck       | ba**ck**en   |
| 10  | double consonant (ll, mm, nn, ss, tt, …)  | double   | a**ll**e     |
| 11  | `z` (not part of tz)                      | z        | **Z**ug      |
| 12  | first vowel cluster (fallback)            | vowel    | H**u**nd     |

**Multi-word lemmas** (e.g. "zu Hause"): gap the longest token, reassemble around it.
**Separable prefix verbs** (e.g. "aufstehen"): strip common prefixes (ab, an, auf, aus, ein, mit,
nach, vor, zu, zurück, etc.) before applying rules to the stem, then prepend the prefix to `before`.

### Answer checking

Case-insensitive, but strict on umlauts and ß — `a` ≠ `ä`, `ss` ≠ `ß`. This is intentional: the
whole point of the exercise is to drill these exact distinctions.

### Session queue

`buildDictationQueue()` selects 15 words per session with 4-tier priority:

1. Never-seen words (shuffled)
2. Weak words: accuracy < 70% with ≥ 2 attempts (worst first)
3. Stale words: not seen in > 3 days (oldest first)
4. Mastered words: streak ≥ 3 and accuracy ≥ 80% (oldest first)

Words with comma-containing lemmas ("dein, deine") or target tokens ≤ 2 characters are excluded.

### Progress — separate track, synced to KV

Dictation progress uses `DictationProgressMap` (keyed by `Word.id`), tracking `attempts`, `correct`,
`streak`, `lastSeen`, and an optional `starred` flag (bookmark a word for focused practice) per word.
It is stored in its own IndexedDB object store (`dictation`) within the same `de-flashcards` database,
**separate from** the Leitner `ProgressMap`.

**Synced to KV** under its own key, `user:dictation`, via `src/app/api/dictation/route.ts` — mirroring
the Leitner sync (see [ADR 004](004-offline-first-progress-sync.md)) rather than reusing its key, so
the two tracks never collide. The merge (`mergeDictation`) is **newest-wins by `lastSeen`**, except
`starred` is **OR-merged** so a bookmark made on one device is never lost when another device pushes.
The same iOS-durability flush applies: the debounced PUT is flushed synchronously on
`visibilitychange`/`pagehide` with `keepalive: true`.

> **History:** this track originally shipped local-only (no KV sync), on the reasoning that dictation
> is a low-stakes drill with no spaced-repetition calendar to break. Cross-device sync — listed as
> deferred future work in the original ADR — was subsequently implemented because losing it on a
> device switch or iOS eviction was annoying in practice; the merge pattern is the same as ADR 004.

### UI flow

Two-phase card (no flip animation):

1. **Question:** gapped word with inline text input, SpeakButton, auto-play audio on mount.
2. **Result:** correct answer shows article + word with gap in emerald; wrong answer shows
   struck-through user input then the correct form with gap in emerald. Auto-play only on wrong
   results. Article colored per gender (sky = der, rose = die, emerald = das).

A word can be **starred** to bookmark it; sessions can be filtered to starred-only for focused
practice.

## Consequences

- **Fills the production gap:** users now practice typing German spelling, not just recognising it.
- **Lightweight:** no spaced-repetition scheduling — just attempt counts.
- **Offline-safe:** everything runs on static data + IndexedDB; the network (KV sync) is best-effort
  on top, exactly like the Leitner track.
- **Survives device switches and iOS eviction:** the `user:dictation` KV key backs up progress and
  carries it across devices; `starred` bookmarks OR-merge so they are never lost.
- **Single gap per word:** the ranked ruleset always picks the highest-priority pattern, so a word
  like "Mädchen" always gaps the `ä`, never the `ch`. This keeps difficulty consistent across
  sessions but means each word exercises only one spelling challenge.
