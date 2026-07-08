export interface DictationWordProgress {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number;
  starred?: boolean;
}

export type DictationProgressMap = Record<string, DictationWordProgress>;
