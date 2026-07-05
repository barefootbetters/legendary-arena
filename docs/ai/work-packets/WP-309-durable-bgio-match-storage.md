# WP-309 — Durable boardgame.io Match Storage (survive deploy / restart)

**Status:** Ready
**Primary Layer:** Server / Infra
**Dependencies:** WP-115 (long-lived `pg.Pool` construction in `server.mjs`); relates to WP-116 (disconnect / reconnect posture — D-11601..D-11605, deferred). No hard dependency blocks drafting; execution depends on the reconciliation below.
**User-Visible Surface:** play.legendary-arena.com — an in-progress match survives a server deploy or restart instead of freezing on its last state.

> This is the authored form of roadmap item **Future-WP-I** (docs/05-ROADMAP.md:323-327), the
> root cause of the 2026-06-16 and 2026-07-05 play.legendary-arena.com mid-match freezes.

---

## Session Context

WP-115 established the single long-lived `pg.Pool` constructed once in `startServer()` (lifetime = process lifetime, closed on SIGTERM by `index.mjs`); the boardgame.io `Server({...})` at `apps/server/src/server.mjs:513` is built with **no `db:` option**, so boardgame.io falls back to its `InMemory` match store — this packet swaps that store for a durable Postgres-backed adapter without changing any engine or move code.

---

## Goal

After this session, `apps/server` constructs the boardgame.io `Server({...})` with an explicit `db:` storage adapter backed by the existing PostgreSQL instance, so match state (which boardgame.io internally serializes from `G`/`ctx`) is persisted to durable storage and reloaded on process start. A server restart or auto-deploy no longer discards in-progress matches: a client that was mid-match before the restart can continue submitting moves against the reloaded match state. The engine, moves, zone ops, and snapshot code are **unchanged** — the only behavioral change is where boardgame.io keeps its own match store.

---

## User-Visible Impact

A player in the middle of a match on play.legendary-arena.com no longer freezes when the server redeploys (which happens on every push to `main`). Before this packet, each deploy restarts the process and wipes boardgame.io's in-memory match store, so every live match's state vanishes and the client hangs on its last-rendered board with no way to advance. After this packet, the match state is reloaded from Postgres on start-up and the player can keep playing. This is the direct fix for the reported "game froze" incidents (2026-06-16, 2026-07-05).

---

## Architecture Reconciliation (Operator-Approved 2026-07-05)

> **This section is the crux of the packet. The reconciliation wording below was
> approved by the operator at draft time (2026-07-05).** Execution lands the wording
> into `docs/ai/ARCHITECTURE.md` + the `.claude/rules/architecture.md` mirror + a
> `DECISIONS.md` entry, in the implementation commit. The roadmap note flagged exactly
> this: *"Carries an architecture-invariant reconciliation (the `G` is never persisted
> line) to settle when the WP is authored."*

**The tension.** ARCHITECTURE.md §Persistence Boundary and `.claude/rules/architecture.md`
state the invariant **"`G` is never persisted, stored, cached, or written to any database."**
Surviving a restart *requires* persisting match state, and boardgame.io's own match blob
internally contains a serialization of `G` and `ctx`. Taken literally, the invariant forbids
the fix.

**The resolution.** The invariant's load-bearing intent (per the Persistence Boundary and the
`legendary-persistence` skill) is that **application code** never treats `G` as a save-game:
never writes `G` into the *application domain schema* (`legendary.*`), never reads it back to
reconstruct or branch game logic, never builds features on a persisted `G`; snapshots store
**counts only**. boardgame.io's *own* storage layer round-tripping its opaque match blob to
survive a restart is a **framework / operational durability** concern, categorically distinct
from application code persisting `G`. The existing Persistence Boundary table already lists
"Live game state (`G`) | boardgame.io in-memory | Yes — via moves only," i.e. the framework
already owns `G`'s lifecycle; this packet only makes that framework-owned store durable.

**To keep the boundary crisp and enforceable, the reconciliation is:**

1. The boardgame.io store lives in a **dedicated `bgio` schema**, never in `legendary.*`.
   This physically separates framework operational state from application domain data.
2. **No application code** (routes, engine, snapshot builders) reads the `bgio` store's match
   rows for game logic. The store is written and read **only** by boardgame.io internals
   through the storage adapter.
