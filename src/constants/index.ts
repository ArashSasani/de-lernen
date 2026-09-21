import type { Box, Level } from '@/types';
import type { LevelFilter, PosFilter } from '@/types/filter';

export const GRADE = {
  MISS: 'miss',
  GOOD: 'good',
  EASY: 'easy',
} as const;

// Canonical article/plural → Tailwind text-colour class.
// Must not use sky/rose/emerald — those are reserved for der/die/das respectively
// (and yellow for plural) and must not bleed into grade-button or result colours
// elsewhere.
// The `light:` variant (see globals.css) swaps in a darker shade of the same
// hue for the light theme — the -400 shades read fine on our dark base-100
// but fall below readable contrast on a white/near-white one.
export const ARTICLE_COLOR: Record<string, string> = {
  der: 'text-sky-400 light:text-sky-700',
  die: 'text-rose-400 light:text-rose-700',
  das: 'text-emerald-400 light:text-emerald-700',
};

export const PLURAL_COLOR = 'text-yellow-400 light:text-yellow-700';

export const POS = {
  NOUN: 'noun',
  VERB: 'verb',
  ADJ: 'adj',
  ADV: 'adv',
  OTHER: 'other',
} as const;

export const ARTICLE = {
  DER: 'der',
  DIE: 'die',
  DAS: 'das',
} as const;

export const BOXES = [1, 2, 3, 4, 5] as const;

export const LEVELS = ['a1', 'a2', 'b1'] as const;

export const FILTER = {
  ALL: 'all',
  DUE: 'due',
} as const;

// The fixed set of tap-a-word AI chip intents on /api/ai — the value array
// backs both WordIntent (src/types/ai.ts) and the server-side enum check in
// src/lib/ai/validate.ts.
export const WORD_INTENTS = [
  'genitiv',
  'konjugation',
  'partizip2',
  'imperativ',
  'komparativ',
  'beispiel',
  'erklaeren',
  'ask',
] as const;

// The AI-proxy's structured (non-streaming, JSON) intents — the mistakes
// pipeline's note-authoring + verification calls. Kept as a separate array
// from WORD_INTENTS: that array also backs the tap-a-word chip row
// (CHIP_LABELS, chipsForPos) and src/__tests__/ai-prompts.test.ts's
// it.each(WORD_INTENTS), neither of which these intents belong to.
export const STRUCTURED_INTENTS = ['note', 'judge'] as const;

// Shared chip option lists — used by FilterBar and, for the level chips, also
// by the read/grammar pages' own level filters, so they stay in sync with a
// single source instead of two hand-copied lists.
export const POS_CHIPS: { value: PosFilter; label: string }[] = [
  { value: FILTER.ALL, label: 'All' },
  { value: POS.NOUN, label: 'Noun' },
  { value: POS.VERB, label: 'Verb' },
  { value: POS.ADJ, label: 'Adj' },
  { value: POS.ADV, label: 'Adv' },
  { value: POS.OTHER, label: 'Other' },
];

export const BOX_CHIPS: Box[] = [...BOXES];

// B1 has no extracted vocabulary/grammar topics yet, so its chip is hidden
// for now — add it back once a B1 source is built.
export const LEVEL_CHIPS: { value: LevelFilter; label: string }[] = [
  { value: FILTER.ALL, label: 'All' },
  ...LEVELS.filter((l): l is Exclude<Level, 'b1'> => l !== 'b1').map((l) => ({
    value: l,
    label: l.toUpperCase(),
  })),
];

// PWA theme-color / manifest brand colours — must mirror the `delernen-dark`
// / `delernen-light` themes' `--color-base-100` in globals.css. Kept as a
// literal hex pair (not a CSS var) because <meta name="theme-color"> and the
// web-app manifest are read by the browser/OS chrome outside of CSS.
export const THEME_COLOR = {
  dark: '#0c0f1a',
  light: '#f8f9fc',
} as const;

// Tailwind's `md` breakpoint as a media query, for the places that have to
// *not mount* a component above it rather than just hide it with `md:hidden`
// (see hooks/useMediaQuery.ts). Keep in sync with Tailwind's default `md`.
export const DESKTOP_MEDIA_QUERY = '(min-width: 48rem)';

// localStorage key for the per-device theme pref (src/lib/theme-prefs.ts).
// Duplicated as a literal in the blocking inline theme script in
// layout.tsx (which can't import a module) — keep both in sync by hand.
export const THEME_STORAGE_KEY = 'theme';

// Length caps shared across the mistakes note/judge pipeline (a JSON
// schema, a validator, the gate, and the route each check these).
export const AI_MAX_LEMMA_LEN = 64; // word.lemma and a candidate's claimedLemma
export const MISTAKES_MAX_NOTE_LEN = 160; // the persisted note text
export const MISTAKES_MAX_EVIDENCE_LEN = 300; // must fit inside a question
export const MISTAKES_MAX_REASON_LEN = 120; // judge verdict reason, debug-only
export const MISTAKES_MAX_REPLY_LEN = 1200; // exchange.reply sent to /api/ai
export const MISTAKES_MAX_CORPUS = 500; // corpus cap after merge

// The valid MistakeSource values as a runtime allow-list. Both load paths
// filter on it: the corpus is append-only with no tombstones, so one record
// with an unrecognised source would 400 every PUT from then on.
export const MISTAKE_SOURCES = [
  'flashcard',
  'dictation',
  'grammar-quiz',
] as const;
