# WP-095 — Ranking Aggregation Data Model

**Status:** Draft — **BLOCKED** on WP-052 (Player Identity, Replay Ownership) until that packet is executed. Schema and contracts are locked here so execution can begin the moment WP-052 lands.
**Primary Layer:** Server (Persistence) — PostgreSQL schema + type contracts under `apps/server/src/ranking/`.
**Dependencies:**
- **Hard:** WP-052 (persistent player identity with `legendary.player_account(player_id UUID PK)`)
- **Hard:** WP-048 (engine-side `LeaderboardEntry`, `ScenarioKey`, `FinalScore` contracts)
- **Soft:** WP-054 (public leaderboard projection — consumed by aggregation engine in WP-096+, not by this packet)
- **Spec source:** `docs/ai/DESIGN-RANKING.md` §13 WP-1 ("Ranking aggregation data model — schema, types, validators; no scoring logic")

This WP is the first executable artifact of the ranking aggregation layer. It defines persistence contracts only — no scoring, no aggregation computation, no projection engine.

---

## Session Context

`docs/ai/DESIGN-RANKING.md` defines an asynchronous competitive-comparison surface (Vision §23(b), D-0005) that aggregates replay-verified scenario runs into Best-N seasonal rankings. The spec is complete; this packet makes it buildable by creating the persistence surface.

The ranking aggregation layer is **strictly downstream** of the engine and of WP-048's scenario scoring. It reads verified `LeaderboardEntry` records, computes aggregate projections, and writes append-only archive records. It never writes to `G`, never influences gameplay, and never recomputes `FinalScore` (per D-0005 and D-4806).

This packet is schema + Zod validators + invariant triggers. It deliberately contains **no aggregation logic** — Best-N computation, field-strength calculation, event floor-cap mapping, live projection queries, and season-reset workflow all belong to later WPs (WP-096 through WP-102 per `DESIGN-RANKING.md` §13).

The schema is designed so that illegal states are unrepresentable at the database level wherever feasible: UNIQUE constraints enforce "one scenario entry per (season, player, scenario)," CHECKs enforce FinalScore sign conventions and Best-N invariants, and triggers enforce season-param immutability, archive append-only semantics, and run-sourced best-only update rules. The aggregation engine (WP-096) inherits these guarantees and does not need to re-enforce them in application code.

---

## Goal

After this session:

- PostgreSQL schema `ranking` exists under `data/migrations/004_ranking_schema.sql`, creating nine tables (season, scenario, season_params, scenario_entry, field_strength_snapshot, season_aggregate_snapshot, event, event_result, archive_entry) and their supporting functions/triggers.
- `apps/server/src/ranking/ranking.types.ts` exports the TypeScript shapes that mirror the schema, with `FinalScore` typed as `number` with no sign restriction (negative = under PAR, per WP-048).
- `apps/server/src/ranking/ranking.validators.ts` exports Zod schemas matching the tables, for use by the aggregation engine (WP-096) when writing rows.
- Migration 004 is idempotent (`IF NOT EXISTS`, `DROP IF EXISTS trigger + CREATE`), runnable on a clean database or an existing one, and leaves the schema in a state ready to be read by WP-096.
- Two test files (`ranking.schema.test.ts`, `ranking.triggers.test.ts`) exercise every CHECK, UNIQUE constraint, and trigger with binary pass/fail assertions against a real PostgreSQL instance via `pg`.

No scoring logic, no aggregation computation, no API endpoints, no UI.

---

## Assumes

