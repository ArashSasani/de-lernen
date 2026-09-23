'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ProgressMap, WordProgress } from '@/types';
import { defaultProgress } from '@/lib/leitner';
import { localSave, remoteSync, mergeProgress } from '@/lib/sync';
import { useSyncedMap } from './useSyncedMap';

interface ProgressSync {
  progress: ProgressMap;
  progressRef: React.RefObject<ProgressMap>;
  setProgress: (next: ProgressMap) => void;
  // Apply a Leitner transition to one word. Returns the new map for any
  // caller-side derivations.
  grade: (
    wordId: string,
    transform: (prev: WordProgress) => WordProgress,
  ) => ProgressMap;
}

// Leitner progress on the shared offline-first transport (useSyncedMap); see
// the sync/merge spec in learning-engine.md and ADR 004.
export function useProgressSync(): ProgressSync {
  const router = useRouter();
  const onTokenLost = useCallback(() => router.replace('/login'), [router]);

  const cfg = useMemo(
    () => ({
      merge: mergeProgress,
      remotePush: remoteSync,
      saveLocal: localSave,
      onTokenLost,
    }),
    [onTokenLost],
  );

  const { map, mapRef, setMap, update } = useSyncedMap<WordProgress>(
    cfg,
    defaultProgress,
  );

  return {
    progress: map,
    progressRef: mapRef,
    setProgress: setMap,
    grade: update,
  };
}
