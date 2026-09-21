import { WORD_INTENTS, STRUCTURED_INTENTS } from '@/constants';
import type { Article, Level } from '@/types';
import type { QuizDifficulty } from '@/types/grammar-quiz';

export type WordIntent = (typeof WORD_INTENTS)[number];
export type StructuredIntent = (typeof STRUCTURED_INTENTS)[number]; // 'note' | 'judge' | 'grammar'
export type AiIntent = WordIntent | StructuredIntent;

export interface AiWordFields {
  lemma: string;
  article: Article | null;
  plural: string | null;
  en: string;
}

export interface WordIntentRequest {
  intent: WordIntent;
  level: Level; // per-content floor: wordLevel(word)
  learnerLevel?: Level; // Settings pref; server defaults to 'a1' if missing/invalid
  word: AiWordFields;
  question?: string; // present only when intent === 'ask'
}

// A missed grammar-quiz item, grounding a note/judge call. Untrusted free
// text (`prompt`, `explanation`) is delimited in the prompt like every
// other AI-proxy input.
export interface QuizMissContext {
  topicId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  acceptableIndices?: number[];
  learnerAnswerIndex: number;
  explanation: string;
}

// Note authoring for the mistakes corpus's first producer: a grammar-quiz
// miss. `quiz` is the context the model authors a note from; grounding
// against it is enforced by `lib/mistakes-gate.ts`, not by this request.
export interface NoteIntentRequest {
  intent: 'note';
  level: Level;
  learnerLevel?: Level;
  quiz: QuizMissContext;
}

// What the model returns for `note`. Never stored as-is — the gate
// re-derives the persisted record from ground truth, not this candidate.
export interface MistakeCandidate {
  found: boolean; // false = "no identifiable signal"; the model's escape hatch
  text: string; // '' when found === false
  confidence: number; // 0..1
  level?: Level; // advisory only — the gate stamps the ground-truth level
}

export interface JudgeIntentRequest {
  intent: 'judge';
  level: Level;
  learnerLevel?: Level;
  candidate: Pick<MistakeCandidate, 'text'>;
  quiz: QuizMissContext;
}

export interface JudgeVerdict {
  keep: boolean;
  reason: string; // debug only, never stored
}

// The online adaptive-grammar-practice intent: generates a batch of quiz
// questions for one topic. `level` is the topic's own content level — a
// ceiling on difficulty, never raised by `learnerLevel` (that only lifts
// the explanation register). `recentResults` is raw client-observed
// correctness for the current session; the server composes it into a
// natural-language performance sentence rather than forwarding it as JSON.
export interface GrammarIntentRequest {
  intent: 'grammar';
  level: Level;
  learnerLevel?: Level;
  topicId: string;
  batchSize: number; // 3-4
  difficulty: QuizDifficulty;
  recentResults?: boolean[];
  alreadyAsked?: string[]; // prompts already served this session for this topic
  notes?: string[]; // mistake-corpus notes for this topic, injected as scaffolding
}

// What the model returns per generated item — the server stamps
// id/topicId/level/difficulty from the already-validated request.
export interface GeneratedQuizItem {
  prompt: string;
  choices: string[];
  correctIndex: number;
  acceptableIndices: number[];
  explanation: string;
}

export type AiRequest =
  | WordIntentRequest
  | NoteIntentRequest
  | JudgeIntentRequest
  | GrammarIntentRequest;