- **WP-052 complete.** `legendary.player_account(player_id UUID PRIMARY KEY)` exists with UUID v4 player IDs. If WP-052 lands under a different table or column name, this WP is **BLOCKED** pending rename alignment.
- **WP-048 complete.** `LeaderboardEntry` TypeScript type exists at `packages/game-engine/src/scoring/parScoring.types.ts` with the shape locked in WP-048 §A: `{ scenarioKey, teamKey, playerIdentifiers, scoreBreakdown, replayHash, createdAt, scoringConfigVersion }`. `ScenarioKey` format is `{schemeSlug}::{mastermindSlug}::{sorted-villainGroupSlugs-joined-by-+}`. `FinalScore` is a centesimal integer, sign convention: **negative = under PAR (better), zero = at PAR, positive = over PAR (worse)**.
- **Migration infrastructure exists.** `data/migrations/001_server_schema.sql`, `002_seed_rules.sql`, `003_game_sessions.sql` are in place. The server's migration runner applies numbered files in order inside a single transaction each.
- **`apps/server/` has `pg`, `zod`, and `node:test` available.** No new runtime dependencies introduced by this WP.
- **PostgreSQL 14+** for `BTREE (lower(...))` indexes if needed and for `generated always as identity` compatibility. If Render or the local dev environment runs < 14, this WP is BLOCKED.
- **`docs/ai/DESIGN-RANKING.md` is authoritative.** Every invariant encoded here traces back to a specific §N clause in that document.
- **`docs/01-VISION.md` §23(b), §24, §25, §26 and D-0005 are authoritative.** See Vision Alignment.
- **The `LeaderboardEntry` server-side persistence WP does NOT yet exist.** This packet references run-sourced scenario entries by `replayHash` (content-addressable, stable, appears on every `LeaderboardEntry`) rather than by FK to a `leaderboard_entry` table that does not yet exist. A future WP may add that table and tighten the reference into an FK; this packet is forward-compatible with that change.

If any assumption is false, this Work Packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Claude must read these before writing any code:

- `docs/ai/DESIGN-RANKING.md` — the full spec. Every invariant in this packet traces to a section there. Especially §2 (Terminology), §3 (Core Principles, including the litmus test), §6 (Scoring Framework — Best-N aggregation, replacement value constraints, field-strength snapshot rules), §7 (Event slot-consumption invariant), §8 (Anti-Farming), §10.2 (Archive immutability invariant), §13 (Decomposition — confirms this is WP-1, schema only).
- `docs/01-VISION.md` §23(b), §24, §25, §26 — competitive surfaces, replay integrity, skill over repetition, simulation-calibrated PAR.
- `docs/ai/DECISIONS.md`:
  - **D-0005** — Asynchronous PvP Comparison Authorized (authorizes this entire system; its How-to-Apply clause directly gates this WP)
  - **D-4803** — MVP PAR is team-aggregate (binds `playerIdentifiers` semantics)
  - **D-4804** — `deriveScoringInputs` end-of-match only (binds what runs can be qualifying)
  - **D-4805** — Scoring configs are self-contained (informs `scoringConfigVersion` column)
  - **D-4806** — `ScoreBreakdown` and `LeaderboardEntry` are JSON-roundtrip tested (informs how we reference leaderboard entries)
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) — ranking is Server/Persistence; must not import engine runtime, must not write to `G`.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §7 (MatchSetupConfig 9-field lock) — scenario identity fields (`schemeId`, `mastermindId`, `villainGroupIds`) are locked; ranking schema uses these names verbatim.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: no abbreviations, full-sentence error messages, `// why:` on non-obvious decisions.
- `data/migrations/003_game_sessions.sql` — reference for the trigger pattern used in this codebase (`CREATE OR REPLACE FUNCTION` + `DROP IF EXISTS trigger + CREATE TRIGGER`).
- `packages/game-engine/src/scoring/parScoring.types.ts` — read the locked `LeaderboardEntry` shape and `ScenarioKey` format.

---

## Non-Negotiable Constraints

### Engine-wide (always apply — do not remove)

- ESM only, Node v22+ — all TypeScript files use `import`/`export`, never `require()`.
- `node:` prefix on all Node.js built-in imports.
- Test files use `.test.ts` — never `.test.mjs`.
- Full file contents for every new or modified file — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- No `Math.random()` anywhere.
- No writes to engine state (`G`, `ctx`) from any file in this packet.

### Packet-specific

