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
import { getToken } from '@/lib/sync';
import { useDebouncedPush } from './useDebouncedPush';

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

  const push = useCallback(
    async (ids: ReadonlySet<string>, opts: { keepalive?: boolean }) => {
      if (!getToken()) return false;
      const payload = pickNewMistakes(mistakesRef.current, ids);
      const merged = await remoteMistakesSync(payload, opts);
      if (!merged) return false;
      const remerged = mergeMistakes(mistakesRef.current, merged);
      mistakesRef.current = remerged;
      setMistakesState(remerged);
      return true;
    },
    [],
  );

  const { markDirty } = useDebouncedPush(push);

  const addRecord = useCallback(
    (record: MistakeRecord) => {
      const next = [record, ...mistakesRef.current];
      mistakesRef.current = next;
      setMistakesState(next);
      void saveMistake(record);
      markDirty(record.id);
    },
    [markDirty],
  );

  return { mistakes, ready, addRecord };
}
