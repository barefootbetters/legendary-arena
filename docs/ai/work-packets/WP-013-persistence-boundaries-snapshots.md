# WP-013 — Persistence Boundaries & Snapshots (Explicit, Safe)

**Status:** Complete
**Primary Layer:** Architecture / Data Lifecycle
**Dependencies:** WP-012

---

## Session Context

WP-012 completed the minimum viable multiplayer loop (create → list → join →
ready → play → reconnect). This packet does two things simultaneously: it
formalises the data boundary model in code (`PERSISTENCE_CLASSES`,
`MatchSnapshot`, `PersistableMatchConfig`, `createSnapshot`,
`validateSnapshotShape`), and it creates `docs/ai/ARCHITECTURE.md` — the system
structure document that every prior packet has referenced but that did not yet
exist. The three data classes defined here (`runtime`, `configuration`,
`snapshot`) are the canonical classifications every future packet must respect.

---

## Goal

Formally define and enforce what data may be persisted in Legendary Arena, what
data must never be persisted, and how to safely create read-only snapshots for
debugging and auditing — without violating determinism or the boardgame.io
runtime model.

After this session, `@legendary-arena/game-engine` exports:
- `PERSISTENCE_CLASSES` — authoritative constants naming the three data classes
- `MatchSnapshot` — the canonical read-only derived view of a match at a point
  in time
- `PersistableMatchConfig` — the safe subset of match data that may be stored
- `createSnapshot(G, ctx, matchId)` — pure function, returns
  `Readonly<MatchSnapshot>`
- `validateSnapshotShape` — confirms a snapshot has the correct shape and was
  not round-tripped from `G` directly
- Tests that confirm snapshots are JSON-serializable and contain no live engine
  state

This packet also creates `docs/ai/ARCHITECTURE.md` — the system structure
document that every prior packet has referenced.

No database schema, migrations, or storage engines are implemented here.

---

## Assumes

- WP-012 complete. Specifically:
  - `packages/game-engine/src/types.ts` exports `LegendaryGameState` with
    `counters`, `messages`, `playerZones`, `lobby`, `currentStage`,
    `hookRegistry` (accumulated across WP-005B through WP-011)
  - `packages/game-engine/src/endgame/endgame.types.ts` exports `EndgameResult`
    with `outcome: 'heroes-win' | 'scheme-wins'` and `reason: string` (WP-010)
  - `packages/game-engine/src/matchSetup.types.ts` exports `MatchSetupConfig`
    with the 9 locked §8.1 fields (WP-005A)
  - `packages/game-engine/src/state/zones.types.ts` exports `PlayerState`,
    `PlayerZones` (WP-006A)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/DECISIONS.md` exists (created in WP-002)

**Note:** `docs/ai/ARCHITECTURE.md` does **not** exist yet — this packet creates
it. Do not reference it as a prerequisite. If running this packet after the file
already exists (e.g., in a review session), read it first but do not treat it
as the authoritative source — this packet defines the content.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `packages/game-engine/src/types.ts` — read `LegendaryGameState` entirely.
  The snapshot derives zone **counts** (not contents) from the player zones.
  Know every field before deciding what to include vs. exclude from the snapshot.
- `packages/game-engine/src/endgame/endgame.types.ts` — `EndgameResult`. The
  snapshot's `outcome` field uses this type when a match has concluded.
- `packages/game-engine/src/matchSetup.types.ts` — `MatchSetupConfig`. The
  `PersistableMatchConfig` type wraps this as the safe-to-store config record.
- `packages/game-engine/src/moves/coreMoves.types.ts` — `MoveError`. The
  snapshot validator must import and reuse this type — do not define a new error
  shape.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.2` — the authoritative
  statement that `G` and `ctx` are boardgame.io runtime-only state and must
  never be persisted as live state. This packet formalises that boundary in code.
- `docs/ai/REFERENCE/00.2-data-requirements.md §4` — what belongs in the
  database vs. in memory. This section is the source for the three data class
  definitions.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-negotiable:
  no DB queries inside boardgame.io moves; `G` must be JSON-serializable.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `playerIdentifier` not `pid`), Rule 6 (`// why:` on the count-only snapshot
  design), Rule 9 (`node:` prefix), Rule 11 (full-sentence error messages),
  Rule 13 (ESM only).

