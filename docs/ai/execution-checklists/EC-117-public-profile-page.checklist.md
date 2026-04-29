# EC-117 — Public Player Profile Page (Execution Checklist)

**Source:** docs/ai/work-packets/WP-102-public-profile-page.md
**Layer:** Server (read-only profile composition; Koa router) + Arena Client (Vue 3 SPA, hand-rolled query-string router)

> *Slot retargeted from EC-102 to EC-117 (2026-04-28 staleness sweep). EC-102 occupied by `EC-102-viewer-typecheck-cleanup.checklist.md`. Follows EC-101 → EC-114 retarget precedent. Pre-flight 2026-04-28 surfaced PS-1 (Koa not Express) / PS-2 (no `vue-router`; query-string pattern) / PS-3 (`server.mjs` entry) / PS-5 (`ProfileResult<T>` local) plus 4 copilot RISK fixes (#10 / #15 / #16 / #17); all eight applied to WP-102 + this EC in the same SPEC commit, pre-flight re-run pending.*

**Execution Authority:** This EC is the authoritative execution checklist for WP-102. Implementation must satisfy every clause exactly. If EC and WP conflict on design, **WP-102 wins**.

## Before Starting (STOP / GO Gate)
- [ ] WP-052 merged on `main` (`legendary.players` + `legendary.replay_ownership` + `findPlayerByAccountId` + `Result<T>` + `AccountId` + `DatabaseClient` + `PlayerAccount`)
- [ ] WP-101 merged on `main` (Commit B `7b92734` confirmed; `findAccountByHandle` + `getHandleForAccount` + migration `008` applied)
- [ ] WP-053 / WP-103 contract files unchanged at HEAD (verified by `git diff main`)
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` baseline: engine **`570 / 126 / 0`**; server **`63 / 9 / 0`** (with skips when `TEST_DATABASE_URL` unset)
- [ ] `git diff --name-only packages/ apps/server/src/identity/ apps/server/src/replay/ apps/server/src/competition/ data/migrations/` empty at start
- [ ] `apps/arena-client/package.json` has no `vue-router` dependency (verified by `grep`); `apps/server/src/server.mjs` exists and registers `registerHealthRoute(server.router)` at line ~120

## Locked Values (do not re-derive)
- HTTP endpoint: `GET /api/players/:handle/profile` (single new route; no other HTTP verbs); registered on the **Koa router** `server.router` from `apps/server/src/server.mjs` per pre-flight PS-1
- 404 body: `{ "error": "player_not_found" }` (verbatim; no information leak); 500 body: `{ "error": "internal_error" }` (no body detail)
- `PublicProfileView` 4 fields: `handleCanonical`, `displayHandle`, `displayName`, `publicReplays`
- `PublicReplaySummary` 4 fields: `replayHash`, `scenarioKey`, `visibility`, `createdAt`
- `PublicReplaySummary.visibility` typed as `'public' | 'link'` — `'private'` excluded at the type level AND filtered by SQL AND narrowed by application-layer guard (defense-in-depth per RISK #10)
- `ProfileErrorCode = 'player_not_found'` (sole value); `PROFILE_ERROR_CODES` canonical readonly array drift-tested
- Replay-filter SQL: `visibility IN ('public', 'link') AND (expires_at IS NULL OR expires_at > now())`
- `ProfileResult<T>` declared **locally** in `profile.types.ts` (mirrors WP-052 `Result<T>` shape but keyed on `ProfileErrorCode`, not `IdentityErrorCode`); per pre-flight PS-5
- `AccountId`, `PlayerAccount`, `DatabaseClient` re-imported from `../identity/identity.types.js`; never redeclared. **`Result<T>` is NOT re-imported** (would force `IdentityErrorCode` discriminant)
- Vue surface: `?profile=<canonical>` query parameter parsed by `App.vue`'s `parseQuery()`; `type AppRoute` extended with `'profile'`; `<PlayerProfilePage :handle="..." />` lazy-loaded via `defineAsyncComponent`. **No `vue-router`** per pre-flight PS-2

## Guardrails
- No `INSERT` / `UPDATE` / `DELETE` SQL anywhere under `apps/server/src/profile/` (grep-verified)
- No `boardgame.io`, `@legendary-arena/game-engine`, `@legendary-arena/registry`, `@legendary-arena/preplan` import in any WP-102 file; no `vue-router` import in any WP-102 file
- No `requireAuthenticatedSession` import; no Hanko reference (`@teamhanko`, `hanko.io`, `'hanko'` literal); no WP-112 contract invocation
- Handle → `AccountId` dereference per request via `findAccountByHandle`; no `(handle, *)` cache beyond request scope
- Empty-state tabs (rank, badges, tournaments, comments, integrity, support) make zero `fetch` / XHR / WebSocket calls and have no Vue lifecycle hooks
- `.reduce()` forbidden in profile composition; use explicit `for...of` loops; **per-row visibility narrowing required** (`if (row.visibility !== 'public' && row.visibility !== 'link') continue;`) per RISK #10
- **Aliasing prevention (RISK #17):** `getPublicProfileByHandle` returns a fresh `PublicProfileView` literal per call; `publicReplays` array built via explicit `for...of` with fresh `PublicReplaySummary` literals — never `result.rows` passthrough or spread of a `pg`-row
- **Lifecycle prohibition (RISK #16):** the four exported profile functions MUST NOT be called from `game.ts`, any `LegendaryGame.moves` entry, any phase hook, any file under `packages/`, `apps/replay-producer/`, `apps/registry-viewer/`, `apps/server/src/identity|replay|competition|par|rules|game/`. Consumed only by `profile.logic.test.ts`, `profile.routes.ts`, `apps/server/src/server.mjs` (one-line registration), and `PlayerProfilePage.vue` (via `profileApi.ts`)
- WP-052 / WP-101 / WP-053 / WP-103 contract files NOT modified; `packages/game-engine/src/types.ts` NOT modified; no new migration; no new npm dependency (`pnpm-lock.yaml` `git diff` empty after Commit A)

## Required `// why:` Comments
- `profile.routes.ts` route handler: (a) thin Koa adapter — logic lives in `profile.logic.ts` for testability without spinning up `Server()`; (b) intentionally unauthenticated — visibility governed solely by replay flags + server filter, future authenticated `/me/profile` MUST register a separate handler
- `profile.logic.ts` `loadPlayerIdByAccountId`: WP-101 `findAccountByHandle` returns `PlayerAccount` keyed on `ext_id`/`AccountId`; the bigint `player_id` FK is fetched separately because `legendary.replay_ownership` joins on it
- `profile.logic.ts` 404 / `player_not_found` discipline: no information leak distinguishing unclaimed / deleted / reserved
- `profile.logic.ts` per-row visibility narrowing (RISK #10): SQL `visibility IN ('public', 'link')` is the authoritative gate; the application-layer guard is defense-in-depth so the type-level exclusion of `'private'` survives any future SQL relaxation
- `profile.types.ts` `ProfileResult<T>` (PS-5): mirrors WP-052 `Result<T>` shape but locally declared because WP-052's union is keyed on `IdentityErrorCode`, not `ProfileErrorCode`
- `App.vue` `?profile=<canonical>` precedence (PS-2): presence of `?profile=` takes priority over `?match=` / `?fixture=` so a stale live-match query string doesn't shadow a profile navigation
- `PlayerProfilePage.vue` empty-state tabs (RISK #15): each tab carries `<!-- why: ... -->` (HTML comment in `<template>`) or `// why:` in `<script>` naming why it makes no fetch — preserves Vision §11 stateless-client and the WP-102 lifecycle prohibition

## Files to Produce
- `apps/server/src/profile/profile.types.ts` — **new** (declares `ProfileResult<T>` locally; re-imports `AccountId` / `PlayerAccount` / `DatabaseClient` only)
- `apps/server/src/profile/profile.logic.ts` — **new** (`getPublicProfileByHandle`, `loadPlayerIdByAccountId`)
- `apps/server/src/profile/profile.routes.ts` — **new** (`registerProfileRoutes(router: KoaRouter, database)`)
- `apps/server/src/profile/profile.logic.test.ts` — **new** (8 tests in 1 `describe()` block)
- `apps/arena-client/src/App.vue` — **modified** (per PS-2: extends `AppRoute` with `'profile'`; parses `?profile=<canonical>`; renders `<PlayerProfilePage :handle="..." />` branch)
- `apps/arena-client/src/pages/PlayerProfilePage.vue` — **new** (Vue 3 SFC; receives `handle` as prop, NOT from `vue-router`)
- `apps/arena-client/src/lib/api/profileApi.ts` — **new** (`fetchPublicProfile(handle)`)
- ~~`apps/server/src/server.mjs` — **modified** (per PS-3: one-line `registerProfileRoutes(server.router, database)` after `registerHealthRoute(server.router)` at line ~120)~~ — **DEFERRED 2026-04-28 per Commit A `369c0a4` execution-time amendment + WP-102 §H amendment + D-10202 (Pool-lifecycle deferral; cite D-3103 mid-execution precedent + WP-053 `submitCompetitiveScore` shipped-but-unwired precedent). Commit A ships 7 files, not 8. The future request-handler WP that owns long-lived `pg.Pool` lifecycle lands this addition.**

## After Completing
- [ ] All WP-102 §Verification Steps + §Definition of Done items pass
- [ ] `pnpm -r build` exits 0; engine baseline **`570 / 126 / 0`** unchanged
- [ ] Server baseline post-execution **`71 / 10 / 0`** (or `71` with skips for DB tests 4–8 when `TEST_DATABASE_URL` unset)
- [ ] `git diff --name-only main` limited to the 8 files in §Files to Produce; `pnpm-lock.yaml` `git diff` empty
- [ ] New `D-NNNN` entry classifies `apps/server/src/profile/` as a server-layer directory (mirrors D-5202 / D-10301); D-number assigned at execution
- [ ] `docs/ai/STATUS.md` `### WP-102 / EC-117 Executed` block at top of `## Current State`
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-102 row `[ ]` → `[x]` with date + Commit A SHA
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-117 row `Draft` → `Done {YYYY-MM-DD}`
- [ ] Commit A prefix `EC-117:` (NOT `EC-102:` — collides with viewer-typecheck EC; NOT `WP-102:` — commit-msg hook rejects per P6-36); Commit B prefix `SPEC:`; Vision trailer `Vision: §3, §11, §14, §18, §24, §25` on Commit A

## Common Failure Smells
- Server baseline reads `48/7/0` or `522/116/0` — re-read post-WP-101 floor: server `63/9/0`, engine `570/126/0`
- `Result<T>` re-imported in `profile.types.ts` (forces `IdentityErrorCode` discriminant) OR migration `007_add_handle_to_players.sql` referenced — STOP; declare `ProfileResult<T>` locally per PS-5; WP-101 migration is slot `008` since 2026-04-27 (slot `007` is WP-053 `competitive_scores`)
- `'private'` appears anywhere in `profile.logic.ts` / `profile.types.ts` / response body — STOP; type-narrowed to `'public' | 'link'` AND SQL-filtered AND app-layer-narrowed per RISK #10 (defense-in-depth)
- Route handler signature uses `app: Express` / `req.params` / `res.status().json()` OR `apps/arena-client/src/router/routes.ts` referenced anywhere — STOP; framework is Koa per PS-1 (mirror `registerHealthRoute(server.router)` at `server.mjs:30–34`); arena-client has no `vue-router` per PS-2 (`App.vue` extension is the locked pattern)
- `PublicReplaySummary` literal built via `result.rows.map(row => row)` / spread `...row` / direct `result.rows` passthrough — STOP; aliasing rule per RISK #17 requires fresh literal per row
- Page calls `fetch` from inside an empty-state tab — STOP; tabs are inert per WP-102 §"Empty-state stubs make zero network requests" + RISK #15 `// why:` discipline
