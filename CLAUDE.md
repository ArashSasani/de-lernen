# CLAUDE.md — project context for the agent

This file plus the topic rules in **`.claude/rules/`** are the **source of truth** for the
project's spec and invariants — the data model, the Leitner / sync / auth specs, the
data-pipeline design, and the corrections policy. Rules in `.claude/rules/` are loaded by Claude
Code the same way this file is (see "Rules map" below for what lives where).

## What this is

A single-user, offline-first, installable PWA for studying German vocabulary (A1, A2;
extensible to further levels) with Leitner-box spaced repetition. Vocabulary is compiled
**once** from source PDFs into a static `data/words.json`. The deterministic core makes **zero LLM
calls**; an optional, BYOK runtime-AI layer (tap-a-word chips on the daily reading text, and an
adaptive grammar-practice question generator layered on the frozen quiz bank) runs behind the
user's own key and degrades gracefully offline.

User: one person. No multi-user auth, no user database. A single password gate is enough.

## Hard invariants (do not violate)

1. **The app ships zero inference capability and zero AI secrets of its own.** All build-time
   translation/fixing/text-authoring happens in the one-time local data build, whose output lives in
   the repo as static files (`words.json`, `daily-texts.json`, `grammar.json`, `grammar-bank.json`).
   The one runtime exception is the optional, user-supplied AI layer: a single JWT-gated Edge route
   (`/api/ai`) proxies to the deploying user's own paid Anthropic key, is entirely optional, and must
   degrade gracefully (grey out, or fall back to frozen data, never block) when offline or
   unconfigured — the deterministic core always works without it. This covers both the streaming
   tap-a-word chips and the non-streaming structured intents (grammar-question generation, and the
   mistakes corpus's note-authoring/verification calls) — every one of them falls back to a frozen
   artifact or a no-op on failure, never to an error state.
2. **Secrets only in env.** `APP_PASSWORD`, `TOKEN_SECRET`, `KV_*`, `ANTHROPIC_API_KEY` live in
   `.env.local` (gitignored) and the Vercel dashboard. Never commit them. Never hardcode them.
3. **Static word data is immutable at runtime.** The app never writes to `words.json`. The only
   mutable, synced state is the user's `ProgressMap`.
4. **Offline must work.** Studying, grading, and local persistence must function with no network.
   Sync is best-effort on top.
5. **Deploy is Vercel CLI, not GitHub.** No `.github/`, no Actions. (User may add GitHub later.)
6. **Git commits are the user's call, not the agent's.** The repo is git-initialized, but the
   agent must **not** run `git commit`/`git push`, create branches, or prompt the user to commit
   unless explicitly asked — just leave finished work in the working tree. `.gitignore` keeps
   secrets, build output, and generated caches out of any commit the user makes. See README →
   "Git".
7. **No private-planning language in tracked docs.** `docs/new/` and any other private/scratch
   spec directories are gitignored and stay that way. Tracked docs (README.md, CLAUDE.md,
   `.claude/rules/*.md`, `docs/adrs/*.md`) must **never** reference internal milestone labels
   (`M1`, `M2`, "v2 spec", "next-phase plan", etc.) or link to gitignored paths. Describe features
   in their finished state, not by the increment that delivered them — a reader coming to the repo
   cold shouldn't see planning artifacts. When implementing a milestone from `docs/new/`, land the
   code and update tracked docs to describe the resulting behavior; leave the milestone label in
   the private spec.

## Rules map (`.claude/rules/`)

The rest of the spec is split into topic files. **Always-loaded** rules (no `paths:` frontmatter)
are in context every session, exactly like this file:

- **`architecture.md`** — Next.js App Router, static-shell/CSR rendering, persistence split, sync model.
- **`data-model.md`** — all `src/types` interfaces, level scoping, dictation/grammar-quiz tracks, IndexedDB stores.
- **`learning-engine.md`** — Leitner spec (`src/lib/leitner.ts`) + sync/merge spec.
- **`project-structure.md`** — the full `src/` / `scripts/` / `data/` file tree.

**Path-scoped** rules load only when Claude touches matching files (they trim the always-on core):

- **`data-pipeline.md`** (`scripts/**`, `data/**`) — build-time extract → refine/merge → daily corpus, and the corrections policy.
- **`auth.md`** (`src/app/api/**`, `src/lib/auth.ts`, `src/app/login/**`) — single-password stateless JWT auth.
- **`grammar-quiz.md`** (grammar-quiz lib/route/page/build/bank paths) — the frozen item-bank quiz spec.
- **`pwa.md`** (`public/sw.js`, `public/manifest.json`, service-worker + layout) — minimal service worker + iOS notes.

## Conventions

- TypeScript strict. Path alias `@/* → src/*`.
- Keep components small and client-only where they touch state. Pure logic (leitner, merge) stays
  in `lib/` and is unit-testable; `lib/` is framework-agnostic, so React hooks (stateful glue with
  `useRef`/`useEffect`) live in `src/hooks/`, not `lib/`.
- **Components/pages hold only JSX + hooks; their pure logic and constants live in a co-located
  helper.** Each component is a folder `Name/` with `index.tsx`, `index.helpers.ts`, and
  `index.helpers.test.ts`. Route files must stay `page.tsx` (Next.js), so pages pair with
  `page.helpers.ts` + `page.helpers.test.ts` in the same route folder. Every helper module has a
  unit-test suite.
- **All exported types and interfaces live in `src/types/`.** Import them with `@/types/...`
  directly — not re-exported through helpers or component index files.
- Tailwind for styling; dark theme by default; mobile-first (this lives on a phone).
- **Icons: use `@heroicons/react` only. Never write raw inline SVG for icons.** Use the `/24/outline` set by default; `/24/solid` only where fill is intentional (e.g. `SpeakerWaveIcon`). Size with Tailwind (`h-4 w-4`, etc.), always add `aria-hidden="true"`.
- Don't introduce a backend framework or DB beyond KV. Don't add user accounts.
- **A value used in more than one file is a constant in `src/constants/index.ts`, not a
  re-declared local.** This applies to numeric caps, enums, and localStorage keys alike — before
  hardcoding a limit that a JSON schema, a validator, and a UI slice all need to agree on, check
  whether it's already there, and add it there if it isn't. A constant genuinely local to one
  module (an internal tuning knob nothing else reads) can stay local.
- **Code comments: max 2 lines, precise, to the point.** State the non-obvious reason, not the
  history or a design essay. If it takes more than 2 lines, it belongs in an ADR, not inline.
- **Comment the code as it is, never as a diff from what it was.** Work sits in the working tree
  until the user commits it, so an approach that was built and then dropped mid-session was never
  part of the project — a reader has no "before" to contrast against, and a comment explaining a
  change they can't see is noise. Never write "removed", "reverted", "no longer", "used to", "an
  earlier version", "retired X", or "kept for backwards compatibility" in code, test names, or
  tracked docs. Delete the dropped thing and describe what remains. The same goes for defensive
  code: justify a guard by the condition it prevents, not by the bug that prompted it. If an
  abandoned approach is worth recording, an ADR carries it as a **rejected alternative** ("X was
  considered and rejected because …") — a standing design boundary, not a change log. Git history
  and the private spec under `docs/new/` are where change itself is tracked.