**Note on ARCHITECTURE.md:** This packet creates `docs/ai/ARCHITECTURE.md`.
Do not look for it before writing — it is an output of this session. The
architecture document is produced here because WP-013 is the natural place to
formally establish the data boundary model. It is a Markdown document, not
TypeScript — no `node:test` coverage required for it.

---

## Non-Negotiable Constraints

**Applicable engine-wide constraints:**
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets,
  or functions; all new types must satisfy this
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access of any kind
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `createSnapshot` is a pure function — no I/O, no throws, returns a frozen
  object via `Object.freeze()`
- `MatchSnapshot` contains zone **counts** only — no `CardExtId[]` arrays; this
  prevents the snapshot from becoming a secondary copy of live game state
- `validateSnapshotShape` returns structured results — never throws
- `MoveError` is imported from `coreMoves.types.ts` — do not redefine or create
  a parallel error type
- `PERSISTENCE_CLASSES` constants are the canonical data class names — every
  future packet that classifies data must import and use these, never string
  literals
- `packages/game-engine/src/game.ts` must not be modified — this packet adds
  no game logic

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **PERSISTENCE_CLASSES string values** (this packet defines these 3 canonical
  class names — every future packet that classifies data must import and use
  these constants, never the string values directly):
  `RUNTIME = 'runtime'` | `CONFIGURATION = 'configuration'` |
  `SNAPSHOT = 'snapshot'`

- **MatchSnapshot top-level keys** (this packet defines `MatchSnapshot` with
  exactly these keys — no additional fields, no live runtime fields like
  `hookRegistry`, `lobby`, or `currentStage`):
  `matchId` | `snapshotAt` | `turn` | `phase` | `activePlayer` |
  `players` | `counters` | `messages` | `outcome` (optional)

- **MatchSnapshot.players zone count fields** (derived from `PlayerZones` keys
  established in WP-006A — each player entry must have exactly these 5 count
  fields, no zone contents):
  `deckCount` | `handCount` | `discardCount` | `inPlayCount` | `victoryCount`

- **MoveError shape** (reused from WP-008A for `validateSnapshotShape` — do
  not redefine):
  `{ code: string; message: string; path: string }`

---

## Scope (In)

### A) `src/persistence/persistence.types.ts` — new
- `const PERSISTENCE_CLASSES` — readonly object with 3 named class strings:
  ```ts
  const PERSISTENCE_CLASSES = {
    RUNTIME:       'runtime',
    CONFIGURATION: 'configuration',
    SNAPSHOT:      'snapshot',
  } as const;
  ```
- `// why:` comment block documenting each class:
  - `runtime`: `G`, `ctx`, in-flight rule effects, socket/session data — exist
    only in boardgame.io's in-memory process; never persisted
  - `configuration`: `MatchSetupConfig`, player names, seat assignments,
    creation timestamp — deterministic inputs, safe to store before match starts
  - `snapshot`: turn count, phase, zone counts, counters, messages, outcome —
    derived, read-only, immutable records; never re-hydrated into a live match
- `interface PersistableMatchConfig`:
  ```ts
  interface PersistableMatchConfig {
    matchId:     string
    setupConfig: MatchSetupConfig
    playerNames: Record<string, string>  // playerId → display name
    createdAt:   string                  // ISO 8601
  }
  ```
- `interface MatchSnapshot`:
  ```ts
  interface MatchSnapshot {
    matchId:      string
    snapshotAt:   string   // ISO 8601 — when snapshot was taken
    turn:         number
    phase:        string
    activePlayer: string
    players: {
      playerId:     string
      deckCount:    number
      handCount:    number
      discardCount: number
      inPlayCount:  number
      victoryCount: number
    }[]
    counters:  Record<string, number>
    messages:  string[]
    outcome?:  { result: 'heroes-win' | 'scheme-wins'; reason: string }
  }
  ```
  Zone counts only — no `ext_id` arrays; no `hookRegistry`; no `lobby`;
  no `currentStage`
- All types JSON-serializable — no functions, no Maps, no Sets

### B) `src/persistence/snapshot.create.ts` — new
- `createSnapshot(G: LegendaryGameState, ctx: Ctx, matchId: string): Readonly<MatchSnapshot>`
  — pure function; no I/O; no throws; returns `Object.freeze(snapshot)`
  - Derives `turn` from `ctx.turn`, `phase` from `ctx.phase`,
    `activePlayer` from `ctx.currentPlayer`
  - For each player, computes zone counts from `G.playerZones`
  - Copies `G.counters` and `G.messages` by value (shallow copy — already plain
    objects/arrays)
  - Sets `outcome` from `G.endgameResult` if present; `undefined` if game
    ongoing
  - Sets `snapshotAt` using `new Date().toISOString()`
