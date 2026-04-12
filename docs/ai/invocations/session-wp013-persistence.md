# Work Packet Invocation — WP-013 (Persistence Boundaries & Snapshots)

**FILE TYPE:** Invocation Prompt
**AUDIENCE:** Claude Code (Execution Mode)
**PURPOSE:** Pre-execution contract setup for a single Work Packet
**SCOPE:** This file defines *what may be done* in the upcoming WP execution

---

## Invocation Header

**Work Packet ID:** `WP-013`
**Work Packet Title:** Persistence Boundaries & Snapshots (Explicit, Safe)
**Execution Mode:** EC-Mode (Execution Checklist enforced)
**Invocation Type:** Single-WP Execution
**Status:** Ready to Execute
**Pre-Flight Date:** 2026-04-11
**Pre-Flight Verdict:** READY TO EXECUTE

---

## Invocation Intent

You are about to execute **WP-013** in the Legendary Arena codebase.

This invocation defines **exact scope**, **authority order**, **allowed changes**,
and **forbidden behavior** for this Work Packet execution.

WP-013 formalises the data boundary model in code: `PERSISTENCE_CLASSES`,
`MatchSnapshot`, `PersistableMatchConfig`, `createSnapshot`, and
`validateSnapshotShape`. It also updates `docs/ai/ARCHITECTURE.md` to ensure
Section 3 (Persistence Boundaries) contains the three-class data model and
field-to-class mapping table.

**Work Packet Class:** Contract-Only (types/contracts/tests only). No game
logic changes, no moves, no phase hooks, no `game.ts` modifications.

You must operate strictly within this contract.

---

## Authority Chain (Must Read In Order)

Before executing any step, you must read and follow these documents **in this order**:

1. `.claude/CLAUDE.md`
   - EC-mode rules
   - Bug handling rules
   - Commit discipline

2. `docs/ai/ARCHITECTURE.md`
   - **This file already exists (1173 lines).** Read it fully before modifying.
   - Layer boundaries, persistence rules, package import rules
   - Section 3 will be updated (not replaced) — see Risk 1 below

3. `.claude/rules/persistence.md`
   - The three data classes (runtime, configuration, snapshot)
   - What lives where table
   - Snapshot creation and validation rules
   - Prohibited persistence behaviors

4. `.claude/rules/game-engine.md`
   - G is runtime-only, never persisted
   - Zone contents are CardExtId strings only
   - No boardgame.io imports in pure helpers

5. `.claude/rules/code-style.md`
   - Rule 4 (no abbreviations — `playerIdentifier` not `pid`)
   - Rule 6 (`// why:` on zone counts design and snapshotAt timestamp)
   - Rule 9 (`node:` prefix on all Node built-in imports)
   - Rule 11 (full-sentence error messages)
   - Rule 13 (ESM only)

6. `docs/ai/execution-checklists/EC-013-persistence.checklist.md`
   - The governing execution checklist for this WP

7. `docs/ai/work-packets/WP-013-persistence-boundaries-snapshots.md`
   - The formal specification for this Work Packet

Then reference (read-only unless explicitly listed in Files Allowed to Change):

8. `packages/game-engine/src/types.ts` — `LegendaryGameState` (lines 144-197);
   the snapshot derives zone counts from `G.playerZones`
9. `packages/game-engine/src/endgame/endgame.types.ts` — `EndgameResult`,
   `EndgameOutcome` — snapshot `outcome` uses this type
10. `packages/game-engine/src/matchSetup.types.ts` — `MatchSetupConfig` —
    `PersistableMatchConfig` wraps this
11. `packages/game-engine/src/state/zones.types.ts` — `PlayerZones` with 5
    zones: `deck`, `hand`, `discard`, `inPlay`, `victory`
12. `packages/game-engine/src/moves/coreMoves.types.ts` — `MoveError` with
    `{ code, message, path }` — imported by `validateSnapshotShape`

If any document conflicts, **higher-authority documents win**.

---

## Pre-Flight Findings (2026-04-11)

Pre-flight validation confirmed readiness. Key findings:

### Prerequisites Verified

- WP-012 complete (2026-04-11, commit `f388e3f`) — CLI scripts committed,
  server verified, minimum viable multiplayer loop complete
- `LegendaryGameState` has all required fields: `matchConfiguration`,
  `selection`, `currentStage`, `playerZones`, `piles`, `messages`,
  `counters`, `hookRegistry`, `lobby`
