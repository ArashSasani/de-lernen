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
  explanation: string;
}

export interface GrammarQuizTopicProgress {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number;
}

export type GrammarQuizProgressMap = Record<string, GrammarQuizTopicProgress>;
