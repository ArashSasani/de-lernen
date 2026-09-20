# Architecture

- **Next.js App Router + TypeScript.** Client components for the study UI; five serverless
  routes for auth, sync, and AI (`api/login`, `api/progress`, `api/dictation`, `api/grammar-quiz`,
  `api/ai`).
- **Rendering: static shell + client-side app, no per-request SSR.** See
  **[ADR 003](../../docs/adrs/003-static-rendering-client-app.md)**. Pages are prerendered to a static
  shell at build time (SSG) and run on the client (CSR); `words.json` is a bundled `import`, not a
  server fetch. The layout is a static server component (document shell + PWA metadata); the only
  per-request server code is `api/login`, `api/progress`, `api/dictation`, `api/grammar-quiz`, and
  `api/ai` (JSON or a streamed text body, never HTML). Don't add `force-dynamic` or server-side page
  data fetching — it would break the offline guarantee.
- **Persistence split:** static word data (bundled JSON) is separate from progress (mutable).
  Progress lives in **IndexedDB** locally and a single **Vercel KV** key remotely.
- **Sync model:** offline-first. Local is authoritative offline; on load / on change (debounced)
  / on reconnect, push changed progress and merge **newest-wins per word** by `lastReviewed`.
  Implement the same merge on client and server so neither device clobbers the other.
- **Capability tiers:** the deterministic core (flashcards, dictation, reading, grammar reference)
  works fully offline with zero AI. An optional BYOK runtime-AI tier layers on top —
  `api/ai` (Edge, streaming, JWT-gated) proxies to the user's own Anthropic key — and must always
  degrade gracefully (grey out) rather than block the core when offline, unconfigured, or toggled
  off in Settings.
- **UI kit: FlyonUI as a Tailwind plugin only — CSS classes, no JS runtime.** Styling is FlyonUI's
  semantic classes on top of Tailwind v4 (two themes, `delernen-dark`/`delernen-light`, declared in
  `globals.css`, plus `flyonui/variants.css` for state variants like `accordion-item-active:`).
  FlyonUI's JS bundle is deliberately **not** loaded, and neither is the
  [Next.js guide](https://flyonui.com/docs/framework-integrations/nextjs/)'s companion
  `@source '…/flyonui.js'` line: its plugins keep component state in the DOM, which fights React
  for anything the app needs to control (deep-linked accordion categories, expand-all while a
  search is active). React owns every component's state instead — see
  `components/shared/Accordion`, which reuses FlyonUI's accordion classes but animates open/close
  with a `0fr → 1fr` grid row rather than a measured JS height. This also keeps the offline
  guarantee simple: no interactive content depends on a lazily-imported JS chunk being in the
  service-worker cache.
