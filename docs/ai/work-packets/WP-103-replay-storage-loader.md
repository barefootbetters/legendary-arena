# WP-103 — Server-Side Replay Storage & Loader

**Status:** Draft (lint-gate self-review PASS; pre-flight pending)
**Primary Layer:** Server / Replay Storage
**Version:** 1.0
**Last Updated:** 2026-04-25
**Dependencies:** WP-027, WP-052, WP-004

> Predecessor packet for WP-053. WP-053's EC-053 §Before Starting line 21
> requires "an existing replay loader by `replayHash`" with no mocks
> accepted; WP-103 lands that loader. After WP-103 ships, WP-053 can
> open against a green `Before Starting` checklist.

---

## Session Context

WP-027 established the canonical `ReplayInput` contract (`seed`,
`setupConfig`, `playerOrder`, `moves`) and the `replayGame` /
`computeStateHash` engine surface. WP-052 added server-side identity
(`AccountId`, `PlayerAccount`, `GuestIdentity`) and replay ownership
metadata (`legendary.replay_ownership` keyed by `replay_hash text`),
explicitly deferring replay-blob persistence (PS-12 / D-5207-pending).
This packet introduces the missing storage / read path: a content-
addressed `legendary.replay_blobs` table plus `storeReplay` /
`loadReplay` server-side helpers. No engine, registry, preplan, UI,
or replay-producer changes; no WP-052 contract modifications.

---

## Why This Packet Matters

Without a server-side replay loader, WP-053 (Competitive Score
Submission & Verification) cannot start — its EC-053 explicitly
forbids satisfying the loader prerequisite with a mock. WP-103 is the
smallest viable predecessor that closes that gap: a single PostgreSQL
table keyed by `replay_hash`, plus `storeReplay` and `loadReplay`
helpers in `apps/server/src/replay/`, with no behavioral surface
beyond write + read by hash. The storage backend choice (PostgreSQL
`jsonb`) keeps the data path transactional with the existing
`legendary.players` / `legendary.replay_ownership` tables and
preserves the option of migrating to R2 / object storage later behind
the same `loadReplay` interface.

---

## Vision Alignment

**Vision clauses touched:** `§3 (Player Trust & Fairness),
§18 (Replayability & Spectation), §19 (AI-Ready Export & Analysis
Support), §22 (Deterministic & Reproducible Evaluation),
§24 (Replay-Verified Competitive Integrity)`.

**Conflict assertion:** **No conflict: this WP preserves all touched
clauses.**

