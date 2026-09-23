'use client';

import { useCallback, useMemo } from 'react';
import type {
  GrammarQuizProgressMap,
  GrammarQuizTopicProgress,
} from '@/types/grammar-quiz';
import {
  loadGrammarQuizProgress,
  saveGrammarQuizProgress,
  defaultGrammarQuizProgress,
  mergeGrammarQuiz,
  remoteGrammarQuizSync,
} from '@/lib/grammar-quiz-sync';
import { useSyncedMap } from './useSyncedMap';

export { loadGrammarQuizProgress };

export interface GrammarQuizSync {
  progress: GrammarQuizProgressMap;
  progressRef: React.RefObject<GrammarQuizProgressMap>;
  setProgress: (next: GrammarQuizProgressMap) => void;
  recordAttempt: (topicId: string, correct: boolean) => void;
}

export function useGrammarQuizSync(): GrammarQuizSync {
  const cfg = useMemo(
    () => ({
      merge: mergeGrammarQuiz,
      remotePush: remoteGrammarQuizSync,
      saveLocal: saveGrammarQuizProgress,
    }),
    [],
  );

  const { map, mapRef, setMap, update } =
    useSyncedMap<GrammarQuizTopicProgress>(cfg, defaultGrammarQuizProgress);

  const recordAttempt = useCallback(
    (topicId: string, correct: boolean) => {
      update(topicId, (prev) => ({
        attempts: prev.attempts + 1,
        correct: prev.correct + (correct ? 1 : 0),
        streak: correct ? prev.streak + 1 : 0,
        lastSeen: Date.now(),
      }));
    },
    [update],
  );

  return {
    progress: map,
    progressRef: mapRef,
    setProgress: setMap,
    recordAttempt,
  };
}
