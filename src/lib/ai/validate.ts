import {
  AI_MAX_LEMMA_LEN,
  ARTICLE,
  GRAMMAR_BATCH_SIZE_MAX,
  GRAMMAR_BATCH_SIZE_MIN,
  GRAMMAR_MAX_CHOICE_LEN,
  GRAMMAR_MAX_CHOICES,
  GRAMMAR_MAX_EXPLANATION_LEN,
  GRAMMAR_MAX_PROMPT_LEN,
  GRAMMAR_MIN_CHOICES,
  LEVELS,
  MISTAKES_MAX_NOTE_LEN,
  MISTAKES_MAX_REASON_LEN,
  WORD_INTENTS,
} from '@/constants';
import type {
  AiRequest,
  AiWordFields,
  GeneratedQuizItem,
  GrammarIntentRequest,
  JudgeIntentRequest,
  JudgeVerdict,
  MistakeCandidate,
  NoteIntentRequest,
  QuizMissContext,
  WordIntentRequest,
} from '@/types/ai';
import type { QuizDifficulty } from '@/types/grammar-quiz';

const MAX_QUESTION_LEN = 300;
const MAX_EN_LEN = 120;
const MAX_PLURAL_LEN = 64;
// Judge-request input cap. Looser than the gate's persisted-note cap: this
// is raw model output on its way to be judged, not a stored note.
const MAX_NOTE_TEXT_LEN = 200;

const MAX_QUIZ_PROMPT_LEN = GRAMMAR_MAX_PROMPT_LEN;
const MAX_QUIZ_CHOICE_LEN = GRAMMAR_MAX_CHOICE_LEN;
const MAX_QUIZ_EXPLANATION_LEN = GRAMMAR_MAX_EXPLANATION_LEN;
const MAX_QUIZ_CHOICES = GRAMMAR_MAX_CHOICES;
const MIN_QUIZ_CHOICES = GRAMMAR_MIN_CHOICES;

const TOPIC_ID_RE = /^[a-z0-9-]+$/;
const DIFFICULTIES: readonly string[] = ['easy', 'medium', 'hard'];

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

// The context a note/judge call grounds on: a missed grammar-quiz item.
// `prompt`/`explanation` are untrusted content authored earlier (bank or
// AI-generated), delimited in the prompt like any other AI-proxy input.
function parseQuizMissContext(quiz: unknown): QuizMissContext | null {
  if (typeof quiz !== 'object' || quiz === null) return null;
  const q = quiz as Record<string, unknown>;

  if (typeof q.topicId !== 'string' || !TOPIC_ID_RE.test(q.topicId)) {
    return null;
  }
  if (
    typeof q.prompt !== 'string' ||
    !q.prompt ||
    q.prompt.length > MAX_QUIZ_PROMPT_LEN
  ) {
    return null;
  }
  if (
    !Array.isArray(q.choices) ||
    q.choices.length < MIN_QUIZ_CHOICES ||
    q.choices.length > MAX_QUIZ_CHOICES ||
    !q.choices.every(
      (c) => typeof c === 'string' && c && c.length <= MAX_QUIZ_CHOICE_LEN,
    )
  ) {
    return null;
  }
  const choices = q.choices as string[];
  if (
    typeof q.correctIndex !== 'number' ||
    !Number.isInteger(q.correctIndex) ||
    q.correctIndex < 0 ||
    q.correctIndex >= choices.length
  ) {
    return null;
  }
  if (q.acceptableIndices !== undefined) {
    if (
      !Array.isArray(q.acceptableIndices) ||
      !q.acceptableIndices.every(
        (i) =>
          typeof i === 'number' &&
          Number.isInteger(i) &&
          i >= 0 &&
          i < choices.length,
      )
    ) {
      return null;
    }
  }
  if (
    typeof q.learnerAnswerIndex !== 'number' ||
    !Number.isInteger(q.learnerAnswerIndex) ||
    q.learnerAnswerIndex < 0 ||
    q.learnerAnswerIndex >= choices.length
  ) {
    return null;
  }
  if (
    typeof q.explanation !== 'string' ||
    !q.explanation ||
    q.explanation.length > MAX_QUIZ_EXPLANATION_LEN
  ) {
    return null;
  }

  return {
    topicId: q.topicId,
    prompt: q.prompt,
    choices,
    correctIndex: q.correctIndex,
    ...(q.acceptableIndices
      ? { acceptableIndices: q.acceptableIndices as number[] }
      : {}),
    learnerAnswerIndex: q.learnerAnswerIndex,
    explanation: q.explanation,
  };
}

function parseNoteRequest(
  b: Record<string, unknown>,
): NoteIntentRequest | null {
  const levels = parseLevelFields(b);
  if (!levels) return null;

  const quiz = parseQuizMissContext(b.quiz);
  if (!quiz) return null;

  return {
    intent: 'note',
    level: levels.level,
    learnerLevel: levels.learnerLevel,
    quiz,
  } as NoteIntentRequest;
}

function parseJudgeRequest(
  b: Record<string, unknown>,
): JudgeIntentRequest | null {
  const levels = parseLevelFields(b);
  if (!levels) return null;

  const quiz = parseQuizMissContext(b.quiz);
  if (!quiz) return null;

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

  return {
    intent: 'judge',
    level: levels.level,
    learnerLevel: levels.learnerLevel,
    candidate: { text: c.text },
    quiz,
  } as JudgeIntentRequest;
}

