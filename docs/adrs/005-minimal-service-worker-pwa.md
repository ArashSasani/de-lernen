# ADR 005 — Minimal Hand-Written Service Worker for the PWA

**Status:** Accepted  
**Implementation:** `public/sw.js`, `public/manifest.json`, `src/app/ServiceWorkerInit.tsx`,
`src/lib/service-worker.ts`, `src/app/layout.tsx`, `next.config`

## Context

The app is meant to be **installed to the home screen** on iPhone and Mac and to **work offline**
(invariant 4) — both of which require a service worker and a web manifest. The conventional
Next.js path is a plugin like `next-pwa`, which auto-generates the service worker and precache
manifest.

Two frictions push against that default:

- `next-pwa` has known **rough edges with the App Router**, the router this project uses.
- The caching need here is tiny and well-understood: cache the app shell + the static `words.json`,
  and **never** cache `/api/*` (those are the auth/sync endpoints — caching them would serve stale
  progress or break the newest-wins merge in [ADR 004](004-offline-first-progress-sync.md)).

A heavyweight plugin is a lot of generated machinery and config surface for a caching policy that
fits in a few lines.

## Decision

Hand-write a **minimal service worker** (`public/sw.js`) instead of adopting `next-pwa`.

- **Cache:** the app shell + `words.json` (the static dataset — see
  [ADR 002](002-build-time-data-pipeline.md)).
- **Never cache `/api/*`:** auth and progress sync must always hit the network when online.
- Register the worker from a small client island (`src/app/ServiceWorkerInit.tsx` →
  `src/lib/service-worker.ts`) that the static layout renders; serve `/sw.js` with the
  `Service-Worker-Allowed` and no-cache headers via `next.config`.
- **iOS install requirements** explicitly covered: `manifest.json`, `apple-touch-icon.png`,
  `theme-color`, and `apple-mobile-web-app-capable`.

## Consequences

- **Full control, no plugin churn:** the caching policy is readable in one small file, with no
  App-Router compatibility risk and no build-tool magic to debug.
- **Sync stays correct:** because `/api/*` is never cached, an online device always sees fresh
  remote progress; offline reads fall through to IndexedDB ([ADR 004](004-offline-first-progress-sync.md)),
  not a stale cached API response.
- **Manual cache busting:** without a generated precache manifest, the SW's cache version must be
  bumped by hand when the app shell changes, or clients can serve stale assets. The cost of the
  control we chose.
- **iOS durability caveat unchanged:** an installed PWA gets more durable storage than a browser
  tab, but iOS can still evict IndexedDB under pressure — which is exactly why KV sync exists as the
  backstop ([ADR 004](004-offline-first-progress-sync.md)).
