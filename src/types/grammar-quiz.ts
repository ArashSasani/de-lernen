export interface QuizQuestion {
  topicId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  hint?: string;
}

export interface GrammarQuizTopicProgress {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number;
}

export type GrammarQuizProgressMap = Record<string, GrammarQuizTopicProgress>;
