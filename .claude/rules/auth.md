---
paths:
  - 'src/app/api/**'
  - 'src/lib/auth.ts'
  - 'src/lib/auth-security.ts'
  - 'src/app/login/**'
---

# Auth spec

See **[ADR 006](../../docs/adrs/006-single-password-stateless-auth.md)** for the full rationale and
tradeoffs (no refresh tokens, stolen-token window, `localStorage` vs cookie). Key facts:

- `POST /api/login {password}` → compare to `APP_PASSWORD` → on match, sign a JWT
  (jose, HS256, 30-day expiry, `TOKEN_SECRET`) and return it. Client stores it in localStorage.
- **Failed logins are rate-limited** (`src/lib/auth-security.ts`): 5 failures per client IP in a
  15-minute window → `429` with a `Retry-After` header; a successful login clears the counter. The
  counter lives in KV under a hashed key (`login:failed:<sha256(TOKEN_SECRET:ip)>`) and **fails
  open** — a KV outage or a KV-less local dev setup must never lock the single user out.
- `GET /api/progress` / `PUT /api/progress` → require `Authorization: Bearer <jwt>`, verify, then
  read/merge-write KV. 401 on missing/invalid token; client clears the token and routes to login.
- No refresh tokens, no sessions table. Stateless JWT is fine for one user.
- `POST /api/ai` reuses the same Bearer-JWT gate but is otherwise the odd one out: it's the second
  **Edge** (not Node) runtime route besides `login`, and it responds with a **streamed plain-text
  body**, not JSON — the client reads it via `res.body.getReader()`, not `res.json()`. 401 on
  missing/invalid token follows the same client contract (clear the token, route to login).
- `GET /api/ai` shares the same file and the same Bearer-JWT gate; it returns
  `{ configured: boolean }` — whether `ANTHROPIC_API_KEY` is set on this deployment — so the
  client (`useAiConfigured`) can auto-disable the Settings AI toggle instead of only discovering
  it's unconfigured after a POST 503.
