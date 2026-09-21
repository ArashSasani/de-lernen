import {
  AI_MAX_LEMMA_LEN,
  ARTICLE,
  LEVELS,
  MISTAKES_MAX_EVIDENCE_LEN,
  MISTAKES_MAX_NOTE_LEN,
  MISTAKES_MAX_REASON_LEN,
  MISTAKES_MAX_REPLY_LEN,
  WORD_INTENTS,
} from '@/constants';
import type {
  AiRequest,
  AiWordFields,
  JudgeIntentRequest,
  JudgeVerdict,
  MistakeCandidate,
  NoteIntentRequest,
  WordIntentRequest,
} from '@/types/ai';

const MAX_QUESTION_LEN = 300;
const MAX_EN_LEN = 120;
const MAX_PLURAL_LEN = 64;
// Judge-request input cap. Looser than the gate's persisted-note cap: this
// is raw model output on its way to be judged, not a stored note.
const MAX_NOTE_TEXT_LEN = 200;

const ARTICLES: readonly string[] = Object.values(ARTICLE);
const INTENTS: readonly string[] = WORD_INTENTS;
const LEVEL_VALUES: readonly string[] = LEVELS;

// No newlines in one-line request fields; `reply` is the one exception
// (see parseExchange) since it's a full rendered answer.
const HAS_NEWLINE = /[\r\n]/;

function parseWordFields(word: unknown): AiWordFields | null {
  if (typeof word !== 'object' || word === null) return null;
  const w = word as Record<string, unknown>;

  if (
    typeof w.lemma !== 'string' ||
    !w.lemma ||
    w.lemma.length > AI_MAX_LEMMA_LEN ||
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

  return {
    lemma: w.lemma,
    article: w.article as AiWordFields['article'],
    plural: w.plural as AiWordFields['plural'],
    en: w.en,
  };
}

function parseLevelFields(
  b: Record<string, unknown>,
): { level: string; learnerLevel: string | undefined } | null {
  if (typeof b.level !== 'string' || !LEVEL_VALUES.includes(b.level)) {
    return null;
  }
  if (
    b.learnerLevel !== undefined &&
    (typeof b.learnerLevel !== 'string' ||
      !LEVEL_VALUES.includes(b.learnerLevel))
  ) {
    return null;
  }
  return {
    level: b.level,
    learnerLevel: b.learnerLevel as string | undefined,
  };
}

function parseWordIntentRequest(
  b: Record<string, unknown>,
): WordIntentRequest | null {
  const levels = parseLevelFields(b);
  if (!levels) return null;

  const word = parseWordFields(b.word);
  if (!word) return null;

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
    level: levels.level,
    learnerLevel: levels.learnerLevel,
    word,
    ...(b.intent === 'ask' ? { question: b.question as string } : {}),
  } as WordIntentRequest;
}

function parseExchange(
  exchange: unknown,
): { question: string; reply: string } | null {
  if (typeof exchange !== 'object' || exchange === null) return null;
  const e = exchange as Record<string, unknown>;
  if (
    typeof e.question !== 'string' ||
    !e.question ||
    e.question.length > MAX_QUESTION_LEN ||
    HAS_NEWLINE.test(e.question)
  ) {
    return null;
  }
  // `reply` is a full rendered answer, not one-line request data — newlines
  // are expected here.
  if (
    typeof e.reply !== 'string' ||
    !e.reply ||
    e.reply.length > MISTAKES_MAX_REPLY_LEN
  ) {
    return null;
  }
  return { question: e.question, reply: e.reply };
}

function parseNoteRequest(
  b: Record<string, unknown>,
): NoteIntentRequest | null {
  const levels = parseLevelFields(b);
  if (!levels) return null;

  const word = parseWordFields(b.word);
  if (!word) return null;

  const exchange = parseExchange(b.exchange);
  if (!exchange) return null;

  return {
    intent: 'note',
    level: levels.level,
    learnerLevel: levels.learnerLevel,
    word,
    exchange,
  } as NoteIntentRequest;
}

