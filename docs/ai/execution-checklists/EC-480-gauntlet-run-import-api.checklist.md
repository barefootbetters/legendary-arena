# EC-480 — Gauntlet Run Import + Run-CRUD API (Execution Checklist)

**Source:** docs/ai/work-packets/WP-445-gauntlet-run-import-api.md
**Layer:** Server

## Before Starting
- [ ] WP-440 ✅, WP-442 ✅, WP-443 ✅ Done on `main` (registry `validateGauntletPack` + `./gauntletPack`; `gauntletTruth.logic.ts`; migration 039 + `gauntletRun.types.ts`).
- [ ] Baseline `origin/main` @ `9c788d98` (or later; re-confirm the three deps stayed Done).
- [ ] `apps/server/src/profile/loadoutLibrary.{routes,logic,types}.ts` present (the pattern to mirror) and its `server.mjs` registration line present.
- [ ] `apps/server/src/gauntlet/gauntletRun.types.ts` present (extend, don't recreate); `apps/server/src/gauntlet/` already exists.
- [ ] Scope lock — EXACT target file set = the six files in `## Files to Produce`; the ONLY runtime-wiring exception is `apps/server/src/server.mjs` (01.5). Any edit outside this set is a FAIL — surface it as a blocker.
- [ ] `pnpm -r build` exits 0 on a clean baseline.

## Locked Values (do not re-derive)
- Endpoints (all `Auth = authenticated-session-required`, `Cache-Control: no-store` as the FIRST statement of every handler body per D-11504):
  - `POST /api/me/gauntlet-runs` → `201` (new) / `200` (idempotent attach); `400 invalid_pack`; `422 unknown_gauntlet`; `401 unauthorized`; `403 account_suspended`; `500 internal_error`.
  - `GET /api/me/gauntlet-runs` → `200 { runs: GauntletRunView[] }`; `401`; `500`.
  - `PATCH /api/me/gauntlet-runs/:id` → `200 GauntletRunView`; `400 invalid_leg_picks`; `404 not_found`; `401`; `500`.
  - `DELETE /api/me/gauntlet-runs/:id` → `204`; `404 not_found`; `401`; `500`.
- `GauntletRunView` wire shape (camelCase): `{ id, setAbbr, mastermindSlug, division, playerCount, legPicks, createdAt, updatedAt, firstCompletedAt }`. NO `player_id`/account id on the wire.
- `GauntletRunErrorCode` closed union (+ canonical readonly array, drift-asserted): `unauthorized | account_suspended | invalid_pack | unknown_gauntlet | invalid_leg_picks | not_found`.
- Status map: `unauthorized`→401, `account_suspended`→403, `invalid_pack`→400, `unknown_gauntlet`→422, `invalid_leg_picks`→400, `not_found`→404; uncaught→500 `internal_error`.
- Idempotency (D-24264): catch the partial-unique active-run conflict `(player_id, set_abbr, mastermind_slug, division, player_count) WHERE first_completed_at IS NULL` → SELECT + return the existing active run (200). New insert → 201. A fresh POST after `first_completed_at` is set opens a NEW active run.
- Import INSERTs `leg_picks = '{}'` (heroes start empty). This WP NEVER writes `first_completed_at`.
- Derived read (5-state status / pool / headroom / per-leg cleared / last-played via `gauntletTruth.logic.ts`) is OUT — that is WP-446. The GET returns the RAW stored run only.
- Auth order per handler: `requireAuthenticatedSession` → `requireUnsuspendedAccount`; then `player_id` resolve; then scoped query.

## Guardrails
- `gauntletRun.logic.ts` imports ONLY `@legendary-arena/registry` (`validateGauntletPack`), the injected `DatabaseClient` alias, and Node built-ins. NO `game-engine` / `preplan` / `boardgame.io` / any `apps/*` import. Reach gauntlet existence through the INJECTED resolver — do NOT build the registry catalog inside the logic layer.
- Persistence: ordinary `legendary.*` domain storage (the `player_loadouts` precedent). No `G`/`ctx` read/write, no `bgio`-blob read, no snapshot, no carve-out.
- Store NOTHING derived (D-24262): identity + `leg_picks` + timestamps only. The GET returns exactly those keys — no `status`/`pool`/`headroom`/`cleared`/`lastPlayed`.
- Idempotent import: the active-run conflict returns the existing run, NEVER a 409/500.
- Every query scoped by resolved `player_id`; malformed / cross-account / missing `:id` → `not_found` (no existence leak). Guard `:id` with the UUID pattern BEFORE any `::uuid` cast (else a cast error 500s — the loadout precedent).
- `Cache-Control: no-store` first statement of every handler; a thrown error still leaves 500 with `{ error: 'internal_error' }` (try/catch around all logic, never re-throw to the framework).
- `node:test` + `node:assert` only; DB-gated tests LOUD-skip without `TEST_DATABASE_URL` (visible skip, never a silent pass); no `boardgame.io/testing`; no network.
- PATCH validates only the STRUCTURAL shape of `legPicks` (object of string → string[]); NO gameplay/registry validity check on hero ids (that is launch-time, later WP).

## Required `// why:` Comments
- The idempotent insert-or-attach conflict catch: why the partial-unique violation is caught and resolved to a returned existing run (D-24264) rather than surfaced.
- The `Cache-Control: no-store` first-statement in each handler: cite D-11504 (header survives a thrown 500).
- The `:id` UUID-pattern guard: why a malformed id returns `not_found` not a `::uuid`-cast 500 (and matches the cross-account response — no existence leak).
- The injected `resolveGauntletExistence` dependency: why gauntlet existence is injected from `server.mjs`'s built catalog, keeping the logic layer registry-catalog-free and DB-test-friendly.
- `server.mjs` registration: cite 01.5 runtime-wiring allowance.

## Files to Produce
- `apps/server/src/gauntlet/gauntletRun.routes.ts` — **new** — four route handlers (auth → body-parse → delegate → status-map), local `KoaRouter`/`KoaGauntletRunContext` structural interfaces, `statusForGauntletRunErrorCode`. No SQL.
- `apps/server/src/gauntlet/gauntletRun.logic.ts` — **new** — `importGauntletRun`, `listGauntletRuns`, `updateGauntletRunLegPicks`, `deleteGauntletRun`, `loadPlayerIdByAccountId`, row→view mapper, `UUID_PATTERN`.
- `apps/server/src/gauntlet/gauntletRun.types.ts` — **modified** — additive API types (`GauntletRunView`, `GauntletRunErrorCode` + array, `GauntletRunResult<T>`, `ImportGauntletRunInput`, `UpdateGauntletRunPatch`, `GauntletRunRouteDependencies`, `GauntletExistenceResolver`); row-shape types unchanged.
- `apps/server/src/gauntlet/gauntletRun.logic.test.ts` — **new** — DB-gated: import-creates-one (empty `leg_picks`), re-import-attaches (200, one row), invalid-pack, unknown-gauntlet, PATCH-updates + `updated_at` advances, DELETE-removes, cross-account 404, malformed-id 404, error-code drift assertion.
- `apps/server/src/server.mjs` — **modified** — import + `registerGauntletRunRoutes(...)`, build `resolveGauntletExistence` from `gauntletCatalog` (01.5 wiring).
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — four new `Wired` rows (D-11804 §21, replace-whole-row, closed Status + Auth sets, `Authorizing WP = WP-445`).

## After Completing
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/server test` exits 0 (server build IS the typecheck).
- [ ] DB-gated suite passes with `TEST_DATABASE_URL` + migrations applied; loud-skips visibly without it.
- [ ] Layer grep clean: `rg -n "game-engine|preplan|boardgame\.io|apps/(arena-client|registry-viewer|legends-board)" apps/server/src/gauntlet/gauntletRun.logic.ts` → 0 matches.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` has the four rows (same commit).
- [ ] `docs/ai/STATUS.md` states "No user-observable change — infrastructure only".
- [ ] `docs/ai/DECISIONS.md` — D-24264 flipped Drafted → Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-445 node glyph `📝` → `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `git diff --name-only` matches the six-file allowlist (+ the governance ledgers/indices); no stray file.

## Common Failure Smells
- A `409` on re-import → the partial-unique conflict was surfaced, not caught; the idempotent attach path is missing (violates D-24264).
- A `500` from `WHERE id = $1::uuid` on a malformed `:id` → the UUID-pattern guard is missing before the cast.
- A `status`/`pool`/`headroom` key on the GET response → the derived read leaked in; it belongs to WP-446, not here (violates D-24262 + the split).
- The logic layer importing `buildGauntletCatalog` or `@legendary-arena/registry`'s `gauntletLoadouts` directly → gauntlet existence should be injected, not resolved in-layer.
- Tests silently passing with no DB → the loud-skip guard is missing (a silent pass hides an unrun contract).