3. The invariant wording in ARCHITECTURE.md + `.claude/rules/architecture.md` is amended to:
   *"`G` is never persisted by application code, nor written to the `legendary.*` domain
   schema. boardgame.io's storage adapter MAY persist its own opaque match state (its internal
   serialization of `G`/`ctx`) to a dedicated non-domain store as an operational durability
   concern; that blob is never read or interpreted by application code, never a save-game, and
   never a source of derived features. Snapshots remain counts-only."*

**Operator disposition (2026-07-05):** the reconciliation wording above is **approved**.
The three edits (ARCHITECTURE.md, `.claude/rules/architecture.md` mirror, DECISIONS.md)
are made **in the implementation commit** — the approval, not the WP/EC allowlist alone,
authorizes the authority-doc edit.

---

## Adapter Approach (Operator-Approved: Option A)

Two viable ways to supply the `db:` adapter for boardgame.io ^0.50. Both persist to the existing
Postgres; they differ in dependency weight and control.

**Option A — Custom `StorageAPI.Async` over the existing `pg.Pool` (recommended).**
Implement boardgame.io's `StorageAPI.Async` interface (`connect`, `createMatch`/`setState`,
`fetch`, `setMetadata`, `listMatches`, `wipe`, `remove`) as a small server-layer module backed
by the `pg.Pool` WP-115 already constructs. Match state + metadata stored as `jsonb` in a
`bgio.matches` table. **No new dependency**, full control over the schema, and the adapter is a
pure wiring artifact (Server layer — it stores, it does not decide gameplay). Cost: we own ~1
file of adapter code + its tests.

**Option B — Community `bgio-postgres` adapter.**
Add the community package and pass its instance as `db:`. Cost: it pulls in **Sequelize** (a
heavy ORM dependency) and manages its own tables/migrations outside our `pg`/migration
conventions, with less control over the schema-boundary point above. Faster to wire, heavier
footprint.

**Selected: Option A** (operator-approved 2026-07-05). It adds no ORM dependency, keeps the
store inside our existing `pg` + migration conventions and the dedicated `bgio` schema, and
matches the Server-layer "wires, does not decide" role. The Scope/Files/AC below are written
for Option A. Option B (`bgio-postgres` + Sequelize) is explicitly rejected — recorded in the
DECISIONS entry as the rejected alternative.

---

## Assumes

- WP-115 complete. Specifically:
  - `apps/server/src/server.mjs` constructs a long-lived `pg.Pool` via `createPool()` from
    `./db/database.js` and returns it from `startServer()`; `index.mjs` closes it on SIGTERM.
  - `apps/server/src/server.mjs:513` — `const server = Server({ games, origins })` with no
    `db:` option (the gap this packet closes).
- The production Postgres reachable via `DATABASE_URL` (the same instance the rules loader,
  profiles, entitlements, etc. already use) is writable and migratable.
- `pnpm --filter @legendary-arena/server` scripts run; `apps/server` has DB-backed test suites
  gated on `TEST_DATABASE_URL` (skip when unset).

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Persistence Boundary` and `§Persisted vs Runtime` — read the
  invariant this packet reconciles and the existing "boardgame.io in-memory" table rows.
- `.claude/rules/architecture.md §Persistence Boundary (Cross-Layer)` and
  `§G and ctx Are Runtime-Only` — the enforcement mirror to sync.
- `.claude/skills/legendary-persistence/SKILL.md` — the persistence authority; confirm the
  reconciliation does not violate the counts-only snapshot rule.
- `.claude/skills/legendary-server/SKILL.md` — Server-layer role ("wires, does not decide"),
  which the storage adapter must respect.
- `apps/server/src/server.mjs` — read `startServer()` entirely, especially the `Server({...})`
  construction (`:513`) and the `pg.Pool` construction (WP-115 block, `~:594`). The adapter
  needs the pool available **at Server() construction time**, which is currently built after.
- `apps/server/src/db/database.js` — the `createPool()` contract and pool lifetime.
- `apps/server/src/index.mjs` — SIGTERM graceful-shutdown ordering (pool close after HTTP
  server close); the adapter must not break that ordering.
- The existing migration convention under `apps/server` (the `legendary.*` schema, `bigserial`
  PKs, `ext_id text`) — this packet adds a **`bgio` schema** migration, deliberately outside
  `legendary.*`, per the reconciliation.
- boardgame.io ^0.50 `StorageAPI` / `Async` interface (the method contract the adapter implements).
- `docs/05-ROADMAP.md:323-327` — the Future-WP-I note this packet authors.

---

## Non-Negotiable Constraints

**Server-layer (always apply):**
- The storage adapter **wires and stores only** — it never reads, interprets, or branches on
  game logic in the match blob. It is not a "coordinator" of gameplay.
- No engine, move, zone-op, or snapshot code is modified. `G` is not read by application code
  from the store.
- ESM only, Node v22+; `node:` prefix on built-ins; `.test.ts` for tests.
- Full-sentence error messages including what failed and what to check.
- Every `async` DB call handles errors explicitly; no silently-swallowed errors without a
  `// why:`.