- §3 / §22 / §24: replays are content-addressed by `replay_hash`
  (the hash from WP-027's `computeStateHash`). Tampering changes the
  hash; the application layer enforces `replayHash === computeStateHash(replayGame(input).finalState)`
  on submission paths (in WP-053). WP-103 stores blobs faithfully —
  it does not mutate, re-encode, or paraphrase replay content.
- §18 / §19: server-side persistence is the substrate that lets
  account players share replays via stable URLs and lets analysts
  fetch deterministic re-execution inputs by hash. WP-103 provides
  the read path; URL surfaces and analyst tooling are downstream WPs.
- §19 specifically: `loadReplay` returns the canonical `ReplayInput`
  shape from WP-027 — analysts use the same type the engine consumes,
  with no shape divergence.

**Non-Goal proximity check:** This WP touches durable replay storage
and account-scoped infrastructure. Confirmation that none of NG-1..7
are crossed:

- NG-1 (Pay-to-Win): not crossed — storage is content-addressed,
  not tier-gated. Every account's replays are stored identically.
- NG-2 (Gacha): not crossed.
- NG-3 (Content Withheld): not crossed — replay storage is mechanical
  infrastructure, not gameplay content.
- NG-4 (Energy / Timers): not crossed.
- NG-5 (Ads): not crossed.
- NG-6 (Dark Patterns): not crossed — `loadReplay` is metadata-free;
  callers cannot infer non-public information by probing.
- NG-7 (Apologetic Monetization): not crossed.

**Determinism preservation:** N/A for engine determinism — WP-103
is server-layer storage. `replay_blobs` rows are immutable after
insert (only `INSERT` / `SELECT` / `DELETE`; no `UPDATE`). The hash
column IS the primary key; rows cannot be rewritten without changing
their identity. Engine determinism contracts (Vision §22, WP-027
`computeStateHash`) are unaffected.

---

## Goal

After this session, the server can persist and retrieve replay
inputs by their cryptographic hash. Specifically:

- `apps/server/src/replay/replay.types.ts` exists and re-exports
  `ReplayInput` from `@legendary-arena/game-engine` plus a local
  `DatabaseClient` type alias matching the WP-052 pattern.
- `apps/server/src/replay/replay.logic.ts` exports two functions:
  `storeReplay(replayHash, replayInput, database)` — idempotent
  insert via `ON CONFLICT (replay_hash) DO NOTHING`; and
  `loadReplay(replayHash, database)` — returns the canonical
  `ReplayInput` if found or `null` if absent. No `Result<T>` wrapper
  — there are no expected application-side failure modes; infra
  errors propagate via thrown exceptions.
- `data/migrations/006_create_replay_blobs_table.sql` creates
  `legendary.replay_blobs` with `replay_hash text PRIMARY KEY`,
  `replay_input jsonb NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`,
  and is idempotent (`CREATE TABLE IF NOT EXISTS`).
- `apps/server/src/replay/replay.logic.test.ts` exercises 5 tests
  in one `describe('replay storage logic (WP-103)', …)` block —
  1 pure (validation / shape) + 4 DB-dependent (round-trip,
  idempotent re-store, null-on-miss, jsonb shape preservation)
  using the locked `{ skip: 'requires test database' }` pattern.

---

## Assumes

- WP-027 complete. Specifically:
  - `packages/game-engine/src/replay/replay.types.ts` exports
    `ReplayInput` (interface with `seed`, `setupConfig`,
    `playerOrder`, `moves`)
  - `packages/game-engine/src/replay/replay.hash.ts` exports
    `computeStateHash` (used at WP-053's caller boundary, not by
    WP-103 itself)
- WP-052 complete (Done 2026-04-25 at `fd769f1`). Specifically:
  - `apps/server/src/identity/identity.types.ts` exports
    `DatabaseClient` (alias for `pg.Pool`) — WP-103 imports this
    type, mirroring the WP-052 pattern; alternative is a local
    re-export to keep the `apps/server/src/replay/` directory
    self-contained
  - `legendary.players` and `legendary.replay_ownership` tables
    exist via migrations 004 + 005
- WP-004 complete. `apps/server/src/index.mjs` exists; WP-103 does
  not modify it
- `pnpm -r build` exits 0
- `pnpm --filter @legendary-arena/server test` reports `31 / 5 / 0`
  (with 6 skipped when `TEST_DATABASE_URL` is unset) — the
  post-WP-052 baseline
- `docs/ai/DECISIONS.md`, `docs/ai/ARCHITECTURE.md`, `docs/ai/STATUS.md`,
  `docs/ai/work-packets/WORK_INDEX.md` exist
- Migration runner is available and idempotent (existing convention
  from migrations 001–005)

If any of the above is false, this packet is **BLOCKED** and must
not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — read
  the full §Server Layer subsection. WP-103 is server-layer-only;
  the engine and registry must not be touched. The Layer Boundary
  authoritative table forbids `apps/server/**` from importing from
  any other `apps/*` package and forbids `packages/game-engine/**`
  from importing from `apps/server/**`.
- `docs/ai/ARCHITECTURE.md §Persistence Boundaries` — confirms
  `G` / `ctx` are runtime-only. `legendary.replay_blobs` does NOT
  store `G` or `ctx` — it stores `ReplayInput` (Class 2 Configuration
  per `replay.types.ts:14-16`).
- `.claude/rules/server.md` — server is a wiring + storage layer;
  no gameplay logic. WP-103 conforms by keeping all gameplay in the
  engine and only handling I/O.
- `.claude/rules/persistence.md` — confirms identity / replay records
  are server-persisted bookkeeping per D-5203 (introduced by WP-052)
  and distinct from Class 1/2/3 game-state persistence.
- `.claude/rules/code-style.md` — Rule 4 (no abbreviations), Rule 6
  (`// why:` comments), Rule 9 (`node:` prefix), Rule 11 (full-sentence
  errors), Rule 13 (ESM only), Rule 14 (field names match contract).
- `packages/game-engine/src/replay/replay.types.ts` — read entirely.
  `ReplayInput` is the canonical Class 2 configuration shape that
  WP-103 stores. Field names: `seed`, `setupConfig`, `playerOrder`,
  `moves`. Do not redefine, paraphrase, or extend this type.
- `apps/server/src/identity/replayOwnership.logic.ts` — read entirely.
  This is the WP-052 precedent pattern for `apps/server/src/`-style
  server-layer modules: caller-injected `DatabaseClient`, idempotent
  `INSERT … ON CONFLICT` SQL, single-responsibility helpers,
  comprehensive `// why:` comments, no `boardgame.io` import.
- `apps/server/src/identity/identity.types.ts` — read entirely.
  Source of the `DatabaseClient` type alias WP-103 reuses.
- `data/migrations/004_create_players_table.sql` and
  `005_create_replay_ownership_table.sql` — read both for migration
  format precedent (uppercase SQL, `legendary.*` namespace,
  `CREATE TABLE IF NOT EXISTS`, comprehensive `-- why:` comments).
- `docs/ai/REFERENCE/00.2-data-requirements.md §1` — confirms
  `legendary.*` namespace, `bigserial` PKs (NOTE: WP-103 uses a
  `text` PK because the hash IS the natural key; document with a
  `-- why:` comment), `text` cross-service identifiers.
- `docs/13-REPLAYS-REFERENCE.md §Storage and Access Architecture` —
  the normative governance for replay storage decisions.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — N/A for WP-103 (no randomness)
- Never throw inside boardgame.io move functions — N/A (no moves)
- Never persist `G`, `ctx`, or any runtime state — `replay_blobs`
  stores `ReplayInput` (Class 2 Configuration), never `G` or `ctx`
- `G` must be JSON-serializable at all times — N/A (no engine touch)
- ESM only, Node v22+ — all new files use `import`/`export`
- `node:` prefix on all Node.js built-in imports
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
  (the storage helpers themselves are I/O — that is their purpose)
- Full file contents for every new or modified file in the output —
  no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- No `boardgame.io` import in any WP-103 file — server-storage layer
  has no boardgame.io concerns
- No `@legendary-arena/registry`, `@legendary-arena/preplan`, or
  `@legendary-arena/vue-sfc-loader` imports
- No modifications to any file under `packages/game-engine/`,
  `packages/registry/`, `packages/preplan/`, `packages/vue-sfc-loader/`,
  `apps/arena-client/`, `apps/replay-producer/`, `apps/registry-viewer/`
- No modifications to existing files under `apps/server/src/identity/`,
  `apps/server/src/par/`, `apps/server/src/rules/`,
  `apps/server/src/game/` — WP-052, WP-051, and prior server WPs are
  locked contracts
- No modifications to `apps/server/src/server.mjs`, `index.mjs`,
  `package.json`, or `apps/server/scripts/` — runtime wiring is
  out of scope; `loadReplay` and `storeReplay` are not called from
  `startServer` in this packet (a future request-handler WP wires
  them in)
- No modifications to existing migrations 001–005 — they are
  locked contracts
- New migration appended at number `006`
- No `.reduce()` with branching logic
- No `require()`
- `replay_input` column type MUST be `jsonb` — not `bytea`, not
  `text`, not `json`. `jsonb` is the only choice that preserves
  shape queryability and storage efficiency
- `storeReplay` SQL pattern is `INSERT … ON CONFLICT (replay_hash)
  DO NOTHING` — locked verbatim per the body's Locked Values block.
  `DO UPDATE` is forbidden because content-addressed rows must be
  immutable after insert; observing two distinct `replay_input`
  values for the same `replay_hash` would imply a SHA-256 collision
  and is treated as a no-op rather than silent overwrite
- `storeReplay` returns `Promise<void>`. No `Result<T>` wrapper.
  Infra-level failures (connection lost, permission denied)
  propagate via thrown exceptions; application-level "failure"
  modes do not exist for this surface (idempotent insert + null-on-miss
  read is the entire contract surface)
- `loadReplay` returns `Promise<ReplayInput | null>`. No `Result<T>`
  wrapper; `null` is the only documented "miss" signal
- DB-dependent tests use `node:test`'s `{ skip: 'requires test
  database' }` non-silent skip when `TEST_DATABASE_URL` is unset.
  The skip reason MUST be the literal string `'requires test database'`
  for greppability across the test suite. Use the inline form
  `hasTestDatabase ? {} : { skip: 'requires test database' }`
  established by WP-052 §3.1 post-mortem reconciliation
- Tests wrapped in exactly one `describe('replay storage logic (WP-103)', …)`
  block — no bare top-level `test()` calls

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask
  the human before proceeding — never guess or invent field names,
  type shapes, or file paths
- If WP-052's `replayOwnership.logic.ts` pattern conflicts with this
  packet's intent at any point, STOP and re-read both — WP-052 is the
  precedent template; deviations need explicit justification

**Locked contract values (verbatim — do not paraphrase or re-derive):**

- **legendary.\* namespace** — all tables in `legendary.*` schema per
  `00.2-data-requirements.md §1`
- **`replay_blobs` schema** — locked verbatim:
  ```sql
  CREATE TABLE IF NOT EXISTS legendary.replay_blobs (
      replay_hash   text         PRIMARY KEY,
      replay_input  jsonb        NOT NULL,
      created_at    timestamptz  NOT NULL DEFAULT now()
  );
  ```
  Three columns, no more, no less. PK is `replay_hash text`, not
  `bigserial` — see `-- why:` requirement in §Required `// why:`
  Comments below.
- **`storeReplay` SQL pattern** — locked verbatim:
  ```sql
  INSERT INTO legendary.replay_blobs (replay_hash, replay_input)
  VALUES ($1, $2)
  ON CONFLICT (replay_hash) DO NOTHING;
  ```
- **`loadReplay` SQL pattern** — locked verbatim:
  ```sql
  SELECT replay_input FROM legendary.replay_blobs
  WHERE replay_hash = $1
  LIMIT 1;
  ```
- **Function signatures** — locked verbatim:
  ```ts
  export async function storeReplay(
    replayHash: string,
    replayInput: ReplayInput,
    database: DatabaseClient,
  ): Promise<void>;

  export async function loadReplay(
    replayHash: string,
    database: DatabaseClient,
  ): Promise<ReplayInput | null>;
  ```
- **`DatabaseClient` re-export** — `apps/server/src/replay/replay.types.ts`
  re-exports `DatabaseClient` from `../identity/identity.types.js`
  rather than redefining it. This keeps `pg.Pool` typed identically
  across server-layer modules.

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via
deterministic reproduction and state inspection.

- `storeReplay` and `loadReplay` are deterministic given identical
  input parameters and identical DB state. Two consecutive `loadReplay`
  calls with the same `replayHash` against an unchanged DB return
  identity-equal `ReplayInput` shapes (deep equality; the rows
  produced by `pg` are fresh JS objects on every call so no
  reference-aliasing escapes).
- Failures attributable to this packet are localizable via the SQL
  surface — every failure path is either a thrown infra error
  (logged at the caller layer) or a `null` return (loader miss).
  Application-level silent failure modes are forbidden by the
  signature contracts.
- Runtime state remains JSON-serializable: `ReplayInput` is JSON
  by definition (Class 2). `replay_blobs.replay_input` round-trips
  through `pg`'s `jsonb` codec with byte-equivalent shape.

---

## Scope (In)

### A) Create `apps/server/src/replay/replay.types.ts` (new)

- Re-export `ReplayInput` from `@legendary-arena/game-engine` (type
  re-export only — no runtime import beyond the engine package's
  public barrel)
- Re-export `DatabaseClient` from `../identity/identity.types.js`
  (type-only)
- Add `// why:` comment at the file head explaining: this module
  exists so `replay.logic.ts` and any future `replay.*.ts` siblings
  reference one canonical pair of types without re-importing from
  multiple sources

### B) Create `apps/server/src/replay/replay.logic.ts` (new)

Imports (allowed):
```ts
import type { ReplayInput, DatabaseClient } from './replay.types.js';
```

Forbidden imports: anything from `boardgame.io`,
`@legendary-arena/game-engine` runtime (type-only via re-export is
fine), `@legendary-arena/registry`, `@legendary-arena/preplan`,
`@legendary-arena/vue-sfc-loader`, any UI / arena-client /
replay-producer / registry-viewer package, `pg` directly (use
`DatabaseClient` alias).

Exports:
- `async function storeReplay(replayHash: string, replayInput: ReplayInput, database: DatabaseClient): Promise<void>`
  — wraps the locked SQL. Catches no errors; infra failures
  propagate.
- `async function loadReplay(replayHash: string, database: DatabaseClient): Promise<ReplayInput | null>`
  — wraps the locked SQL. Returns `null` when zero rows. Returns
  the parsed `ReplayInput` from `result.rows[0].replay_input`
  (pg's `jsonb` codec returns the value already deserialized; no
  manual `JSON.parse`).

JSDoc on both exports. Required `// why:` comments per §Required
`// why:` Comments below.

### C) Create `data/migrations/006_create_replay_blobs_table.sql` (new)

Idempotent DDL: `CREATE TABLE IF NOT EXISTS legendary.replay_blobs`
with the three locked columns. `-- why:` comments at every locked
decision point per §Required `// why:` Comments below.

### D) Create `apps/server/src/replay/replay.logic.test.ts` (new — 5 tests)

Structure (one `describe('replay storage logic (WP-103)', …)`
block, no bare top-level `test()` calls):

1. **`loadReplay returns null for an unknown replayHash` (pure)** —
   uses a stub `DatabaseClient` whose `query` returns `{ rows: [] }`.
   Asserts the return is exactly `null`.
2. **`storeReplay → loadReplay round-trip preserves ReplayInput shape` (DB)** —
   constructs a sample `ReplayInput` (small but covers all four
   fields), calls `storeReplay`, then `loadReplay`, asserts
   `assert.deepEqual(loaded, original)`.
3. **`storeReplay is idempotent — second call with same args is a no-op` (DB)** —
   calls `storeReplay` twice with identical args; both succeed
   without error. After the second call, `loadReplay` returns the
   same record (no duplicate row created — confirmed by
   `SELECT count(*) FROM legendary.replay_blobs WHERE replay_hash = $1`).
4. **`loadReplay for unknown replayHash returns null against real DB` (DB)** —
   distinct from test 1; uses real DB to confirm no row materializes
   from a missing key.
5. **`storeReplay accepts the locked ReplayInput shape with all four fields populated` (DB)** —
   asserts that after a round-trip through `jsonb`, every field of
   `ReplayInput` (`seed: string`, `setupConfig: MatchSetupConfig`,
   `playerOrder: string[]`, `moves: ReplayMove[]`) is preserved
   byte-equivalent.

DB tests use `before` / `after` for `pg.Pool` lifecycle and
`beforeEach` for `DELETE FROM legendary.replay_blobs;` cleanup.
DB-dependent tests use the locked `{ skip: 'requires test database' }`
pattern via `hasTestDatabase ? {} : { skip: 'requires test database' }`.

---

## Out of Scope

- **No replay write-back from `apps/replay-producer/`** — the
  producer remains a CLI that emits `ReplaySnapshotSequence` to a
  user-supplied path. WP-103 does not modify the producer or
  introduce a server-side ingestion endpoint. A future WP may wire
  the producer to call `storeReplay` directly, but that is layer-
  bridging work (spans engine + server) and needs its own scope.
- **No HTTP endpoints** — `storeReplay` / `loadReplay` are server-
  internal helpers. The submission HTTP endpoint that receives
  `ReplayInput` from arena-client or replay-producer is a future
  WP (likely paired with WP-053).
- **No FK from `legendary.replay_ownership.replay_hash` →
  `legendary.replay_blobs.replay_hash`** — WP-052's `replay_ownership`
  table is a locked contract per §Non-Negotiable Constraints.
  Adding a FK retroactively would be a WP-052 contract modification.
  Application logic (in WP-053) is responsible for ensuring
  `storeReplay` runs before `assignReplayOwnership` on the
  submission path.
- **No replay-blob deletion or retention** — `legendary.replay_blobs`
  rows are immutable and indefinitely retained in this packet.
  Retention policies, GDPR-driven blob purge, and the audit-count
  handoff completion are explicitly deferred (PS-12 / D-5207-pending
  from WP-052). A future WP will land:
  (a) `deleteReplayBlob(replayHash, db)` for explicit purge calls,
  (b) integration with `deletePlayerData` to chain blob purge after
      ownership-row deletion,
  (c) the retention-policy-driven background purge job.
- **No replay-content validation** — `storeReplay` does not verify
  that `computeStateHash(replayGame(replayInput).finalState) === replayHash`.
  Hash verification is the caller's responsibility (WP-053 enforces
  it on the submission path). Storing a replay where the input
  doesn't hash to the supplied key would create an unreachable row;
  WP-103 does not protect against this misuse — verification is
  layered above storage.
