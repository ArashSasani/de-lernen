export const GRADE = {
  MISS: 'miss',
  GOOD: 'good',
  EASY: 'easy',
} as const;

// Canonical article → Tailwind text-colour class.
// Must not use sky/rose/emerald — those are reserved for der/die/das respectively
// and must not bleed into grade-button or result colours elsewhere.
export const ARTICLE_COLOR: Record<string, string> = {
  der: 'text-sky-400',
  die: 'text-rose-400',
  das: 'text-emerald-400',
};

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