- `EndgameResult` exists in `endgame.types.ts` (WP-010)
- `MatchSetupConfig` with 9 locked fields exists (WP-005A)
- `PlayerZones` with 5 zones exists (WP-006A)
- `MoveError` with `{ code, message, path }` exists (WP-008A)
- Build: `pnpm --filter @legendary-arena/game-engine build` exits 0
- Tests: 132/132 passing (123 engine + 6 server + 3 registry), 0 failing
- No `packages/game-engine/src/persistence/` directory exists — will be
  created fresh

### Critical Finding: ARCHITECTURE.md Already Exists

**WP-013 says** `docs/ai/ARCHITECTURE.md` does not exist yet and this packet
creates it. **However, ARCHITECTURE.md already exists** (1173 lines) and is
referenced as authoritative by `.claude/CLAUDE.md` and all
`.claude/rules/*.md` files.

**Locked resolution:** Read existing ARCHITECTURE.md first. Update Section 3
(Persistence Boundaries) to include the three-class data model and
field-to-class mapping table as specified by WP-013 Scope D. Do NOT delete
or rewrite existing sections that are correct and referenced by governance
docs. Verify all 5 required section topics are present; add any missing
subsections.

---

## Critical Context (Post-WP-012 Reality)

- WP-012 is complete. The following are present:
  - `list-matches.mjs` and `join-match.mjs` CLI scripts (server tooling)
  - Full multiplayer loop: create -> list -> join -> ready -> play
  - D-1241 (built-in endpoints), D-1242 (stubbed fetch), D-1243 (stdout
    credentials) recorded in DECISIONS.md
  - Match setup schema governance artifacts: MATCH-SETUP-SCHEMA.md,
    MATCH-SETUP-JSON-SCHEMA.json, MATCH-SETUP-VALIDATION.md (D-1244-D-1248)
- 132 tests passing across all packages (123 engine, 6 server, 3 registry)
- `packages/game-engine/src/persistence/` does not exist yet
- `docs/ai/ARCHITECTURE.md` already exists (1173 lines) — must be updated,
  not created from scratch

---

## Scope Contract (Read Carefully)

### WP-013 DOES:

- Create `src/persistence/persistence.types.ts` — `PERSISTENCE_CLASSES`,
  `MatchSnapshot`, `PersistableMatchConfig`
- Create `src/persistence/snapshot.create.ts` — `createSnapshot` pure
  function returning `Readonly<MatchSnapshot>` via `Object.freeze()`
- Create `src/persistence/snapshot.validate.ts` — `validateSnapshotShape`
  returning structured results (never throws)
- Create `src/persistence/snapshot.create.test.ts` — 7 tests using
  `node:test` and `node:assert`
- Modify `src/types.ts` — re-export `MatchSnapshot`, `PersistableMatchConfig`,
  `PERSISTENCE_CLASSES`
- Modify `src/index.ts` — export `createSnapshot`, `validateSnapshotShape`,
  and persistence types as named public exports
- Update `docs/ai/ARCHITECTURE.md` — ensure Section 3 (Persistence
  Boundaries) contains the three-class data model and field-to-class
  mapping table

### WP-013 DOES NOT:

- No database schema, migrations, or PostgreSQL access
- No storage engine or snapshot persistence to disk
- No snapshot retrieval or listing API
- No automatic snapshot triggers
- No modifications to `game.ts` — no game logic changes
- No server or UI changes
- No `require()` — ESM only
- No `Math.random()` or `.reduce()`
- No `boardgame.io` imports in persistence files (pure helpers)
- No redefining `MoveError` — import from `coreMoves.types.ts`
- No `CardExtId[]` arrays in `MatchSnapshot` — zone counts only
- No `hookRegistry`, `lobby`, or `currentStage` in `MatchSnapshot`
- No `throw` statements in `createSnapshot` or `validateSnapshotShape`
- No speculative helpers, convenience abstractions, or "while I'm here"
  improvements

If something feels questionable, it almost certainly belongs in a **later WP**.

---

## Files Allowed to Change (Allowlist)

Only the following files **may be created or modified** during this execution:

    packages/game-engine/src/persistence/persistence.types.ts   -- new
    packages/game-engine/src/persistence/snapshot.create.ts      -- new
    packages/game-engine/src/persistence/snapshot.validate.ts    -- new
    packages/game-engine/src/persistence/snapshot.create.test.ts -- new
    packages/game-engine/src/types.ts                            -- modified
    packages/game-engine/src/index.ts                            -- modified
    docs/ai/ARCHITECTURE.md                                      -- modified

### Runtime Wiring Allowance (01.5)

**Not applicable to WP-013.** This packet introduces no new fields on
`LegendaryGameState`, no new moves, and no game logic changes. The new
types (`MatchSnapshot`, `PersistableMatchConfig`, `PERSISTENCE_CLASSES`)
are independent of `G`'s runtime shape. The 01.5 runtime wiring allowance
is not exercised.

