# EC-403 — Dashboard Matches + Players + KPIs Endpoints (Server) (WP-374)

**Pairs with:** WP-374 · **Reserves:** D-24169 · **Lane:** large · **Status:** execution-prep 2026-07-13
**Layer:** Server (`apps/server`). Extends the WP-373 `apps/server/src/dashboard/` module + `/api/dash/*` surface. Server-only; no migration; no dashboard-app change.

## Before Starting
- [ ] Rebuild `registry` + `game-engine` dist before typecheck/tests (consumers import built dist). DB-gated tests skip without `TEST_DATABASE_URL`.

## Execution refinement (scope-neutral)
Consolidate the WP's `dashboardMatches`/`dashboardPlayers`/`dashboardKpis` into **one `dashboardGameplay.{types,logic,routes}.ts`** module (shared helpers; fewer files) — cohesive, byte-neutral to the contract.

## Locked Values
- **Carve-out extension (DONE first):** `docs/ai/ARCHITECTURE.md §Persistence Boundary` + `.claude/rules/architecture.md` gained the **D-24169 match-summary** sentence (reads `initial_state.G.matchConfiguration` + `ctx.numPlayers` + `metadata.{createdAt,updatedAt,gameover}`; projection-only, never `state`/`log`/write).
- **Auth/envelope:** reuse WP-373 `passesAdminGate` idiom (`requireAdminSession` first, `no-store` first, 401/403/500) + bare `{ data: T }` (D-20503). Routes need `registry` (startup `CardRegistry`) injected → build the name resolver via **`buildNameResolver(registry)`** (exported from `match/matchLagn.logic.ts`; ext_id→name, id-fallback).
- **Types** (mirror `apps/dashboard/src/types/index.ts`): `MatchRecord {id,startedAt,duration,playerCount,scheme,mastermind,outcome:'villain_wins'|'hero_wins'|'in_progress'}`, `PlayerRecord {id,name,email,matchesPlayed,winRate,lastActive,status:'active'|'inactive'|'banned'}`, `KpiSnapshot {id,label,value,previousValue,unit,trend:'up'|'down'|'flat',target?,tolerance?,direction?}`.
- **`GET /api/dash/matches`:** `SELECT match_id, initial_state, metadata FROM bgio.matches ORDER BY updated_at DESC LIMIT $1`. Per row (pg auto-parses jsonb): skip if `initial_state` null or `G.matchConfiguration` missing; `scheme`/`mastermind` = `resolveName(schemeId/mastermindId)`; `playerCount` = `ctx.numPlayers`; `startedAt` = ISO of `metadata.createdAt` (ms); `duration` = `max(0, round((updatedAt−createdAt)/1000))`; `outcome` = `metadata.gameover` null/undefined → `in_progress`, else `gameover.outcome==='heroes-win'` → `hero_wins`, `'scheme-wins'` → `villain_wins`.
- **`GET /api/dash/players`:** `players p LEFT JOIN competitive_scores cs ON cs.player_id = p.player_id GROUP BY p.player_id ORDER BY p.created_at DESC LIMIT $1`. `id`=ext_id; `name`=display_name; `email`; `matchesPlayed`=`count(cs.submission_id)`; `winRate`= matches>0 ? `count FILTER (outcome='heroes-win')`/matches : 0; `lastActive`= `max(cs.created_at)` ?? `p.created_at` (ISO); `status`= `is_suspended`→`banned`, else `active` if lastActive within `ACTIVE_WINDOW_DAYS` (30) else `inactive`. 0-score player → `0`/`0` (not null).
- **`GET /api/dash/kpis`:** derivable subset (each `{value, previousValue}` current vs prior equal window; `unit`; trend up/down/flat; **omit** target/tolerance/direction): total players (cumulative, prev = `created_at ≤ now−30d`); new players (30d, prev = prior 30d); total matches (`count(bgio.matches)`, prev = `count FILTER ((metadata->>'createdAt')::bigint ≤ (now−30d)ms)`); revenue 30d (sum WP-373 `getRevenueDaily(db,30,now)` vs `getRevenueDaily(db,30,now−30d)`); hero-win-rate 30d (`competitive_scores` outcome over `created_at`, prev prior 30d). **DAU/activity KPIs OMITTED.** `nowMs` injectable for tests.

## Guardrails
- [ ] No engine/registry-runtime gameplay import (registry `CardRegistry` **type** + `buildNameResolver` only) / no `boardgame.io` / no write / no migration.
- [ ] Blob read = `initial_state` + `metadata` only (never `state`/`log`); gameover absent → in_progress (never guessed); null-initial_state skipped.
- [ ] Nothing fabricated: DAU omitted, approximate `lastActive` documented, 0-score → 0/0.
- [ ] Admin gate + `no-store` first on every route; `{ data }` envelope.

## Files to Produce
- `apps/server/src/dashboard/dashboardGameplay.{types,logic,routes}.ts` (+ `.logic.test.ts`, `.routes.test.ts`)
- `apps/server/src/dashboard/dashboardGameplay.integration.test.ts` (DB-gated)
- `apps/server/src/server.mjs` (register the 3 routes; thread `registry` into the deps)
- `docs/ai/ARCHITECTURE.md` + `.claude/rules/architecture.md` (D-24169 carve-out — DONE)
- `docs/ai/REFERENCE/api-endpoints.md` (3 `Wired` rows, D-11804)

## Tests
- logic (fake pool + injected resolver + fixed nowMs): match projection (in_progress vs hero/villain, null-initial_state skip, name resolution); player aggregation (0-score, win-rate, status, lastActive fallback); KPI compose + trend (prior-window, DAU absent).
- routes (fake router + injected gate + fake registry): gate 401/403, `no-store`, `{ data }`, range N/A (no range params).
- integration (DB-gated): seed a `bgio.matches` row (initial_state + metadata incl gameover) + players + competitive_scores; assert the 3 responses; clean up in `after()`.

## After Completing
- [ ] `pnpm -r build` 0; full server no-DB suite green; DB-gated integration green.
- [ ] D-24169 → Active; WORK_INDEX WP-374 `[x]`; EC_INDEX EC-403 row; STATUS; `api-endpoints.md` 3 rows; `wiki/dashboard.md` (drafted → executed); mindmap 📝→✅ + counts.
- [ ] D-24026 deploy+data-pending.

## Common Failure Smells
- Stale registry/engine dist → false import errors (rebuild first).
- Reading `state`/`log` or writing the blob → carve-out violation (grep-guard).
- Guessing a winner for a gameover-absent match → in_progress only.
- `(metadata->>'createdAt')::bigint` throws on a non-numeric → guard/filter.
- KPI window off-by-one or NaN rate on empty → zero-guard, injected nowMs.
