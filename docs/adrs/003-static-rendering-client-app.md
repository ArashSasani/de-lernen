# ADR 003 — Static Rendering + Client-Side App (no per-request SSR)

**Status:** Accepted  
**Implementation:** `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/study/page.tsx`,
`src/app/login/page.tsx`, `src/app/ServiceWorkerInit.tsx`, `src/app/api/{login,progress}/route.ts`

## Context

The app is built on the Next.js App Router, which makes **server-side rendering the default** for
pages. But this app is an **offline-first, installable PWA** (invariant 4): the UI has to render
and fully function from the service-worker-cached app shell with **no network**, and all of its
real state lives on the client — progress in IndexedDB, the JWT in `localStorage`, the word list
bundled into the JS from `data/words.json` (invariant 3). There is no per-request data that the
server could usefully render into the HTML.

So the question is _how much of the App Router's server rendering we actually want_. Per-request
SSR would fight the offline requirement: a page rendered fresh on every request can't be served
from a static cache when the device is offline, and it would buy us nothing here because the
server has no user-specific data to inject (it can't read IndexedDB or `localStorage`).

## Decision

**Render the pages as static HTML at build time (SSG) and run the actual app on the client (CSR).
Reserve the server only for a static document shell and two JSON API routes.** Do not introduce
per-request SSR, server-side data fetching for pages, or `dynamic = 'force-dynamic'`.

Concretely, each route falls into one of three buckets:

| Route                                                    | Kind                                 | Runs where                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/layout.tsx`                                         | Server component (static)            | Build time → emits `<html>`/`<body>`, fonts, PWA `metadata`/`viewport`. Same output every build, so it's baked in, not per-request.              |
| `app/page.tsx`                                           | Server component                     | A bare `redirect('/study')`. No content rendered.                                                                                                |
| `app/study/page.tsx`, `app/login/page.tsx`               | `'use client'` → **SSG shell + CSR** | Prerendered to a static shell at build; all state (IndexedDB load, `fullSync`, queue building, grading) runs in `useEffect` **after hydration**. |
| `app/api/login`, `app/api/progress`, `app/api/dictation` | Serverless functions                 | Per-request on Vercel. Return **JSON, not HTML** — these are the only true runtime-server code.                                                  |

The word data is **not** an SSR fetch: `src/lib/words.ts` does a plain `import wordsData from
'data/words.json'`, so the dataset is bundled into the client JS and cached by the service worker
alongside the shell.

Service-worker registration is itself a client concern, so it lives in a tiny client island
(`app/ServiceWorkerInit.tsx`) rendered by the otherwise-static layout — the layout stays a server
component, the `useEffect` registration stays on the client.

## Architecture

```
┌──────────────────────── BUILD TIME (next build) ───────────────────────┐
│                                                                         │
│  data/words.json ──import──┐                                            │
│                            ▼                                            │
│   layout.tsx (server) ─► static <html> shell + PWA metadata            │
│   page.tsx    (server) ─► redirect('/study')                            │
│   study/login (client) ─► prerendered static HTML shell  ── + ──►  JS  │
│                            (words.json bundled into the client JS)      │
│                                                                         │
└──────────────────────────────────┬──────────────────────────────────--─┘
                                    │ deployed as static assets + λ routes
                                    ▼
┌──────────────────────────────── RUNTIME ──────────────────────────────-─┐
│                                                                          │
│   BROWSER (PWA, works offline)            VERCEL (serverless λ)          │
│   ┌───────────────────────────┐           ┌──────────────────────────┐  │
│   │ Service Worker             │           │ POST /api/login          │  │
│   │  • app shell (/, /study,   │           │   → verify APP_PASSWORD  │  │
│   │    /login)                 │           │   → sign JWT (jose)      │  │
│   │  • bundled JS + words.json │           ├──────────────────────────┤  │
│   │  • never caches /api/*     │           │ GET/PUT /api/progress    │  │
│   └───────────┬───────────────┘           │   → Bearer JWT guard     │  │
│               │ serves shell               │   → merge ↔ Vercel KV    │  │
│               ▼                            └────────────┬─────────────┘  │
│   ┌───────────────────────────┐                        │ Bearer JWT     │
│   │ Hydrated React app (CSR)   │  ── fetch /api/* ──────┘ (online only)  │
│   │  • IndexedDB (progress)    │                                         │
│   │  • localStorage (JWT)      │   Offline: shell + JS + words.json from │
│   │  • Leitner queue, grading  │   cache; grading writes IndexedDB; API  │
│   │  • debounced sync          │   calls simply fail and retry on        │
│   └───────────────────────────┘   reconnect (see ADR 004).              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────-─┘
```

The three API routes (`login`, `progress`, `dictation`) are the only per-request server code, and they're deliberately HTTP/JSON
endpoints the client calls — not page renderers. Everything a user _sees_ comes from the static
shell plus client-side React.

## Consequences

- **Offline-capable by construction:** because pages are static, the service worker can cache the
  whole shell and serve it with no network. Per-request SSR could not be cached this way. This is
  what makes invariant 4 hold (see [ADR 005](005-minimal-service-worker-pwa.md) for the SW itself).
- **No server round-trip for content:** first paint is a static shell from cache/CDN; the app
  hydrates and reads local state. No SSR latency, no server compute on the hot path.
- **The server's job is tiny and stateless:** auth ([ADR 006](006-single-password-stateless-auth.md))
  and progress sync ([ADR 004](004-offline-first-progress-sync.md)) — two JSON routes backed by KV.
  Nothing else runs server-side at request time, which keeps us inside the \$0 hosting target.
- **No SEO / no-JS rendering:** the static shell is near-empty until JS hydrates, so the app is
  useless with JavaScript disabled and invisible to crawlers. Both are non-issues for a
  single-user, auth-gated, installed PWA.
- **State is client-authoritative:** the server never renders user data into HTML (it has none to
  render), so there is no SSR/CSR hydration-mismatch risk from progress and no flash of
  server-rendered state. The tradeoff is that a cold load shows the shell before progress appears.
- **Don't reach for SSR later by reflex.** Adding `force-dynamic`, server data fetching for pages,
  or RSC data loading would re-introduce a network dependency on the render path and break the
  offline guarantee. If a future feature seems to need it, treat it as a decision that revisits
  this ADR, not a routine change.