- `// why:` comment: zone counts not contents prevents snapshots from becoming
  a second source of truth about card positions; the live `G` is authoritative;
  snapshots are audit records only

### C) `src/persistence/snapshot.validate.ts` — new
- `validateSnapshotShape(input: unknown): { ok: true } | { ok: false; errors: MoveError[] }`
  — validates `input` has all required `MatchSnapshot` fields and correct types
  — does NOT check that `matchId` exists in any store
  — returns structured results, never throws
- Imports `MoveError` from `../moves/coreMoves.types.js` — not a local
  redefinition

### D) `docs/ai/ARCHITECTURE.md` — new Markdown document (not TypeScript)
- Five required sections:
  1. **System Overview** — monorepo package boundaries (`packages/game-engine`,
     `packages/registry`, `apps/server`) with import rules table
  2. **Data Flow** — how `MatchSetupConfig` flows from creation through
     boardgame.io `setup()` into `G`; server startup sequence; registry metadata
     file shapes; zone & pile structure
  3. **Persistence Boundaries** — the three data classes from (A) above, with a
     table mapping each field/object to its data class; includes `G`, `ctx`,
     `MatchSetupConfig`, `MatchSnapshot`
  4. **boardgame.io Runtime Model** — what `G` and `ctx` are; why they must
     never be persisted; how `endIf` and `endTurn` work; phase sequence;
     turn stage cycle; move validation contract; zone mutation rules; rule
     execution pipeline; endgame contract
  5. **Package Dependency Rules** — what can import what; `game-engine` has no
     dependency on `server`; `registry` has no dependency on `game-engine`
- No `node:test` coverage required — this is a Markdown document

### E) `src/types.ts` — modified
- Re-export `MatchSnapshot`, `PersistableMatchConfig`, `PERSISTENCE_CLASSES`
  alongside existing game state types

### F) `src/index.ts` — modified
- Export `createSnapshot`, `validateSnapshotShape`, `MatchSnapshot`,
  `PersistableMatchConfig`, `PERSISTENCE_CLASSES` as named public exports

### G) Tests — `src/persistence/snapshot.create.test.ts` — new
- Uses `node:test` and `node:assert` only; does not import from `boardgame.io`;
  uses a plain mock `G` object (not `makeMockCtx` — snapshot takes a full `G`
  and `ctx`, both of which can be plain objects for testing)
- Seven tests:
  1. `createSnapshot` with valid `G` and `ctx` returns a `MatchSnapshot`
     with correct zone counts
  2. `JSON.stringify(snapshot)` succeeds — no functions, no circular refs
  3. Snapshot does NOT contain `G.hookRegistry`, `G.lobby`, or
     `G.currentStage` as keys — confirmed by asserting the snapshot keys are
     exactly the expected set
  4. `createSnapshot` called twice on the same `G` returns identical snapshots
     (deterministic)
  5. `validateSnapshotShape` returns `{ ok: true }` on a valid snapshot
  6. `validateSnapshotShape` returns `{ ok: false }` when `turn` is missing
  7. Zone counts in the snapshot match the lengths of the source zone arrays
     in `G`

---

## Out of Scope

- No database schema, migrations, or PostgreSQL access
- No storage engine — snapshots are types and helpers only; WP-034 handles
  versioning and save migration
- No snapshot retrieval or listing API
- No automatic snapshot trigger — snapshots are created on demand; the caller
  decides when to call `createSnapshot`
