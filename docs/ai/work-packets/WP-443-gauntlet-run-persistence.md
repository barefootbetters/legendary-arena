# WP-443 — Gauntlet Run Persistence (`player_gauntlet_runs`) (server / migration)

**User-Visible Surface:** `none — infrastructure`. This WP adds one PostgreSQL
table (`legendary.player_gauntlet_runs`) via a new migration, an optional minimal
row-shape types module, and a DB-gated migration test. No endpoint, no client, no
read logic — a player observes nothing until WP-5 (import + run API) consumes this
storage. **D-24026 inverted** — STATUS states "No user-observable change —
infrastructure only." The payoff is structural: it is the account-local **run
workspace** storage the whole Mastermind Gauntlets epic builds on — identity +
per-leg hero picks + audit timestamps, **nothing derived**.

## Goal

After this session, `data/migrations/039_create_player_gauntlet_runs.sql` creates a
single new table `legendary.player_gauntlet_runs` in the `legendary.*` domain
schema: the minimal, maximally-derived storage for a player's gauntlet **run
workspace**. Each row carries the run's **identity** (`player_id` FK, `set_abbr`,
`mastermind_slug`, `division`, `player_count`), the player's **per-leg hero picks**
(one `leg_picks jsonb` column mapping `schemeSlug → heroDeckIds[]`), and **audit
timestamps** (`created_at`, `updated_at`, and the write-once `first_completed_at`).
It stores **no** derived state: **no `status` column, no `hero_pool` column, no child
table, no history/flag table** — status, pool, budget headroom, fixed-pool validity,
champion, and "where you left off" are all computed at read time (WP-5) from
`leg_picks` + `legendary.competitive_scores`, never persisted. A **partial-unique
active-run index** on `(player_id, set_abbr, mastermind_slug, division, player_count)
WHERE first_completed_at IS NULL` enforces at-most-one active run per identity while
letting a completed run free the slot; a plain `(player_id)` index serves the listing
read. An optional minimal `apps/server/src/gauntlet/gauntletRun.types.ts` describes
the row shape for WP-5 (a plain types file, **not** a repository/query module). A
**DB-gated** `gauntletRun.migration.test.ts` applies the migration and asserts the
table/columns exist, the partial-unique index blocks a second active run of the same
identity **but allows one once the first has `first_completed_at` set**, the
`division` and `player_count` CHECKs reject bad input, and `ON DELETE CASCADE` removes
a player's runs. This is WP #4 of the Mastermind Gauntlets: download → import → build
→ track epic — the run workspace lands **before** the import + run API (WP-5) so the
storage shape exists before any endpoint freezes.

## Assumes

- **On `origin/main` @ `61bef39a`** (the drafting baseline; `git rev-parse
  origin/main` at draft time). `apps/server` builds and its DB-gated tests pass green
  against a migrated `TEST_DATABASE_URL` on this SHA.
- **WP-442 ✅ shipped** (`origin/main` @ `61bef39a`, EC-477 impl `5e616a7a`):
  `apps/server/src/legends/gauntletTruth.logic.ts` owns the shared leg-clear predicate
  + `findBestPoolAssignment` that WP-5's per-run read will consume. This WP stores the
  run workspace those derived reads operate over; it does not consume the helper
  itself (that is WP-5). (Source: WORK_INDEX WP-442 row; the file on `main`.)
- **WP-440 ✅ / WP-441 ✅ shipped** (the pack contract + legends download). The pack is
  the identity-only import token whose fields (`setAbbr`, `mastermindSlug`,
  `division`, `playerCount`) become the run's identity columns here; WP-5 validates a
  pack and inserts the run row. This WP is **parallel-safe** with WP-440/WP-441 (it
  touches neither the registry pack contract nor the legends client). (Source:
  WORK_INDEX WP-440 / WP-441 rows; D-24260.)
- `legendary.players(player_id)` is a `bigint` primary key that existing tables FK
  with `ON DELETE CASCADE` (migrations 009, 011, 022). The new table mirrors that FK
  posture verbatim. (Source: `data/migrations/009` / `011` / `022`.)
- `data/migrations/` is applied sequentially by an idempotent runner
  (`scripts/migrate.mjs`); every `CREATE TABLE` / `CREATE INDEX` uses `IF NOT EXISTS`
  so re-running against an already-seeded database succeeds (migration-009 / 022 / 033
  precedent). The next free migration number is **039** (`038` is
  `add_driver_owner_to_match_bot_ally`, already on `main`). (Source: `ls
  data/migrations/*.sql` on `main`; `033_create_match_bot_ally.sql` idempotency note.)
- `gen_random_uuid()` is available as the uuid-PK default (migrations 017, 022 use
  it). (Source: `data/migrations/017` / `022`.)
