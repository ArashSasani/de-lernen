export interface DictationWordProgress {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number;
  starred?: boolean;
  // When `starred` was last set — the bookmark's own merge clock, so an
  // un-star propagates across devices (data-model.md).
  starredAt?: number;
}

export type DictationProgressMap = Record<string, DictationWordProgress>;
