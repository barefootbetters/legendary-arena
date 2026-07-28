# WP-445 — Gauntlet Run Import + Run-CRUD API (Server)

**User-Visible Surface:** none — infrastructure (the endpoints are machine-facing HTTP; no player-visible surface until the WP-446 derived read and the WP-7 profile tracker land)

**Sixth WP of the Mastermind Gauntlets: download → import → build → track epic.**
The play-side (`play.legendary-arena.com` / `apps/server`) consumer of the WP-440
identity pack: the authenticated import endpoint plus run-workspace CRUD.

---

## Goal

After this session, an authenticated player can POST a WP-440 identity pack to
`POST /api/me/gauntlet-runs` and get back a persisted **run workspace** row in
`legendary.player_gauntlet_runs` (identity + empty `leg_picks` + timestamps),
list their runs via `GET /api/me/gauntlet-runs` (raw stored rows — identity +
`leg_picks` + timestamps, no derived projection), edit a run's per-leg hero
picks via `PATCH /api/me/gauntlet-runs/:id`, and delete a run via
`DELETE /api/me/gauntlet-runs/:id`. Import is **idempotent**: re-importing the
same gauntlet identity while an active run exists attaches to and returns that
run instead of erroring on the partial-unique conflict; once a run is completed
(`first_completed_at` set) a fresh import opens a new active run. All four
endpoints require a validated session, are scoped by the resolved `player_id`
(cross-account → 404, no existence leak), and set `Cache-Control: no-store`.
The endpoints mirror `loadoutLibrary.{routes,logic,types}.ts` structurally.

---

## Assumes

- **WP-440 ✅ (Gauntlet Pack contract).** `@legendary-arena/registry` exports
  `validateGauntletPack(input): GauntletPack` and the `GauntletPack` type via
  the `./gauntletPack` subpath (`packages/registry/src/gauntletPack.ts`). The
  server layer already imports the registry at runtime, so this is a permitted
  server-layer import. Source: WORK_INDEX WP-440 row; `.claude/rules/architecture.md`
  Import Rules (`apps/server` may import `registry`).
- **WP-442 ✅ (shared gauntlet-truth helper).** `apps/server/src/legends/gauntletTruth.logic.ts`
  exists and exports `qualifiesAsLegClear` + `findBestPoolAssignment`. **This WP
  does NOT consume it** — the derived read that consumes the helper is the
  WP-446 follow-on. The dependency is listed because WP-445's raw-GET contract
  is deliberately shaped to leave room for WP-446 to extend it. Source:
  WORK_INDEX WP-442 row.
- **WP-443 ✅ (run persistence).** Migration `data/migrations/039_create_player_gauntlet_runs.sql`
  created `legendary.player_gauntlet_runs` (`id uuid`, `player_id bigint FK`,
  `set_abbr`, `mastermind_slug`, `division text CHECK IN ('fixed','open')`,
  `player_count smallint CHECK BETWEEN 1 AND 5`, `leg_picks jsonb DEFAULT '{}'`,
  `created_at`, `updated_at`, `first_completed_at` nullable) with the
  partial-unique active-run index `UNIQUE (player_id, set_abbr, mastermind_slug,
  division, player_count) WHERE first_completed_at IS NULL` and a `(player_id)`
  listing index. `apps/server/src/gauntlet/gauntletRun.types.ts` exists with the
  `GauntletRunRow`, `GauntletRunDivision`, `GauntletRunLegPicks` row-shape types.
  Source: WORK_INDEX WP-443 row; migration 039 header.
- **D-24262 ✅ (derived-progression lock).** No derived progression value
  (status, hero pool, budget headroom, champion, last-played) may be stored.
  This WP stores only identity + `leg_picks` + timestamps + the write-once
  `first_completed_at` audit stamp. Source: `docs/ai/DECISIONS.md` D-24262.
- **WP-301 ✅ (loadout library) — structural precedent.**
  `apps/server/src/profile/loadoutLibrary.{routes,logic,types}.ts` and its
  `server.mjs` wiring (`registerLoadoutLibraryRoutes(server.router, pool, {
  requireAuthenticatedSession, verifier, accountResolver })`) are the exact
  pattern this WP mirrors for auth, `player_id` scoping, `no-store`, and typed
  errors. Source: those files on `main`.
