'use client';

import { useCallback, useEffect, useRef } from 'react';
import { SYNC_DEBOUNCE_MS } from '@/lib/sync';

export interface DebouncedPush {
  markDirty: (id: string) => void;
  // Push now, cancelling any pending debounce, with a keepalive body.
  flush: () => void;
}

// The push lifecycle every synced track shares: dirty ids, a debounce, and the iOS-PWA
// keepalive flush (ADR 004). Only ids a confirmed push was handed are cleared.
export function useDebouncedPush(
  push: (
    ids: ReadonlySet<string>,
    opts: { keepalive?: boolean },
  ) => Promise<boolean>,
): DebouncedPush {
  const dirtyRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // In a ref so the lifecycle effect never re-subscribes on a caller's new closure.
  const pushRef = useRef(push);
  useEffect(() => {
    pushRef.current = push;
  }, [push]);

  const run = useCallback(async (opts: { keepalive?: boolean }) => {
    if (dirtyRef.current.size === 0) return;
    const ids = new Set(dirtyRef.current);
    const confirmed = await pushRef.current(ids, opts);
    if (confirmed) for (const id of ids) dirtyRef.current.delete(id);
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    void run({ keepalive: true });
  }, [run]);

  const markDirty = useCallback(
    (id: string) => {
      dirtyRef.current.add(id);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void run({}), SYNC_DEBOUNCE_MS);
    },
    [run],
  );

  // An installed iOS PWA fires visibilitychange/pagehide, not a reliable unmount;
  // unmount stays as a fallback. An empty dirty set makes each flush a no-op.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  return { markDirty, flush };
}
