'use client';

import { useCallback, useMemo } from 'react';
import type { DictationWordProgress } from '@/types/dictation';
import type { DictationProgressMap } from '@/types/dictation';
import {
  loadDictationProgress,
  saveDictationProgress,
  defaultDictationProgress,
  mergeDictation,
  remoteDictationSync,
} from '@/lib/dictation-sync';
import { useSyncedMap } from './useSyncedMap';

export { loadDictationProgress };

export interface DictationSync {
  progress: DictationProgressMap;
  progressRef: React.RefObject<DictationProgressMap>;
  setProgress: (next: DictationProgressMap) => void;
  recordAttempt: (wordId: string, correct: boolean) => void;
  toggleStar: (wordId: string) => void;
}

export function useDictationSync(): DictationSync {
  const cfg = useMemo(
    () => ({
      merge: mergeDictation,
      remotePush: remoteDictationSync,
      saveLocal: saveDictationProgress,
    }),
    [],
  );

  const { map, mapRef, setMap, update } = useSyncedMap<DictationWordProgress>(
    cfg,
    defaultDictationProgress,
  );

  const recordAttempt = useCallback(
    (wordId: string, correct: boolean) => {
      update(wordId, (prev) => ({
        ...prev,
        attempts: prev.attempts + 1,
        correct: prev.correct + (correct ? 1 : 0),
        streak: correct ? prev.streak + 1 : 0,
        lastSeen: Date.now(),
      }));
    },
    [update],
  );

  const toggleStar = useCallback(
    (wordId: string) => {
      // Stamped so the bookmark merges on its own clock; otherwise another
      // device still holding the star would put an un-star back.
      update(wordId, (prev) => ({
        ...prev,
        starred: !prev.starred,
        starredAt: Date.now(),
      }));
    },
    [update],
  );

  return {
    progress: map,
    progressRef: mapRef,
    setProgress: setMap,
    recordAttempt,
    toggleStar,
  };
}