function parseJudgeRequest(
  b: Record<string, unknown>,
): JudgeIntentRequest | null {
  const levels = parseLevelFields(b);
  if (!levels) return null;

  const word = parseWordFields(b.word);
  if (!word) return null;

  const exchange = parseExchange(b.exchange);
  if (!exchange) return null;

  const candidate = b.candidate;
  if (typeof candidate !== 'object' || candidate === null) return null;
  const c = candidate as Record<string, unknown>;
  if (
    typeof c.text !== 'string' ||
    !c.text ||
    c.text.length > MAX_NOTE_TEXT_LEN ||
    HAS_NEWLINE.test(c.text)
  ) {
    return null;
  }
  if (
    typeof c.evidence !== 'string' ||
    c.evidence.length > MISTAKES_MAX_EVIDENCE_LEN ||
    HAS_NEWLINE.test(c.evidence)
  ) {
    return null;
  }
  if (
    typeof c.claimedLemma !== 'string' ||
    !c.claimedLemma ||
    c.claimedLemma.length > AI_MAX_LEMMA_LEN ||
    HAS_NEWLINE.test(c.claimedLemma)
  ) {
    return null;
  }

  return {
    intent: 'judge',
    level: levels.level,
    learnerLevel: levels.learnerLevel,
    candidate: {
      text: c.text,
      evidence: c.evidence,
      claimedLemma: c.claimedLemma,
    },
    word,
    exchange,
  } as JudgeIntentRequest;
}

// A leaked JWT gates *who* can call /api/ai, not *what* they send — every
// field is validated so it can't run arbitrary prompts or inflate cost.
export function parseAiRequest(body: unknown): AiRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;

  if (typeof b.intent !== 'string') return null;
  if (INTENTS.includes(b.intent)) return parseWordIntentRequest(b);
  if (b.intent === 'note') return parseNoteRequest(b);
  if (b.intent === 'judge') return parseJudgeRequest(b);
  return null;
}

// Re-validates the model's own structured output, same as client input —
// a model ignoring its schema must not reach the gate with a corrupt value.
export function parseMistakeCandidate(input: unknown): MistakeCandidate | null {
  if (typeof input !== 'object' || input === null) return null;
  const c = input as Record<string, unknown>;

  // Lengths are TRUNCATED, not rejected — a tool schema's maxLength isn't a
  // hard guarantee on generated output. Wrong *type* still hard-rejects.
  if (typeof c.found !== 'boolean') return null;
  if (typeof c.text !== 'string') return null;
  if (typeof c.evidence !== 'string') return null;
  if (typeof c.confidence !== 'number' || Number.isNaN(c.confidence)) {
    return null;
  }
  if (typeof c.claimedLemma !== 'string') return null;
  if (c.level !== undefined && !LEVEL_VALUES.includes(c.level as string)) {
    return null;
  }

  return {
    found: c.found,
    // Truncated to the gate's own cap, not a looser one: anything longer
    // would pass here only to be rejected as 'text-too-long'.
    text: c.text.slice(0, MISTAKES_MAX_NOTE_LEN),
    evidence: c.evidence.slice(0, MISTAKES_MAX_EVIDENCE_LEN),
    confidence: Math.min(1, Math.max(0, c.confidence)),
    claimedLemma: c.claimedLemma.slice(0, AI_MAX_LEMMA_LEN),
    ...(c.level ? { level: c.level as MistakeCandidate['level'] } : {}),
  };
}

export function parseJudgeVerdict(input: unknown): JudgeVerdict | null {
  if (typeof input !== 'object' || input === null) return null;
  const v = input as Record<string, unknown>;

  // `reason` is a local debug field, never stored — truncate, don't reject.
  if (typeof v.keep !== 'boolean') return null;
  if (typeof v.reason !== 'string') return null;
  return { keep: v.keep, reason: v.reason.slice(0, MISTAKES_MAX_REASON_LEN) };
}