- **Schema-only.** No aggregation computation, no Best-N calculation, no field-strength formula, no event floor-cap mapping. Any such logic is a scope violation — it belongs in WP-096+. This packet defines the persistence surface those WPs will use.
- **FinalScore is not non-negative.** `CHECK (final_score >= 0)` is forbidden on any column holding a FinalScore value. Per WP-048 locked contract values, `FinalScore = RawScore - PAR`; beating par produces a negative value and is *better*. Any CHECK that rejects negatives is wrong. Columns may bound against `INTEGER` or `NUMERIC` range but not against zero.
- **All invariants from DESIGN-RANKING that can be DB-enforced must be.** Specifically:
  - Per-season immutability of `season_params.best_n` after the first `scenario_entry` or `season_aggregate_snapshot` exists (trigger-enforced). Source: DESIGN-RANKING §6.4.
  - Field strength writes only permitted when `season.status = 'archived'` (trigger-enforced). Source: DESIGN-RANKING §6.5.
  - Archive entries are insert-only; UPDATE and DELETE are trigger-rejected. Amendments create new rows with `amends_archive_entry_id` set. Source: DESIGN-RANKING §10.2.
  - Run-sourced `scenario_entry` may only improve (new `entry_score <= OLD.entry_score`) on UPDATE. Source: DESIGN-RANKING §6.3 ("best on scenario"). Trigger enforces regardless of source transition.
  - One scenario entry per `(season_id, player_id, scenario_key)` — UNIQUE constraint, enforcing §6.3 and the §7 slot-consumption invariant.
  - Major event declaration must precede first run seeding — `CHECK (first_run_seeded_at IS NULL OR declared_at < first_run_seeded_at)`. Source: DESIGN-RANKING §7.2.
  - `season.archived_at` present iff `status = 'archived'` — CHECK constraint.
- **Invariants that cannot be DB-enforced must be explicitly commented as application-layer responsibilities.** Specifically:
  - Replacement-value constraints (DESIGN-RANKING §6.4: strictly worse than typical entries, never zero/null-as-neutral, breadth always outranks non-breadth). These are compute-time invariants enforced by WP-096 and cannot be DB CHECKs because the "typical entries" distribution is a season-level aggregate.
  - Field-strength formula bounds (§6.5). Columns carry the multiplier; the formula lives in WP-096.
  - "Explicit prohibition" on sum/average/time-series aggregation (§6.4). This is a WP-intake rule, not a DB rule.
- **No event table may sit outside the Best-N substrate.** Per DESIGN-RANKING §7 slot-consumption invariant: event results produce `scenario_entry` rows with `source = 'event'`; there is no parallel "event points" table, no `event_points` column on any aggregate table. Any proposal to add one is a slot-consumption violation and must be rejected.
- **`FinalScore` is write-once.** On `scenario_entry`, both run-sourced `entry_score` updates (which may only decrease) and event-sourced rows (which may not UPDATE at all) are governed by the best-only trigger. No in-place mutation of historical FinalScore values per D-0005 and §26 (PAR versioning creates new versions, never mutates old ones).
- **Archive amendment chain.** `archive_entry.amends_archive_entry_id` is a self-referential nullable FK. Amendments may only target archive entries in the same `(season_id, category)` domain — trigger-enforced.
- **Idempotency.** Migration 004 must be re-runnable on a clean database AND on a database where migration 004 has already been applied, without error or data loss. Use `CREATE SCHEMA IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`. For triggers: `DROP TRIGGER IF EXISTS ...; CREATE TRIGGER ...` pattern (PostgreSQL has no `CREATE TRIGGER IF NOT EXISTS`). For functions: `CREATE OR REPLACE FUNCTION`.
- **No ORM.** Raw SQL only in the migration. Zod validators in the TS layer are for runtime shape validation, not for query generation.
- **No `.reduce()` with branching** in any TS file per 00.6 Rule 8. Not expected to apply here since this packet has no computation.
- **Tests use `node:test` + `node:assert` only.** No `boardgame.io`, no Jest, no Vitest. Tests require a running PostgreSQL instance (via `.env` `DATABASE_URL`) — this is the first WP in the codebase with DB-integration tests, so the harness must set up and tear down its own schema via `BEGIN ... ROLLBACK` per test.

### Session protocol

- If any contract, field name, or reference is unclear, stop and ask the human before proceeding — never guess or invent field names, type shapes, or file paths.
- If WP-052 has not executed and `legendary.player_account(player_id UUID)` does not exist, **stop immediately** and report BLOCKED; do not substitute a placeholder.
- If any DESIGN-RANKING invariant appears to conflict with a locked WP-048 contract value, the WP-048 contract wins (higher authority chain), and the conflict is logged to DECISIONS.md as a follow-up for DESIGN-RANKING revision.

### Locked contract values

