---
paths:
  - 'public/sw.js'
  - 'public/manifest.json'
  - 'src/lib/service-worker.ts'
  - 'src/app/ServiceWorkerInit.tsx'
  - 'src/app/layout.tsx'
---

# PWA notes

See **[ADR 005](../../docs/adrs/005-minimal-service-worker-pwa.md)** for the full rationale (why a
hand-written SW over `next-pwa`, cache-busting tradeoff). Key facts:

- Prefer a **minimal hand-written service worker** over heavy plugins — `next-pwa` has App Router
  rough edges. `public/sw.js` precaches **every route's shell**, the three fetched corpora
  (`/data/*.json`, ADR 013) and `public/offline.html`; entries are added one by one so a single
  404 can't fail the whole install. Never cache `/api/*`.
- Strategies: navigation is **network-first**, falling back to the route's cached shell and then
  to `offline.html`; `/data/*` is **stale-while-revalidate** (unhashed paths, so a rebuild lands on
  the next load without a cache bump); everything else is **cache-first** (content-hashed).
- iOS: needs `manifest.json`, `apple-touch-icon.png`, `theme-color`, and
  `apple-mobile-web-app-capable`. Installed-to-home-screen storage is more durable than a browser
  tab, but iOS can still evict IndexedDB under pressure — which is exactly why KV sync exists.
