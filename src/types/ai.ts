import { WORD_INTENTS, STRUCTURED_INTENTS } from '@/constants';
import type { Article, Level } from '@/types';

export type WordIntent = (typeof WORD_INTENTS)[number];
export type StructuredIntent = (typeof STRUCTURED_INTENTS)[number]; // 'note' | 'judge'
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

// The exchange a `note` candidate is authored from — both fields are
// untrusted free text, delimited in the prompt.
export interface NoteExchange {
  question: string;
  reply: string;
}

// Note authoring, server-side infra with no producer wired yet. The word +
// exchange shape is what the first producer (grammar quiz) will reshape.
export interface NoteIntentRequest {
  intent: 'note';
  level: Level;
  learnerLevel?: Level;
  word: AiWordFields;
  exchange: NoteExchange;
}

// What the model returns for `note`. Never stored as-is — the gate
// re-derives the persisted record from ground truth, not this candidate.
export interface MistakeCandidate {
  found: boolean; // false = "no identifiable signal"; the model's escape hatch
  text: string; // '' when found === false
  evidence: string; // must be a verbatim substring of the learner's question
  confidence: number; // 0..1
  claimedLemma: string; // grounding echo, checked against the word actually asked about
  level?: Level; // advisory only — the gate stamps the ground-truth level
}

export interface JudgeIntentRequest {
  intent: 'judge';
  level: Level;
  learnerLevel?: Level;
  candidate: Pick<MistakeCandidate, 'text' | 'evidence' | 'claimedLemma'>;
  word: AiWordFields;
  exchange: NoteExchange;
}

export interface JudgeVerdict {
  keep: boolean;
  reason: string; // debug only, never stored
}

// A future intent (e.g. a grammar-practice one) adds a union member here.
export type AiRequest =
  | WordIntentRequest
  | NoteIntentRequest
  | JudgeIntentRequest;