**Packet-specific:**
- The bgio store lives in a **dedicated `bgio` schema**, never `legendary.*`.
- The adapter is the **only** reader/writer of `bgio.matches`. No route handler or engine code
  queries it.
- The `pg.Pool` is **not** duplicated — the adapter reuses the single WP-115 pool. If Server()
  must be constructed before the pool today, the pool construction is reordered ahead of it
  (documented with a `// why:`), preserving the single-pool, close-on-SIGTERM invariant.
- Adapter method contract matches boardgame.io ^0.50 `StorageAPI.Async` exactly — do not invent
  method names or a parallel error contract.

**Session protocol:**
- If the `StorageAPI` method contract for ^0.50 is unclear, stop and confirm against the
  installed `boardgame.io` types before writing — never guess the interface shape.

---

## Debuggability & Diagnostics

- Match persistence must be reproducible: given the same sequence of moves, the reloaded match
  state after a simulated restart equals the pre-restart state (proven by a round-trip test:
  write via `setState`, re-`fetch`, assert deep-equal).
- The adapter surfaces DB failures as thrown errors from its async methods (boardgame.io's
  contract), with full-sentence messages naming the operation (`createMatch`, `fetch`, etc.) —
  never a bare catch.
- A startup log line states which store is active (`Postgres` vs `InMemory` fallback) so a
  misconfigured deploy is observable rather than silently in-memory again.
- No new runtime state is added to `G`; `G` remains JSON-serializable (unchanged).

---

## Scope (In)

### A) Postgres-backed `StorageAPI.Async` adapter (Option A)
- **`apps/server/src/db/bgioPgStore.js`** — new:
  - `createBgioPgStore(pool): StorageAPI.Async` — a factory returning an object implementing
    boardgame.io ^0.50's async storage contract: `connect()`, `createMatch(matchID, opts)`,
    `setState(matchID, state, deltalog?)`, `setMetadata(matchID, metadata)`,
    `fetch(matchID, opts)`, `wipe(matchID)`, `listMatches(opts?)`, `remove(matchID)` (confirm
    the exact set/signatures against the installed `boardgame.io/server` types before writing).
  - State + metadata stored as `jsonb` in `bgio.matches` keyed by `match_id text primary key`.
  - Each method reuses the injected `pool`; no new pool, no per-call connect/disconnect.
  - `// why:` comment on the schema-boundary choice (dedicated `bgio` schema, never `legendary.*`)
    and on the "adapter never interprets the blob" invariant.
  - Full-sentence errors naming the failing operation and the `match_id`.

### B) Migration — `bgio` schema + `bgio.matches`
- **`apps/server/migrations/<NNN>-bgio-match-store.sql`** (follow the existing migration naming/
  location convention) — new:
  - `create schema if not exists bgio;`
  - `create table if not exists bgio.matches (match_id text primary key, state jsonb not null,
    metadata jsonb, initial_state jsonb, log jsonb, updated_at timestamptz not null default now());`
    (final column set matches what the adapter's method contract needs — reconcile against the
    `StorageAPI` shape).
  - `// why:`-style SQL comment: this schema is boardgame.io's operational store, deliberately
    outside `legendary.*` per the WP-309 reconciliation.

