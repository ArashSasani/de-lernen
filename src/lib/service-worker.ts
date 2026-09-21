import { SW_CACHE_PREFIX } from '@/constants';

export function shouldRegisterServiceWorker(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    process.env.NODE_ENV === 'production'
  );
}

// A service worker registered by a production run on localhost survives the
// switch back to `npm run dev` — same origin — and keeps serving its
// cache-first copies of /_next chunks, whose dev URLs are stable and so
// never refresh. That hydrates current server HTML with a stale bundle, so
// a non-production load tears the worker and its caches down rather than
// merely skipping registration.
export async function unregisterServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((r) => r.unregister()));

  if (typeof caches === 'undefined') return;
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((k) => k.startsWith(SW_CACHE_PREFIX))
      .map((k) => caches.delete(k)),
  );
}

export function registerServiceWorker(): void {
  if (!shouldRegisterServiceWorker()) {
    void unregisterServiceWorker().catch(() => {
      // teardown is best-effort; a dev load still works without it
    });
    return;
  }
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // registration failures are non-fatal; app still works online
  });
}
