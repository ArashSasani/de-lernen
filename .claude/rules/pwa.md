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

- Prefer a **minimal hand-written service worker** (cache app shell + `words.json`; never cache
  `/api/*`) over heavy plugins — `next-pwa` has App Router rough edges.
- iOS: needs `manifest.json`, `apple-touch-icon.png`, `theme-color`, and
  `apple-mobile-web-app-capable`. Installed-to-home-screen storage is more durable than a browser
  tab, but iOS can still evict IndexedDB under pressure — which is exactly why KV sync exists.