### C) Wire the adapter into `Server({...})`
- **`apps/server/src/server.mjs`** — modified:
  - Construct (or reorder to construct) the `pg.Pool` **before** `Server({...})`, then pass
    `db: createBgioPgStore(pool)` into the `Server({ games, origins, db })` options.
  - Preserve every existing option (games, origins) byte-identical.
  - Preserve the single-pool + close-on-SIGTERM invariant (index.mjs unchanged, or its shutdown
    ordering re-verified).
  - Startup log line naming the active store.
  - `// why:` on the reorder and on the `db:` wiring citing WP-309 + the DECISIONS entry.

### D) ARCHITECTURE / rules / DECISIONS reconciliation edits (in the impl commit)
- **`docs/ai/ARCHITECTURE.md`** — modified: amend the Persistence Boundary invariant wording
  per `## Architecture Reconciliation`; add a row/note for the bgio durable store.
- **`.claude/rules/architecture.md`** — modified: sync the mirror wording.
- **`docs/ai/DECISIONS.md`** — modified: new D-entry recording the reconciliation (why the
  framework store is exempt from "G never persisted," why the dedicated `bgio` schema, why
  Option A over Option B).

### E) Tests
Add tests in `apps/server/src/db/bgioPgStore.test.ts` (DB-backed, gated on `TEST_DATABASE_URL`,
skip when unset — the established `apps/server` pattern):
- Round-trip: `createMatch` → `fetch` returns the written state/metadata.
- `setState` then `fetch` returns the updated state (restart-survival proof).
- `wipe`/`remove` deletes the row; `fetch` after wipe returns empty.
- `listMatches` returns created match IDs.
- Adapter methods throw full-sentence errors on a forced DB failure (naming the operation).
- Adapter writes only to the `bgio` schema (assert the table qualifier).

---

## Out of Scope

- **No disconnect / reconnect handler wiring** — that is WP-116 (D-11601..D-11605, deferred).
  This packet makes the store durable; it does not add reconnection UX.
- **No change to `G`, moves, zone ops, snapshots, or any engine code.**
- **No new dependency** (Option A). No Sequelize, no ORM.
- **No reads of the `bgio` store by any route handler, the engine, or snapshot code.**
- **No migration of existing in-memory matches** — matches live at cutover are not backfilled
  (a one-time acceptable loss on the deploy that ships this).
- Refactors or "while I'm here" cleanups outside the files below.

---

## Files Expected to Change

- `apps/server/src/db/bgioPgStore.js` — **new** — Postgres `StorageAPI.Async` adapter.
- `apps/server/src/db/bgioPgStore.test.ts` — **new** — DB-backed round-trip tests (gated).
- `apps/server/migrations/<NNN>-bgio-match-store.sql` — **new** — `bgio` schema + `matches` table.
- `apps/server/src/server.mjs` — **modified** — pool reorder + `db:` wiring + startup log.
- `docs/ai/ARCHITECTURE.md` — **modified** — Persistence Boundary reconciliation.
- `.claude/rules/architecture.md` — **modified** — mirror sync.
- `docs/ai/DECISIONS.md` — **modified** — reconciliation D-entry.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — register + check off WP-309.
- `docs/ai/STATUS.md` — **modified** — capability now available.
- `docs/05-ROADMAP.md` — **modified** — flip Future-WP-I 📦 Queued → authored/done.

No other files may be modified.

---

## Acceptance Criteria

### A) Adapter
- [ ] `createBgioPgStore(pool)` returns an object implementing every `StorageAPI.Async` method
      boardgame.io ^0.50 requires, signatures matching the installed types.
- [ ] The adapter reuses the injected pool — no `new Pool` inside the module (confirmed with
      `Select-String`).
- [ ] No import of `@legendary-arena/game-engine` or any engine path in the adapter (it never
      interprets `G`) (confirmed with `Select-String`).

### B) Migration
- [ ] Migration creates schema `bgio` and table `bgio.matches`; contains no `legendary.`
      qualifier (confirmed with `Select-String`).

### C) Wiring
- [ ] `Server({...})` is called with a `db:` property; `games` and `origins` are byte-identical
      to before.
- [ ] Exactly one `pg.Pool` is constructed in `server.mjs` (confirmed with `Select-String` for
      `createPool(`/`new Pool`).
- [ ] Startup logs the active store name.

### D) Reconciliation
- [ ] ARCHITECTURE.md and `.claude/rules/architecture.md` invariant wording updated identically
      per the approved reconciliation.
- [ ] DECISIONS.md has the new D-entry.