- **No bulk operations** — no `storeReplays(...replays)`, no
  `listReplaysByAccountId`, no batched `loadReplays(...hashes)`.
  Single-replay surface only.
- **No engine, registry, preplan, arena-client, replay-producer,
  registry-viewer, or vue-sfc-loader changes**.
- Refactors, cleanups, or "while I'm here" improvements are **out
  of scope** unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `apps/server/src/replay/replay.types.ts` — **new** — type re-exports
- `apps/server/src/replay/replay.logic.ts` — **new** — `storeReplay` + `loadReplay`
- `apps/server/src/replay/replay.logic.test.ts` — **new** — 5 tests (1 pure + 4 DB-dependent)
- `data/migrations/006_create_replay_blobs_table.sql` — **new** — `legendary.replay_blobs` DDL

Governance close (Commit B):
- `docs/ai/STATUS.md` — **modified** — prepend WP-103 / EC-103 current-state block
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — flip WP-103 row `[ ]` → `[x]`
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — flip EC-103 row Draft → Done
- `docs/ai/post-mortems/01.6-WP-103-replay-storage-loader.md` — **new** — mandatory per 01.6 (new long-lived abstraction + new contract consumed by WP-053 + new persistence surface)

No other files may be modified.

---

## Required `// why:` Comments