- The DB-gated server-test harness is the locked `TEST_DATABASE_URL` +
  options-based-non-silent-skip pattern (`friendships.logic.test.ts` /
  `ownerProfile.logic.test.ts`): pure assertions always run; DB assertions skip loudly
  when `TEST_DATABASE_URL` is unset, and the local harness applies migrations via
  `psql` before the run. (Source: `apps/server/src/friendships/friendships.logic.test.ts`.)

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the **Server layer**
  and its Import Rules row (`apps/server` may import `pg` + registry + Node built-ins).
  This WP's storage is legitimate **server-layer domain storage** in the `legendary.*`
  schema — the account-local run workspace, written and read only by the server.
- `.claude/rules/architecture.md §Persistence Boundary (Cross-Layer)` — the boundary
  this WP explicitly respects. `G` / `ctx` are **runtime-only** and are **untouched**:
  this table is **not** a snapshot, **not** a save-game, and **not** boardgame.io
  match state (the `bgio` schema). It is account-local **configuration/workspace**
  state — "player-authored inputs" analogous to `legendary.player_loadouts` (WP-301) —
  stored server-side, never derived from or written back into gameplay `G`. Snapshots
  remain counts-only; this WP adds no snapshot surface.
- `.claude/skills/legendary-persistence/SKILL.md` — the Three Data Classes. This
  table is **Configuration/workspace** (deterministic account-local input the player
  authors), **not** Runtime (`G`/`ctx`, never persisted) and **not** Snapshot (derived
  counts-only audit records). It stores no zone contents, no `CardExtId[]` gameplay
  arrays interpreted as state, no functions — only identity, per-leg hero-pick
  identity strings, and timestamps.
- `data/migrations/022_create_player_loadouts.sql` — the closest structural analog
  and the idiom template: uuid PK via `gen_random_uuid()`, `bigint player_id` FK to
  `legendary.players(player_id) ON DELETE CASCADE`, a single-column `player_id` index
  for the list read, and a **partial-unique index with a `WHERE` predicate**. This WP
  mirrors that idiom (the predicate is `WHERE first_completed_at IS NULL` instead of
  `WHERE share_slug IS NOT NULL`).
- `apps/server/src/profile/loadoutLibrary.types.ts` — the types-module pattern WP-5's
  run API mirrors. This WP optionally adds a **minimal** row-shape types file only; the
  error-code unions, result types, route dependencies, and quota constants are **WP-5**.
- `apps/server/src/friendships/friendships.logic.test.ts` — the DB-gated test harness
  (TEST_DATABASE_URL gate, per-suite-run unique labels, `createPlayerAccount`
  provisioning, `pg.Pool`) this WP's migration test mirrors.
- `C:\Users\jjensen\.claude\plans\glimmering-meandering-russell.md §2 "Run workspace =
  minimal, maximally derived"` — the approved design this WP implements, and the
  epic's **derived-progression** posture D-24262 locks.
- `docs/ai/DECISIONS.md` — D-24260 (pack is identity-only; the identity fields this
  table stores), D-24131 §8b (the superseded Gauntlet-progress-on-profiles backlog
  line), D-24187 / D-24199 (the fixed-division / approved-loadout gauntlet rules the
  derived reads honor), D-24245 (number ledger). This WP **reserves D-24262** (the
  load-bearing derived-progression lock — see `## Contract`).

**Why now / split rationale.** This is WP #4 of the approved Mastermind Gauntlets
epic (plan §Work-packet decomposition). It lands the run-workspace storage **before**
the import + run API (WP-5) so the persistence shape is frozen before any endpoint
depends on it — "the storage exists before the API." It is a **single-layer,
single-concern** server-layer migration + a minimal types file + a DB-gated test.
Explicitly **parallel-safe** with WP-440 / WP-441 (different layers/files entirely).
It is **not** lightweight-lane eligible: it touches the persistence surface (a new
domain table) — the lane's empirical criterion #8 (zero determinism/persistence
impact) disqualifies any WP that adds a persisted table, and it locks a
cross-cutting invariant (D-24262). It therefore runs the standard two-session lane.

**Why a DECISIONS.md entry (D-24262).** Unlike WP-442, this WP **locks a new,
cross-cutting, future-facing architectural invariant**: that gauntlet progression is
**read-only derived state** and no future work may store cleared/champion/pool-validity
flags without a superseding decision. That lock protects the entire epic (and any
later gauntlet work) from the consistency-introducing shortcut of caching a derived
flag — the single most likely way this design decays. Per `01.0a` Step 2 a `D-NNNNN`
is reserved "only if the WP locks architectural decisions"; this one does, and the
approved plan assigns WP-4 as **the load-bearing lock**. D-24262 is reserved in the
ledger at draft time and **landed at execution** (flips Drafted → Active in Session 2).

## Scope (In)

