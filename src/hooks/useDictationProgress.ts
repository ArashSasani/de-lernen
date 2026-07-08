'use client';

import { useCallback, useRef, useState } from 'react';
import type {
  DictationProgressMap,
  DictationWordProgress,
} from '@/types/dictation';
import {
  loadDictationProgress,
  saveDictationProgress,
  defaultDictationProgress,
} from '@/lib/dictation-sync';

export interface DictationProgressSync {
  progress: DictationProgressMap;
  progressRef: React.RefObject<DictationProgressMap>;
  setProgress: (next: DictationProgressMap) => void;
  recordAttempt: (wordId: string, correct: boolean) => void;
}

export { loadDictationProgress };

export function useDictationProgress(): DictationProgressSync {
  const [progress, setProgressState] = useState<DictationProgressMap>({});
  const progressRef = useRef<DictationProgressMap>({});

  const setProgress = useCallback((next: DictationProgressMap) => {
    progressRef.current = next;
    setProgressState(next);
  }, []);

  const recordAttempt = useCallback((wordId: string, correct: boolean) => {
    const prev: DictationWordProgress =
      progressRef.current[wordId] ?? defaultDictationProgress();
    const updated: DictationWordProgress = {
      attempts: prev.attempts + 1,
      correct: prev.correct + (correct ? 1 : 0),
      streak: correct ? prev.streak + 1 : 0,
      lastSeen: Date.now(),
    };
    const next = { ...progressRef.current, [wordId]: updated };
    progressRef.current = next;
    setProgressState(next);
    void saveDictationProgress(next);
  }, []);

  return { progress, progressRef, setProgress, recordAttempt };
}