- `apps/server/src/replay/replay.types.ts` head — explain why this
  module re-exports both `ReplayInput` and `DatabaseClient`: single
  canonical pair for all `apps/server/src/replay/` modules; mirrors
  the WP-052 `identity.types.ts` precedent.
- `replay.logic.ts` `storeReplay` — explain why `DO NOTHING` is
  used (not `DO UPDATE`): content-addressed rows are immutable
  after insert; SHA-256 collision is statistically infeasible, so
  a conflicting key with different content would be cryptographic
  anomaly rather than expected behavior.
- `replay.logic.ts` `loadReplay` — explain why `pg`'s `jsonb`
  codec returns deserialized JS objects (no manual `JSON.parse`
  call): `pg` deserializes `jsonb` columns at the driver level;
  manual parsing would double-decode and break.
- `006_create_replay_blobs_table.sql` `replay_hash text PRIMARY KEY`
  line — explain why this PK choice diverges from WP-052's
  `bigserial player_id` + `ext_id text UNIQUE` pattern: replays
  are content-addressed by hash, with no use case for a separate
  internal bigint identifier; using `replay_hash` directly as the
  PK avoids the `ext_id ↔ player_id` mapping complexity that
  WP-052 needed for cross-service identity.
- `006_create_replay_blobs_table.sql` `replay_input jsonb NOT NULL`
  line — explain why `jsonb` (not `bytea` or `text`): `ReplayInput`
  is JSON-serializable by contract (Class 2 per
  `replay.types.ts:14-16`); `jsonb` preserves shape queryability
  for future audit / analytics use cases without manual parsing
  overhead.
