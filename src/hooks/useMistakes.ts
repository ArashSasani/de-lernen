'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MistakeCorpus, MistakeRecord } from '@/types/mistakes';
import {
  loadMistakes,
  saveMistake,
  mergeMistakes,
  pickNewMistakes,
  remoteMistakesSync,
  fullMistakesSync,
} from '@/lib/mistakes-sync';
import { getToken, SYNC_DEBOUNCE_MS } from '@/lib/sync';

export { loadMistakes };

export interface MistakesApi {
  mistakes: MistakeCorpus; // createdAt desc
  ready: boolean;
  // Takes an already-gated record, so it stays source-agnostic: the caller
  // owns authoring (the note intent) and gating; this owns persistence.
  addRecord: (record: MistakeRecord) => void;
}

// The corpus transport — IndexedDB load, remote merge, debounced push, and
// the keepalive flush the other three tracks use. Its producer is the
// grammar quiz, via useMistakeNotes, which calls addRecord with a gated
// record.
export function useMistakes(): MistakesApi {
  const [mistakes, setMistakesState] = useState<MistakeCorpus>([]);
  const mistakesRef = useRef<MistakeCorpus>([]);
  const [ready, setReady] = useState(false);
  const dirtyRef = useRef<Set<string>>(new Set());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setMistakes = useCallback((next: MistakeCorpus) => {
    mistakesRef.current = next;
    setMistakesState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadMistakes();
      if (cancelled) return;
      setMistakes(local);
      const merged = await fullMistakesSync(local);
      if (cancelled) return;
      setMistakes(merged);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [setMistakes]);

  const pushNew = useCallback(async (opts: { keepalive?: boolean } = {}) => {
    if (!getToken()) return;
    if (dirtyRef.current.size === 0) return;
    const ids = new Set(dirtyRef.current);
    const payload = pickNewMistakes(mistakesRef.current, ids);
    const merged = await remoteMistakesSync(payload, opts);
    if (merged) {
      for (const id of ids) dirtyRef.current.delete(id);
      const remerged = mergeMistakes(mistakesRef.current, merged);
      mistakesRef.current = remerged;
      setMistakesState(remerged);
    }
  }, []);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => void pushNew(), SYNC_DEBOUNCE_MS);
  }, [pushNew]);

  const flushSync = useCallback(() => {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
      syncTimer.current = null;
    }
    void pushNew({ keepalive: true });
  }, [pushNew]);

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

  const addRecord = useCallback(
    (record: MistakeRecord) => {
      const next = [record, ...mistakesRef.current];
      mistakesRef.current = next;
      setMistakesState(next);
      dirtyRef.current.add(record.id);
      void saveMistake(record);
      scheduleSync();
    },
    [scheduleSync],
  );

  return { mistakes, ready, addRecord };
}
