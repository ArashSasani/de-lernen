# ADR 004 — Offline-First Progress Sync Across Devices

**Status:** Accepted  
**Implementation:** `src/lib/sync.ts` (client), `src/lib/db.ts` (server), `src/app/api/progress/route.ts`

## Context

The app runs as an installable PWA on two devices (iPhone + Mac) for a single user, and **must work
offline** (invariant 4): studying, grading, and local persistence cannot depend on the network.
At the same time, progress should follow the user across devices, so a word reviewed on the phone
shows up scheduled correctly on the Mac.

Two constraints shape the design:

- **No real backend or DB beyond Vercel KV** — no per-record server, no conflict-resolution service.
- **iOS can evict IndexedDB under storage pressure**, even for an installed PWA, so a purely local
  store is not durable enough on its own. KV is the durable backstop.

Only the user's `ProgressMap` is mutable and synced — the static word data (`words.json`) is
immutable at runtime (invariant 3) and is never part of sync.

This sync model assumes the app is **client-authoritative**: progress lives on the client and is
never server-rendered, which is exactly the rendering model recorded in
[ADR 003](003-static-rendering-client-app.md). The API routes (`login`, `progress`, and the
parallel `dictation` route) are the only server code on the request path.

## Decision

Offline-first with **last-writer-wins per word**, resolved by each word's `lastReviewed` timestamp,
using the **same pure merge function on both client and server**.

### The two stores

| Store         | Where                              | Role                                                                                                                  |
| ------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **IndexedDB** | Each device, local                 | Authoritative offline. Every grade writes here immediately.                                                           |
| **Vercel KV** | Remote, single key `user:progress` | Holds the whole `ProgressMap`. Shared source of truth across devices and durable backstop against IndexedDB eviction. |

### The merge function

`mergeProgress(local, remote)` is a pure function, shared between `src/lib/db.ts` (server) and a
client-safe copy used by `src/lib/sync.ts`:

- Start from `remote`.
- For each word in `local`, take the local entry **only if** it is new (not in remote) or has a
  **strictly newer** `lastReviewed`.

Running the identical merge on both sides means neither device can clobber the other regardless of
who writes last — a stale PUT merges into KV rather than overwriting it.

### Client flow

- **On load / reconnect (`fullSync`):** load IndexedDB → fetch remote (`GET /api/progress`) →
  `mergeProgress(local, remote)` → save the merged map locally **and** PUT it to the server.
- **On every grade:** write IndexedDB immediately (synchronous, offline-safe); debounce (~2s) the
  remote PUT so rapid grading produces one network write, not one per card.

### Server flow

`GET /api/progress` returns the KV map (or `{}` if KV is unset/unreachable). `PUT /api/progress`
**merges** the request body into KV via `mergeProgress` before saving, then returns the merged
result — so the server is also conflict-safe, not a blind overwrite. Both routes require a valid
Bearer JWT (see [ADR — auth in CLAUDE.md](../../CLAUDE.md#auth-spec)); a 401 makes the client drop
the token and route to login, but local study continues regardless.

### Worked example

1. Phone (offline) grades word X → IndexedDB only.
2. Laptop (online) grades word Y → debounced PUT merges Y into KV.
3. Phone reconnects → fetches KV (has Y), merges with local (has X), saves the union locally and
   PUTs it back. KV now holds both.
4. Laptop's next `fullSync` fetches and merges → both devices converge.

For a word touched on **both** devices, the later `lastReviewed` wins.

## Consequences

- **Truly offline:** grading never blocks on the network; sync is best-effort on top. With `KV_*`
  unset the app is fully usable on one device (sync simply no-ops).
- **No clobbering:** symmetric merge on client and server makes convergence order-independent — no
  central locking or sequence numbers needed.
- **Durable:** KV survives IndexedDB eviction on iOS; a wiped device re-hydrates from KV on next
  login.
- **Clock-dependent:** resolution relies on device `lastReviewed` timestamps, so a badly skewed
  device clock could make its writes wrongly win or lose. Acceptable for one user across personal
  devices; it is the explicit tradeoff for avoiding vector clocks / a server sequence.
- **Per-word granularity only:** merge is per word `id`, not per field — a newer review carries its
  whole `WordProgress` (`box`, `lastReviewed`, `nextDue`). Fine, since a review updates all three
  together.
- **Dictation progress syncs on a parallel track.** The Dictation feature has its own
  `DictationProgressMap` in a separate IndexedDB object store (`dictation`) and its own KV key,
  `user:dictation`, reached via `api/dictation`. It reuses this same offline-first machinery —
  newest-wins by `lastSeen` (with `starred` OR-merged), plus the keepalive flush — but never touches
  the Leitner `user:progress` key, so the two tracks can't clobber each other. See
  [ADR 008](008-dictation-spelling-exercise.md). The grammar-quiz track, by contrast, is genuinely
  local-only (no KV); see [ADR 010](010-grammar-quiz.md).