- **New migration** `data/migrations/039_create_player_gauntlet_runs.sql` creating
  **exactly one table** `legendary.player_gauntlet_runs` with **exactly** these
  columns (types + constraints verbatim — see `## Contract`):
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `player_id bigint NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE`
  - `set_abbr text NOT NULL`
  - `mastermind_slug text NOT NULL`
  - `division text NOT NULL CHECK (division IN ('fixed', 'open'))`
  - `player_count smallint NOT NULL CHECK (player_count BETWEEN 1 AND 5)`
  - `leg_picks jsonb NOT NULL DEFAULT '{}'::jsonb` (map `schemeSlug → heroDeckIds[]`)
  - `created_at timestamptz NOT NULL DEFAULT now()`
  - `updated_at timestamptz NOT NULL DEFAULT now()`
  - `first_completed_at timestamptz` (nullable)
  - **Partial-unique active-run index** `player_gauntlet_runs_active_identity_uidx`:
    `UNIQUE (player_id, set_abbr, mastermind_slug, division, player_count) WHERE
    first_completed_at IS NULL`.
  - **Listing index** `player_gauntlet_runs_player_idx` on `(player_id)`.
  - Idempotent: `CREATE TABLE IF NOT EXISTS` + `CREATE {UNIQUE} INDEX IF NOT EXISTS`
    (migration-009 / 022 / 033 precedent). Module-header comment cites WP-443 / EC-478
    / D-24262 and the migration-number note (039, because 038 is `driver_owner`).
- **Optional new types module** `apps/server/src/gauntlet/gauntletRun.types.ts` — a
  **plain, minimal** row-shape file: the `GauntletRunDivision = 'fixed' | 'open'`
  union, a `GauntletRunLegPicks` alias (`Record<string, readonly string[]>` — schemeSlug
  → heroDeckIds), and a `GauntletRunRow` interface mirroring the table columns (JSDoc
  noting pg returns `bigint` as a string, and that the mapping/query layer is WP-5). It
  is **types only** — no functions, no `pg` query, no repository, no error-code unions,
  no quota constants (all WP-5).
- **New DB-gated test** `apps/server/src/gauntlet/gauntletRun.migration.test.ts`
  (`node:test`, TEST_DATABASE_URL-gated, mirroring the friendships harness) that, when
  a test database is present:
  - asserts the table exists with all ten columns of the expected data type / nullability
    (via `information_schema.columns`), and both indexes exist (the partial-unique with
    its `first_completed_at IS NULL` predicate, and the `(player_id)` index);
  - inserts one active run for a provisioned player, then asserts a **second insert of
    the same `(player_id, set_abbr, mastermind_slug, division, player_count)` while
    `first_completed_at IS NULL` fails** with a unique-violation;
  - stamps the first run's `first_completed_at` and asserts a **new active run of the
    same identity now succeeds** (completion frees the active slot);
  - asserts the `division` CHECK rejects a value outside `{'fixed','open'}` and the
    `player_count` CHECK rejects `0` and `6`;
  - asserts `DELETE FROM legendary.players WHERE player_id = $1` **cascades** and
    removes the player's runs;
  - uses per-suite-run unique identity values so repeated runs never collide, and
    cleans up provisioned rows in an `after` hook.

## Out of Scope

- **No `status` column, no `hero_pool` column, no child table, no history/flag table.**
  Status (the 5-state model), pool (union of leg picks), budget headroom, fixed-pool
  validity, champion, and "where you left off" are **all derived at read time** (WP-5)
  from `leg_picks` + `competitive_scores` — **never** stored. A normalized
  `player_gauntlet_run_heroes` child table is **future-only** and forbidden in v1.
  **No `completed_gauntlets` / cleared-flag / champion-flag / pool-validity table shall
  ever exist** (D-24262). This is the load-bearing constraint.
- **No API / endpoint / route.** `POST` / `GET` / edit / delete `/api/me/gauntlet-runs`,
  re-import idempotency logic, and pack validation are **WP-5**. This WP adds no HTTP
  surface — §21 (API catalog) is **N/A**.
- **No derived-read logic.** The per-run status/pool/headroom/champion/last-played
  derivation that consumes WP-442's `gauntletTruth.logic.ts` helper is **WP-5**. This
  WP adds no logic module that reads or computes progression.
- **No client change** (`apps/arena-client`, `apps/legends-board`) and **no import
  flow** — the profile tracker UI + file import is WP-7.
- **No `player_loadouts` change.** Run picks live in `leg_picks` here, **never** in
  `player_loadouts` — the 50-loadout cap (D-24086) is untouched. Only an explicit
  "save this leg to my library" (future) consumes that cap.
- **No `G` / `ctx` / snapshot / boardgame.io-store touch.** This is `legendary.*` domain
  storage, not runtime state, not a snapshot, not the `bgio` framework store. No
  persistence-boundary carve-out is added or needed.
