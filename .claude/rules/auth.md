---
paths:
  - 'src/app/api/**'
  - 'src/lib/auth.ts'
  - 'src/app/login/**'
---

# Auth spec

See **[ADR 006](../../docs/adrs/006-single-password-stateless-auth.md)** for the full rationale and
tradeoffs (no refresh tokens, stolen-token window, `localStorage` vs cookie). Key facts:

- `POST /api/login {password}` → compare to `APP_PASSWORD` → on match, sign a JWT
  (jose, HS256, 30-day expiry, `TOKEN_SECRET`) and return it. Client stores it in localStorage.
- `GET /api/progress` / `PUT /api/progress` → require `Authorization: Bearer <jwt>`, verify, then
  read/merge-write KV. 401 on missing/invalid token; client clears the token and routes to login.
- No refresh tokens, no sessions table. Stateless JWT is fine for one user.
