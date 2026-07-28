# WP-446 — Gauntlet Run Derived Progression Read (Server)

**User-Visible Surface:** none — infrastructure (the derived read is machine-facing JSON; no player-visible surface until the WP-7 profile tracker consumes it)

**Seventh WP of the Mastermind Gauntlets: download → import → build → track epic.**
The DERIVED-progression read WP-445 deferred: `GET /api/me/gauntlet-runs` now
returns each run's progression — status, pool, budget headroom, per-leg cleared,
and last-played — computed at read time from `leg_picks` +
`legendary.competitive_scores`, storing nothing (D-24262).

---

## Goal

After this session, `GET /api/me/gauntlet-runs` returns, for each of the
caller's runs, a `GauntletRunProgressView` that extends the raw
`GauntletRunView` with a **derived** progression block: the run's `legs` (the
mastermind's home-set schemes, each with a `cleared` flag, a `hasFullPicks`
flag, and a `lastPlayedAt` stamp), the derived hero `pool` (the union of the
run's `leg_picks`), the `budgetHeadroom` (`heroCount + 2` minus the pool size),
an `isChampion` flag, and a 5-state `status` (`needs-heroes` / `ready` /
`playing` / `all-legs-cleared` / `champion`). **Nothing derived is stored**
(D-24262): every field is computed on each read from `leg_picks` +
`legendary.competitive_scores`. The per-leg-clear and champion derivations
**reuse `qualifiesAsLegClear` + `findBestPoolAssignment` from WP-442's
`gauntletTruth.logic.ts` verbatim** — with the same injected inputs the
leaderboard's `getGauntletStandings` uses — so the tracker and the leaderboard
can never disagree on "cleared a leg" or "champion." The read is caller-scoped
(the run owner's own scores + picks), `authenticated-session-required`, and
`Cache-Control: no-store`. `all-legs-cleared` and `champion` are **distinct
states** by design (a player can clear every leg with teams that exceed the
fixed pool budget and legitimately not be champion).

---

## Assumes

- **WP-442 ✅ (shared gauntlet-truth helper).** `apps/server/src/legends/gauntletTruth.logic.ts`
  exports `qualifiesAsLegClear(facts, approvedLoadouts, publishedScoringConfigVersion)`
  and `findBestPoolAssignment(rosterAccumulator, legSchemeSlugs, poolBudget,
  boardName, playerCount)`, plus the `LegClearReplayFacts` and
  `RosterLegAccumulator` types. This WP **consumes these unchanged** — it does
  not re-implement the leg-clear predicate or the pool search. Source:
  WORK_INDEX WP-442 row; `apps/server/src/legends/gauntletTruth.logic.ts` on `main`.
- **WP-443 ✅ (run persistence).** Migration `data/migrations/039_create_player_gauntlet_runs.sql`
  created `legendary.player_gauntlet_runs` with `set_abbr`, `mastermind_slug`,
  `division`, `player_count`, `leg_picks jsonb`, timestamps, and nullable
  `first_completed_at`; `apps/server/src/gauntlet/gauntletRun.types.ts` holds the
  `GauntletRunRow` / `GauntletRunDivision` / `GauntletRunLegPicks` row-shape
  types. Source: WORK_INDEX WP-443 row; migration 039 header.
- **WP-445 ✅ (run import + CRUD API).** The four `/api/me/gauntlet-runs`
  endpoints exist in `apps/server/src/gauntlet/gauntletRun.{routes,logic,types}.ts`;
  `GET` currently returns the **raw stored** run (`GauntletRunView`) with **no**
  derived projection, deliberately shaped to leave room for this WP to extend it
  (D-24264 names the derived read "the WP-446 follow-on"). `listGauntletRuns`,
  `loadPlayerIdByAccountId`, and the `GauntletRunRouteDependencies` bundle are
  reused. Source: WORK_INDEX WP-445 row; those files on `main`.
- **D-24262 ✅ (derived-progression lock).** No derived progression value
  (status, hero pool, budget headroom, champion, cleared, last-played) may be
  stored. This WP computes all of them at read time and stores nothing. Source:
  `docs/ai/DECISIONS.md` D-24262.
- **`getGauntletStandings` is the leaderboard reference.**
  `apps/server/src/legends/gauntlet.logic.ts` `getGauntletStandings(definition,
  database, leaderboardDeps)` folds `legendary.competitive_scores` into
  `RosterLegAccumulator`s via `qualifiesAsLegClear`, resolving
  `publishedScoringConfigVersion` from `leaderboardDeps.checkParPublished(scenarioKey)`
  and the fixed division via `findBestPoolAssignment`. This WP's single-run read
  reuses the SAME helpers with the SAME inputs, scoped to one caller instead of
  aggregating all rosters. Source: that file on `main`.
- **The gauntlet catalog + `PLAYER_COUNT_SETUP` are built at startup.**
  `server.mjs` builds `gauntletCatalog` (array of `GauntletDefinition`, each
  carrying `legs`, `approvedLoadouts`, `heroPoolBudgets[count] = heroCount + 2`)
  and `leaderboardDeps`; `PLAYER_COUNT_SETUP` supplies `heroCount` per count. This
  WP injects a progress-inputs resolver + the leaderboard deps built from these,
  so the logic layer never imports the registry (mirrors the WP-445
  existence-resolver injection). Source: `apps/server/src/server.mjs` around the
  `resolveGauntletExistence` block; `packages/registry/src/playerCountSetup.ts`.
- **Baseline:** `origin/main` @ `85d096d9` (`git rev-parse origin/main` at draft
  time). Ledger next-free confirmed WP-446 / EC-481 / D-24265.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` — §Layer Boundary (Authoritative): `apps/server`
  import rules (may import `registry`, `pg`, Node built-ins; not `game-engine` /
  `preplan` / `boardgame.io` / any `apps/*`) and §Persistence Boundary (`G`/`ctx`
  runtime-only; the `bgio` blob is untouched — this WP reads only the
  `legendary.*` domain tables `player_gauntlet_runs`, `competitive_scores`,
  `replay_ownership`, `players`).
- `.claude/rules/architecture.md` — Import Rules quick-reference row for
  `apps/server`; the pure-helper rule (no `.reduce()` in the fold — use `for...of`).
- `.claude/skills/legendary-server/SKILL.md` — server is a wiring layer; no
  gameplay logic. The derived read is account-local domain read-modeling over
  competitive-score rows, not gameplay.
- `.claude/skills/legendary-persistence/SKILL.md` — the read touches only
  Class-2 domain tables; it stores NOTHING (no write path at all); `G`/`ctx` and
  the `bgio` store are untouched; no snapshot.
- `docs/ai/REFERENCE/00.2-data-requirements.md` — §8.1 canonical field names
  (`schemeId`, `heroDeckIds`, `playerCount`, …); this WP uses `heroDeckIds`
  inside `leg_picks`, `setAbbr`, `mastermindSlug`, `division`, `playerCount`
  verbatim and surfaces per-leg `schemeId` (the registry `slug`).
- `docs/ai/REFERENCE/api-endpoints.md` — §21 catalog obligation (D-11804): the
  `GET /api/me/gauntlet-runs` row's Response schema changes (it now carries the
  derived block), so the whole row is replaced (replace-whole-row semantics).
- `docs/ai/DECISIONS.md` — D-24262 (derived-progression lock), D-24264
  (import/API-shape), D-24187 (fixed-pool budget = `heroCount + 2`; the
  `findBestPoolAssignment` contract), D-24199 (approved-loadout requirement),
  D-9905 (Auth closed set), D-11504 (Cache-Control first-statement), D-11804
  (API-catalog replace-whole-row).
- Source to reuse: `apps/server/src/legends/gauntletTruth.logic.ts`
  (`qualifiesAsLegClear` + `findBestPoolAssignment` — consume as-is),
  `apps/server/src/legends/gauntlet.logic.ts` (`getGauntletStandings` — the
  fold/injection pattern to mirror; `GauntletLeg` / `GauntletApprovedLoadouts` /
  `buildGauntletBoardName` exports), `apps/server/src/gauntlet/gauntletRun.logic.ts`
  (`listGauntletRuns`, `loadPlayerIdByAccountId`), `apps/server/src/leaderboards/leaderboard.types.ts`
  (`LeaderboardDependencies.checkParPublished`).

**Split note (single vs several):** this is a deliberate single-WP,
single-app (`apps/server`) follow-on to WP-445. It does not cross a layer
boundary (all reuse is server-internal); it locks one durable contract
(D-24265). It is NOT lightweight-lane eligible — it consumes leaderboard /
scoring truth logic and locks a cross-cutting, future-facing derivation
contract (both disqualifiers per `01.0a §Lightweight Lane`), so it runs the
standard two-session lane.

---

## Scope (In)

- **Enhance `GET /api/me/gauntlet-runs`** so its response body becomes
  `{ runs: GauntletRunProgressView[] }` — each run the raw `GauntletRunView`
  fields PLUS a derived progression block. The endpoint path, method, auth
  posture (`authenticated-session-required`), and `Cache-Control: no-store` are
  unchanged; only the response schema grows. The `POST` / `PATCH` / `DELETE`
  handlers are UNCHANGED.
- **New pure-ish derivation module** `apps/server/src/gauntlet/gauntletRunProgress.logic.ts`:
  - `deriveGauntletRunStatus(...)` — a **pure** function mapping
    `{ legs, clearedByScheme, hasFullPicksByScheme, isChampion }` to the 5-state
    `GauntletRunStatus` (unit-testable with no DB).
  - `deriveGauntletRunProgress(run, inputs, qualifyingRows, checkParPublished)` —
    a **pure** function that, given a run + injected `GauntletRunProgressInputs`
    + the already-fetched caller-scoped competitive-score rows, builds a
    caller-centric `RosterLegAccumulator` (owner-visibility list via `for...of`,
    never `.reduce()`), computes per-leg `cleared` (≥1 qualifying replay per
    `qualifiesAsLegClear`) and `lastPlayedAt` (`max(created_at)` over the
    caller's qualifying rows for that leg), the hero `pool` (sorted union of the
    run's `leg_picks`), `budgetHeadroom` (`poolBudget − pool.length`),
    `isChampion` (all legs cleared AND `findBestPoolAssignment` returns non-null),
    and the `status`, then returns a `GauntletRunProgressView`.
  - `listGauntletRunProgress(accountId, database, deps)` — the DB entrypoint:
    reuse `listGauntletRuns` to load the caller's raw runs, resolve each run's
    `GauntletRunProgressInputs` via the injected resolver, run ONE caller-scoped
    `competitive_scores` read per run (mastermind + the run's set's leg schemes +
    the run's `player_count`, restricted to replays the caller owns), and derive.
- **Extend** `apps/server/src/gauntlet/gauntletRun.types.ts` **additively** with:
  `GauntletRunLegProgress`, `GauntletRunStatus` closed union + its canonical
  `GAUNTLET_RUN_STATUSES` array (drift-asserted), `GauntletRunProgressView`
  (extends `GauntletRunView`), `GauntletRunProgressInputs`,
  `GauntletRunProgressResolver`, and the additional fields on
  `GauntletRunRouteDependencies` (`resolveGauntletRunProgressInputs` +
  `leaderboardDependencies`). This additive extension of the WP-445 contract
  file is authorized by **D-24265** (the derivation-semantics lock) — the same
  review-and-decision pattern WP-445 used to extend WP-443's file under D-24264.
  Row-shape + WP-445 API types are reused unchanged.
- **Modify** `apps/server/src/gauntlet/gauntletRun.routes.ts` — the `GET`
  handler delegates to `listGauntletRunProgress` and returns
  `{ runs: GauntletRunProgressView[] }`; the other three handlers are untouched.
- **Wire** into `apps/server/src/server.mjs` (runtime-wiring — 01.5 allowance):
  build `resolveGauntletRunProgressInputs` from the already-built
  `gauntletCatalog` + `PLAYER_COUNT_SETUP` (legs + `approvedLoadouts` +
  `heroPoolBudgets[count]` + `heroCount` + `buildGauntletBoardName(definition)`)
  and pass it plus the existing `leaderboardDeps` into `registerGauntletRunRoutes`.
- **Update** `docs/ai/REFERENCE/api-endpoints.md` — replace the whole
  `GET /api/me/gauntlet-runs` row (Response schema now the derived block; D-11804 §21).
- **DB-gated tests** `apps/server/src/gauntlet/gauntletRunProgress.logic.test.ts`
  (loud-skip when `TEST_DATABASE_URL` unset) covering all 5 status states,
  champion vs all-legs-cleared, per-leg cleared, budget headroom, last-played,
  and a cross-check that the run read AGREES with `getGauntletStandings` on a
  shared solo (`player_count = 1`) fixture where the two overlap. Plus a pure
  unit test of `deriveGauntletRunStatus` (all 5 states) and the
  `GAUNTLET_RUN_STATUSES` drift assertion (no DB needed).

## Out of Scope

- **Any schema change / stored derived value.** No migration, no new column, no
  cache table. Everything is computed per read (D-24262). This WP has **no write
  path at all** — it does NOT write `first_completed_at` (the write-once stamp is
  a later concern; every derivation is read-only).
- **Changes to `gauntletTruth.logic.ts`.** `qualifiesAsLegClear` and
  `findBestPoolAssignment` are consumed as-is. If a genuinely-missing exported
  helper is discovered at execution, STOP and flag it — do not re-implement the
  predicate or the pool search inline (drift = FAIL).
- **The other three endpoints.** `POST` / `PATCH` / `DELETE` bodies are
  byte-unchanged.
- **The profile tracker UI / import file-picker.** `MyProfilePage.vue`, the
  arena-client `gauntletRunApi.ts`, and any client rendering are the WP-7 client
  WP.
- **Composition → match launch.** The lobby-extraction primitive and any leg
  launch are later WPs.
- **The open-division secondary badge.** Open-division-specific presentation
  (open per-leg clears beside the fixed championship) is the future WP-8; see the
  Contract's division note for how `open` runs are handled here.
- **No `bgio`-blob read, no persistence carve-out, no snapshot.**

---

## Files Expected to Change

- `apps/server/src/gauntlet/gauntletRunProgress.logic.ts` — **new** — the
  derivation module: `deriveGauntletRunStatus` (pure 5-state map),
  `deriveGauntletRunProgress` (pure per-run derivation over injected inputs +
  fetched rows, reusing `qualifiesAsLegClear` + `findBestPoolAssignment`), and
  `listGauntletRunProgress` (DB entrypoint: reuse `listGauntletRuns`, one
  caller-scoped score read per run, derive). The caller-scoped
  `competitive_scores` SQL mirrors `getGauntletStandings`' query, restricted to
  replays the caller owns at the run's `player_count`.
- `apps/server/src/gauntlet/gauntletRun.types.ts` — **modified** — additive:
  `GauntletRunLegProgress`, `GauntletRunStatus` + `GAUNTLET_RUN_STATUSES`,
  `GauntletRunProgressView extends GauntletRunView`, `GauntletRunProgressInputs`,
  `GauntletRunProgressResolver`, and the two new `GauntletRunRouteDependencies`
  fields. Row-shape + WP-445 API types unchanged. (Authorized by D-24265.)
- `apps/server/src/gauntlet/gauntletRun.routes.ts` — **modified** — the `GET`
  handler delegates to `listGauntletRunProgress` and returns
  `{ runs: GauntletRunProgressView[] }`; POST/PATCH/DELETE untouched.
- `apps/server/src/gauntlet/gauntletRunProgress.logic.test.ts` — **new** —
  DB-gated (loud-skip without `TEST_DATABASE_URL`): all 5 status states, champion
  vs all-legs-cleared, per-leg cleared, headroom, last-played, and the
  agrees-with-`getGauntletStandings` solo cross-check; plus a no-DB pure unit test
  of `deriveGauntletRunStatus` + the `GAUNTLET_RUN_STATUSES` drift assertion.
- `apps/server/src/server.mjs` — **modified** — build
  `resolveGauntletRunProgressInputs` from `gauntletCatalog` + `PLAYER_COUNT_SETUP`
  + `buildGauntletBoardName`, and pass it plus `leaderboardDeps` into
  `registerGauntletRunRoutes` (01.5 runtime-wiring allowance).
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — replace the
  `GET /api/me/gauntlet-runs` row entirely (Response schema = the derived block;
  Status/Auth from the closed sets; `Authorizing WP = WP-446`; D-11804 §21).

---

## Contract

- **Endpoint (unchanged path/method/auth/cache):**
  `GET /api/me/gauntlet-runs` → `200 { runs: GauntletRunProgressView[] }`; `401
  unauthorized`; `403 account_suspended`; `500 internal_error`.
  `Auth = authenticated-session-required`, `Cache-Control: no-store`,
  caller-scoped by the resolved `player_id`.
- **`GauntletRunProgressView` (extends `GauntletRunView`):**
  `{ …GauntletRunView, status, pool, budgetHeadroom, heroCount, budget,
  isChampion, legs }` where
  - `status: GauntletRunStatus`,
  - `pool: readonly string[]` — the sorted union of all `leg_picks` hero ids,
  - `budgetHeadroom: number` — `budget − pool.length` (may be negative when the
    picks already exceed budget),
  - `heroCount: number` — the run's per-`playerCount` hero-group count (from
    `PLAYER_COUNT_SETUP`, injected),
  - `budget: number` — `heroCount + 2` (the fixed-pool budget, D-24187 §4),
  - `isChampion: boolean`,
  - `legs: readonly GauntletRunLegProgress[]`.
- **`GauntletRunLegProgress`:** `{ schemeId: string, schemeName: string, cleared:
  boolean, hasFullPicks: boolean, lastPlayedAt: string | null }` where `schemeId`
  is the registry scheme `slug`, `hasFullPicks` is `leg_picks[schemeId].length ===
  heroCount`, and `lastPlayedAt` is the ISO `max(created_at)` over the caller's
  qualifying `competitive_scores` for that leg (`null` if none).
- **`GauntletRunStatus` closed union** (+ `GAUNTLET_RUN_STATUSES` canonical
  readonly array, drift-asserted): `needs-heroes | ready | playing |
  all-legs-cleared | champion`. Derivation (evaluated in this order):
  - `champion` — every leg cleared AND a budget-valid fixed-pool assignment
    exists (`findBestPoolAssignment` non-null over the caller's winning teams);
  - `all-legs-cleared` — every leg cleared but NO budget-valid pool;
  - `playing` — ≥1 leg cleared, not all;
  - `ready` — ≥1 leg has `hasFullPicks`, 0 legs cleared;
  - `needs-heroes` — no leg has `hasFullPicks` (nothing launchable).
  **`all-legs-cleared` and `champion` are DISTINCT** — the invisible-failure
  class the epic exists to make legible.
- **Single source of truth:** per-leg `cleared` is `qualifiesAsLegClear(facts,
  approvedLoadouts, publishedScoringConfigVersion)` from WP-442 — the
  `approvedLoadouts` from the injected inputs (same catalog data the leaderboard
  stamps on the definition), `publishedScoringConfigVersion` resolved from
  `leaderboardDependencies.checkParPublished(scenarioKey)` exactly as
  `getGauntletStandings` does. `isChampion`'s pool search is
  `findBestPoolAssignment` from WP-442. Neither predicate is re-implemented.
- **Caller-centric aggregation (design note, locked by D-24265):** the run read
  builds ONE `RosterLegAccumulator` from the caller's own qualifying replays at
  the run's `player_count` (keyed by `team_key` per leg — hero identity, not
  player identity), so the champion search runs over "the caller's winning
  teams." This is intentionally distinct from `getGauntletStandings`' per-roster
  grouping; for solo runs (`player_count = 1`, roster == the caller) the two
  coincide, which the cross-check test asserts.
- **Division handling (design note):** the derivation uses the fixed-pool model
  uniformly (`budget = heroCount + 2`; champion requires a budget-valid pool).
  For an `open` run the same fields are computed with the same rule; open-division
  secondary-badge presentation is deferred to the future WP-8. `division` is
  carried through on the view unchanged.
- **Derived-nothing (D-24262):** no field is stored; the read has no write path.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Provide **full file contents** for every new or modified file. Diffs,
  snippets, or "show only the changed section" output are forbidden.
- ESM only; Node v22+; `node:`-prefixed built-in imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (explicit control
  flow; **no `.reduce()`** in the score fold — use `for...of` with descriptive
  variables; full-word names; boolean names `is/has/can`; every function has
  JSDoc; error messages are full sentences; named imports only, no `import *`).

**Packet-specific:**
- Server layer only. `gauntletRunProgress.logic.ts` may import: the WP-442
  helpers + types from `../legends/gauntletTruth.logic.js`, the `GauntletLeg` /
  `GauntletApprovedLoadouts` **types** and (in `server.mjs` only)
  `buildGauntletBoardName` from `../legends/gauntlet.logic.js`, `listGauntletRuns`
  + `loadPlayerIdByAccountId` from `./gauntletRun.logic.js`, the
  `LeaderboardDependencies` **type** from `../leaderboards/leaderboard.types.js`,
  `pg` via the injected `DatabaseClient` alias, and Node built-ins. It MUST NOT
  import `game-engine`, `preplan`, `boardgame.io`, `@legendary-arena/registry`,
  or any `apps/*` package. The progress inputs (legs, approvedLoadouts,
  poolBudget, heroCount, boardName) arrive via the INJECTED resolver — the logic
  layer never builds the registry catalog.
- **Reuse, don't re-implement:** `qualifiesAsLegClear` + `findBestPoolAssignment`
  are consumed verbatim. Re-deriving the leg-clear clause order or the pool
  subset search is a FAIL (drift between tracker and leaderboard).
- **Derived, never stored (D-24262):** status / pool / headroom / champion /
  cleared / last-played are computed per read; no column, no cache, no write.
- **`all-legs-cleared` ≠ `champion`** — the two states are distinct and must both
  be reachable.
- Caller-scoped: every query restricted to replays the caller owns and the
  caller's own runs; `authenticated-session-required`; `Cache-Control: no-store`
  the first statement of the GET handler body (D-11504); a thrown error still
  leaves `500 { error: 'internal_error' }` (try/catch, never re-throw to the
  framework).
- Never `Math.random()` (no RNG); `node:test` + `node:assert` only; no
  `boardgame.io/testing`; DB-gated tests LOUD-skip without `TEST_DATABASE_URL`
  (visible skip, never a silent pass); no network.
- No new npm dependency; `pg` only, no ORM, no axios/node-fetch.

**Session protocol:** if any locked value, field name, or contract detail is
unclear, STOP and ask — do not guess or invent. If the EC and this WP conflict,
this WP wins; if this WP and ARCHITECTURE.md conflict, ARCHITECTURE.md wins.

**Locked contract values:** the `GauntletRunStatus` union + its derivation order,
the `GauntletRunProgressView` / `GauntletRunLegProgress` field sets, the
`budget = heroCount + 2` relation, `hasFullPicks = picks.length === heroCount`,
and the reuse of `qualifiesAsLegClear` + `findBestPoolAssignment` are locked —
see the EC `## Locked Values`.

---

## Vision Alignment

**Vision clauses touched:** §3 (player identity / accounts — the read is
account-local, `player_id`-scoped), §11 (ownership / visibility — a run's
progression is private to its owner and derived only from that owner's own
consent-visible scores), §20–26 (leaderboard / competitive scoring — the read
consumes `competitive_scores` READ-ONLY through the same truth helper the
leaderboard uses, so it can never diverge), NG-1 (no pay-to-win).

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
The derived read stores nothing, confers no in-game advantage, and reuses the
authoritative leaderboard truth logic rather than a parallel one; the server
remains the sole authority and the pack stays import-only.

**Non-Goal proximity check:** none of NG-1..7 are crossed. The progression read
is free account-local derived state; it gates no gameplay power and carries no
monetization surface.

**Determinism preservation:** N/A for gameplay determinism — this WP touches no
`G`/`ctx`, no RNG, no replay execution, no simulation. The derivation is a pure
function of `leg_picks` + the caller's scored rows (same inputs → same output),
but sits entirely outside the engine's determinism boundary.

---

## Acceptance Criteria

1. `GET /api/me/gauntlet-runs` returns `{ runs: GauntletRunProgressView[] }`;
   each element carries the raw `GauntletRunView` fields PLUS `status`, `pool`,
   `budgetHeadroom`, `heroCount`, `budget`, `isChampion`, and `legs`.
2. A fresh run with empty `leg_picks` derives `status = 'needs-heroes'`, `pool =
   []`, `budgetHeadroom = budget`, `isChampion = false`, and every leg
   `{ cleared: false, hasFullPicks: false, lastPlayedAt: null }`.
3. A run where ≥1 leg has exactly `heroCount` picks and 0 legs cleared derives
   `status = 'ready'`.
4. A run with ≥1 cleared leg but not all cleared derives `status = 'playing'`;
   the cleared leg's `cleared` is `true` and its `lastPlayedAt` equals the ISO
   `max(created_at)` of the caller's qualifying scores for that leg.
5. A run where every leg is cleared but the caller's winning teams' union exceeds
   `budget` (no valid pool) derives `status = 'all-legs-cleared'` and
   `isChampion = false` — distinct from champion.
6. A run where every leg is cleared AND a budget-valid pool exists derives
   `status = 'champion'` and `isChampion = true`.
7. `pool` is the sorted union of all `leg_picks` hero ids; `budgetHeadroom =
   budget − pool.length` (negative allowed when picks exceed budget); `budget =
   heroCount + 2` for the run's `player_count`.
8. Per-leg `cleared` matches `qualifiesAsLegClear`, and `isChampion`'s pool
   search matches `findBestPoolAssignment`, both from `gauntletTruth.logic.ts` —
   asserted by the cross-check test that a solo (`player_count = 1`) fixture
   produces the SAME champion verdict as that caller's presence in
   `getGauntletStandings`' fixed division.
9. The read is caller-scoped: account B's runs and scores never affect account
   A's derived view; the query is restricted to replays the caller owns and the
   caller's own runs.
10. Every response sets `Cache-Control: no-store` and requires a validated,
    unsuspended session (`401` / `403` otherwise); an uncaught error yields
    `500 { error: 'internal_error' }` with the header still set.
11. `gauntletRunProgress.logic.ts` imports nothing from `game-engine` /
    `preplan` / `boardgame.io` / `@legendary-arena/registry` / any `apps/*`
    package; the leg-clear predicate and pool search are the imported WP-442
    helpers, not re-implemented locally.
12. `GauntletRunStatus` union and its `GAUNTLET_RUN_STATUSES` canonical array are
    drift-asserted; a synthetic phantom status fails the guard. Nothing derived
    is stored — the module has no `INSERT`/`UPDATE`/`DELETE`.
13. `docs/ai/REFERENCE/api-endpoints.md` `GET /api/me/gauntlet-runs` row is
    replaced whole with the derived Response schema (Status + Auth from the closed
    sets; `Authorizing WP = WP-446`; canonical field names).

---

## Verification Steps

- `pnpm -r build` — exits 0 (server build type-checks the new modules + the
  additive types).
- `pnpm --filter @legendary-arena/server test` — exits 0; the new
  `gauntletRunProgress.logic.test.ts` registers and passes (its DB cases
  loud-skip with a visible skip when `TEST_DATABASE_URL` is unset — never a
  silent pass; the pure `deriveGauntletRunStatus` + drift tests run without a DB).
- With `TEST_DATABASE_URL` set and migrations applied (`node scripts/migrate.mjs`
  or the psql-migrations path per `project_db_backed_server_tests_local`):
  `pnpm --filter @legendary-arena/server test` exercises all 5 status states,
  champion-vs-all-legs-cleared, per-leg cleared + last-played, headroom, and the
  agrees-with-`getGauntletStandings` solo cross-check.
- Layer-boundary grep (expected: zero matches):
  `rg -n "game-engine|preplan|boardgame\.io|@legendary-arena/registry|apps/(arena-client|registry-viewer|legends-board)" apps/server/src/gauntlet/gauntletRunProgress.logic.ts`.
- Re-implementation grep (expected: zero matches — the predicate/search are
  imported, not redefined):
  `rg -n "function (qualifiesAsLegClear|findBestPoolAssignment)" apps/server/src/gauntlet/gauntletRunProgress.logic.ts`.
- `pnpm -r --no-bail test` — repo-wide totals unchanged except the added server
  tests.
- API-catalog spot check: `rg -n "GET.*/api/me/gauntlet-runs" docs/ai/REFERENCE/api-endpoints.md`
  shows the GET row now describing the derived `status`/`pool`/`budgetHeadroom`/
  `legs` block, `Authorizing WP = WP-446`.

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/server test`
      exits 0 (server build IS the typecheck — no separate `typecheck` line for a
      server package).
- [ ] The enhanced `GET` is reachable through the framework router and returns
      the derived block.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` GET row replaced whole in the same
      commit (D-11804 §21 replace-whole-row; closed Status + Auth sets).
- [ ] `docs/ai/STATUS.md` updated — states "No user-observable change —
      infrastructure only" (surface is `none — infrastructure`; the payoff is the
      WP-7 tracker consuming the derived read).
- [ ] `docs/ai/DECISIONS.md` — D-24265 flipped Drafted → Active (the single-run
      derived-progression-semantics lock).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — the WP-446 node glyph moved `📝` → `✅`,
      then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified (the
      `server.mjs` wiring is the sole 01.5 runtime-wiring exception, declared in
      the EC).

---

## Lint Gate Self-Review

All 21 sections of `00.3-prompt-lint-checklist.md` resolved against this WP:

- **§1 Structure** — PASS. All required sections present and non-empty. Out of
  Scope names >2 excluded items (schema change, `gauntletTruth.logic.ts` edits,
  the other three endpoints, tracker UI, match launch, open-division badge).
- **§2 Constraints block** — PASS. Engine-wide (full file contents, ESM/Node
  v22+, `00.6`), packet-specific, session protocol, and locked values all present.
- **§3 Assumes** — PASS. WP-442/443/445 + D-24262 + the `getGauntletStandings`
  reference + the startup catalog/PLAYER_COUNT_SETUP, with exact exports/shapes;
  baseline SHA `85d096d9` recorded.
- **§4 Context** — PASS. Specific docs + sections: ARCHITECTURE Layer Boundary +
  Persistence, both SKILL files, 00.2 §8.1, api-endpoints §21, DECISIONS by id,
  and the exact source files to reuse.
- **§5 Files** — PASS. Six files, each new/modified with a one-line description;
  ≤8; no ambiguous "update this section" language.
- **§6 Naming** — PASS. `heroDeckIds`, `setAbbr`, `mastermindSlug`, `division`,
  `playerCount`, `player_id`, `leg_picks`, `schemeId`, `heroCount` match
  00.2 / WP-440 / WP-443 / PLAYER_COUNT_SETUP verbatim; boolean names
  `hasFullPicks` / `isChampion` / `cleared`.
- **§7 Dependencies** — PASS. No new npm dependency; `pg` only; no ORM, axios,
  node-fetch, Jest, or Vitest; stated explicitly.
- **§8 Boundaries** — PASS. Server-layer READ modeling; no `G`/`ctx`; no gameplay
  logic; `pg` pool via the injected `DatabaseClient`; the WP-442 helpers +
  injected inputs are the only cross-module edges; no registry runtime import in
  the logic layer.
- **§9 Windows** — PASS (N/A specifics). No shell scripts; the DB test path uses
  the documented `TEST_DATABASE_URL` flow; no Unix assumptions.
- **§10 Env vars** — PASS. `TEST_DATABASE_URL` (test-only) is the sole variable;
  no new production env var, no secret in output.
- **§11 Auth** — PASS. One identity model (WP-112 validated session →
  `AccountId`), applied consistently; the endpoint states its required credential
  (`authenticated-session-required`); caller-scoping (`player_id`) named.
- **§12 Tests** — PASS. `node:test` + `node:assert`; no `boardgame.io/testing`;
  DB-gated cases loud-skip; pure `deriveGauntletRunStatus` + drift tests run
  without a DB; no network. (No deck/shuffle golden test — N/A: no deterministic
  deck construction here.)
- **§13 Verification** — PASS. Exact `pnpm` commands with expected exit behavior;
  the loud-skip expectation and both greps are stated.
- **§14 Acceptance** — PASS. 13 binary, observable, specific items aligned to the
  deliverables.
- **§15 Definition of Done** — PASS. Includes STATUS.md, DECISIONS.md,
  WORK_INDEX.md, the mindmap/counts gate, the scope-boundary check, and the
  §15.1 `none — infrastructure` handling (STATUS states "No user-observable
  change").
- **§16 Code Style** — PASS. No abstraction for <3 uses; explicit control flow
  (no `.reduce()` in the fold — stated; no nested ternaries — the status
  derivation is an ordered `if` ladder); descriptive names; per-function JSDoc;
  full-sentence errors; named imports only.
- **§17 Vision Alignment** — PASS. `## Vision Alignment` with clause numbers
  (§3, §11, §20–26, NG-1), No-conflict assertion, NG proximity check, determinism
  line (N/A-gameplay, justified).
- **§18 Prose-vs-grep** — PASS. Two greps: the layer grep targets
  `game-engine|preplan|boardgame.io|@legendary-arena/registry|apps/*` in
  `gauntletRunProgress.logic.ts`; the re-implementation grep targets
  `function (qualifiesAsLegClear|findBestPoolAssignment)` in the same file. Both
  are scoped to that source file, not this markdown — this WP's prose names those
  tokens but the greps do not read this file, so no false positive. The EC keeps
  the policed literals out of the logic file's own prose.
- **§19 Bridge staleness** — N/A. Not a repo-state-summarizing artifact; baseline
  SHA cited as a fixed fact, reconciled at commit.
- **§20 Funding Surface Gate** — N/A. No funding affordance, donate/support copy,
  or tournament-funding channel; an account-local derived read.
- **§21 API Catalog** — APPLIES. This WP changes the Response schema of an
  existing `apps/server` endpoint (`GET /api/me/gauntlet-runs`);
  `docs/ai/REFERENCE/api-endpoints.md` GET row is replaced whole in the same
  execution commit (Status + Auth from the closed sets,
  `authenticated-session-required`, canonical field names, `Authorizing WP =
  WP-446`, replace-whole-row). Listed in Files Expected to Change and the DoD.

**Verdict: LINT PASS** — all 21 sections resolved (N/A justified for §19, §20;
§9/§12-golden are N/A-in-part with reasons).

---

## Pre-Flight (01.4) — Verdict: READY TO EXECUTE

- **Authority chain read** — CLAUDE.md, ARCHITECTURE.md (Layer Boundary +
  Persistence), `.claude/rules/architecture.md`, both SKILL files,
  WP-442/443/445 rows on `main`. Baseline `origin/main` @ `85d096d9`.
- **Dependencies complete** — WP-442 ✅, WP-443 ✅, WP-445 ✅ (all `[x]` Done on
  `main`; `gauntletTruth.logic.ts` exports the two helpers; migration 039 +
  `gauntletRun.{types,logic,routes}.ts` present; `getGauntletStandings` +
  `LeaderboardDependencies.checkParPublished` present). No blocking dep.
- **Contracts on `main`** — `qualifiesAsLegClear` / `findBestPoolAssignment` /
  `LegClearReplayFacts` / `RosterLegAccumulator` (`gauntletTruth.logic.ts`);
  `GauntletLeg` / `GauntletApprovedLoadouts` / `buildGauntletBoardName` /
  `getGauntletStandings` (`gauntlet.logic.ts`); `listGauntletRuns` /
  `loadPlayerIdByAccountId` / `GauntletRunView` / `GauntletRunRouteDependencies`
  (`gauntletRun.{logic,types}.ts`); `heroPoolBudgets[count] = heroCount + 2`
  built in `server.mjs`; `PLAYER_COUNT_SETUP` heroCount — all verified present on
  the drafting baseline. The `competitive_scores` columns (`scenario_key`,
  `final_score`, `scoring_config_version`, `player_count`, `team_key`,
  `henchman_key`, `outcome`, `created_at`) verified via migrations 007/026/027/034/035.
- **Structural readiness** — the new module reuses two existing pure helpers +
  an existing caller-scoped query shape; the additive types extend an existing
  file; the GET handler swaps its logic delegate; the wiring extends an existing
  `registerGauntletRunRoutes` call.
- **Runtime readiness** — no `G`/`ctx`, no RNG, no framework move; the pool is
  the existing single `pg.Pool`; inputs + leaderboard deps are injected from
  already-built startup state (no new registry edge in the logic layer).
- **Scope lock** — the six-file allowlist is enumerated and matches §Files; the
  `server.mjs` wiring is the sole 01.5 exception, declared.
- **PS/RS items:** none blocking. RS-1 (resolved): caller-centric aggregation vs
  per-roster grouping — resolved by the Contract's design note + the solo
  cross-check; documented, not a gap. RS-2 (resolved): `open`-division handling —
  uses the fixed-pool model uniformly, open-badge deferred to WP-8; documented.
  RS-3 (resolved): modifying WP-445 contract files (`gauntletRun.types.ts` /
  `.routes.ts`) is authorized by D-24265 and mirrors the WP-445→WP-443
  extension precedent under D-24264.
- **Verdict: READY TO EXECUTE.**

---

## Copilot Check (01.7) — Verdict: PASS

Audited against the 30 failure modes; the load-bearing ones for this surface:

- **Boundaries (1.x)** — PASS. Server read-modeling only; no gameplay logic; the
  logic layer reaches truth via the imported WP-442 helpers + injected inputs,
  never the registry catalog.
- **Determinism (2.x)** — PASS (N/A-gameplay). No RNG/time/iteration-order
  dependence in gameplay; the derivation is a pure function of picks + scored
  rows; the fold uses `for...of`, not `.reduce()`.
- **Persistence (5.x)** — PASS. Read-only over `legendary.*` domain tables; no
  `G`/`ctx`/`bgio`-blob touch; NOTHING derived is stored (D-24262); no snapshot.
- **Type safety / contract (4.x)** — PASS. Closed `GauntletRunStatus` union +
  drift-asserted canonical array; `GauntletRunProgressView` /
  `GauntletRunLegProgress` field sets locked; no `any`/free-form status strings.
- **Single-source-of-truth / drift (3.x, 6.x)** — PASS. The leg-clear predicate
  and pool search are the SAME functions the leaderboard uses; the cross-check
  test pins agreement on the shared solo fixture; re-implementation is grep-gated
  out.
- **Scope governance (7.x)** — PASS. `apps/server/src/gauntlet/` already exists;
  no new top-level directory; six files; one scoped-but-durable D-entry (D-24265)
  with a clear derivation-semantics rationale.

**Verdict: PASS.** No RISK or BLOCK. Two items surfaced for Jeff's eye (not
blockers): the caller-centric-vs-per-roster aggregation choice for multiplayer
runs, and the uniform fixed-pool treatment of `open` runs (open badge deferred to
WP-8). Both are recorded in the Contract's design notes.
