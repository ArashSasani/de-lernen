# Architecture

- **Next.js App Router + TypeScript.** Client components for the study UI; six serverless
  routes for auth, sync, and AI (`api/login`, `api/progress`, `api/dictation`, `api/grammar-quiz`,
  `api/mistakes`, `api/ai`).
- **Rendering: static shell + client-side app, no per-request SSR.** See
  **[ADR 003](../../docs/adrs/003-static-rendering-client-app.md)**. Pages are prerendered to a static
  shell at build time (SSG) and run on the client (CSR). The three large corpora (`words.json`,
  `daily-texts.json`, `grammar-bank.json`) are **static assets fetched at runtime** by
  `lib/dataset.ts`'s `loadDataset()` — not bundled imports, and never a server data fetch — and
  precached by the service worker; `grammar.json` stays a bundled import because `api/ai` reads it
  server-side. See **[ADR 013](../../docs/adrs/013-runtime-fetched-corpora.md)**. The layout is a static server component (document shell + PWA metadata); the only
  per-request server code is `api/login`, `api/progress`, `api/dictation`, `api/grammar-quiz`,
  `api/mistakes`, and `api/ai` (JSON or a streamed text body, never HTML). Don't add `force-dynamic`
  or server-side page data fetching — it would break the offline guarantee.
- **Persistence split:** static word data (build-time JSON, fetched once and SW-cached) is separate
  from progress (mutable).
  Progress lives in **IndexedDB** locally and a single **Vercel KV** key remotely.
- **Sync model:** offline-first. Local is authoritative offline; on load / on change (debounced)
  / on reconnect, push changed progress and merge **newest-wins per word** by `lastReviewed`.
  Implement the same merge on client and server so neither device clobbers the other.
- **Capability tiers:** the deterministic core (flashcards, dictation, reading, grammar reference,
  the grammar quiz's frozen item bank) works fully offline with zero AI. An optional BYOK
  runtime-AI tier layers on top — `api/ai` (Edge, JWT-gated) proxies to the user's own Anthropic
  key — and must always degrade gracefully (grey out, or fall back to frozen/bank data) rather
  than block the core when offline, unconfigured, or toggled off in Settings. Most intents stream
  plain text (the tap-a-word chips); three are **non-streaming, JSON** via
  `client.messages.parse()` + a raw JSON-Schema `output_config.format`: `note`/`judge` (the
  mistakes corpus's note-authoring/verification calls) and `grammar` (adaptive grammar-quiz
  question generation, ADR 012) — the first real caller of the `note`/`judge` pair, which
  previously had none.
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
