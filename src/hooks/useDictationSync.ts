'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DictationProgressMap,
  DictationWordProgress,
} from '@/types/dictation';
import {
  loadDictationProgress,
  saveDictationProgress,
  defaultDictationProgress,
  pickDictationChanged,
  mergeDictation,
  remoteDictationSync,
} from '@/lib/dictation-sync';
import { getToken } from '@/lib/sync';

export { loadDictationProgress };

const SYNC_DEBOUNCE_MS = 2000;

export interface DictationSync {
  progress: DictationProgressMap;
  progressRef: React.RefObject<DictationProgressMap>;
  setProgress: (next: DictationProgressMap) => void;
  recordAttempt: (wordId: string, correct: boolean) => void;
  toggleStar: (wordId: string) => void;
}

export function useDictationSync(): DictationSync {
  const [progress, setProgressState] = useState<DictationProgressMap>({});
  const progressRef = useRef<DictationProgressMap>({});
  const dirtyRef = useRef<Set<string>>(new Set());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setProgress = useCallback((next: DictationProgressMap) => {
    progressRef.current = next;
    setProgressState(next);
  }, []);

  const pushChanged = useCallback(
    async (opts: { keepalive?: boolean } = {}) => {
      if (!getToken()) return;
      if (dirtyRef.current.size === 0) return;
      const ids = new Set(dirtyRef.current);
      const payload = pickDictationChanged(progressRef.current, ids);
      const merged = await remoteDictationSync(payload, opts);
      if (merged) {
        for (const id of ids) dirtyRef.current.delete(id);
        const remerged = mergeDictation(progressRef.current, merged);
        progressRef.current = remerged;
        setProgressState(remerged);
      }
    },
    [],
  );

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => void pushChanged(), SYNC_DEBOUNCE_MS);
  }, [pushChanged]);

  const flushSync = useCallback(() => {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
      syncTimer.current = null;
    }
    void pushChanged({ keepalive: true });
  }, [pushChanged]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushSync();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushSync);
    return () => {
      flushSync();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushSync);
    };
  }, [flushSync]);

  const recordAttempt = useCallback(
    (wordId: string, correct: boolean) => {
      const prev: DictationWordProgress =
        progressRef.current[wordId] ?? defaultDictationProgress();
      const updated: DictationWordProgress = {
        ...prev,
        attempts: prev.attempts + 1,
        correct: prev.correct + (correct ? 1 : 0),
        streak: correct ? prev.streak + 1 : 0,
        lastSeen: Date.now(),
      };
      const next = { ...progressRef.current, [wordId]: updated };
      progressRef.current = next;
      setProgressState(next);
      dirtyRef.current.add(wordId);
      void saveDictationProgress(next);
      scheduleSync();
    },
    [scheduleSync],
  );

  const toggleStar = useCallback(
    (wordId: string) => {
      const prev: DictationWordProgress =
        progressRef.current[wordId] ?? defaultDictationProgress();
      const updated: DictationWordProgress = {
        ...prev,
        starred: !prev.starred,
      };
      const next = { ...progressRef.current, [wordId]: updated };
      progressRef.current = next;
      setProgressState(next);
      dirtyRef.current.add(wordId);
      void saveDictationProgress(next);
      scheduleSync();
    },
    [scheduleSync],
  );

  return { progress, progressRef, setProgress, recordAttempt, toggleStar };
}