- `006_create_replay_blobs_table.sql` immutability comment block —
  explain why no `updated_at` column exists (cf. WP-052's
  `legendary.players.updated_at`): replay blobs are content-addressed
  and immutable by design; mutation is conceptually invalid (would
  change the canonical identifier) and there is no migration path
  that would rewrite a stored blob.

---

## Acceptance Criteria

### Storage layer
- [ ] `apps/server/src/replay/replay.types.ts` exists and re-exports
      exactly `ReplayInput` (from `@legendary-arena/game-engine`) and
      `DatabaseClient` (from `../identity/identity.types.js`)
- [ ] `apps/server/src/replay/replay.logic.ts` exists and exports
      exactly two functions: `storeReplay`, `loadReplay`
- [ ] `storeReplay` signature matches `(replayHash: string,
      replayInput: ReplayInput, database: DatabaseClient): Promise<void>`
- [ ] `loadReplay` signature matches `(replayHash: string, database:
      DatabaseClient): Promise<ReplayInput | null>`
- [ ] Neither function throws for any expected application-side
      condition (idempotent insert; null-on-miss read). Infra-level
      thrown exceptions propagate
- [ ] No `boardgame.io`, `@legendary-arena/game-engine`,
      `@legendary-arena/registry`, `@legendary-arena/preplan`, or
      `@legendary-arena/vue-sfc-loader` runtime imports anywhere in
      `apps/server/src/replay/` (grep-verified)
