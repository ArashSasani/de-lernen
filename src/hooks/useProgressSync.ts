'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProgressMap, WordProgress } from '@/types';
import { defaultProgress } from '@/lib/leitner';
import {
  localSave,
  remoteSync,
  mergeProgress,
  getToken,
  pickChanged,
  SYNC_DEBOUNCE_MS,
} from '@/lib/sync';

interface ProgressSync {
  // Current progress as React state — drives re-renders.
  progress: ProgressMap;
  // Always-current snapshot, readable synchronously inside callbacks/effects
  // without a stale closure (used to build queues without re-subscribing).
  progressRef: React.RefObject<ProgressMap>;
  // Replace the whole map (initial load / post-merge); keeps state and ref together.
  setProgress: (next: ProgressMap) => void;
  // Apply a transform to one word, persist to IndexedDB now, and debounce the
  // remote push. Returns the new map for any caller-side derivations.
  grade: (
    wordId: string,
    transform: (prev: WordProgress) => WordProgress,
  ) => ProgressMap;
}

// Shared offline-first progress sync for the study and read pages: debounced KV
// push on grade, plus a synchronous keepalive flush on the lifecycle events an
// installed iOS PWA actually fires when backgrounded/killed — without which the
// last grades are lost and high-box cards silently revert to box 1 after an
// IndexedDB eviction. See CLAUDE.md "Sync / merge spec" and ADR 004.
export function useProgressSync(): ProgressSync {
  const router = useRouter();
  const [progress, setProgressState] = useState<ProgressMap>({});
  const progressRef = useRef<ProgressMap>({});
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Word ids graded but not yet confirmed-synced to KV. We push only this subset
  // so the keepalive flush body stays far under the 64KB limit (see pickChanged).
  const dirtyRef = useRef<Set<string>>(new Set());

  const setProgress = useCallback((next: ProgressMap) => {
    progressRef.current = next;
    setProgressState(next);
  }, []);

  // Push only the words changed since the last confirmed push. On a confirmed
  // response we clear exactly the ids we sent — grades made during the in-flight
  // request stay dirty for the next push — then re-merge newest-wins so a stale
  // KV (e.g. a failed initial push) can't overwrite locally-newer cards.
  const pushChanged = useCallback(
    (opts: { keepalive?: boolean } = {}) => {
      if (!getToken()) return;
      const sent = [...dirtyRef.current];
      if (sent.length === 0) return;
      const payload = pickChanged(progressRef.current, sent);
      remoteSync(payload, opts).then((merged) => {
        if (!getToken()) {
          router.replace('/login');
        } else if (merged) {
          for (const id of sent) dirtyRef.current.delete(id);
          setProgress(mergeProgress(progressRef.current, merged));
        }
      });
    },
    [router, setProgress],
  );

  // Immediately flush pending changes, cancelling any pending debounce. keepalive
  // lets the request survive the page being backgrounded/killed.
  const flushSync = useCallback(() => {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
      syncTimer.current = null;
    }
    pushChanged({ keepalive: true });
  }, [pushChanged]);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => pushChanged(), SYNC_DEBOUNCE_MS);
  }, [pushChanged]);

  // Flush on the lifecycle events an installed iOS PWA actually fires when it is
  // backgrounded or closed (unmount/beforeunload are unreliable there), plus on
  // unmount as a fallback. A flush with an empty dirty set is a no-op, so this is
  // safe to keep mounted before the first grade.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushSync();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushSync);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushSync);
      flushSync();
    };
  }, [flushSync]);

  const grade = useCallback(
    (wordId: string, transform: (prev: WordProgress) => WordProgress) => {
      const prev = progressRef.current[wordId] ?? defaultProgress();
      const updated = { ...progressRef.current, [wordId]: transform(prev) };
      progressRef.current = updated;
      dirtyRef.current.add(wordId);
      setProgressState(updated);
      // Persist to IndexedDB now (the put is dispatched synchronously), then
      // debounce the remote push; flushSync covers the background/close case.
      void localSave(updated);
      scheduleSync();
      return updated;
    },
    [scheduleSync],
  );

  return { progress, progressRef, setProgress, grade };
}
