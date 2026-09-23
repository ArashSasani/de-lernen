const CACHE = 'de-lernen-v4';

const OFFLINE_FALLBACK = '/offline.html';

// Every route's shell, so a cold install that goes offline before visiting a
// page still has it. Navigation is network-first, so these serve only offline.
const ROUTES = [
  '/',
  '/study',
  '/read',
  '/dictation',
  '/grammar',
  '/grammar/quiz',
  '/settings',
  '/login',
];

// The corpora the app fetches at runtime (ADR 013) — precached, since offline
// study depends on them.
const DATA = [
  '/data/words.json',
  '/data/daily-texts.json',
  '/data/grammar-bank.json',
];

const PRECACHE = [
  ...ROUTES,
  ...DATA,
  OFFLINE_FALLBACK,
  '/manifest.json',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Individually, not cache.addAll: that rejects the whole install if a
      // single entry 404s, which would leave the app with no cache at all.
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] precache miss:', url, err);
          }),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

// Cached copy at once, refreshed in the background: the corpora's paths are
// unhashed, so cache-first would pin a stale build's data until a cache bump.
function staleWhileRevalidate(request) {
  return caches.open(CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  // Never cache API routes
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/data/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Network-first for navigation so updates propagate; offline it falls back to
  // the route's shell, then to the offline page for a URL never cached.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_FALLBACK)),
        ),
    );
    return;
  }

  // Cache-first for everything else (JS, CSS, fonts, images) — all of it is
  // content-hashed by the build, so a stale entry can't shadow a new one.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return res;
        }),
    ),
  );
});
