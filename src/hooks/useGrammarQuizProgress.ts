'use client';

import { useCallback, useRef, useState } from 'react';
import type {
  GrammarQuizProgressMap,
  GrammarQuizTopicProgress,
} from '@/types/grammar-quiz';
import {
  loadGrammarQuizProgress,
  saveGrammarQuizProgress,
  defaultGrammarQuizProgress,
} from '@/lib/grammar-quiz-sync';

export interface GrammarQuizProgressSync {
  progress: GrammarQuizProgressMap;
  progressRef: React.RefObject<GrammarQuizProgressMap>;
  setProgress: (next: GrammarQuizProgressMap) => void;
  recordAttempt: (topicId: string, correct: boolean) => void;
}

export { loadGrammarQuizProgress };

export function useGrammarQuizProgress(): GrammarQuizProgressSync {
  const [progress, setProgressState] = useState<GrammarQuizProgressMap>({});
  const progressRef = useRef<GrammarQuizProgressMap>({});

  const setProgress = useCallback((next: GrammarQuizProgressMap) => {
    progressRef.current = next;
    setProgressState(next);
  }, []);

  const recordAttempt = useCallback((topicId: string, correct: boolean) => {
    const prev: GrammarQuizTopicProgress =
      progressRef.current[topicId] ?? defaultGrammarQuizProgress();
    const updated: GrammarQuizTopicProgress = {
      attempts: prev.attempts + 1,
      correct: prev.correct + (correct ? 1 : 0),
      streak: correct ? prev.streak + 1 : 0,
      lastSeen: Date.now(),
    };
    const next = { ...progressRef.current, [topicId]: updated };
    progressRef.current = next;
    setProgressState(next);
    void saveGrammarQuizProgress(next);
  }, []);

  return { progress, progressRef, setProgress, recordAttempt };
}