- **No contract-file creation** (`.types.ts` name notwithstanding — the optional
  `gauntletRun.types.ts` is a **plain row-shape** module, not a locked `.validate.ts` /
  `.gating.ts` contract; it declares no closed union that a drift-detection test polices).

## Files Expected to Change

- `data/migrations/039_create_player_gauntlet_runs.sql` — **new** — the single-table
  migration: `legendary.player_gauntlet_runs` (10 columns), the partial-unique
  active-run index, the `(player_id)` listing index; idempotent, `legendary.*` schema,
  header cites WP-443 / EC-478 / D-24262.
- `apps/server/src/gauntlet/gauntletRun.types.ts` — **new (optional, minimal)** — plain
  row-shape types for WP-5: `GauntletRunDivision`, `GauntletRunLegPicks`,
  `GauntletRunRow`. No functions, no `pg`, no repository.
- `apps/server/src/gauntlet/gauntletRun.migration.test.ts` — **new** — `node:test`
  DB-gated migration test (table/columns/indexes exist; partial-unique blocks a 2nd
  active run and allows one after completion; division / player_count CHECKs; player
  CASCADE), mirroring the friendships TEST_DATABASE_URL harness.

## Non-Negotiable Constraints

**Output contract for this session:**
- Full file contents for every new file — **no diffs, no snippets, no "show only the
  changed section."**
- ESM only, Node v22+, human-style code per `docs/ai/REFERENCE/00.6-code-style.md`
  (full English names, `// why:` on non-self-evident constraints, explicit `for...of`
  — no `.reduce()` — in any test-side accumulation).

**Persistence-boundary (always apply):**
- `G` and `ctx` are **untouched**. This table is account-local domain storage in the
  `legendary.*` schema — **not** a snapshot, **not** a save-game, **not** the `bgio`
  framework store. No persistence carve-out is added (`.claude/rules/architecture.md
  §Persistence Boundary` needs no edit; this is ordinary server-layer domain storage,
  the `player_loadouts` precedent).
- Snapshots stay counts-only; this WP adds no snapshot surface.

**Packet-specific:**
- **Minimal + maximally derived:** the table stores **only** identity + per-leg hero
  picks + audit timestamps. Storing any derived value (status, hero pool, cleared flag,
  champion flag, pool-validity, last-played leg) is a **FAIL** (D-24262). If a column
  seems needed to "make a read cheaper," STOP — it is derived, not stored.
- **Partial-unique predicate exact:** the active-run uniqueness is
  `UNIQUE (player_id, set_abbr, mastermind_slug, division, player_count) WHERE
  first_completed_at IS NULL` — verbatim. Not a full UNIQUE (that would forbid a
  completed run + a fresh active run of the same identity), not a different column set.
- **`first_completed_at` is write-once audit, not truth:** it is a nullable timestamp
  set the first time a read derives champion (WP-5) and is **never** read as
  championship truth — every read re-derives champion from `competitive_scores`. It
  exists only for history ordering + the active-run boundary.
- **Migration idempotency:** `IF NOT EXISTS` on the table and both indexes; re-running
  the runner against a seeded DB succeeds (migration-009 / 022 / 033 precedent).
- **DB-gated test asserts the completion-frees-the-slot behavior:** it is not enough to
  assert the block; the test must prove a second active run of the same identity
  **succeeds after** the first run's `first_completed_at` is stamped.

**Session protocol:** if any step appears to require a `status`/`hero_pool`/child/flag
column, a persistence carve-out, an API route, a client edit, or reading gameplay `G` —
**STOP and ask.** Do not improvise a derived-storage shortcut or a scope expansion.

**Locked contract values:** see `## Contract`.

## Contract

**Table DDL (`legendary.player_gauntlet_runs`) — locked column set + constraints:**

```sql
CREATE TABLE IF NOT EXISTS legendary.player_gauntlet_runs (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id          bigint      NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE,
  set_abbr           text        NOT NULL,
  mastermind_slug    text        NOT NULL,
  division           text        NOT NULL CHECK (division IN ('fixed', 'open')),
  player_count       smallint    NOT NULL CHECK (player_count BETWEEN 1 AND 5),
  leg_picks          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  first_completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS player_gauntlet_runs_active_identity_uidx
  ON legendary.player_gauntlet_runs (player_id, set_abbr, mastermind_slug, division, player_count)
  WHERE first_completed_at IS NULL;

CREATE INDEX IF NOT EXISTS player_gauntlet_runs_player_idx
  ON legendary.player_gauntlet_runs (player_id);
```

**Locked values (do not re-derive):**

- **Migration number `039`** — `038_add_driver_owner_to_match_bot_ally.sql` is the
  current frontier on `main`; `039` is the next free sequential slot.