### Tests
- [ ] `pnpm --filter @legendary-arena/server test` passes (DB suites run when `TEST_DATABASE_URL`
      set; skip cleanly when unset).
- [ ] Round-trip test proves `setState` → `fetch` equality (restart-survival).
- [ ] Tests use `node:test` + `node:assert`.

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build the server workspace
pnpm --filter @legendary-arena/server build
# Expected: exits 0 (note: apps/server has no tsconfig typecheck; build = its build script)

# Step 2 — run server tests (set TEST_DATABASE_URL to exercise the DB suite)
$env:TEST_DATABASE_URL = $env:DATABASE_URL
pnpm --filter @legendary-arena/server test
# Expected: all tests pass; bgioPgStore round-trip suite runs (not skipped)

# Step 3 — confirm the adapter never constructs its own pool
Select-String -Path "apps\server\src\db\bgioPgStore.js" -Pattern "new Pool|createPool"
# Expected: no output

# Step 4 — confirm the adapter imports no engine code
Select-String -Path "apps\server\src\db\bgioPgStore.js" -Pattern "game-engine"
# Expected: no output

# Step 5 — confirm the migration stays out of the legendary.* domain schema
Select-String -Path "apps\server\migrations\*-bgio-match-store.sql" -Pattern "legendary\."
# Expected: no output

# Step 6 — confirm Server() now gets a db: option
Select-String -Path "apps\server\src\server.mjs" -Pattern "db:"
# Expected: the db: wiring line

# Step 7 — scope check
git diff --name-only
# Expected: only files in ## Files Expected to Change
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification (surface = play.legendary-arena.com):** confirmed **live** —
      a match is in progress on the deployed server, the server is restarted/redeployed, and the
      same client can still submit a move and see it applied (the match did not freeze). Evidence
      captured (observed behavior + the deploy-confirmed commit SHA serving the change). Tests
      alone do NOT satisfy this item. (D-24026)
- [ ] All acceptance criteria pass.
- [ ] `pnpm --filter @legendary-arena/server build` exits 0.
- [ ] `pnpm --filter @legendary-arena/server test` passes (DB suite run at least once with
      `TEST_DATABASE_URL` set).
- [ ] Architecture reconciliation approved by the operator and the ARCHITECTURE.md / rules /
      DECISIONS edits landed in the impl commit.
- [ ] No engine/move/snapshot file modified (`git diff`).
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — in-progress matches now survive deploy/restart.
- [ ] `docs/ai/DECISIONS.md` updated — the reconciliation + adapter-choice D-entry.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-309 checked off with today's date.
- [ ] `docs/05-ROADMAP.md` Future-WP-I flipped from 📦 Queued.

---

## Vision Alignment

> §17 triggered: this WP touches Determinism / RNG sourcing (Vision §3, §8) and Multiplayer
> synchronization / reconnection (Vision §4).

- **Vision clauses touched:** §3 (determinism), §4 (multiplayer sync / reconnection), §8 (RNG
  sourcing / replay). No monetization, scoring, PAR, or identity clause is touched.
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.` The engine's
  determinism and RNG sourcing are unchanged — no move, `ctx.random.*` call, or replay path is
  modified. Persisting boardgame.io's own opaque match store to survive a restart does not alter
  how the game replays; it makes the framework's already-authoritative state durable across a
  process boundary. Multiplayer §4 is strictly improved: a match survives a deploy instead of
  desyncing every client to a frozen board.
- **Non-Goal proximity check:** none of NG-1..7 are crossed. No pay-to-win, no paid surface, no
  persuasive copy — this is server durability infrastructure.
- **Determinism preservation:** the change is deterministic and replay-faithful (Vision §22). No
  application code reads or interprets the persisted blob; the engine sees the same `G` it would
  have held in memory. `G` remains JSON-serializable and unmodified. Replays reconstruct from
  the same inputs regardless of whether the store was in-memory or Postgres.

---

## Lint Gate Self-Review

> Per 01.0a Step 5 / 00.3. All 21 sections resolved. Verdict: **PASS.**

- **§1 Structure** — PASS. All required sections present and non-empty (Goal, Assumes, Context,
  Scope In, Out of Scope, Files Expected to Change, Non-Negotiable Constraints, Acceptance
  Criteria, Verification Steps, Definition of Done). `## Out of Scope` names ≥2 adjacent
  exclusions (disconnect/reconnect wiring; existing-match backfill).
