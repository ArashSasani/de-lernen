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
