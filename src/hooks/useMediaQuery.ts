'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query.
 *
 * Use this — not a `md:hidden` wrapper — whenever a component must not *exist*
 * at a given breakpoint. A hidden-by-CSS component still mounts and still runs
 * its effects, which is how the desktop grammar/read pages ended up with the
 * mobile modal's body scroll-lock applied to an invisible dialog.
 *
 * Reads `false` during prerender (there's no viewport to measure), so don't
 * use it to gate content that has to be in the static shell.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