- **Schema name:** `ranking` (lowercase, single-word namespace).
- **Scenario key format:** `{schemeSlug}::{mastermindSlug}::{sorted-villainGroupSlugs-joined-by-+}` — matches WP-048 exactly. No divergence permitted.
- **Player ID type:** `UUID`, referencing `legendary.player_account(player_id)`.
- **FinalScore storage type:** `INTEGER` (centesimal, per WP-048 — display divides by 100). `NUMERIC` is forbidden; integer arithmetic preserves determinism.
- **FinalScore sign convention:** lower-is-better; negatives are valid and represent better-than-PAR runs.
- **Season ID type:** `INTEGER` (calendar year, e.g., 2026).
- **Event ID type:** `TEXT` (opaque operator-assigned string; an operator-auth WP may tighten this later).
- **Archive entry identifier:** `BIGSERIAL` — append-only monotonic, never reused.
- **Canonical enum values** (use text columns + CHECK lists; no PostgreSQL `CREATE TYPE ENUM` — matches the existing pattern in `001_server_schema.sql` which uses text codes):
  - `scenario_entry.source`: `'run'` | `'event'`
  - `season.status`: `'open'` | `'archived'`
  - `event.tier`: `'standard'` | `'major'`
  - `event.status`: `'declared'` | `'active'` | `'completed'`
  - `event_result.finish`: `'champion'` | `'runner_up'` | `'semi_finalist'`
  - `archive_entry.category`: `'final_rank'` | `'player_of_year'` | `'event_result'` | `'major_title'` | `'milestone'`

---

## Scope (In)

### A) `data/migrations/004_ranking_schema.sql` — new

Single idempotent migration file creating the full ranking namespace:

- `CREATE SCHEMA IF NOT EXISTS ranking;`
- Nine tables with full columns, types, PRIMARY KEYs, FOREIGN KEYs, UNIQUE constraints, CHECK constraints (listed in §Locked contract values and §Packet-specific constraints).
- All nine tables have `IF NOT EXISTS` guards.
- Five helper functions (one per non-trivial trigger):
  - `ranking.enforce_scenario_entry_best_only()` — rejects `UPDATE` where `NEW.entry_score > OLD.entry_score` regardless of source transition. Error message: *"scenario_entry for season %, player %, scenario % cannot regress: old score %, new score %."*
  - `ranking.enforce_season_params_immutable()` — on UPDATE of `season_params.best_n`, rejects if any `scenario_entry` or `season_aggregate_snapshot` exists for that season. Error message identifies the blocking table and row count.
  - `ranking.enforce_field_strength_archived_only()` — on INSERT or UPDATE of `field_strength_snapshot`, rejects if the referenced `season.status <> 'archived'`. Error: *"field_strength_snapshot for season % cannot be written while season status is %; field strength is a season-archive-time computation only (DESIGN-RANKING §6.5)."*
  - `ranking.enforce_archive_insert_only()` — rejects `UPDATE` and `DELETE` on `archive_entry` unconditionally. Error: *"archive_entry % cannot be updated or deleted; corrections require a new amendment row with amends_archive_entry_id set (DESIGN-RANKING §10.2)."*
  - `ranking.enforce_amendment_same_domain()` — on INSERT of an `archive_entry` with `amends_archive_entry_id IS NOT NULL`, rejects if the target entry has a different `(season_id, category)` from NEW. Error names the divergent field.
- Five triggers wiring those functions (each uses the `DROP TRIGGER IF EXISTS ...; CREATE TRIGGER ...` pattern).
- Indexes:
  - `scenario_entry (season_id, player_id)`
  - `scenario_entry (season_id, scenario_key)`
  - `season_aggregate_snapshot (season_id, computed_at DESC)`
  - `season_aggregate_snapshot (season_id, player_id, computed_at DESC)`
  - `archive_entry (season_id, category)`
  - `event (season_id, tier)`
- Every non-obvious constraint carries a `COMMENT ON CONSTRAINT ... IS '...'` or inline `-- why:` comment tracing to a DESIGN-RANKING section number.

Full SQL is generated in the execution session; this WP locks the contract.

### B) `apps/server/src/ranking/ranking.types.ts` — new

TypeScript shapes mirroring the SQL tables, one named export per table. All fields use full English names per 00.6 Rule 4 (no abbreviations). Key exports:

- `SeasonId`, `PlayerId`, `ScenarioKey`, `EventId`, `ArchiveEntryId` — branded string/number aliases.
- `Season`, `Scenario`, `SeasonParams`, `ScenarioEntry`, `FieldStrengthSnapshot`, `SeasonAggregateSnapshot`, `Event`, `EventResult`, `ArchiveEntry` — `interface` per table.
- `ScenarioEntrySource`, `SeasonStatus`, `EventTier`, `EventStatus`, `EventFinish`, `ArchiveCategory` — union types matching the SQL enum value lists exactly.
- `SCENARIO_ENTRY_SOURCES`, `SEASON_STATUSES`, `EVENT_TIERS`, `EVENT_STATUSES`, `EVENT_FINISHES`, `ARCHIVE_CATEGORIES` — `readonly` arrays as drift-detection canonical lists (per 00.6 Drift Detection conventions in `.claude/rules/code-style.md`).
- `// why:` comment on `finalScore` fields: *"Negative values are valid and represent beat-PAR runs per WP-048 sign convention. Do not add non-negative CHECKs."*

