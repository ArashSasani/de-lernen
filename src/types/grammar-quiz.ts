import type { Level } from './index';

export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export interface QuizQuestion {
  id: string;
  topicId: string;
  level: Level;
  difficulty: QuizDifficulty;
  prompt: string;
  choices: string[];
  correctIndex: number;
  // Every index that is a genuinely correct answer, not just correctIndex —
  // German sometimes allows more than one (e.g. "gehe"/"fahre" nach Hause).
  // Defaults to [correctIndex] when absent, so the 492 frozen bank items
  // need no change.
  acceptableIndices?: number[];
  explanation: string;
}

export interface GrammarQuizTopicProgress {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number;
}

export type GrammarQuizProgressMap = Record<string, GrammarQuizTopicProgress>;

// Priority band a planner assigns a topic: struggling, never-seen, stale, rest.
export type QuizTier = 0 | 1 | 2 | 3;

// One batch of a session: one topic, a question count, and a starting difficulty.
export interface QuizPlan {
  topicId: string;
  count: number;
  tier: QuizTier;
  difficulty: QuizDifficulty;
}

export type QuizPhase =
  | 'booting'
  | 'loading-first'
  | 'active'
  | 'waiting-batch'
  | 'empty'
  | 'finished';

// A quiz session's whole state; `phase` is derived from it, never stored.
export interface QuizState {
  plan: QuizPlan[] | null; // null until a run starts
  queue: QuizQuestion[];
  index: number;
  results: boolean[];
  landedBatches: ReadonlySet<number>; // plan slots whose own batch arrived
  filledBatches: ReadonlySet<number>; // plan slots bridged with bank filler
  degraded: boolean;
}

export type QuizEvent =
  | { type: 'started'; plan: QuizPlan[]; starter: QuizQuestion[] }
  | { type: 'batch-landed'; batchIdx: number; questions: QuizQuestion[] }
  | { type: 'filler-landed'; batchIdx: number; questions: QuizQuestion[] }
  | { type: 'degraded' }
  | { type: 'answered'; correct: boolean }
  | { type: 'advanced' };

// The live values a run reads per batch, without restarting when they change.
export interface QuizRunContext {
  progress: GrammarQuizProgressMap;
  aiEnabled: boolean;
  online: boolean;
  results: readonly boolean[];
  getNotes?: (topicId: string) => string[];
}