- [ ] No `pg` direct import in `replay.logic.ts` (uses
      `DatabaseClient` alias only)
- [ ] No `Math.random` / `Date.now` / `require()` in any new file

### Migration
- [ ] `data/migrations/006_create_replay_blobs_table.sql` exists and
      uses `CREATE TABLE IF NOT EXISTS legendary.replay_blobs`
- [ ] Exactly three columns: `replay_hash text PRIMARY KEY`,
      `replay_input jsonb NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`
- [ ] No `updated_at` column (immutability per Vision Alignment)
- [ ] No FK references (no `REFERENCES` clause)
- [ ] No seed inserts
- [ ] At least 4 `-- why:` comments per the §Required `// why:`
      Comments list

### Tests
- [ ] `apps/server/src/replay/replay.logic.test.ts` exists with
      exactly 5 tests in one `describe('replay storage logic (WP-103)', …)`
      block
- [ ] 1 pure test always runs; 4 DB-dependent tests use the locked
      `{ skip: 'requires test database' }` reason
- [ ] DB-dependent tests use the inline form
      `hasTestDatabase ? {} : { skip: 'requires test database' }`
      established by WP-052 §3.1 post-mortem
- [ ] `pnpm --filter @legendary-arena/server test` reports
      `36 / 6 / 0` (with 4 additional skipped if no test DB:
      `36 / 6 / pass 32 / skipped 10 / fail 0`)

