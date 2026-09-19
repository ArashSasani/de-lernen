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