- **Column set (exactly 10):** `id`, `player_id`, `set_abbr`, `mastermind_slug`,
  `division`, `player_count`, `leg_picks`, `created_at`, `updated_at`,
  `first_completed_at`. **No** `status`, `hero_pool`, cleared/champion/pool-validity
  flag, or last-played column.
- **`division` CHECK:** `division IN ('fixed', 'open')` — verbatim, matching the pack's
  `division` values (D-24260).
- **`player_count` CHECK:** `player_count BETWEEN 1 AND 5` (`smallint`).
- **`leg_picks`:** `jsonb NOT NULL DEFAULT '{}'::jsonb` — a map `schemeSlug →
  heroDeckIds[]`; the **single authoritative hero state** for the run (no child table,
  no `player_loadouts` entry).
- **Active-run uniqueness key:** `(player_id, set_abbr, mastermind_slug, division,
  player_count) WHERE first_completed_at IS NULL` — a player may run multiple
  counts/divisions concurrently but not two active identical runs; a completed run
  (non-null `first_completed_at`) frees the slot.
- **`first_completed_at`:** nullable `timestamptz`, write-once audit + archive-boundary
  stamp, never read as championship truth.

**Types module (`gauntletRun.types.ts`) public surface — minimal:**

- `export type GauntletRunDivision = 'fixed' | 'open'`
- `export type GauntletRunLegPicks = Record<string, readonly string[]>` — schemeSlug →
  heroDeckIds
- `export interface GauntletRunRow { id: string; playerId: string; setAbbr: string;
  mastermindSlug: string; division: GauntletRunDivision; playerCount: number; legPicks:
  GauntletRunLegPicks; createdAt: string; updatedAt: string; firstCompletedAt: string |
  null; }` (JSDoc: `playerId` is the `bigint` FK surfaced as a string by `pg`; DB→row
  mapping is WP-5).

## Acceptance Criteria

- [ ] `data/migrations/039_create_player_gauntlet_runs.sql` exists, creates exactly one
      table `legendary.player_gauntlet_runs` with the ten locked columns and the two
      indexes, and is idempotent (`IF NOT EXISTS` on the table and both indexes).
- [ ] The migration adds **no** `status`, `hero_pool`, child, history, or flag column /
      table: a grep of the migration for `status`, `hero_pool`, `champion`, `cleared`
      as column definitions returns **no match**.
- [ ] The partial-unique index predicate is exactly `WHERE first_completed_at IS NULL`
      over `(player_id, set_abbr, mastermind_slug, division, player_count)`, and the
      listing index is on `(player_id)`.
- [ ] `division` is `CHECK (division IN ('fixed', 'open'))` and `player_count` is
      `smallint CHECK (player_count BETWEEN 1 AND 5)`.
- [ ] `player_id` is `bigint NOT NULL REFERENCES legendary.players(player_id) ON DELETE
      CASCADE`; `id` is `uuid PRIMARY KEY DEFAULT gen_random_uuid()`; `leg_picks` is
      `jsonb NOT NULL DEFAULT '{}'::jsonb`; `first_completed_at` is nullable.
- [ ] (If included) `apps/server/src/gauntlet/gauntletRun.types.ts` exports
      `GauntletRunDivision`, `GauntletRunLegPicks`, `GauntletRunRow` and **only** those —
      no function, no `pg` import, no repository, no error-code union.
- [ ] `apps/server/src/gauntlet/gauntletRun.migration.test.ts` (DB-gated): with a test
      DB it asserts (a) table + ten columns + both indexes exist; (b) a second active
      run of the same identity while `first_completed_at IS NULL` is rejected
      (unique-violation); (c) after stamping the first run's `first_completed_at`, a new
      active run of the same identity **succeeds**; (d) the `division` and
      `player_count` CHECKs reject bad input; (e) deleting the player cascades to remove
      the runs. Without `TEST_DATABASE_URL` the DB assertions **skip loudly** (not a
      silent pass).
- [ ] `pnpm -r build` exits 0 and `pnpm --filter @legendary-arena/server test` passes
      (the new test's pure/structure portion runs; DB portion skips loudly without
      `TEST_DATABASE_URL`, runs green against a migrated `TEST_DATABASE_URL`).
- [ ] `docs/ai/DECISIONS.md` D-24262 flips Drafted → Active (post-execution).
- [ ] No file outside the `Files Expected to Change` list is modified.

## Verification Steps