### C) `apps/server/src/ranking/ranking.validators.ts` — new

Zod schemas mirroring §B, one named export per interface (e.g., `seasonSchema`, `scenarioEntrySchema`). Each schema:

- Uses `z.string().uuid()` for `PlayerId` columns.
- Uses `z.number().int()` for `INTEGER` columns.
- Uses `z.enum([...])` for canonical enum columns, with the literal values duplicated from §B's readonly arrays. Drift-detection test (§E) asserts the two stay aligned.
- Does NOT impose `.nonnegative()` on any `finalScore` or `entryScore` field.

Validators are for runtime shape-checking when the aggregation engine (WP-096) writes rows. This packet does not invoke them; it only exports them.

### D) `apps/server/src/ranking/ranking.types.test.ts` — new

Drift-detection tests (no DB required). Uses `node:test` + `node:assert`.

- For each canonical array (`SCENARIO_ENTRY_SOURCES`, etc.), assert it is readonly, has expected length, and contains expected values.
- For each array/union pair, assert that a `type` satisfies-check compiles (statically; tested via a type-level assertion pattern).
- Assert Zod schemas reject unknown enum values with descriptive error messages.
- Six drift-detection tests total (one per enum).

### E) `apps/server/src/ranking/ranking.schema.test.ts` — new

DB-integration tests for every CHECK, UNIQUE, and FK. Uses `node:test` + `node:assert` + `pg`. Requires `DATABASE_URL` env var via `node --env-file=.env`.

Each test follows the pattern: `BEGIN; ...test DDL/DML...; ROLLBACK;` so tests never persist state. Test runner seeds the prerequisite `legendary.player_account` row inside its own transaction.

Tests (minimum 12):

1. INSERT valid season → success
2. INSERT season with `starts_at >= ends_at` → rejected by CHECK
3. INSERT season with `status = 'archived'` and `archived_at IS NULL` → rejected
4. INSERT duplicate `(season_id, player_id, scenario_key)` in `scenario_entry` → rejected by UNIQUE
5. INSERT `scenario_entry` with `source = 'run'` and NULL `source_replay_hash` → rejected by CHECK
6. INSERT `scenario_entry` with `source = 'event'` and NULL `source_event_id` → rejected by CHECK
7. INSERT `scenario_entry` with `entry_score = -150` → **succeeds** (explicit negative-ok test per WP-048)
8. INSERT `scenario_entry` with a non-existent `player_id` → rejected by FK
9. INSERT `event` with `declared_at >= first_run_seeded_at` → rejected by CHECK
10. INSERT `event_result.finish` outside canonical list → rejected by CHECK
11. INSERT `archive_entry` with `amends_archive_entry_id` pointing to a non-existent row → rejected by FK
12. INSERT `season_aggregate_snapshot` with `counted_entries + replacement_slots <> best_n` → rejected by CHECK (explicit Best-N arithmetic invariant test)

### F) `apps/server/src/ranking/ranking.triggers.test.ts` — new

DB-integration tests for every trigger. Same harness as §E. Minimum 10 tests:

1. UPDATE `scenario_entry` (source=run) with `entry_score > OLD.entry_score` → rejected by best-only trigger
2. UPDATE `scenario_entry` (source=run) with `entry_score < OLD.entry_score` → succeeds
3. UPDATE `scenario_entry` transitioning source=run → source=event with worse `entry_score` → rejected by best-only trigger (explicit cross-source regression test)
4. UPDATE `season_params.best_n` before any `scenario_entry` exists → succeeds
5. UPDATE `season_params.best_n` after a `scenario_entry` exists for that season → rejected by immutability trigger
6. UPDATE `season_params.best_n` after a `season_aggregate_snapshot` exists → rejected
7. INSERT `field_strength_snapshot` when `season.status = 'open'` → rejected
8. INSERT `field_strength_snapshot` when `season.status = 'archived'` → succeeds
9. UPDATE any `archive_entry` row → rejected unconditionally
10. INSERT amendment `archive_entry` targeting a different `(season_id, category)` → rejected