### Engine + cross-package immutability
- [ ] `git diff main -- packages/` empty
- [ ] `git diff main -- apps/{arena-client,replay-producer,registry-viewer}/` empty
- [ ] `git diff main -- apps/server/src/{server.mjs,index.mjs,rules/,par/,game/,identity/} apps/server/scripts/ apps/server/package.json` empty
- [ ] `git diff main -- data/migrations/00{1,2,3,4,5}_*.sql` empty

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

### Post-mortem
- [ ] `docs/ai/post-mortems/01.6-WP-103-replay-storage-loader.md`
      written before Commit B per 01.6 (mandatory triggers: new
      long-lived abstraction `storeReplay` / `loadReplay` consumed
      by WP-053; new contract consumed by future WPs; new persistence
      surface)

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm -r build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: 513 / 115 / 0 (unchanged from WP-052 baseline)

pnpm --filter @legendary-arena/server test
# Expected: tests 36, suites 6, fail 0
# (Or with skipped count if no test database: tests 36, suites 6,
#  pass 26, skipped 10, fail 0)

# Step 3 — confirm no boardgame.io / engine runtime imports
grep -nE "from ['\"]boardgame\.io" apps/server/src/replay/*.ts
# Expected: no output

grep -nE "from ['\"]@legendary-arena/game-engine'" apps/server/src/replay/*.ts
# Expected: at least one match (the type re-export of ReplayInput in replay.types.ts)
# — verify it is `import type`, not a runtime import

grep -nE "from ['\"]@legendary-arena/(registry|preplan|vue-sfc-loader)" apps/server/src/replay/*.ts
# Expected: no output

# Step 4 — confirm no Math.random / Date.now / require()
grep -nE "Math\.random|Date\.now" apps/server/src/replay/*.ts
# Expected: no output

grep -nE "require\(" apps/server/src/replay/*.ts
# Expected: no output

# Step 5 — confirm SQL pattern in storeReplay
grep -nE "ON CONFLICT \(replay_hash\) DO NOTHING" apps/server/src/replay/replay.logic.ts
# Expected: at least one match

grep -nE "ON CONFLICT.*DO UPDATE" apps/server/src/replay/replay.logic.ts
# Expected: no output (DO UPDATE forbidden; immutability)

# Step 6 — confirm migration shape
grep -nE "CREATE TABLE IF NOT EXISTS legendary\.replay_blobs" data/migrations/006_create_replay_blobs_table.sql
# Expected: exactly one match

grep -nE "replay_hash\s+text\s+PRIMARY KEY" data/migrations/006_create_replay_blobs_table.sql
# Expected: at least one match

grep -nE "replay_input\s+jsonb\s+NOT NULL" data/migrations/006_create_replay_blobs_table.sql
# Expected: at least one match

grep -nE "updated_at" data/migrations/006_create_replay_blobs_table.sql
# Expected: no output (no updated_at; immutability)

grep -c -e "-- why:" data/migrations/006_create_replay_blobs_table.sql
# Expected: >= 4

# Step 7 — confirm test wrapping
grep -nE "^describe\('replay storage logic \(WP-103\)" apps/server/src/replay/replay.logic.test.ts
# Expected: exactly one line

grep -cE "^test\(" apps/server/src/replay/replay.logic.test.ts
# Expected: 0 (all tests inside the single describe block)

grep -nE "skip: 'requires test database'" apps/server/src/replay/replay.logic.test.ts
# Expected: at least 4 lines (one per DB-dependent test)

# Step 8 — confirm no files outside scope changed
git diff --name-only main
# Expected: only the 4 Commit-A files + the 4 Commit-B governance
# files listed in ## Files Expected to Change

# Step 9 — confirm engine + cross-package immutability
git diff main -- packages/
# Expected: no output

git diff main -- apps/arena-client/ apps/replay-producer/ apps/registry-viewer/
# Expected: no output

git diff main -- apps/server/src/server.mjs apps/server/src/index.mjs apps/server/src/rules/ apps/server/src/par/ apps/server/src/game/ apps/server/src/identity/ apps/server/scripts/ apps/server/package.json
# Expected: no output

git diff main -- data/migrations/001_server_schema.sql data/migrations/002_seed_rules.sql data/migrations/003_game_sessions.sql data/migrations/004_create_players_table.sql data/migrations/005_create_replay_ownership_table.sql
# Expected: no output
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] Engine baseline `513 / 115 / 0` unchanged
- [ ] Server baseline `36 / 6 / 0` (with 10 skipped when no test DB:
      `36 / 6 / pass 26 / skipped 10 / fail 0`) — exactly +5 tests / +1 suite from WP-052's 31/5/0 baseline
- [ ] Every test file uses `.test.ts` — never `.test.mjs`
- [ ] No `boardgame.io`, `@legendary-arena/registry`,
      `@legendary-arena/preplan`, or `@legendary-arena/vue-sfc-loader`
      imports in any WP-103 file (grep-verified)
- [ ] `@legendary-arena/game-engine` import in `replay.types.ts` is
      type-only (`import type`)
- [ ] No `Math.random()`, `Date.now()`, `require()`, or external UUID
      library in any new file
- [ ] `storeReplay` uses `INSERT … ON CONFLICT (replay_hash) DO NOTHING`
      verbatim; no `DO UPDATE` anywhere in `replay.logic.ts`
- [ ] `replay_blobs` migration uses `CREATE TABLE IF NOT EXISTS`,
      three locked columns, no `updated_at`, no FK
- [ ] Test file wraps tests in exactly one `describe()` block
      (suite delta = +1)
- [ ] All DB-dependent tests use the locked
      `hasTestDatabase ? {} : { skip: 'requires test database' }`
      pattern
- [ ] `// why:` comments present at all required sites per §Required
      `// why:` Comments
- [ ] Post-mortem written at
      `docs/ai/post-mortems/01.6-WP-103-replay-storage-loader.md`
      (mandatory per 01.6) before Commit B
- [ ] Commit A subject line starts with `EC-103:`; Commit B subject
      line starts with `SPEC:`; `WP-103:` is forbidden per the
      commit-msg hook
- [ ] `git diff --name-only main` shows exactly 4 lines for Commit A
      (3 `.ts` source/test + 1 `.sql` migration)
- [ ] WP-027, WP-051, WP-052 contract files unmodified;
      `packages/game-engine/src/types.ts` unmodified
- [ ] `docs/ai/STATUS.md` updated with WP-103 / EC-103 current-state block
- [ ] `docs/ai/DECISIONS.md` updated if any new architectural decision
      is made during execution (e.g., `text PRIMARY KEY` divergence
      from WP-052's `bigserial` precedent — author D-10301 if not
      already filed at A0). If A0 lands D-10301 + D-10302 (jsonb
      choice + immutability) before Commit A, no further DECISIONS
      changes are needed at execution time.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-103 checked off
      with execution date + Commit A hash
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-103 row
      flipped Draft → Done with execution date

---

## Pre-Flight Self-Lint Status (00.3)

This packet has been self-reviewed against `00.3-prompt-lint-checklist.md`:

- §1 Work Packet Structure: PASS — all required sections present.
- §2 Non-Negotiable Constraints Block: PASS — engine-wide,
  packet-specific, session protocol, locked contract values all
  present; references `00.6-code-style.md`; full file contents
  required.
- §3 Prerequisites: PASS — `## Assumes` lists exact prior packets,
  exact exports, exact file paths.
- §4 Out of Scope: PASS — explicit non-scope items including the
  most adjacent-seeming ones (FK from replay_ownership, replay-
  content validation, write-back from replay-producer, retention).
- §5 Files Expected to Change: PASS — every file marked `**new**`
  or `**modified**`; no other files permitted.
- §6 Acceptance Criteria: PASS — binary checks grouped by sub-task.
- §7 Verification Steps: PASS — every command shows expected output.
- §8 Definition of Done: PASS — STATUS / DECISIONS / WORK_INDEX
  updates present; commit-prefix discipline cited.
- §17 Vision Alignment: PASS — block present with conflict assertion,
  per-clause analysis, NG-1..7 proximity check, determinism note.
- §17.1 Triggers: this WP touches the `legendary.*` namespace
  (governance trigger) and adds a new persistence surface — Vision
  Alignment block is required and present.

Pre-flight verdict: READY FOR PRE-FLIGHT INVOCATION (01.4).