```bash
pnpm -r build
# Expected: whole-repo build green; apps/server compiles with the optional new types
# module (if included). A migration + a DB-gated test add no compile surface otherwise.

pnpm --filter @legendary-arena/server test
# Expected: server tests pass. Without TEST_DATABASE_URL the new migration test's DB
# assertions skip LOUDLY (options-based non-silent skip); with a migrated
# TEST_DATABASE_URL they run green (block-2nd-active, allow-after-complete, CHECKs,
# CASCADE).

# With a local migrated test DB (mirrors project_db_backed_server_tests_local):
#   psql "$TEST_DATABASE_URL" -f data/migrations/039_create_player_gauntlet_runs.sql
#   TEST_DATABASE_URL=... pnpm --filter @legendary-arena/server test
# Expected: the run-persistence migration test is green.

grep -nE "\b(status|hero_pool|champion|cleared)\b" data/migrations/039_create_player_gauntlet_runs.sql ; echo "exit=$?"
# Expected: no column-definition match for a derived/flag column (D-24262 derived-lock).

grep -n "WHERE first_completed_at IS NULL" data/migrations/039_create_player_gauntlet_runs.sql ; echo "exit=$?"
# Expected: exactly the partial-unique active-run predicate (grep exit=0, one match).
```

## Vision Alignment