---

## Out of Scope

- **No aggregation computation.** Best-N selection, replacement value computation, field-strength formula, event floor-cap resolution, season aggregate recomputation — all belong to WP-096.
- **No API endpoints.** REST or GraphQL surfaces for ranking queries are future work.
- **No UI.** Zero frontend changes.
- **No engine changes.** `packages/game-engine/` is not touched. WP-048 contract files are not modified.
- **No `LeaderboardEntry` server persistence table.** That is a separate WP (TBD). This packet references leaderboard entries by `replayHash` only; once a `legendary.leaderboard_entry` table exists, a follow-up migration can convert `scenario_entry.source_replay_hash` to an FK.
- **No authentication or operator-auth wiring.** `event.declared_by_operator` is an opaque TEXT column; operator-auth gating is a later WP.
- **No season reset or archive-write workflow.** Season end-of-life logic is WP-101.
- **No WORK_INDEX.md or STATUS.md changes beyond the standard WP check-off.** This packet does not reshape the work backlog.
- **No modification of `data/migrations/001_server_schema.sql`, `002_seed_rules.sql`, or `003_game_sessions.sql`.**
- **No modification of 00.2 data requirements.** Ranking field names are self-contained in this WP's locked contract values section; a future WP may promote them to 00.2 if they become shared surface.
- **No seeding of ranking data.** The migration creates empty tables. Initial season rows, default parameters, etc. belong to an operational bootstrap WP.
- **No `ranking.qualified_run_ref` materialized cache.** The reviewer's original draft included a `qualified_run_ref` table as a staged denormalization of `LeaderboardEntry`. Omitted here to reduce scope; the aggregation engine can JOIN directly against the leaderboard-entry table when it exists, or maintain its own materialized view at that time.
- Refactors, cleanups, or "while I'm here" improvements are **out of scope** unless explicitly listed in Scope (In).

---

## Files Expected to Change

- `data/migrations/004_ranking_schema.sql` — **new** — full ranking schema: 9 tables, 5 functions, 5 triggers, 6 indexes, constraint comments.
- `apps/server/src/ranking/ranking.types.ts` — **new** — TypeScript interfaces and canonical enum arrays.
- `apps/server/src/ranking/ranking.validators.ts` — **new** — Zod schemas matching table shapes.
- `apps/server/src/ranking/ranking.types.test.ts` — **new** — 6 drift-detection tests (no DB).
- `apps/server/src/ranking/ranking.schema.test.ts` — **new** — 12 DB-integration tests for CHECKs, UNIQUE, FK.
- `apps/server/src/ranking/ranking.triggers.test.ts` — **new** — 10 DB-integration tests for triggers.

**No other files may be modified.** Six files total, within the 00.3 §5 soft cap of ~8.

---

## Vision Alignment

**Vision clauses touched:** §23(b), §24, §25, §26, NG-1..7.

**Conflict assertion:** No conflict: this WP preserves all touched clauses.

- **§23(b)** — This WP is the persistence substrate for the async comparison surface that §23(b) authorizes. All rows are derived from independently played, replay-verified scenario runs; no shared-match data is stored.
- **§24** — `scenario_entry.source_replay_hash` preserves the replay-verification linkage. Entries without replay verification cannot be inserted (application-layer guard in WP-096 + documented constraint here).
- **§25** — Schema is structurally hostile to volume-based ranking: `UNIQUE (season_id, player_id, scenario_key)` on `scenario_entry` forces one-entry-per-scenario per season; there is no `runs_played_count` column or equivalent that could be used as a ranking input. The §6.4 explicit prohibition on sum/average aggregation is honored by the schema exposing only scenario-best entries to downstream aggregation.
- **§26** — PAR baselines are immutable inputs consumed by WP-048; this WP never writes to PAR and never recomputes FinalScore. `scoringConfigVersion` is recorded on rows that consume scored data (forthcoming in WP-096), preserving PAR version traceability.
- **NG-1..7** — No pay-to-win surface, no gacha, no energy system, no dark patterns. Ranking is purely competitive projection over verified runs. No monetization hooks in schema.

**Non-Goal proximity check:** This WP touches a competitive surface but does not cross NG-1..NG-7 — no columns support paid advantages, no fields gate content, no schema supports microtransaction-driven tiers.