function parseGrammarRequest(
  b: Record<string, unknown>,
): GrammarIntentRequest | null {
  const levels = parseLevelFields(b);
  if (!levels) return null;

  if (typeof b.topicId !== 'string' || !TOPIC_ID_RE.test(b.topicId)) {
    return null;
  }
  if (
    typeof b.batchSize !== 'number' ||
    !Number.isInteger(b.batchSize) ||
    b.batchSize < GRAMMAR_BATCH_SIZE_MIN ||
    b.batchSize > GRAMMAR_BATCH_SIZE_MAX
  ) {
    return null;
  }
  if (
    typeof b.difficulty !== 'string' ||
    !DIFFICULTIES.includes(b.difficulty)
  ) {
    return null;
  }
  if (b.recentResults !== undefined) {
    if (
      !Array.isArray(b.recentResults) ||
      !b.recentResults.every((r) => typeof r === 'boolean')
    ) {
      return null;
    }
  }
  if (b.alreadyAsked !== undefined) {
    if (
      !Array.isArray(b.alreadyAsked) ||
      !b.alreadyAsked.every(
        (p) => typeof p === 'string' && p.length <= MAX_QUIZ_PROMPT_LEN,
      )
    ) {
      return null;
    }
  }
  // Notes are model-authored free text re-injected into a later prompt —
  // no newline (the app's line-oriented fence) survives the request.
  if (b.notes !== undefined) {
    if (
      !Array.isArray(b.notes) ||
      !b.notes.every(
        (n) =>
          typeof n === 'string' &&
          n.length <= MISTAKES_MAX_NOTE_LEN &&
          !HAS_NEWLINE.test(n),
      )
    ) {
      return null;
    }
  }

  return {
    intent: 'grammar',
    level: levels.level,
    learnerLevel: levels.learnerLevel,
    topicId: b.topicId,
    batchSize: b.batchSize,
    difficulty: b.difficulty as QuizDifficulty,
    ...(b.recentResults ? { recentResults: b.recentResults as boolean[] } : {}),
    ...(b.alreadyAsked ? { alreadyAsked: b.alreadyAsked as string[] } : {}),
    ...(b.notes ? { notes: b.notes as string[] } : {}),
  } as GrammarIntentRequest;
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
  if (b.intent === 'grammar') return parseGrammarRequest(b);
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
  if (typeof c.confidence !== 'number' || Number.isNaN(c.confidence)) {
    return null;
  }
  if (c.level !== undefined && !LEVEL_VALUES.includes(c.level as string)) {
    return null;
  }

  return {
    found: c.found,
    // Truncated to the gate's own cap, not a looser one: anything longer
    // would pass here only to be rejected as 'text-too-long'.
    text: c.text.slice(0, MISTAKES_MAX_NOTE_LEN),
    confidence: Math.min(1, Math.max(0, c.confidence)),
    ...(c.level ? { level: c.level as MistakeCandidate['level'] } : {}),
  };
}

// The model's first array parser: drops malformed items and keeps good
// ones (returning [] only when nothing survives is the caller's job, not
// this function's) — one bad item shouldn't cost the rest of the batch.
// Dropping a bad field *within* an item goes whole instead: renumbering
// choices after dropping one would desync correctIndex/acceptableIndices.
export function parseGeneratedQuestions(input: unknown): GeneratedQuizItem[] {
  if (!Array.isArray(input)) return [];
  const out: GeneratedQuizItem[] = [];
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;

    if (
      typeof r.prompt !== 'string' ||
      !r.prompt ||
      r.prompt.length > MAX_QUIZ_PROMPT_LEN
    ) {
      continue;
    }
    if (
      !Array.isArray(r.choices) ||
      r.choices.length < MIN_QUIZ_CHOICES ||
      r.choices.length > MAX_QUIZ_CHOICES ||
      !r.choices.every(
        (c) => typeof c === 'string' && c && c.length <= MAX_QUIZ_CHOICE_LEN,
      )
    ) {
      continue;
    }
    const choices = r.choices as string[];

    if (
      typeof r.correctIndex !== 'number' ||
      !Number.isInteger(r.correctIndex) ||
      r.correctIndex < 0 ||
      r.correctIndex >= choices.length
    ) {
      continue;
    }

    if (
      !Array.isArray(r.acceptableIndices) ||
      r.acceptableIndices.length === 0 ||
      !r.acceptableIndices.every(
        (i) =>
          typeof i === 'number' &&
          Number.isInteger(i) &&
          i >= 0 &&
          i < choices.length,
      )
    ) {
      continue;
    }
    const acceptableIndices = [...new Set(r.acceptableIndices as number[])];
    // At least two choices must be clearly wrong, so a real test survives —
    // an item that marks too many choices acceptable is a giveaway, not a
    // genuine ambiguity, and is discarded rather than repaired.
    if (acceptableIndices.length > choices.length - 2) continue;
    if (!acceptableIndices.includes(r.correctIndex)) continue;

    if (
      typeof r.explanation !== 'string' ||
      !r.explanation ||
      r.explanation.length > MAX_QUIZ_EXPLANATION_LEN
    ) {
      continue;
    }

    out.push({
      prompt: r.prompt,
      choices,
      correctIndex: r.correctIndex,
      acceptableIndices,
      explanation: r.explanation,
    });
  }
  return out;
}

export function parseJudgeVerdict(input: unknown): JudgeVerdict | null {
  if (typeof input !== 'object' || input === null) return null;
  const v = input as Record<string, unknown>;

  // `reason` is a local debug field, never stored — truncate, don't reject.
  if (typeof v.keep !== 'boolean') return null;
  if (typeof v.reason !== 'string') return null;
  return { keep: v.keep, reason: v.reason.slice(0, MISTAKES_MAX_REASON_LEN) };
}
