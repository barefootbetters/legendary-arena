# EC-481 — Gauntlet Run Derived Progression Read (Execution Checklist)

**Source:** docs/ai/work-packets/WP-446-gauntlet-run-derived-progression.md
**Layer:** Server

## Before Starting
- [ ] WP-442 ✅, WP-443 ✅, WP-445 ✅ Done on `main` (`gauntletTruth.logic.ts` exports `qualifiesAsLegClear` + `findBestPoolAssignment` + `LegClearReplayFacts` + `RosterLegAccumulator`; migration 039 + `gauntletRun.{types,logic,routes}.ts`; `getGauntletStandings` + `LeaderboardDependencies.checkParPublished`).
- [ ] Baseline `origin/main` @ `85d096d9` (or later; re-confirm the three deps stayed Done).
- [ ] `apps/server/src/legends/gauntlet.logic.ts` present (the `getGauntletStandings` fold/injection pattern to mirror; exports `GauntletLeg`, `GauntletApprovedLoadouts`, `buildGauntletBoardName`).
- [ ] `apps/server/src/gauntlet/gauntletRun.{types,logic,routes}.ts` present (extend/modify, don't recreate); `apps/server/src/gauntlet/` exists.
- [ ] Scope lock — EXACT target file set = the six files in `## Files to Produce`; the ONLY runtime-wiring exception is `apps/server/src/server.mjs` (01.5). Any edit outside this set is a FAIL — surface it as a blocker (STOP, do not improvise).
- [ ] `pnpm -r build` exits 0 on a clean baseline.

## Locked Values (do not re-derive)
- Endpoint (path/method/auth/cache UNCHANGED): `GET /api/me/gauntlet-runs` → `200 { runs: GauntletRunProgressView[] }`; `401 unauthorized`; `403 account_suspended`; `500 internal_error`. `Auth = authenticated-session-required`; `Cache-Control: no-store` FIRST statement of the handler body (D-11504); caller-scoped by resolved `player_id`. POST/PATCH/DELETE UNCHANGED.
- `GauntletRunProgressView extends GauntletRunView` with: `status`, `pool: readonly string[]` (sorted union of all `leg_picks` hero ids), `budgetHeadroom` (`budget − pool.length`, negative allowed), `heroCount`, `budget` (`= heroCount + 2`, D-24187 §4), `isChampion`, `legs: readonly GauntletRunLegProgress[]`.
- `GauntletRunLegProgress`: `{ schemeId, schemeName, cleared, hasFullPicks, lastPlayedAt: string | null }`. `schemeId` = registry scheme `slug`; `hasFullPicks` = `leg_picks[schemeId].length === heroCount`; `lastPlayedAt` = ISO `max(created_at)` over the caller's qualifying `competitive_scores` for that leg (null if none).
- `GauntletRunStatus` closed union (+ canonical `GAUNTLET_RUN_STATUSES` array, drift-asserted): `needs-heroes | ready | playing | all-legs-cleared | champion`.
- Status derivation (EVALUATE IN THIS ORDER; verbatim):
  - `champion` — every leg cleared AND `findBestPoolAssignment` non-null over the caller's winning teams.
  - `all-legs-cleared` — every leg cleared but NO budget-valid pool.
  - `playing` — ≥1 leg cleared, not all.
  - `ready` — ≥1 leg has `hasFullPicks`, 0 legs cleared.
  - `needs-heroes` — no leg has `hasFullPicks`.
- `all-legs-cleared` and `champion` are DISTINCT states — both must be reachable.
- Truth helpers consumed as-is (WP-442): per-leg `cleared` = `qualifiesAsLegClear(facts, approvedLoadouts, publishedScoringConfigVersion)`; `isChampion` pool search = `findBestPoolAssignment(rosterAccumulator, legSchemeSlugs, poolBudget, boardName, playerCount)`. `publishedScoringConfigVersion` resolved from `leaderboardDependencies.checkParPublished(scenarioKey)` (null → predicate fails closed) EXACTLY as `getGauntletStandings` does.
- Derivation inputs are INJECTED (`GauntletRunProgressInputs`): `legs` + `approvedLoadouts` + `poolBudget` (`heroPoolBudgets[playerCount]`) + `heroCount` (from `PLAYER_COUNT_SETUP`) + `boardName` (`buildGauntletBoardName(definition)`), all built in `server.mjs` from `gauntletCatalog` + `PLAYER_COUNT_SETUP`. Do NOT re-type the heroCount/budget literals in the logic layer.
- Caller-centric aggregation: ONE `RosterLegAccumulator` from the caller's own qualifying replays at the run's `player_count`, keyed by `team_key` per leg. For solo (`player_count = 1`) it coincides with `getGauntletStandings`' per-roster entry — the cross-check test asserts this.
- Division: fixed-pool model applied uniformly (`budget = heroCount + 2`); `open` runs use the same rule; open-badge presentation is deferred (WP-8). `division` carried through unchanged.

## Guardrails
- `gauntletRunProgress.logic.ts` imports ONLY: WP-442 helpers/types from `../legends/gauntletTruth.logic.js`, `GauntletLeg`/`GauntletApprovedLoadouts` **types** from `../legends/gauntlet.logic.js`, `listGauntletRuns`/`loadPlayerIdByAccountId` from `./gauntletRun.logic.js`, `LeaderboardDependencies` **type** from `../leaderboards/leaderboard.types.js`, the injected `DatabaseClient` alias, and Node built-ins. NO `game-engine`/`preplan`/`boardgame.io`/`@legendary-arena/registry`/any `apps/*` import. Inputs arrive via the INJECTED resolver — never build the registry catalog in-layer.
- REUSE, don't re-implement: `qualifiesAsLegClear` + `findBestPoolAssignment` consumed verbatim. Re-deriving the leg-clear clause order or the pool subset search is a FAIL (tracker/leaderboard drift).
- Store NOTHING derived (D-24262): status/pool/headroom/champion/cleared/last-played computed per read; NO column, NO cache, NO write path (no `INSERT`/`UPDATE`/`DELETE` anywhere in this module — it NEVER writes `first_completed_at`).
- `all-legs-cleared` ≠ `champion` — keep the two states distinct; both reachable.
- Caller-scoped: the score read is restricted to replays the caller owns at the run's `player_count`; runs are the caller's own (reuse `listGauntletRuns`). No cross-account leak.
- The score fold uses `for...of`, NOT `.reduce()` (owner-visibility list, per-leg best/team maps); mirrors `getGauntletStandings`.
- `Cache-Control: no-store` first statement of the GET handler; a thrown error still leaves `500 { error: 'internal_error' }` (try/catch, never re-throw to the framework). `node:test` + `node:assert` only; DB-gated tests LOUD-skip without `TEST_DATABASE_URL`; no `boardgame.io/testing`; no network.

## Required `// why:` Comments
- The caller-scoped `competitive_scores` query: why it restricts to replays the caller owns at the run's `player_count`, and why it still fetches ALL owners of those replays (the roster-size + visibility clauses in `qualifiesAsLegClear`).
- The caller-centric single accumulator: why the champion search runs over the caller's winning teams (keyed by `team_key`), intentionally distinct from `getGauntletStandings`' per-roster grouping (D-24265).
- The `publishedScoringConfigVersion` resolution via `checkParPublished`: why null fails the leg-clear predicate closed, matching the leaderboard.
- The status derivation ladder: why the evaluation order is load-bearing (champion → all-legs-cleared → playing → ready → needs-heroes).
- `server.mjs` wiring: cite 01.5 runtime-wiring allowance; why inputs + leaderboard deps are injected from the startup catalog so the logic layer stays registry-free.

## Files to Produce
- `apps/server/src/gauntlet/gauntletRunProgress.logic.ts` — **new** — `deriveGauntletRunStatus` (pure 5-state map), `deriveGauntletRunProgress` (pure per-run derivation over injected inputs + fetched rows, reusing the WP-442 helpers), `listGauntletRunProgress` (DB entrypoint: reuse `listGauntletRuns`, one caller-scoped score read per run, derive). No SQL writes.
- `apps/server/src/gauntlet/gauntletRun.types.ts` — **modified** — additive: `GauntletRunLegProgress`, `GauntletRunStatus` + `GAUNTLET_RUN_STATUSES`, `GauntletRunProgressView`, `GauntletRunProgressInputs`, `GauntletRunProgressResolver`, and the two new `GauntletRunRouteDependencies` fields (`resolveGauntletRunProgressInputs`, `leaderboardDependencies`). Row-shape + WP-445 API types unchanged. Authorized by D-24265.
- `apps/server/src/gauntlet/gauntletRun.routes.ts` — **modified** — GET handler delegates to `listGauntletRunProgress`, returns `{ runs: GauntletRunProgressView[] }`; POST/PATCH/DELETE untouched.
- `apps/server/src/gauntlet/gauntletRunProgress.logic.test.ts` — **new** — DB-gated: all 5 status states, champion vs all-legs-cleared, per-leg cleared + last-played, headroom, and the agrees-with-`getGauntletStandings` solo cross-check; plus a no-DB pure `deriveGauntletRunStatus` test (all 5 states) + the `GAUNTLET_RUN_STATUSES` drift assertion with a synthetic phantom status.
- `apps/server/src/server.mjs` — **modified** — build `resolveGauntletRunProgressInputs` from `gauntletCatalog` + `PLAYER_COUNT_SETUP` + `buildGauntletBoardName`; pass it + `leaderboardDeps` into `registerGauntletRunRoutes` (01.5 wiring).
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — replace the `GET /api/me/gauntlet-runs` row whole (D-11804 §21, closed Status + Auth sets, `Authorizing WP = WP-446`, canonical field names).

## After Completing
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/server test` exits 0 (server build IS the typecheck).
- [ ] DB-gated suite passes with `TEST_DATABASE_URL` + migrations applied; loud-skips visibly without it; the pure status + drift tests run regardless.
- [ ] Layer grep clean: `rg -n "game-engine|preplan|boardgame\.io|@legendary-arena/registry|apps/(arena-client|registry-viewer|legends-board)" apps/server/src/gauntlet/gauntletRunProgress.logic.ts` → 0 matches.
- [ ] Re-implementation grep clean: `rg -n "function (qualifiesAsLegClear|findBestPoolAssignment)" apps/server/src/gauntlet/gauntletRunProgress.logic.ts` → 0 matches.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` GET row replaced whole (same commit).
- [ ] `docs/ai/STATUS.md` states "No user-observable change — infrastructure only".
- [ ] `docs/ai/DECISIONS.md` — D-24265 flipped Drafted → Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-446 node glyph `📝` → `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `git diff --name-only` matches the six-file allowlist (+ governance ledgers/indices); no stray file.

## Common Failure Smells
- A `status`/`pool`/`cleared` value that disagrees with the leaderboard → the predicate/search were re-implemented instead of imported from `gauntletTruth.logic.ts` (drift; violates D-24265 single-source).
- Any `INSERT`/`UPDATE`/`DELETE` in the module (esp. writing `first_completed_at`) → a derived value was stored; this WP is READ-ONLY (violates D-24262).
- `champion` returned whenever all legs are cleared (ignoring the budget) → the `findBestPoolAssignment` gate was dropped; `all-legs-cleared` collapsed into `champion`.
- `.reduce()` in the owner/score fold → use `for...of` (layer rule; mirrors `getGauntletStandings`).
- The logic layer importing `buildGauntletCatalog` / `@legendary-arena/registry` / `PLAYER_COUNT_SETUP` → inputs must be INJECTED from `server.mjs`, not resolved in-layer.
- Tests silently passing with no DB → the loud-skip guard is missing (a silent pass hides an unrun contract).
