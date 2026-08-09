'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GrammarQuizProgressMap,
  GrammarQuizTopicProgress,
} from '@/types/grammar-quiz';
import {
  loadGrammarQuizProgress,
  saveGrammarQuizProgress,
  defaultGrammarQuizProgress,
  pickGrammarQuizChanged,
  mergeGrammarQuiz,
  remoteGrammarQuizSync,
} from '@/lib/grammar-quiz-sync';
import { getToken } from '@/lib/sync';

export { loadGrammarQuizProgress };

const SYNC_DEBOUNCE_MS = 2000;

export interface GrammarQuizSync {
  progress: GrammarQuizProgressMap;
  progressRef: React.RefObject<GrammarQuizProgressMap>;
  setProgress: (next: GrammarQuizProgressMap) => void;
  recordAttempt: (topicId: string, correct: boolean) => void;
}

export function useGrammarQuizSync(): GrammarQuizSync {
  const [progress, setProgressState] = useState<GrammarQuizProgressMap>({});
  const progressRef = useRef<GrammarQuizProgressMap>({});
  const dirtyRef = useRef<Set<string>>(new Set());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setProgress = useCallback((next: GrammarQuizProgressMap) => {
    progressRef.current = next;
    setProgressState(next);
  }, []);

  const pushChanged = useCallback(
    async (opts: { keepalive?: boolean } = {}) => {
      if (!getToken()) return;
      if (dirtyRef.current.size === 0) return;
      const ids = new Set(dirtyRef.current);
      const payload = pickGrammarQuizChanged(progressRef.current, ids);
      const merged = await remoteGrammarQuizSync(payload, opts);
      if (merged) {
        for (const id of ids) dirtyRef.current.delete(id);
        const remerged = mergeGrammarQuiz(progressRef.current, merged);
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
    (topicId: string, correct: boolean) => {
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
      dirtyRef.current.add(topicId);
      void saveGrammarQuizProgress(next);
      scheduleSync();
    },
    [scheduleSync],
  );

  return { progress, progressRef, setProgress, recordAttempt };
}