**Vision clauses touched:** §19b (account-local, user-authored saved content — the run
workspace is the player's own planning state, analogous to saved loadouts), §20–26
(Scoring / PAR / leaderboards — the run's *progression* is derived from
`competitive_scores`, though this WP stores no scoring). No identity / monetization /
RNG-sourcing / determinism surface is touched; the table stores account-local inputs,
not gameplay state.

**Conflict assertion:** *No conflict: this WP preserves all touched clauses.* The run
workspace is account-local configuration the player authors; it stores no scoring, no
progress, and no completion flag (all derived), so it introduces no competitive-truth
surface and no pay-to-win lever.

**Determinism preservation:** N/A to gameplay determinism — this WP adds a domain
table read/written only by the server, never by moves/phases/effects. `G`/`ctx` are
untouched; no snapshot, replay, or `finalStateHash` surface changes.

**Non-Goal proximity check:** No proximity to NG-1..7. The run workspace confers no
in-game advantage (it holds hero-pick *identity strings*, the same ids a lobby loadout
already carries), adds no paid surface, and encodes no pay-to-win lever. Per the epic's
v1 non-goals it stores no XP / rewards / achievement / gauntlet-specific scoring.

## Definition of Done

This packet is complete when ALL of the following are true:
- [ ] All Acceptance Criteria pass.
- [ ] `pnpm -r build` exits 0 and `pnpm --filter @legendary-arena/server test` passes
      (DB portion green against a migrated `TEST_DATABASE_URL`; skips loudly without it).
- [ ] **D-24026 inverted (no user-observable change):** `docs/ai/STATUS.md` states "No
      user-observable change — infrastructure only" (a storage-only migration); no
      live-surface verification is required because the surface is `none —
      infrastructure`. WP-5 delivers the first observable behavior.
- [ ] `docs/ai/STATUS.md` updated (names the `player_gauntlet_runs` table + the
      derived-progression lock; notes no persistence carve-out was added).
- [ ] `docs/ai/DECISIONS.md` — **D-24262 flips Drafted → Active (post-execution)** (the
      derived-progression lock + active-run uniqueness key + `first_completed_at`
      semantics + run-legs-not-loadouts rule).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph moved `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-478 status → `Done`.
- [ ] No files outside the `Files Expected to Change` list were modified.

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE**

- **Authority chain read:** CLAUDE.md → ARCHITECTURE.md §Layer Boundary (Server layer;
  `apps/server` may import `pg`; domain storage in `legendary.*` is a server
  responsibility) + §Persistence Boundary (Cross-Layer: `G`/`ctx` runtime-only —
  untouched; this is not a snapshot/save-game/`bgio` store) → `.claude/rules/architecture.md`
  §Persistence Boundary → `.claude/skills/legendary-persistence/SKILL.md` (Three Data
  Classes: this is Configuration/workspace, not Runtime, not Snapshot) →
  `.claude/rules/code-style.md` → this WP → EC-478. **No conflict:** a new `legendary.*`
  domain table written/read only by the server is ordinary server-layer storage (the
  `player_loadouts` precedent); no boundary is crossed and no carve-out is needed.
- **Dependencies verified on `main` @ `61bef39a`:** WP-440 / WP-441 / WP-442 all shipped
  (WORK_INDEX rows `[x]`); `legendary.players(player_id)` is a `bigint` FK target with
  `ON DELETE CASCADE` precedent (009/011/022); `gen_random_uuid()` + partial-unique-WHERE
  idioms exist (017/022); the DB-gated TEST_DATABASE_URL harness exists (friendships).
  The next free migration number is **039** (`038` = `driver_owner`, on `main`). No
  prerequisite WP is in-flight; WP-5 depends on this, not the reverse. Parallel-safe
  with WP-440/441.
- **Scope lock:** exactly three files — one migration (new), one optional minimal types
  module (new), one DB-gated test (new) — all under `data/migrations/` +
  `apps/server/src/gauntlet/` + governance ledgers. Single layer (Server), single
  concern (storage). No endpoint, no client, no read logic, no `.validate.ts` /
  `.gating.ts` contract file, no persistence carve-out.
- **Validation-tightening check (Empirical Scaffold, `01.4`):** this WP **tightens no
  existing input path** — it adds a new table and a new DB-gated test, rejecting no
  previously-accepted input on any existing surface (no existing fixture carries a
  `player_gauntlet_runs` row). The scaffold-first empirical gate does not trigger; the
  DB-gated test itself is the migration's correctness proof (the CHECK/uniqueness
  behavior is *observed*, not reasoned).
- **Ambiguities:** none blocking. Two design calls, both resolved and recorded: (1)
  the optional types module is **included** (minimal, plain row-shape — helps WP-5 and
  gives the migration test a typed shape, without pre-empting WP-5's query/mapping
  layer); (2) the run-domain files live in a **new `apps/server/src/gauntlet/` folder**
  (a clean domain boundary distinct from the read-only `legends/` standings; WP-5 adds
  routes/logic there). Neither is load-bearing; both are recorded in `## Contract` +
  the EC.

### Copilot Check (`01.7`) — verdict: **PASS**

Audited against the Top-30 lens; findings summarized:
- **Persistence boundary / layer boundaries — PASS.** New `legendary.*` domain table,
  server layer only; `G`/`ctx` untouched; not a snapshot, save-game, or `bgio` store;
  no carve-out added (ordinary domain storage, the `player_loadouts` precedent). The
  legendary-persistence skill's Three Data Classes place it in Configuration/workspace.
- **Derived-state discipline — PASS.** The load-bearing risk (caching a derived flag)
  is fenced by D-24262 + the Out-of-Scope enumeration + the AC grep for
  `status`/`hero_pool`/`champion`/`cleared` column defs. Status/pool/champion/last-played
  are all read-time derivations (WP-5), never columns.
- **Data model correctness — PASS.** The partial-unique predicate (`WHERE
  first_completed_at IS NULL`) correctly permits a completed run + a fresh active run of
  the same identity while blocking two active identicals; the DB-gated test proves both
  the block and the frees-on-completion. FK `ON DELETE CASCADE` mirrors WP-052
  deletePlayerData reachability.
- **Idempotency — PASS.** `IF NOT EXISTS` on the table and both indexes (009/022/033
  precedent); re-running the runner is safe.
- **Type safety / contract integrity — PASS.** The optional types module is a plain
  row-shape (no closed union a drift test must police); `division` mirrors the pack's
  values (D-24260); no `.validate.ts`/`.gating.ts` contract is created.
- **Testing / invariants — PASS.** The DB-gated test is non-vacuous: it drives the
  uniqueness block, the allow-after-complete, both CHECK rejections, and the CASCADE
  independently, and skips **loudly** (options-based) without `TEST_DATABASE_URL` — no
  silent pass.
- **Scope / governance — PASS.** Three-file, single-layer migration with explicit
  Out-of-Scope fences (no status/pool/child/flag column, no API, no read logic, no
  client, no carve-out, no `player_loadouts` touch) and a reserved, load-bearing
  D-24262.
- **Determinism / RNG — PASS.** No gameplay surface; `gen_random_uuid()` is a Postgres
  surrogate-key default, not gameplay randomness; no `Math.random()`/clock in code.

No RISK or BLOCK findings.

## Lint Gate Self-Review (`00.3`, all 21 sections)

- **§1 Structure** — PASS. All required sections present in order (Goal, Assumes,
  Context (Read First), Scope (In), Out of Scope, Files Expected to Change,
  Non-Negotiable Constraints, Acceptance Criteria, Verification Steps, Definition of
  Done), plus Contract, Vision Alignment, and the gate verdicts.
- **§2 Non-Negotiable Constraints** — PASS. Full-file-output + no-diffs; ESM / Node v22+;
  persistence-boundary block (`G`/`ctx` untouched, not a snapshot/save-game/`bgio`
  store, no carve-out); packet-specific (minimal + maximally derived, partial-unique
  predicate exact, `first_completed_at` audit-not-truth, idempotency, test asserts
  frees-on-completion); session protocol (STOP on derived-storage/scope expansion);
  locked values.
- **§3 Prerequisites (`## Assumes`)** — PASS. Each assumption cites its source on `main`
  @ `61bef39a`; WP-440/441/442 shipped-state, the FK/uuid/partial-unique precedents, the
  migration-number frontier, and the DB-gated harness are each cited.
- **§4 Context References** — PASS. Specific docs/sections (ARCHITECTURE §Layer/§Persistence,
  rules §Persistence, persistence SKILL, migration 022, loadoutLibrary.types, friendships
  test) + DECISIONS ids + the approved plan section listed. Field names touched match the
  data contract (§6); no `00.2` field renamed.
- **§5 Output Completeness (`## Files Expected to Change`)** — PASS. Three files
  enumerated with new/optional + one-line each; matches the EC allowlist. No ambiguous
  "update this section" language.
- **§6 Naming Consistency** — PASS. `set_abbr`, `mastermind_slug`, `division`,
  `player_count`, `leg_picks`, `first_completed_at`, `player_id` match the plan + FK
  conventions; the TS mirror uses the camelCase forms (`setAbbr`, `mastermindSlug`,
  `legPicks`, `firstCompletedAt`) consistent with existing row-shape types. No
  abbreviation invented.
- **§7 Dependency Discipline** — PASS. No new npm dependency; `pg` is the existing DB
  driver; no ORM; the migration is plain SQL run by the existing runner.
- **§8 Architectural Boundaries** — PASS. Server layer; new `legendary.*` domain table;
  `G`/`ctx` untouched; not a snapshot/save-game/`bgio` store; no persistence carve-out
  added (ordinary domain storage). The optional types module imports nothing from
  registry/engine/preplan/pg (pure type declarations).
- **§9 Windows Compatibility** — PASS. No shell scripts authored; `pnpm` + `grep` + `psql`
  verification only. `psql` invocation shown is illustrative of the existing local DB
  harness.
- **§10 Environment Variable Hygiene** — PASS. `TEST_DATABASE_URL` is the existing,
  documented test-DB gate (never a secret in output); the migration reads no env.
- **§11 Authentication Clarity** — N/A. This WP adds no route/auth surface; per-account
  scoping (`player_id`) and auth live in WP-5's API. The FK + CASCADE are storage-level.
- **§12 Test Quality** — PASS. `node:test` / `node:assert`, `.test.ts`, no `boardgame.io`
  import; DB-gated with an options-based **non-silent** skip; non-vacuous (drives the
  uniqueness block, the allow-after-complete, both CHECKs, and the CASCADE independently);
  per-suite-run unique labels + `after`-hook cleanup.
- **§13 Commands & Verification** — PASS. Exact `pnpm` + `psql` + count/predicate `grep`
  commands with expected output (incl. the derived-column-absence grep and the
  partial-unique-predicate grep).
- **§14 Acceptance Criteria Quality** — PASS. Binary, observable checks naming the real
  columns/indexes/CHECKs, the frees-on-completion behavior, the loud-skip, and the
  no-derived-column grep.
- **§15 Definition of Done** — PASS, incl. §15.1: `User-Visible Surface` is `none —
  infrastructure`, so the DoD carries the **inverted D-24026** requirement (STATUS states
  "No user-observable change — infrastructure only") and no live-surface item. Server
  package build IS the typecheck (no separate `typecheck` line needed, per EC-TEMPLATE
  Rules). STATUS.md / WORK_INDEX.md / mindmap / EC_INDEX updates present; DECISIONS.md
  D-24262 Drafted → Active.
- **§16 Code Style** — PASS. Plain SQL migration with `// why:`-style header comment
  (SQL `--` comments) on the non-self-evident constraints (partial-unique predicate,
  `first_completed_at` semantics, migration-number note); the optional types module is
  JSDoc'd, function-free; the test uses explicit `for...of` (no `.reduce()`) for any
  column-set assertion.
- **§17 Vision Alignment** — PASS. `## Vision Alignment` present; §19b + §20–26 cited;
  "No conflict"; determinism-preservation line present (N/A to gameplay — no move/phase/
  snapshot surface); NG proximity checked (none; v1 non-goals honored).
- **§18 Prose-vs-Grep Discipline** — PASS. The two count/predicate grep gates target SQL
  column-definition tokens (`\b(status|hero_pool|champion|cleared)\b` as column defs) and
  the literal partial-unique predicate (`WHERE first_completed_at IS NULL`). The migration
  file's own header prose is written to **paraphrase** the derived-column names (it says
  "no derived / flag columns" rather than listing `status`/`hero_pool` as bare tokens on
  a column-definition line), so the derived-column grep stays at zero matches; the
  predicate grep intentionally matches exactly one line (the index definition).
- **§19 Bridge-vs-HEAD Staleness** — N/A. No bridge / state-snapshot artifact authored;
  the baseline SHA `61bef39a` is recorded in `## Assumes`.
- **§20 Funding Surface Gate** — N/A. No funding surface: no global-nav,
  donate/tournament-funding copy, or funding channel — the WP adds a domain table.
- **§21 API Catalog Update** — N/A. No `apps/server` HTTP endpoint is added, modified, or
  removed, and no catalogued `Library-only` function changes — the run API is WP-5.
  `docs/ai/REFERENCE/api-endpoints.md` is untouched.

All 21 sections resolved (PASS or justified N/A). Lint gate satisfied.