- **WP-112 ✅ (`requireAuthenticatedSession`)** and **WP-107 ✅
  (`requireUnsuspendedAccount`)** are available at
  `apps/server/src/auth/sessionToken.logic.js` and
  `apps/server/src/auth/requireUnsuspendedAccount.js`, wired in `server.mjs`.
- **The gauntlet catalog is already built at startup.** `server.mjs` builds
  `const gauntletCatalog = buildGauntletCatalog(...)` (an array of
  `GauntletDefinition`) around line 608; this WP derives a small
  gauntlet-existence resolver from it and injects it, mirroring the
  catalog-injection precedent (the logic layer never imports the registry
  directly).
- **Baseline:** `origin/main` @ `9c788d98` (`git rev-parse origin/main` at draft
  time). Ledger next-free confirmed WP-445 / EC-480 / D-24264.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` — §Layer Boundary (Authoritative): `apps/server`
  import rules (may import `registry`, `pg`, Node built-ins; not `preplan` /
  `boardgame.io` beyond the existing surface) and §Persistence Boundary
  (`legendary.*` domain storage; `G`/`ctx` runtime-only; the `bgio` blob is
  untouched — no carve-out).
- `.claude/rules/architecture.md` — Import Rules quick-reference row for
  `apps/server`; Persistence Boundary (Cross-Layer).
- `.claude/skills/legendary-server/SKILL.md` — server is a wiring layer; no
  gameplay logic; the run API is account-local domain CRUD, not gameplay.
- `.claude/skills/legendary-persistence/SKILL.md` — the run table is ordinary
  Class-2/domain storage (the `player_loadouts` precedent), NOT runtime `G`/`ctx`
  and NOT a snapshot/save-game.
- `docs/ai/REFERENCE/00.2-data-requirements.md` — §8.1 Match Configuration
  canonical field names (`schemeId`, `mastermindId`, `heroDeckIds`, …); this WP
  uses `heroDeckIds` inside `leg_picks` and the identity fields `setAbbr`,
  `mastermindSlug`, `division`, `playerCount` verbatim from the WP-440 pack /
  WP-443 row shape.
- `docs/ai/REFERENCE/api-endpoints.md` — §21 catalog obligation (D-11804);
  Status + Auth closed sets; the loadout-library rows are the row-shape template.
- `docs/ai/DECISIONS.md` — D-24260 (identity-only pack), D-24262
  (derived-progression lock), D-24086 (loadout-library data model precedent),
  D-9905 (Auth closed set), D-11504 (Cache-Control first-statement), D-11804
  (API-catalog replace-whole-row).
- Source to mirror: `apps/server/src/profile/loadoutLibrary.routes.ts`,
  `loadoutLibrary.logic.ts`, `loadoutLibrary.types.ts`.
- Source to reuse: `apps/server/src/gauntlet/gauntletRun.types.ts` (WP-443
  row-shape), `packages/registry/src/gauntletPack.ts` (WP-440),
  `packages/registry/src/gauntletLoadouts.ts` (`getGauntletLoadoutMenu`).

---

## Scope (In)

- **`POST /api/me/gauntlet-runs`** — `requireAuthenticatedSession` then
  `requireUnsuspendedAccount`; parse the request body as an untrusted WP-440
  identity pack and validate it with `validateGauntletPack` (a thrown
  validation error is caught and mapped to `400 { error: 'invalid_pack' }`);
  confirm the `(setAbbr, mastermindSlug)` names a real gauntlet with an approved
  loadout menu for the pack's `(division, playerCount)` via the injected
  resolver (→ `422 { error: 'unknown_gauntlet' }` when absent — a friendly typed
  error, not a crash); then **idempotent insert**: attempt `INSERT` of an active
  run with `leg_picks = '{}'`; on the partial-unique active-run conflict, `SELECT`
  and return the existing active run with status `200` instead of failing.
  A brand-new insert returns `201`. Response body: the `GauntletRunView`
  (identity + `legPicks` + timestamps + `firstCompletedAt`).
- **`GET /api/me/gauntlet-runs`** — list the caller's runs (active + completed),
  each as the **raw stored** `GauntletRunView` (identity + `legPicks` +
  timestamps + `firstCompletedAt`). **No derived projection** — status, pool,
  headroom, per-leg cleared, last-played are the WP-446 follow-on. Ordering:
  active runs first (`first_completed_at IS NULL` DESC), then `updated_at DESC,
  id ASC`.
- **`PATCH /api/me/gauntlet-runs/:id`** — edit `leg_picks`. Body carries a
  `legPicks` object (`Record<schemeSlug, heroDeckIds[]>`); it is validated
  structurally (an object of string → string[]; malformed → `400 {
  error: 'invalid_leg_picks' }`); the row is scoped by the resolved `player_id`
  (malformed / cross-account / missing `:id` → `404 { error: 'not_found' }`, no
  existence leak); `updated_at` advances; returns the updated `GauntletRunView`.
- **`DELETE /api/me/gauntlet-runs/:id`** — delete one of the caller's runs by
  id (player_id-scoped; malformed / cross-account / missing → `404`); `204` on
  success.
- **New files** `apps/server/src/gauntlet/gauntletRun.routes.ts` (route adapter:
  auth, body-parse, status mapping — no SQL) and
  `apps/server/src/gauntlet/gauntletRun.logic.ts` (validation + the injected
  gauntlet-existence resolver call + all SQL + idempotent-conflict handling).
- **Extend** `apps/server/src/gauntlet/gauntletRun.types.ts` **additively** with
  the API contract types (`GauntletRunView` wire shape, `GauntletRunErrorCode`
  closed union + its canonical array, `GauntletRunResult<T>`,
  `ImportGauntletRunInput`, `UpdateGauntletRunPatch`,
  `GauntletRunRouteDependencies`, and the injected `GauntletExistenceResolver`
  type). The row-shape types (`GauntletRunRow`, `GauntletRunDivision`,
  `GauntletRunLegPicks`) are reused unchanged. This extension is authorized by
  D-24264 (the run-API contract lock) and was anticipated by the WP-443
  docstring ("for the WP-5 import + run API to consume").
- **Wire** `registerGauntletRunRoutes(server.router, pool, { requireAuthenticatedSession,
  requireUnsuspendedAccount, verifier, accountResolver, resolveGauntletExistence })`
  into `apps/server/src/server.mjs` (runtime-wiring — 01.5 allowance), building
  `resolveGauntletExistence` from the already-built `gauntletCatalog`.
- **Update** `docs/ai/REFERENCE/api-endpoints.md` with the four new endpoint rows
  (D-11804 §21).
- **DB-gated tests** in `apps/server/src/gauntlet/gauntletRun.logic.test.ts`
  (loud-skip when `TEST_DATABASE_URL` is unset).

## Out of Scope

- **The DERIVED-progression read (WP-446 follow-on).** The 5-state `status`
  (needs-heroes / ready / playing / all-legs-cleared / champion), derived hero
  pool, budget headroom (`heroCount + 2`), per-leg cleared flags, and the
  last-played leg — computed from `leg_picks` + `legendary.competitive_scores`
  via `gauntletTruth.logic.ts` — are NOT in this WP. WP-445's `GET` returns the
  raw stored run only. This is the deliberate split (see §Context split note).
- **Launching a leg / composition → match.** The lobby-extraction
  `useCreateMatchFromComposition` primitive and any match launch are later WPs
  (plan #6/#7). No match-create, no lobby change here.
- **The profile tracker UI.** `MyProfilePage.vue`, the import file-picker, the
  arena-client `gauntletRunApi.ts` are the WP-7 client WP — no `apps/*` client
  change here.
- **Any `leg_picks` gameplay validation** (that a leg's heroDeckIds are valid
  registry ext_ids, or match `heroCount`). The run workspace stores the player's
  picks as authored; leg-playability + budget are derived (WP-446) and enforced
  at launch (later WP), never at PATCH time. PATCH validates only the structural
  shape (object of string → string[]).
- **No migration, no schema change.** Migration 039 already exists (WP-443).
- **No `first_completed_at` write.** It is set the first time a read derives
  `champion` — that read is WP-446. WP-445 never writes `first_completed_at`
  (every run it creates is active).
- **No `bgio`-blob read, no persistence carve-out, no snapshot change.**

---

## Files Expected to Change

- `apps/server/src/gauntlet/gauntletRun.routes.ts` — **new** — the four
  `/api/me/gauntlet-runs*` route handlers (auth → body-parse → delegate →
  status-map), mirroring `loadoutLibrary.routes.ts`; local `KoaRouter` /
  `KoaGauntletRunContext` structural interfaces; a `statusForGauntletRunErrorCode`
  map.
- `apps/server/src/gauntlet/gauntletRun.logic.ts` — **new** — `importGauntletRun`
  (validate pack, resolve existence, idempotent insert-or-attach), `listGauntletRuns`,
  `updateGauntletRunLegPicks`, `deleteGauntletRun`; `loadPlayerIdByAccountId`
  (mirrors the loadout precedent), the `UUID_PATTERN` guard, row→view mapper.
- `apps/server/src/gauntlet/gauntletRun.types.ts` — **modified** — additive API
  contract types (see §Scope In); row-shape types unchanged.
- `apps/server/src/gauntlet/gauntletRun.logic.test.ts` — **new** — DB-gated
  (loud-skip without `TEST_DATABASE_URL`): import creates one row with empty
  `leg_picks`; re-import same identity attaches (still one row, 200); import a
  bogus pack → `invalid_pack`; import an unknown gauntlet → `unknown_gauntlet`;
  PATCH updates `leg_picks` + advances `updated_at`; DELETE removes; cross-account
  `:id` → `not_found`; malformed `:id` → `not_found`; the `GauntletRunErrorCode`
  drift assertion (union ↔ canonical array).
- `apps/server/src/server.mjs` — **modified** — import
  `registerGauntletRunRoutes`, build `resolveGauntletExistence` from
  `gauntletCatalog`, and register the routes alongside
  `registerLoadoutLibraryRoutes` (01.5 runtime-wiring allowance).
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — four new `Wired` rows
  under Server-Registered Routes (D-11804 §21).

---

## Contract

- **Endpoints (all `Auth = authenticated-session-required`, `Cache-Control:
  no-store`):**
  - `POST /api/me/gauntlet-runs` → `201 GauntletRunView` (new) / `200
    GauntletRunView` (idempotent attach to existing active run); `400
    invalid_pack`; `422 unknown_gauntlet`; `401 unauthorized`; `403
    account_suspended`; `500 internal_error`.
  - `GET /api/me/gauntlet-runs` → `200 { runs: GauntletRunView[] }`; `401`;
    `500`.
  - `PATCH /api/me/gauntlet-runs/:id` → `200 GauntletRunView`; `400
    invalid_leg_picks`; `404 not_found`; `401`; `500`.
  - `DELETE /api/me/gauntlet-runs/:id` → `204`; `404 not_found`; `401`; `500`.
- **`GauntletRunView` wire shape (camelCase):** `{ id, setAbbr, mastermindSlug,
  division, playerCount, legPicks, createdAt, updatedAt, firstCompletedAt }`.
  `player_id` / account id are server-internal and NEVER on the wire.
- **`GauntletRunErrorCode` closed union:** `unauthorized | account_suspended |
  invalid_pack | unknown_gauntlet | invalid_leg_picks | not_found` (+ its
  canonical readonly array, drift-asserted).
- **Idempotency (D-24264):** the partial-unique active-run conflict is CAUGHT
  and resolved to a returned existing active run (200), never a 409/500. A fresh
  POST after `first_completed_at` is set creates a new active run.
- **Derived-nothing (D-24262):** the row stores identity + `leg_picks` +
  timestamps only; the raw GET returns exactly those. No status/pool/headroom/
  champion/last-played is stored or returned by this WP.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Provide **full file contents** for every new or modified file. Diffs,
  snippets, or "show only the changed section" output are forbidden.
- ESM only; Node v22+; `node:`-prefixed built-in imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (explicit control
  flow; no `.reduce()` with branching; full-word names; boolean names
  `is/has/can`; every function has JSDoc; error messages are full sentences;
  no `import *` / barrel re-exports).

**Packet-specific:**
- Server layer only. May import `@legendary-arena/registry` (for
  `validateGauntletPack`), `pg` (via the injected `DatabaseClient` alias), and
  Node built-ins. MUST NOT import `game-engine`, `preplan`, `boardgame.io`, or
  any `apps/*` package beyond the existing server surface. `gauntletRun.logic.ts`
  reaches gauntlet existence through the INJECTED resolver, not a direct
  registry catalog build.
- Persistence: `legendary.player_gauntlet_runs` is ordinary domain storage (the
  `player_loadouts` precedent). No `G`/`ctx` read or write, no `bgio`-blob read,
  no snapshot, no carve-out.
- No derived progression value is stored or returned (D-24262).
- Import is idempotent — the active-run partial-unique conflict returns the
  existing run, never a 500 (D-24264).
- `requireAuthenticatedSession` then `requireUnsuspendedAccount` are the first
  business steps on every handler; `Cache-Control: no-store` is the first
  statement of every handler body (D-11504); all queries are scoped by the
  resolved `player_id` (cross-account → `not_found`, no existence leak).
- Never `Math.random()` (no RNG in this WP); no `boardgame.io/testing` in tests;
  `node:test` + `node:assert` only; tests loud-skip without `TEST_DATABASE_URL`.
- No new npm dependency. No `axios`/`node-fetch` (built-in `fetch` if ever
  needed); `pg` only; no ORM.

**Session protocol:** if any locked value, field name, or contract detail is
unclear, STOP and ask — do not guess or invent. If the EC and this WP conflict,
this WP wins; if this WP and ARCHITECTURE.md conflict, ARCHITECTURE.md wins.

**Locked contract values:** the endpoint paths, the `GauntletRunErrorCode` union,
the `GauntletRunView` field set, the idempotency semantics, and the
`Auth = authenticated-session-required` posture above are locked — see the EC
`## Locked Values`.

---

## Vision Alignment

**Vision clauses touched:** §3 (player identity / accounts — the run is
account-local, `player_id`-scoped), §11 (ownership / visibility — a run is
private to its owner, never cross-account readable), §19b (account-local saved
content — the run workspace joins saved loadouts as decorative, account-local
state), §20–26 (leaderboard-adjacent — the run consumes competitive-score data
only in the WP-446 derived read, not here), NG-1 (no pay-to-win).

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
The run workspace stores no scoring, no derived progression, and confers no
in-game advantage; it is account-local input the player authors. The server
remains the sole authority; the pack is import-only.

**Non-Goal proximity check:** none of NG-1..7 are crossed. The run workspace is
free account-local state; it gates no gameplay power and carries no monetization
surface.

**Determinism preservation:** N/A for gameplay determinism — this WP touches no
`G`/`ctx`, no RNG, no replay, no simulation. The import path is deterministic
(same pack + same registry → same resolution) but sits entirely outside the
engine's determinism boundary.

---

## Acceptance Criteria

1. `POST /api/me/gauntlet-runs` with a valid `core/magneto` `fixed`/`p1` pack by
   a fresh authenticated account creates exactly one `player_gauntlet_runs` row
   with `leg_picks = {}` and returns `201` with a `GauntletRunView` whose
   identity fields match the pack.
2. A second `POST` of the same identity while the run is active returns `200`
   with the SAME run id (no second row inserted) — the partial-unique conflict
   is caught, not surfaced as 409/500.
3. `POST` with a body that fails `validateGauntletPack` returns `400 { error:
   'invalid_pack' }` and inserts nothing.
4. `POST` naming a `(setAbbr, mastermindSlug, division, playerCount)` with no
   approved gauntlet menu returns `422 { error: 'unknown_gauntlet' }` and inserts
   nothing.
5. `GET /api/me/gauntlet-runs` returns `{ runs: [...] }` of the caller's runs
   only, each a raw `GauntletRunView` (no `status`/`pool`/`headroom`/`cleared`/
   `lastPlayed` key present).
6. `PATCH /api/me/gauntlet-runs/:id` with a valid `legPicks` object updates the
   row's `leg_picks`, advances `updated_at`, and returns the updated view; a
   malformed `legPicks` returns `400 { error: 'invalid_leg_picks' }`.
7. `DELETE /api/me/gauntlet-runs/:id` removes the caller's row and returns `204`.
8. A `PATCH` or `DELETE` of another account's run id (or a malformed / missing
   id) returns `404 { error: 'not_found' }` with no existence leak, and mutates
   nothing.
9. Every handler sets `Cache-Control: no-store`; every `/api/me/gauntlet-runs*`
   handler requires a validated session (`401 { error: 'unauthorized' }` without
   one) and an unsuspended account.
10. `gauntletRun.logic.ts` imports nothing from `game-engine` / `preplan` /
    `boardgame.io` / any `apps/*` package; the only cross-package import is
    `@legendary-arena/registry` (`validateGauntletPack`). Gauntlet existence is
    reached through the injected resolver.
11. `docs/ai/REFERENCE/api-endpoints.md` carries four new `Wired` rows (Status +
    Auth from the closed sets; `Auth = authenticated-session-required`) with
    canonical field names.
12. `GauntletRunErrorCode` union and its canonical array are drift-asserted; a
    synthetic phantom code fails the guard.

---

## Verification Steps

- `pnpm -r build` — exits 0 (server build type-checks the new modules).
- `pnpm --filter @legendary-arena/server test` — exits 0; the new
  `gauntletRun.logic.test.ts` registers and passes (or loud-skips its DB cases
  with a visible skip when `TEST_DATABASE_URL` is unset — never a silent pass).
- With `TEST_DATABASE_URL` set and migrations applied (`node scripts/migrate.mjs`
  or the repo's psql-migrations path per `project_db_backed_server_tests_local`):
  `pnpm --filter @legendary-arena/server test` exercises the DB-gated cases —
  import-creates-one, re-import-attaches, invalid-pack, unknown-gauntlet,
  PATCH-updates, DELETE-removes, cross-account-404.
- Layer-boundary grep (expected: zero matches):
  `rg -n "game-engine|preplan|boardgame\.io|apps/(arena-client|registry-viewer|legends-board)" apps/server/src/gauntlet/gauntletRun.logic.ts`
  — the logic layer stays engine/preplan/client-free (the `@legendary-arena/registry`
  import is the only permitted cross-package edge).
- `pnpm -r --no-bail test` — repo-wide totals unchanged except the added
  server tests.
- API-catalog spot check: `rg -n "gauntlet-runs" docs/ai/REFERENCE/api-endpoints.md`
  returns the four new rows, each `Wired` + `authenticated-session-required`.

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/server test`
      exits 0 (server build IS the typecheck — no separate `typecheck` line for a
      server package).
- [ ] The four endpoints are registered in `server.mjs` and reachable through the
      framework router.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` updated in the same commit with the
      four new rows (D-11804 §21 replace-whole-row semantics; closed Status +
      Auth sets).
- [ ] `docs/ai/STATUS.md` updated — states "No user-observable change —
      infrastructure only" (the surface is `none — infrastructure`; the payoff is
      the WP-446 derived read + WP-7 tracker consuming these endpoints).
- [ ] `docs/ai/DECISIONS.md` — D-24264 flipped Drafted → Active (the
      import-idempotency + run-API-shape lock).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — the WP-445 node glyph moved `📝` → `✅`,
      then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified (the
      `server.mjs` wiring is the sole 01.5 runtime-wiring exception, declared in
      the EC).

---

## Lint Gate Self-Review

All 21 sections of `00.3-prompt-lint-checklist.md` resolved against this WP:

- **§1 Structure** — PASS. All required sections present and non-empty: Goal,
  Assumes, Context (Read First), Scope (In), Out of Scope, Files Expected to
  Change, Non-Negotiable Constraints, Acceptance Criteria, Verification Steps,
  Definition of Done. Out of Scope names >2 related-but-excluded items (derived
  read, match launch, tracker UI, leg-picks gameplay validation, migration).
- **§2 Constraints block** — PASS. Engine-wide constraints require full file
  contents, forbid diffs/snippets, state ESM/Node v22+, and reference
  `00.6-code-style.md`. Packet-specific + session protocol + locked values
  present.
- **§3 Assumes** — PASS. Every prior WP (440/442/443/301/112/107), the exact
  exports/shapes depended on, and external state (migration 039 applied, catalog
  built at startup) are listed; baseline SHA recorded.
- **§4 Context** — PASS. Specific docs + sections: ARCHITECTURE.md Layer
  Boundary + Persistence, both SKILL files, 00.2 §8.1 (data shapes),
  api-endpoints.md §21, DECISIONS by id. Data-shape WP → 00.2 cited.
- **§5 Files** — PASS. Six files, each new/modified with a one-line description;
  no ambiguous "update this section" language; ≤8 files (bounded — the derived
  read is split out).
- **§6 Naming** — PASS. `heroDeckIds`, `setAbbr`, `mastermindSlug`, `division`,
  `playerCount`, `player_id`, `leg_picks` match 00.2 / WP-440 / WP-443 verbatim;
  no abbreviations.
- **§7 Dependencies** — PASS. No new npm dependency; `pg` only, no ORM, no
  axios/node-fetch, no Jest/Vitest; explicitly stated.
- **§8 Boundaries** — PASS. Server-layer CRUD; no `G`/`ctx` in the DB; no
  gameplay logic; `pg` pool (not a single client) via the injected
  `DatabaseClient`; the registry import is the one permitted cross-package edge.
- **§9 Windows** — PASS (N/A specifics). No shell scripts introduced; DB test
  path uses the repo's documented `TEST_DATABASE_URL` flow. No Unix assumptions.
- **§10 Env vars** — PASS. `TEST_DATABASE_URL` (test-only, local `.env` /
  documented) is the sole variable; no new production env var, no secret in
  output.
- **§11 Auth** — PASS (applicable). One identity model: the WP-112
  `requireAuthenticatedSession` validated-session model (Option B family, server-
  generated `AccountId`), applied consistently; protected endpoints state the
  required credential; the WP names what it does NOT protect (leg-picks are not
  gameplay-validated) under Out of Scope.
- **§12 Tests** — PASS. `node:test` + `node:assert`; no `boardgame.io/testing`;
  DB-gated tests loud-skip without a DB; no network. (No deck/shuffle golden test
  — N/A: this WP has no deterministic deck construction.)
- **§13 Verification** — PASS. Exact `pnpm` commands with expected exit
  behavior; the loud-skip expectation is stated.
- **§14 Acceptance** — PASS. 12 binary, observable, specific items aligned to the
  deliverables; no vague items.
- **§15 Definition of Done** — PASS. Includes STATUS.md, DECISIONS.md,
  WORK_INDEX.md, the scope-boundary check, and the §15.1 user-visible surface
  handling (`none — infrastructure` → STATUS states "No user-observable change").
- **§16 Code Style** — PASS. No abstraction for <3 uses (each helper mirrors the
  loadout precedent's single-purpose functions); explicit control flow (no
  branching `.reduce()`, no nested ternaries); descriptive names; per-function
  JSDoc; full-sentence errors; named imports only.
- **§17 Vision Alignment** — PASS. `## Vision Alignment` present with clause
  numbers (§3, §11, §19b, §20–26, NG-1), No-conflict assertion, NG proximity
  check, determinism line (N/A-gameplay, justified).
- **§18 Prose-vs-grep** — PASS. The one grep Verification Step targets
  `game-engine|preplan|boardgame.io|apps/*` in `gauntletRun.logic.ts`; this WP's
  prose discusses those tokens but the grep is scoped to that source file, not
  this markdown — no false-positive risk. The EC will keep the policed literals
  out of the logic file's own prose.
- **§19 Bridge staleness** — N/A. This WP is not a repo-state-summarizing
  artifact; baseline SHA is cited as a fixed fact, reconciled at commit.
- **§20 Funding Surface Gate** — N/A. No funding affordance, no donate/support
  copy, no tournament-funding channel; this is an account-local run-CRUD API with
  no user-visible funding surface.
- **§21 API Catalog** — APPLIES (not N/A). This WP adds four `apps/server`
  HTTP endpoints; `docs/ai/REFERENCE/api-endpoints.md` gains four `Wired` rows in
  the same execution commit, Status + Auth from the closed sets
  (`authenticated-session-required`), canonical field names, `Authorizing WP =
  WP-445`, replace-whole-row semantics. Listed in Files Expected to Change and
  the DoD.

**Verdict: LINT PASS** — all 21 sections resolved (N/A justified for §19, §20;
§9/§10/§12-golden are N/A-in-part with reasons).

---

## Pre-Flight (01.4) — Verdict: READY TO EXECUTE

- **Authority chain read** — CLAUDE.md, ARCHITECTURE.md (Layer Boundary +
  Persistence), `.claude/rules/architecture.md`, both SKILL files, WP-440/442/443
  rows on `main`. Baseline `origin/main` @ `9c788d98`.
- **Dependencies complete** — WP-440 ✅, WP-442 ✅, WP-443 ✅ (all `[x]` Done on
  `main`; migration 039 + `gauntletRun.types.ts` present). No blocking dep.
- **Contracts on `main`** — `validateGauntletPack` / `GauntletPack` (registry
  `./gauntletPack`), `getGauntletLoadoutMenu` (registry `./gauntletLoadouts`),
  `GauntletRunRow` (server `gauntletRun.types.ts`), the loadout-library
  auth/deps pattern, and the `gauntletCatalog` build in `server.mjs` all verified
  present on the drafting baseline.
- **Structural readiness** — the wire types + error union + result union +
  route-deps + resolver type are additive to an existing types file; the SQL
  targets an existing table with an existing partial-unique index; the idempotent
  insert-or-attach has a concrete conflict-catch path.
- **Runtime readiness** — no `G`/`ctx`, no RNG, no framework move; the pool is
  the existing single `pg.Pool`; the resolver is injected from the already-built
  catalog (no new registry edge in the logic layer).
- **Scope lock** — the six-file allowlist is enumerated and matches §Files; the
  `server.mjs` wiring is the sole 01.5 exception, declared.
- **PS/RS items:** none blocking. RS-1 (resolved): PATCH validates only the
  structural shape of `legPicks`, not gameplay validity — deliberate, per Out of
  Scope. RS-2 (resolved): `GET` returns the raw run only; the derived read is
  WP-446 — the split is the intended shape, not a gap.
- **Verdict: READY TO EXECUTE.**

---

## Copilot Check (01.7) — Verdict: PASS

Audited against the 30 failure modes; the load-bearing ones for this surface:

- **Boundaries (1.x)** — PASS. Server CRUD only; no gameplay logic; the logic
  layer reaches the registry only for `validateGauntletPack` and gauntlet
  existence via an injected resolver, mirroring the catalog-injection precedent.
- **Determinism (2.x)** — PASS (N/A-gameplay). No RNG/time/iteration-order
  dependence in gameplay; the import resolution is deterministic.
- **Persistence (5.x)** — PASS. Ordinary `legendary.*` domain storage; no
  `G`/`ctx`/`bgio`-blob touch; no derived state stored (D-24262); snapshots
  unaffected.
- **Type safety / contract (4.x)** — PASS. Closed `GauntletRunErrorCode` union +
  drift-asserted canonical array; `GauntletRunView` field set locked; no
  `any`/free-form status strings.
- **Scope governance (7.x)** — PASS. The `apps/server/src/gauntlet/` directory
  already exists (WP-443 created it); no new top-level directory. The derived
  read is split to WP-446 so the packet stays bounded (6 files). One scoped D-entry
  (D-24264) with a clear API-shape rationale.
- **Idempotency correctness** — PASS. The partial-unique active-run conflict is
  explicitly caught and resolved to a returned existing run — the WP names the
  200-vs-201 distinction and the post-completion new-run behavior.

**Verdict: PASS.** No RISK or BLOCK finding. The one thing worth Jeff's eye is
the split itself (raw GET now, derived read as WP-446) — surfaced in the report,
not a blocker.
