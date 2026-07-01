# EC-331 — Public Profile Link-Preview Meta (Execution Checklist)

**Source:** docs/ai/work-packets/WP-300-public-profile-link-preview-meta.md
**Layer:** Client App (`apps/arena-client/` — Cloudflare Pages Functions edge subsurface)

## Before Starting
- [ ] WP-102 / WP-152 shipped: `GET /api/players/:handle/profile` (guest) returns `PublicProfileView` and the route is live.
- [ ] WP-161 shipped: API origin is available to client code; confirm how the Pages Functions runtime resolves it (env binding) — R2.
- [ ] WP-007a / EC-148: `apps/arena-client/index.html` head + brand-token cascade are locked — this EC must not modify that file.
- [ ] Confirm CF Pages project root = `apps/arena-client/` so `functions/` is discovered — R1 (else STOP; do not improvise repo-side config).
- [ ] `pnpm --filter arena-client build` exits 0.
- [ ] `pnpm --filter arena-client test` exits 0.
- [ ] `pnpm --filter arena-client typecheck` exits 0.
- [ ] Scope lock — EXACT target set is the `## Files to Produce` list below; any file outside it is a FAIL, surfaced as a blocker before editing.

## Locked Values (do not re-derive)
- Endpoint: `GET /api/players/:handle/profile` (guest). Response: `{ handleCanonical, displayHandle, displayName, publicReplays[], teamAffiliations[], badges[] }`.
- Handle grammar: `^[a-z][a-z0-9_]{2,23}$`.
- Query param: `profile`. Canonical URL: `https://play.legendary-arena.com/?profile=<handle>`.
- Fetch timeout: `1500` ms, fail-soft on expiry.
- OG image (v1): `/og/profile-card.png` (1200×630 static brand card).
- Injected tags: `og:type=profile`, `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`.

## Guardrails
- Transform the RESPONSE only; never modify `index.html`, `robots.txt`, `_redirects`, or the brand-token `<link>` cascade order.
- Insert `<meta>` (and optionally `<title>`) into `<head>` only — no `<link>`/`<script>`/stylesheet add/remove/reorder.
- HTML-attribute-escape EVERY injected value — `displayName`/`displayHandle` are user-controlled (load-bearing safety property).
- Description uses only §23-compliant facts (badge/team/replay counts) — NEVER win/loss, rank, opponent, or challenge framing.
- Fail-soft: non-200 / timeout / error / bad handle / non-HTML / non-GET → return the unmodified shell; never 5xx the visitor.
- No import of `boardgame.io`, `@legendary-arena/registry`, engine runtime, or `pg` in `functions/**`.
- Pure meta logic stays framework-free + I/O-free in `functions/lib/buildProfileMeta.ts`; the middleware is thin wiring.

## Required `// why:` Comments
- The `1500` ms timeout: a shared human profile load must not stall on a slow API.
- The response guard (method/content-type/param): asset + paramless loads are zero-cost pass-throughs.
- The fetch try/catch: a profile-meta failure must never break the page (fail-soft).
- The attribute-escaping: display fields are user-controlled; prevents HTML injection into the served head.

## Files to Produce
- `apps/arena-client/functions/_middleware.ts` — **new** — edge fetch + `HTMLRewriter` wiring.
- `apps/arena-client/functions/lib/buildProfileMeta.ts` — **new** — pure meta composition + attribute escaping.
- `apps/arena-client/functions/lib/buildProfileMeta.test.ts` — **new** — `node:test` (escaping / fallback / §23 guard / og:url).
- `apps/arena-client/functions/tsconfig.json` — **new** — `@cloudflare/workers-types` typecheck config.
- `apps/arena-client/package.json` — **modified** — `@cloudflare/workers-types` devDep + `typecheck:functions` script; ensure test glob covers `functions/**/*.test.ts`.
- `apps/arena-client/public/og/profile-card.png` — **new** — static 1200×630 brand OG image.
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — **modified** — register `functions/` under `client-app` (D-24085).
- `docs/ai/DECISIONS.md` / `docs/ai/STATUS.md` / `docs/ai/work-packets/WORK_INDEX.md` — governance close.

## After Completing
- [ ] `pnpm --filter arena-client build` exits 0.
- [ ] `pnpm --filter arena-client test` exits 0 (discovers `functions/lib/buildProfileMeta.test.ts`).
- [ ] `pnpm --filter arena-client typecheck` exits 0.
- [ ] `pnpm --filter arena-client typecheck:functions` exits 0.
- [ ] `Select-String` confirms no forbidden imports in `functions/**`.
- [ ] `git diff` confirms `index.html` / `robots.txt` / `_redirects` unmodified.
- [ ] Live-on-surface (D-24026): a `?profile=<handle>` URL unfurls into a rich card; `/` is unchanged.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` updated — D-24085 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date.

## Common Failure Smells
- Preview does not unfurl at all → CF Pages did not discover `functions/` (R1: project root not `apps/arena-client/`), OR the API origin is unresolved at the edge (R2).
- Preview works for humans but the page feels slow → the timeout is too high or fail-soft is not returning early on error.
- A `vue-tsc` or `tsc` error on `HTMLRewriter`/`EventContext` → `@cloudflare/workers-types` missing from `functions/tsconfig.json`.
- The new test does not run → the arena-client `test` glob does not include `functions/**` (extend it — in scope).
