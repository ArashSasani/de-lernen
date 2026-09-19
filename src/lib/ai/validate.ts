import { ARTICLE, LEVELS, WORD_INTENTS } from '@/constants';
import type { WordIntentRequest } from '@/types/ai';

const MAX_QUESTION_LEN = 300;
const MAX_LEMMA_LEN = 64;
const MAX_EN_LEN = 120;
const MAX_PLURAL_LEN = 64;

const ARTICLES: readonly string[] = Object.values(ARTICLE);
const INTENTS: readonly string[] = WORD_INTENTS;
const LEVEL_VALUES: readonly string[] = LEVELS;

// No newlines in free-text fields — keeps them one-line data the model can't
// mistake for a new instruction block.
const HAS_NEWLINE = /[\r\n]/;

// The JWT gates *who* can call /api/ai, not *what* they send — validate every
// field against its enum/length so a leaked JWT can't run arbitrary prompts or
// inflate input-token cost on the self-hoster's key.
export function parseAiRequest(body: unknown): WordIntentRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;

  if (typeof b.intent !== 'string' || !INTENTS.includes(b.intent)) return null;
  if (typeof b.level !== 'string' || !LEVEL_VALUES.includes(b.level))
    return null;
  if (
    b.learnerLevel !== undefined &&
    (typeof b.learnerLevel !== 'string' ||
      !LEVEL_VALUES.includes(b.learnerLevel))
  ) {
    return null;
  }

  const word = b.word;
  if (typeof word !== 'object' || word === null) return null;
  const w = word as Record<string, unknown>;

  if (
    typeof w.lemma !== 'string' ||
    !w.lemma ||
    w.lemma.length > MAX_LEMMA_LEN ||
    HAS_NEWLINE.test(w.lemma)
  ) {
    return null;
  }
  if (
    w.article !== null &&
    (typeof w.article !== 'string' || !ARTICLES.includes(w.article))
  ) {
    return null;
  }
  if (
    w.plural !== null &&
    (typeof w.plural !== 'string' ||
      w.plural.length > MAX_PLURAL_LEN ||
      HAS_NEWLINE.test(w.plural))
  ) {
    return null;
  }
  if (
    typeof w.en !== 'string' ||
    !w.en ||
    w.en.length > MAX_EN_LEN ||
    HAS_NEWLINE.test(w.en)
  ) {
    return null;
  }

  if (b.intent === 'ask') {
    if (
      typeof b.question !== 'string' ||
      !b.question ||
      b.question.length > MAX_QUESTION_LEN
    ) {
      return null;
    }
  }

  return {
    intent: b.intent,
    level: b.level,
    learnerLevel: b.learnerLevel as WordIntentRequest['learnerLevel'],
    word: {
      lemma: w.lemma,
      article: w.article as WordIntentRequest['word']['article'],
      plural: w.plural as WordIntentRequest['word']['plural'],
      en: w.en,
    },
    ...(b.intent === 'ask' ? { question: b.question as string } : {}),
  } as WordIntentRequest;
}
