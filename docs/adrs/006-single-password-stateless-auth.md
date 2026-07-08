# ADR 006 — Single-Password, Stateless JWT Auth

**Status:** Accepted  
**Implementation:** `src/lib/auth.ts`, `src/app/api/login/route.ts`, `src/app/api/progress/route.ts`

## Context

The app has exactly **one user** and no concept of accounts, profiles, or sharing
(see CLAUDE.md → "What this is"). Yet the sync endpoints (`/api/progress`) must not be world-open:
the production URL is public, and anyone hitting it could otherwise read or overwrite the single
user's progress in KV.

So we need _some_ gate, but the usual machinery — user table, password hashing per account, refresh
tokens, server-side sessions — is overkill and pulls in a database we explicitly don't want
(invariant: "Don't add user accounts", "no DB beyond KV"). The constraint is: protect the endpoints
with the least mechanism that is still genuinely a gate, and keep all secrets in env (invariant 2).

## Decision

A **single shared password** plus a **stateless signed JWT**. No user database, no sessions table.

### Login

- `POST /api/login {password}` compares the body against the `APP_PASSWORD` env var.
- On match, sign a JWT with **jose**, **HS256**, **30-day expiry**, secret = `TOKEN_SECRET`.
- Return the token; the client stores it in `localStorage`.
- On mismatch, `401`.

### Authorizing requests

- `GET /api/progress` and `PUT /api/progress` require `Authorization: Bearer <jwt>`.
- The route verifies the token (signature + expiry) before reading/merge-writing KV.
- Missing or invalid token → `401`. The client then clears the stored token and routes to `/login`.

Both `APP_PASSWORD` and `TOKEN_SECRET` live only in `.env.local` and the Vercel dashboard
(invariant 2) — never committed, never hardcoded.

## Consequences

- **No database for auth:** the JWT is self-contained; the server holds no session state. Verifying
  a request is a pure signature check, which also keeps the serverless routes cheap and stateless.
- **30-day expiry, no refresh:** a single user on personal devices re-typing a password monthly is
  fine. Adding refresh tokens would be complexity with no payoff here.
- **Stolen-token window:** because there's no session store, a leaked token is valid until it
  expires — there's no server-side revocation. Mitigation if ever needed: rotate `TOKEN_SECRET`
  (invalidates all outstanding tokens at once). Acceptable for a single-user study app.
- **`localStorage`, not an httpOnly cookie:** simpler for a client-driven PWA and avoids CSRF
  considerations, at the cost of XSS exposure. The app renders no third-party/user-generated HTML,
  so the XSS surface is minimal.
- **Auth is the gate for sync, not for studying:** a `401` never blocks local IndexedDB study —
  it only stops remote sync until re-login. This is what keeps the offline guarantee
  (see [ADR 004](004-offline-first-progress-sync.md)) independent of auth state.
- **Not multi-user-ready by design:** moving to real accounts would mean revisiting this wholesale.
  That is an explicit non-goal (CLAUDE.md → "Out of scope").
