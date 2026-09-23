'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { pickEntries } from '@/lib/merge';
import { getToken } from '@/lib/sync';
import { useDebouncedPush } from './useDebouncedPush';

export interface SyncedMapConfig<T> {
  // Newest-wins merge for this track — the same function the server runs.
  merge: (
    local: Record<string, T>,
    remote: Record<string, T>,
  ) => Record<string, T>;
  // PUT the changed subset; resolves to the server's merged map, or null on
  // a failed / unauthorized / offline request.
  remotePush: (
    payload: Record<string, T>,
    opts: { keepalive?: boolean },
  ) => Promise<Record<string, T> | null>;
  saveLocal: (map: Record<string, T>) => Promise<void>;
  // Called after a push that came back without a usable token, so the page
  // can route to login.
  onTokenLost?: () => void;
}

export interface SyncedMap<T> {
  map: Record<string, T>;
  // Always-current snapshot, readable synchronously inside callbacks without
  // a stale closure (queue building reads it without re-subscribing).
  mapRef: React.RefObject<Record<string, T>>;
  // Replace the whole map (initial load / post-merge).
  setMap: (next: Record<string, T>) => void;
  // Apply a transform to one entry, persist locally now, debounce the push.
  update: (id: string, transform: (prev: T) => T) => Record<string, T>;
}

// The offline-first transport the three keyed tracks share; only merge, endpoint and
// local store differ. The mistakes corpus is an array, so it shares only useDebouncedPush.
export function useSyncedMap<T>(
  cfg: SyncedMapConfig<T>,
  makeDefault: () => T,
): SyncedMap<T> {
  const [map, setMapState] = useState<Record<string, T>>({});
  const mapRef = useRef<Record<string, T>>({});
  // In a ref so `update`/`push` never change identity when a caller
  // re-creates its config object.
  const cfgRef = useRef(cfg);
  useEffect(() => {
    cfgRef.current = cfg;
  }, [cfg]);

  const setMap = useCallback((next: Record<string, T>) => {
    mapRef.current = next;
    setMapState(next);
  }, []);

  const push = useCallback(
    async (ids: ReadonlySet<string>, opts: { keepalive?: boolean }) => {
      if (!getToken()) return false;
      const merged = await cfgRef.current.remotePush(
        pickEntries(mapRef.current, ids),
        opts,
      );
      if (!getToken()) {
        cfgRef.current.onTokenLost?.();
        return false;
      }
      if (!merged) return false;
      // Re-merged rather than taken wholesale, so a stale KV can't overwrite
      // newer local entries that were never sent.
      const remerged = cfgRef.current.merge(mapRef.current, merged);
      mapRef.current = remerged;
      setMapState(remerged);
      return true;
    },
    [],
  );

  const { markDirty } = useDebouncedPush(push);

  const update = useCallback(
    (id: string, transform: (prev: T) => T) => {
      const prev = mapRef.current[id] ?? makeDefault();
      const next = { ...mapRef.current, [id]: transform(prev) };
      mapRef.current = next;
      setMapState(next);
      // The IndexedDB put is dispatched synchronously; the remote push is
      // debounced behind it, with the flush covering background/close.
      void cfgRef.current.saveLocal(next);
      markDirty(id);
      return next;
    },
    [makeDefault, markDirty],
  );

  return { map, mapRef, setMap, update };
}