- **§2 Constraints block** — PASS. Server-layer + packet-specific + session protocol + locked
  values present; full-file-contents implied by the standard engine-wide set; references
  `00.6-code-style.md` via the code-style constraint. No partial-output permission.
- **§3 Assumes** — PASS. WP-115 pool dependency + the `server.mjs:513` no-`db:` gap + writable
  Postgres listed; nothing left implicit.
- **§4 Context** — PASS. ARCHITECTURE.md §Persistence Boundary, `.claude/rules/architecture.md`,
  the persistence + server skills, `server.mjs`, `database.js`, `index.mjs`, migration
  convention, bgio `StorageAPI` all cited specifically. Touches no card-data shape → 00.2 not
  required, but canonical field names apply (§6).
- **§5 Files Expected to Change** — PASS. Every file `new`/`modified` with a one-line
  description; no ambiguous "update this section" language. Code surface is 4 files (adapter,
  test, migration, server.mjs); the rest are governance ledgers (excluded from the ~8-file
  split threshold).
- **§6 Naming** — PASS. `matchId`, `pg.Pool`, `bgio.matches` consistent; no MatchSetup fields
  touched. `match_id` column matches the bgio blob key, not a 00.2 domain field.
- **§7 Dependency discipline** — PASS. **Hard decision made: no new dependency** (Option A).
  Option B (`bgio-postgres` + Sequelize / ORM) explicitly rejected — satisfies the "no ORMs;
  use `pg` only" rule.
- **§8 Architectural boundaries** — PASS. The reconciliation (this WP's crux) resolves the
  `G`-never-persisted tension explicitly: framework store in a dedicated `bgio` schema, never
  read by application code, never `legendary.*`. `pg` pool (not a single client) reused. No move
  touches the DB. Server-layer wiring only.
- **§9 Windows compat** — PASS. Verification Steps use `pwsh` + `Select-String` + `\` paths.
- **§10 Env vars** — PASS. Reuses existing `DATABASE_URL` / `TEST_DATABASE_URL`; no new var, no
  secret in output.
- **§11 Auth** — N/A. This WP touches no authentication surface (no verifier, token, or
  protected-endpoint change).
- **§12 Tests** — PASS. `node:test` + `node:assert`, DB-gated on `TEST_DATABASE_URL`, no
  boardgame.io import in tests; round-trip (restart-survival) test mandated.
- **§13 Verification** — PASS. `pnpm --filter` commands, exact `Select-String` checks, expected
  output shown inline.
- **§14 Acceptance Criteria** — PASS. Binary, observable, file/symbol-specific; grouped by
  sub-task; aligned to deliverables.
- **§15 Definition of Done** — PASS. STATUS.md / DECISIONS.md / WORK_INDEX.md updates + scope
  check present. §15.1: `User-Visible Surface: play.legendary-arena.com` declared; DoD includes
  a live-on-surface verification item (restart a live match, confirm it continues) not
  satisfiable by tests + merge alone (D-24026).
- **§16 Code style** — PASS (WP-level). Adapter methods small + JSDoc'd, full-sentence errors,
  `// why:` on the reconciliation + reorder, no premature abstraction (single adapter module),
  no `import *`.
- **§17 Vision Alignment** — PASS. `## Vision Alignment` present, cites §3/§4/§8/§22 by clause,
  asserts no conflict, includes the determinism-preservation line.
- **§18 Prose-vs-grep** — PASS. Verification greps target `new Pool`/`game-engine`/`legendary.`/
  `db:`; no adjacent prose enumerates those as forbidden tokens without a D-cite.
- **§19 Bridge-vs-HEAD** — N/A at lint (commit-time discipline); the drafting commit re-checks
  `git log` before landing.
- **§20 Funding Surface Gate** — N/A. Server durability infrastructure; no funding affordance,
  no donate/support copy, no funding-channel integration touched.
- **§21 API Catalog** — N/A. No HTTP endpoint added, modified, removed, or status-changed, and
  no `apps/server/src/**` `Library-only` catalog function changed. The bgio `db:` swap + a
  startup log line touch no route surface in `api-endpoints.md`.