The modifications to `types.ts` and `index.ts` are limited to re-exports
of the new persistence types. No existing type shapes are changed.

---

## Files Explicitly Locked (Read-Only)

The following files **must not be changed**:

    packages/game-engine/src/game.ts                    -- no game logic
    packages/game-engine/src/matchSetup.types.ts        -- WP-005A contract
    packages/game-engine/src/matchSetup.validate.ts     -- WP-005A contract
    packages/game-engine/src/state/zones.types.ts       -- WP-006A contract
    packages/game-engine/src/moves/coreMoves.types.ts   -- WP-008A contract
    packages/game-engine/src/endgame/endgame.types.ts   -- WP-010 contract
    packages/game-engine/src/lobby/lobby.types.ts       -- WP-011 contract
    apps/server/**                                       -- entire server
    packages/registry/**                                 -- entire registry

These are dependencies, not execution targets.

---

## Locked Values (Do Not Re-Derive)

### PERSISTENCE_CLASSES string values (3 canonical class names)

```ts
const PERSISTENCE_CLASSES = {
  RUNTIME:       'runtime',
  CONFIGURATION: 'configuration',
  SNAPSHOT:      'snapshot',
} as const;
```

### MatchSnapshot top-level keys (exactly these -- no additional fields)

`matchId` | `snapshotAt` | `turn` | `phase` | `activePlayer` | `players` |
`counters` | `messages` | `outcome` (optional)

### MatchSnapshot.players zone count fields (exactly 5)

`deckCount` | `handCount` | `discardCount` | `inPlayCount` | `victoryCount`

Derived from `PlayerZones` keys: `deck`, `hand`, `discard`, `inPlay`, `victory`

### PersistableMatchConfig shape (exact)

```ts
interface PersistableMatchConfig {
  matchId:     string
  setupConfig: MatchSetupConfig
  playerNames: Record<string, string>  // playerId -> display name
  createdAt:   string                  // ISO 8601
}
```

### MoveError shape (reused from WP-008A — do not redefine)

```ts
{ code: string; message: string; path: string }
```

### createSnapshot signature (exact)

```ts
createSnapshot(
  G: LegendaryGameState,
  ctx: { turn: number; phase: string; currentPlayer: string },
  matchId: string
): Readonly<MatchSnapshot>
```

Note: `ctx` parameter uses a minimal interface (not the full boardgame.io
`Ctx`) to avoid importing boardgame.io in persistence files.

---

## Pre-Flight Risk Resolutions (Locked for Execution)

These decisions were made during pre-flight and must not be revisited.

### Risk 1: ARCHITECTURE.md already exists

ARCHITECTURE.md already exists (1173 lines) and is referenced as
authoritative. The execution session must **read it first**, then **update
Section 3** (Persistence Boundaries) to include the three-class data model
and field-to-class mapping table. Do NOT replace the entire file. Verify
all 5 required section topics are present and add any missing subsections.

### Risk 2: `new Date().toISOString()` in createSnapshot

The WP specifies `snapshotAt` using `new Date().toISOString()`. This is a
wall-clock read inside the engine package, which is normally forbidden
(determinism rule). This is permitted because: (a) `createSnapshot` is
never called during gameplay; (b) `snapshotAt` is audit metadata, not
state that affects game outcomes; (c) the WP explicitly specifies this.
Add a `// why:` comment documenting this exception.

### Risk 3: MoveError reuse for snapshot validation

`validateSnapshotShape` returns `{ ok: false; errors: MoveError[] }`.
This reuses the move error contract per WP-013 spec. Import `MoveError`
from `coreMoves.types.ts` — do not create a parallel error type.

### Risk 4: ctx parameter typing for createSnapshot

`createSnapshot` needs `ctx.turn`, `ctx.phase`, and `ctx.currentPlayer`.
To avoid importing boardgame.io's full `Ctx` type into persistence files
(pure helper rule), define a minimal interface locally:

```ts
interface SnapshotContext {
  turn: number;
  phase: string;
  currentPlayer: string;
}
```

The real boardgame.io `Ctx` satisfies this structurally.

---

## Test Expectations (Locked)

### snapshot.create tests — `src/persistence/snapshot.create.test.ts` (7 tests)

1. `createSnapshot` with valid G and ctx returns MatchSnapshot with correct
   zone counts
2. `JSON.stringify(snapshot)` succeeds (no functions, no circular refs)
3. Snapshot does NOT contain `hookRegistry`, `lobby`, or `currentStage` as
   keys (assert exact key set)
4. Two calls on same G produce identical snapshots (determinism)
5. `validateSnapshotShape` returns `{ ok: true }` on valid snapshot
6. `validateSnapshotShape` returns `{ ok: false }` when `turn` is missing
7. Zone counts match source zone array lengths

**Prior test baseline:** 123 engine tests pass — all must continue to pass.

**Test boundaries:**
- No `boardgame.io` imports in test files
- No modifications to `makeMockCtx` or other shared test helpers
- Use plain mock G and ctx objects — `createSnapshot` takes full objects
  that can be constructed inline
- `node:test` and `node:assert` only
- `.test.ts` extension

---

## Behavioral Constraints (Hard Rules)

- One Work Packet only — `WP-013`
- No scope expansion
- No cross-WP implementation
- No convenience abstractions
- `createSnapshot` is pure — no I/O, no throws, returns `Object.freeze()`
- `validateSnapshotShape` never throws — structured results only
- `MatchSnapshot` has zone counts only — no `CardExtId[]` arrays
- `PERSISTENCE_CLASSES` constants are canonical — use constants, not strings
- `MoveError` imported from existing contract — not redefined
- No `boardgame.io` imports in persistence files
- No modifications to `game.ts`
- No `require()` — ESM only
- `node:` prefix on all Node built-in imports
- Test files use `.test.ts` extension
- `// why:` comments on: zone counts design, snapshotAt timestamp, each
  PERSISTENCE_CLASSES entry

---

## EC-Mode Execution Rules

- All code changes must map to **EC-013**
- No commit may be created without passing EC hooks
- Bugs are treated as **EC violations**, not ad-hoc fixes
- If an EC step cannot be satisfied:
  - Stop
  - Report the failure
  - Do not improvise

---

## Execution Outcome Requirements

By the end of WP-013 execution:

- All EC-013 checklist items must pass
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0 (all tests)
- `PERSISTENCE_CLASSES` exported with exactly 3 string values
- `MatchSnapshot` exported with exactly the locked top-level keys
- `MatchSnapshot.players` has exactly 5 count fields — no zone contents
- `PersistableMatchConfig` exported with exactly 4 fields
- `createSnapshot` exported, pure, frozen, no throws
- `validateSnapshotShape` exported, structured results, no throws,
  imports `MoveError` from `coreMoves.types.ts`
- `docs/ai/ARCHITECTURE.md` updated with persistence boundaries
- `game.ts` untouched
- No `CardExtId[]` in MatchSnapshot
- No `require()` in any generated file
- Architecture boundaries remain intact

---

## Verification Steps

```bash
# Step 1 — build after adding persistence types
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing (123 + 7 = 130), 0 failing

# Step 3 — confirm createSnapshot does not throw
grep "throw " packages/game-engine/src/persistence/snapshot.create.ts
# Expected: no output

# Step 4 — confirm snapshot validator does not throw
grep "throw " packages/game-engine/src/persistence/snapshot.validate.ts
# Expected: no output

# Step 5 — confirm MatchSnapshot has no ext_id array fields
grep "CardExtId\[\]\|string\[\]" packages/game-engine/src/persistence/persistence.types.ts
# Expected: no output (zone contents are counts, not arrays)

# Step 6 — confirm game.ts was not modified
git diff --name-only packages/game-engine/src/game.ts
# Expected: no output

# Step 7 — confirm no require() in any generated file
grep -r "require(" packages/game-engine/src/persistence/
# Expected: no output

# Step 8 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in allowlist

# Step 9 — confirm no boardgame.io imports in persistence files
grep "boardgame.io" packages/game-engine/src/persistence/*.ts
# Expected: no output
```

---

## Post-Execution Obligations (Do Not Skip)

After successful execution, but **before committing**:

- Run the **PRE-COMMIT-REVIEW template** (`docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`)
- Update:
  - `docs/ai/STATUS.md` — persistence boundary types exported;
    ARCHITECTURE.md updated with persistence model
  - `docs/ai/DECISIONS.md` — at minimum: why snapshots use zone counts
    rather than ext_id arrays; why `createSnapshot` is a pure function
    rather than an async write-to-DB operation; why `PersistableMatchConfig`
    excludes G and ctx
  - `docs/ai/work-packets/WORK_INDEX.md` — mark WP-013 complete with date
- Commit using EC-mode hygiene rules (`EC-013:` prefix)

Execution is not considered complete until these steps are done.

---

## Final Instruction to Claude

This invocation is a **contract**, not a suggestion.

If there is any uncertainty about whether a change belongs in WP-013:

**DO NOT IMPLEMENT IT.**