**Determinism preservation:** The ranking aggregation layer consumes WP-048's deterministic `FinalScore` and never recomputes it. All invariants in this packet are deterministic: same inputs produce same accept/reject results from every CHECK and trigger. No ranking behavior depends on wallclock time except for audit timestamps, which are derived, not inputs.

**D-0005 alignment:** This schema embodies the §23(b) projection layer D-0005 authorizes. Every How-to-Apply clause from D-0005 is honored: async projection only (no runtime PvP hooks); projection over independent runs (scenario_entry keyed per scenario); raw volume-based scoring forbidden (no cumulative count columns); non-ranking telemetry carve-out respected (no telemetry stats in this schema — those belong to a player-profile WP).

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Migration structure

- [ ] `data/migrations/004_ranking_schema.sql` exists and is syntactically valid PostgreSQL.
- [ ] Migration is idempotent: running it twice on a clean DB produces no errors and identical schema state.
- [ ] Migration creates exactly nine tables under `ranking` schema, matching §Scope (In) §A.
- [ ] All nine tables use `CREATE TABLE IF NOT EXISTS`.
- [ ] All triggers use `DROP TRIGGER IF EXISTS ...; CREATE TRIGGER ...` pattern.
- [ ] All functions use `CREATE OR REPLACE FUNCTION`.

### FinalScore sign convention

- [ ] No `CHECK (... >= 0)` or `CHECK (... > 0)` exists on any column holding a FinalScore value (`scenario_entry.entry_score`, `season_aggregate_snapshot.aggregate_score`, and any future score column). Confirmed by grep on the SQL file.
- [ ] Test §E-7 (negative `entry_score` INSERT succeeds) passes.

### Invariant enforcement

- [ ] UNIQUE `(season_id, player_id, scenario_key)` exists on `scenario_entry`.
- [ ] CHECK `counted_entries + replacement_slots = best_n` exists on `season_aggregate_snapshot`.
- [ ] CHECK `starts_at < ends_at` exists on `season`.
- [ ] CHECK `(status = 'archived') = (archived_at IS NOT NULL)` exists on `season`.
- [ ] CHECK `declared_at < first_run_seeded_at` (when `first_run_seeded_at IS NOT NULL`) exists on `event`.
- [ ] Scenario-entry source discriminator CHECK: `(source = 'run') implies source_replay_hash IS NOT NULL`; `(source = 'event') implies source_event_id IS NOT NULL`.

### Trigger enforcement

- [ ] `enforce_scenario_entry_best_only` trigger rejects regressions regardless of source transition (test §F-1, §F-3 pass).
- [ ] `enforce_season_params_immutable` trigger rejects `best_n` UPDATE after first entry exists (test §F-5, §F-6 pass).
- [ ] `enforce_field_strength_archived_only` trigger rejects pre-archive writes (test §F-7 passes; §F-8 succeeds).
- [ ] `enforce_archive_insert_only` trigger rejects UPDATE and DELETE (test §F-9 passes).
- [ ] `enforce_amendment_same_domain` trigger rejects cross-domain amendments (test §F-10 passes).

### TypeScript + Zod alignment

- [ ] All six canonical readonly arrays exported from `ranking.types.ts`.
- [ ] Zod schemas in `ranking.validators.ts` do not impose non-negative constraints on any FinalScore field.
- [ ] Drift-detection test asserts each canonical array length matches its TypeScript union cardinality.
- [ ] No `import` from `boardgame.io` in any ranking file (confirmed by grep).
- [ ] No `import` from `@legendary-arena/game-engine` runtime (type-only imports are acceptable; grep confirms `import type` only).
- [ ] No `import` from `@legendary-arena/registry` (confirmed by grep).

### Tests

- [ ] `pnpm --filter @legendary-arena/server test` exits 0.
- [ ] All 6 drift-detection tests pass.
- [ ] All 12 schema tests pass.
- [ ] All 10 trigger tests pass.
- [ ] Every test uses `BEGIN; ...; ROLLBACK;` — no test persists DB state. Confirmed by grep for `COMMIT` absence in test files.
- [ ] No test imports `boardgame.io`.

### Scope enforcement

- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`).
- [ ] No changes to `packages/game-engine/**`.
- [ ] No changes to `data/migrations/001_*.sql`, `002_*.sql`, `003_*.sql`.
- [ ] No new npm dependencies (confirmed by `git diff apps/server/package.json` returning no meaningful change).

---

## Verification Steps

```pwsh
# Step 1 — confirm WP-052 prerequisite exists
# why: WP-095 is BLOCKED without legendary.player_account
psql $env:DATABASE_URL -c "SELECT 1 FROM information_schema.tables WHERE table_schema = 'legendary' AND table_name = 'player_account';"
# Expected: one row. If zero rows, STOP — WP-052 has not landed; WP-095 must not execute.

# Step 2 — run migration forward
node --env-file=.env apps/server/src/db/runMigrations.mjs
# Expected: migration 004 applied, exits 0. Re-running exits 0 with no effect.

# Step 3 — typecheck and build
pnpm --filter @legendary-arena/server typecheck
pnpm --filter @legendary-arena/server build
# Expected: exits 0, no TypeScript errors.

# Step 4 — run all ranking tests
pnpm --filter @legendary-arena/server test
# Expected: TAP output — 28 tests passing (6 drift + 12 schema + 10 triggers), 0 failing.

# Step 5 — verify no forbidden FinalScore CHECK
Select-String -Path "data\migrations\004_ranking_schema.sql" -Pattern "entry_score\s*>=\s*0|entry_score\s*>\s*0|aggregate_score\s*>=\s*0|aggregate_score\s*>\s*0"
# Expected: no output. Any match is an automatic FAIL — WP-048 FinalScore can be negative.

# Step 6 — verify no boardgame.io imports
Select-String -Path "apps\server\src\ranking" -Pattern "boardgame.io" -SimpleMatch -Recurse
# Expected: no output.

# Step 7 — verify no engine runtime imports
Select-String -Path "apps\server\src\ranking" -Pattern "@legendary-arena/game-engine" -SimpleMatch -Recurse | Where-Object { $_.Line -notmatch "import type" }
# Expected: no output. Type-only imports are permitted.

# Step 8 — verify scope adherence
git diff --name-only
# Expected: only the 6 files in ## Files Expected to Change.

# Step 9 — verify migration idempotency
node --env-file=.env apps/server/src/db/runMigrations.mjs
node --env-file=.env apps/server/src/db/runMigrations.mjs
# Expected: both invocations exit 0. No errors on the second run.

# Step 10 — verify FinalScore negative-OK by direct SQL
psql $env:DATABASE_URL -c "BEGIN; INSERT INTO ranking.season (season_id, starts_at, ends_at) VALUES (9999, '2099-01-01', '2099-12-31'); INSERT INTO ranking.scenario (scenario_key, scheme_id, mastermind_id, villain_group_ids) VALUES ('test::test::test', 'test', 'test', ARRAY['test']); INSERT INTO legendary.player_account (player_id) VALUES ('00000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING; INSERT INTO ranking.scenario_entry (season_id, player_id, scenario_key, source, entry_score, source_replay_hash) VALUES (9999, '00000000-0000-0000-0000-000000000001', 'test::test::test', 'run', -150, 'hash_test'); ROLLBACK;"
# Expected: all INSERTs succeed; ROLLBACK undoes them. Confirms negative entry_score is accepted.
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps` before checking any item below. Reading the code is not sufficient — run the commands.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass.
- [ ] `pnpm --filter @legendary-arena/server typecheck` exits 0.
- [ ] `pnpm --filter @legendary-arena/server build` exits 0.
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (28 ranking tests).
- [ ] Migration 004 is idempotent (re-run produces no errors).
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — "Ranking aggregation schema exists under `ranking` namespace; no aggregation engine yet (WP-096)."
- [ ] `docs/ai/DECISIONS.md` updated with at minimum:
  - Why `legendary.player_account(player_id)` is the FK target pending WP-052.
  - Why `scenario_entry.source_replay_hash` is a TEXT column instead of an FK to a leaderboard-entry table (forward-compat with future persistence WP).
  - Why no PostgreSQL `CREATE TYPE ENUM` — text columns with CHECK lists match the existing `001_server_schema.sql` pattern.
  - Why no `qualified_run_ref` staging table (reduced scope; aggregation engine can JOIN directly when leaderboard-entry table exists).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-095 checked off with today's date.
- [ ] No new DECISIONS.md entry conflicts with D-0005, D-4803, D-4804, D-4805, or D-4806.

---

## Amendments

*(None yet. Pre-flight review may add A-095-01 before execution.)*