- No changes to boardgame.io lifecycle — `game.ts` must not change
- No server or UI changes
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/persistence/persistence.types.ts` — **new** —
  three data class constants, `MatchSnapshot`, `PersistableMatchConfig`
- `packages/game-engine/src/persistence/snapshot.create.ts` — **new** —
  `createSnapshot` pure function
- `packages/game-engine/src/persistence/snapshot.validate.ts` — **new** —
  `validateSnapshotShape`
- `packages/game-engine/src/types.ts` — **modified** — re-export persistence
  types
- `packages/game-engine/src/index.ts` — **modified** — export new public API
- `packages/game-engine/src/persistence/snapshot.create.test.ts` — **new** —
  `node:test` coverage
- `docs/ai/ARCHITECTURE.md` — **new** — system structure document

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Persistence Types
- [ ] `PERSISTENCE_CLASSES` is exported with exactly 3 string values:
      `'runtime'`, `'configuration'`, `'snapshot'`
- [ ] `MatchSnapshot` exports with exactly these top-level keys:
      `matchId`, `snapshotAt`, `turn`, `phase`, `activePlayer`, `players`,
      `counters`, `messages`, `outcome` (optional)
- [ ] `MatchSnapshot.players` entries contain exactly 5 count fields —
      no zone contents, no `CardExtId[]` arrays
      (confirmed with `Select-String` for `CardExtId\[\]|string\[\]` in
      `persistence.types.ts` — expected: no output)
- [ ] `PersistableMatchConfig` contains `matchId`, `setupConfig`,
      `playerNames`, `createdAt` — no `G`, no `ctx`

### Snapshot Creation
- [ ] `createSnapshot` is exported from `snapshot.create.ts`
- [ ] `createSnapshot` returns a `Readonly<MatchSnapshot>` (frozen object)
- [ ] `JSON.stringify(createSnapshot(G, ctx, matchId))` succeeds
- [ ] `createSnapshot` has a `// why:` comment explaining zone counts only
- [ ] `createSnapshot` contains no `throw` statement
      (confirmed with `Select-String`)

### Snapshot Validator
- [ ] `validateSnapshotShape` is exported from `snapshot.validate.ts`
- [ ] `validateSnapshotShape` contains no `throw` statement
      (confirmed with `Select-String`)
- [ ] `validateSnapshotShape` imports `MoveError` from `coreMoves.types.ts` —
      not a local redefinition
      (confirmed with `Select-String` for the import path)

### Architecture Document
- [ ] `docs/ai/ARCHITECTURE.md` exists and has all 5 sections named in
      Scope (In)
- [ ] Section 3 contains a table mapping at least `G`, `ctx`,
      `MatchSetupConfig`, and `MatchSnapshot` to their data classes
- [ ] Section 5 explicitly states that `game-engine` has no dependency on
      `server`

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Snapshot test confirms `hookRegistry` is NOT a key in the snapshot
- [ ] Snapshot test confirms two calls on the same `G` produce identical output
- [ ] `validateSnapshotShape` test covers both `{ ok: true }` and
      `{ ok: false }` cases
- [ ] Test file does not import from `boardgame.io`
      (confirmed with `Select-String`)
- [ ] Test uses `node:test` and `node:assert` only

### Scope Enforcement
- [ ] `packages/game-engine/src/game.ts` was not modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding persistence types
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm createSnapshot does not throw
Select-String -Path "packages\game-engine\src\persistence\snapshot.create.ts" -Pattern "throw "
# Expected: no output

# Step 4 — confirm snapshot validator does not throw
Select-String -Path "packages\game-engine\src\persistence\snapshot.validate.ts" -Pattern "throw "
# Expected: no output

# Step 5 — confirm MatchSnapshot has no ext_id array fields
Select-String -Path "packages\game-engine\src\persistence\persistence.types.ts" -Pattern "CardExtId\[\]|string\[\]"
# Expected: no output (zone contents are counts, not arrays)

# Step 6 — confirm ARCHITECTURE.md was created with all 5 sections
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "## Section [1-5]|^## [1-5]"
# Expected: 5 matches

# Step 7 — confirm game.ts was not modified
git diff --name-only packages/game-engine/src/game.ts
# Expected: no output

# Step 8 — confirm no require() in any generated file
Select-String -Path "packages\game-engine\src\persistence" -Pattern "require(" -Recurse
# Expected: no output

# Step 9 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] No `throw` in `snapshot.create.ts` or `snapshot.validate.ts`
      (confirmed with `Select-String`)
- [ ] `MatchSnapshot` has no `CardExtId[]` array fields
      (confirmed with `Select-String`)
- [ ] `docs/ai/ARCHITECTURE.md` exists with all 5 required sections
- [ ] `packages/game-engine/src/game.ts` was not modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what persistence boundary types are now
      exported; that `ARCHITECTURE.md` was created
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why snapshots use zone
      counts rather than `ext_id` arrays; why `createSnapshot` is a pure
      function rather than an async write-to-DB operation; why
      `PersistableMatchConfig` excludes `G` and `ctx`
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-013 checked off with today's date
