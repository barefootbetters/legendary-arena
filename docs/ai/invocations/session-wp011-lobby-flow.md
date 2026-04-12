# Work Packet Invocation — WP-011 (Match Creation & Lobby Flow)

**FILE TYPE:** Invocation Prompt
**AUDIENCE:** Claude Code (Execution Mode)
**PURPOSE:** Pre-execution contract setup for a single Work Packet
**SCOPE:** This file defines *what may be done* in the upcoming WP execution

---

## Invocation Header

**Work Packet ID:** `WP-011`
**Work Packet Title:** Match Creation & Lobby Flow (Minimal MVP)
**Execution Mode:** EC-Mode (Execution Checklist enforced)
**Invocation Type:** Single-WP Execution
**Status:** Ready to Execute
**Pre-Flight Date:** 2026-04-11
**Pre-Flight Verdict:** READY TO EXECUTE

---

## Invocation Intent

You are about to execute **WP-011** in the Legendary Arena codebase.

This invocation defines **exact scope**, **authority order**, **allowed changes**,
and **forbidden behavior** for this Work Packet execution.

WP-011 adds the first human interaction layer: players join a match, signal
readiness in the `lobby` phase, and trigger the transition into `setup` and
then `play`. A typed `LobbyState` is added to `LegendaryGameState` with
`requiredPlayers`, `ready`, and `started` fields. Two lobby-phase moves
(`setPlayerReady` and `startMatchIfReady`) gate the transition.
`G.lobby.started = true` is set BEFORE `ctx.events.setPhase('setup')` to
establish the UI observability pattern. A CLI script (`create-match.mjs`)
enables match creation against the running server using Node built-in `fetch`.

You must operate strictly within this contract.

---

## Authority Chain (Must Read In Order)

Before executing any step, you must read and follow these documents **in this order**:

1. `.claude/CLAUDE.md`
   - EC-mode rules
   - Bug handling rules
   - Commit discipline

2. `docs/ai/ARCHITECTURE.md`
   - Section 4: "Phase Sequence and Lifecycle Mapping" (full `lobby -> setup
     -> play -> end` transition table)
   - "The `G.lobby.started` Observability Pattern" (flag set before
     `setPhase`, not after)
   - "How Phase Transitions Work" (`ctx.events.setPhase()` is the only
     permitted mechanism)
   - Layer boundaries, engine vs framework separation

3. `.claude/rules/game-engine.md`
   - G serialization invariants
   - Move Validation Contract (moves never throw)
   - Phase names (locked)
   - `G.lobby` listed in Key G Fields table

4. `.claude/rules/code-style.md`
   - Rule 4 (no abbreviations -- `requiredPlayers` not `reqPlayers`)
   - Rule 6 (`// why:` on `ctx.events.setPhase`, `G.lobby.started`, and
     `ctx.currentPlayer` usage)
   - Rule 9 (`node:` prefix on all Node built-in imports)
   - Rule 11 (full-sentence error messages)
   - Rule 13 (ESM only)

5. `docs/ai/execution-checklists/EC-011-lobby-flow.checklist.md`
   - The governing execution checklist for this WP

6. `docs/ai/work-packets/WP-011-match-creation-lobby-flow.md`
   - The formal specification for this Work Packet

Then reference (read-only unless explicitly listed in Files Allowed to Change):

7. `packages/game-engine/src/types.ts` -- `LegendaryGameState`; will be
   modified (add `lobby: LobbyState`)
8. `packages/game-engine/src/game.ts` -- `lobby` phase stub and `Game.setup()`;
   will be modified (add lobby moves, initialize `G.lobby`)
9. `packages/game-engine/src/index.ts` -- will be modified (export new API)
10. `packages/game-engine/src/moves/coreMoves.types.ts` -- reference only for
    `MoveResult` and `MoveError` shapes; do NOT modify
11. `packages/game-engine/src/matchSetup.types.ts` -- reference only for
    `MatchSetupConfig`; do NOT modify
12. `packages/game-engine/src/test/mockCtx.ts` -- read-only; do NOT modify
    (lobby move tests use inline mocks, not `makeMockCtx`)
13. `packages/game-engine/src/setup/buildInitialGameState.ts` -- will be
    modified under Runtime Wiring Allowance (01.5) only
14. `apps/server/src/server.mjs` -- reference only for understanding server
    structure; do NOT modify
15. `docs/ai/REFERENCE/00.6-code-style.md` -- full style rules with examples
16. `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` -- wiring allowance
    rules

If any document conflicts, **higher-authority documents win**.

---

## Pre-Flight Findings (2026-04-11)

Pre-flight validation confirmed readiness. Key findings:

### Prerequisites Verified

- WP-010 complete (2026-04-11, commit `7dffa9b`) -- `evaluateEndgame` wired,
  `endIf` in play phase, 114 tests pass
- `game.ts` has a `lobby` phase stub (line 166) with `start: true`, `next: 'setup'`
- `MoveResult` / `MoveError` exist in `coreMoves.types.ts` (WP-008A)
- `makeMockCtx` exists in `src/test/mockCtx.ts` (WP-005B)
- `MatchSetupConfig` and `validateMatchSetup` exist (WP-005A)
- `MatchPhase` and `MATCH_PHASES` exist in `turnPhases.types.ts` (WP-007A)
- `apps/server/src/server.mjs` exists (WP-004)
- No existing `src/lobby/` directory -- will be created fresh
- No existing `apps/server/scripts/` directory -- will be created fresh
- Build: `pnpm --filter @legendary-arena/game-engine build` exits 0
- Tests: 114/114 passing, 0 failing

### Risks Identified and Resolved

1. **`buildInitialGameState.ts` requires `lobby` field** -- Adding `lobby:
   LobbyState` as required on `LegendaryGameState` means `buildInitialGameState`
   must include it in its return. Exercise 01.5 Runtime Wiring Allowance: add
   `lobby: { requiredPlayers: context.ctx.numPlayers, ready: {}, started: false }`
   to the return object. Minimal wiring, no new behavior. Precedent: WP-007B
   (`currentStage`), WP-009B (`messages`, `counters`, `hookRegistry`).

2. **Mock context shape for lobby move tests** -- `makeMockCtx` returns
   `SetupContext` (setup-time context). Lobby moves need `FnContext` with
   `events.setPhase` and `currentPlayer`. Build inline mock objects per the
   established pattern from WP-008B integration tests. Do NOT modify
   `makeMockCtx.ts`.

3. **Lobby moves placement** -- Must be inside the `lobby` phase `moves` block,
   not the top-level `moves` object. boardgame.io enforces phase isolation.
   Verify with grep after implementation.

4. **`ctx.numPlayers` access path** -- `buildInitialGameState` receives
   `context: SetupContext` where `numPlayers` lives at `context.ctx.numPlayers`.
   Lobby init uses this path. No new interface needed.

5. **`game.test.ts` structural assertions** -- May need value-only updates
   under 01.5 if move count or phase structure assertions change. No new test
   logic permitted.

6. **`create-match.mjs` smoke test** -- Script creation and static validation
   in execution. Manual smoke test (Verification Step 8) deferred to human.

---

## Critical Context (Post-WP-010 Reality)

- WP-010 is complete. The following are present in `@legendary-arena/game-engine`:
  - `evaluateEndgame(G)` wired into `play` phase via `endIf`
  - `ENDGAME_CONDITIONS` and `ESCAPE_LIMIT` exported
  - `G.counters`, `G.messages`, `G.hookRegistry` established (WP-009B)
  - `play` phase has `turn.onBegin` (resets stage, fires `onTurnStart`) and
    `turn.onEnd` (fires `onTurnEnd`)
  - `lobby` phase exists as a stub: `{ start: true, next: 'setup' }`
  - Top-level `moves` has: `drawCards`, `playCard`, `endTurn`, `advanceStage`
  - `Game.setup()` delegates to `buildInitialGameState(config, registry, context)`
  - 114 tests passing across the game-engine package
- `buildInitialGameState` returns a `LegendaryGameState` object built from
  `context.ctx.numPlayers` and the config. It currently has no `lobby` field
  in its return -- this will be added under 01.5.
- `makeMockCtx` returns `SetupContext` with `ctx: { numPlayers }` and
  `random: { Shuffle }`. It does NOT include `events` or `currentPlayer`.

---

## Scope Contract (Read Carefully)

### WP-011 DOES:

- Create `src/lobby/lobby.types.ts` -- `LobbyState` (3 fields),
  `SetPlayerReadyArgs`, re-exports of `MoveResult`/`MoveError`
- Create `src/lobby/lobby.validate.ts` -- `validateSetPlayerReadyArgs` and
  `validateCanStartMatch` (both return `MoveResult`, never throw)
- Create `src/lobby/lobby.moves.ts` -- `setPlayerReady` and
  `startMatchIfReady` (boardgame.io move functions)
- Create `src/lobby/lobby.moves.test.ts` -- 6 tests using `node:test`
- Create `apps/server/scripts/create-match.mjs` -- CLI match creation script
  using Node built-in `fetch`
- Modify `src/types.ts` -- add `lobby: LobbyState` to `LegendaryGameState`
- Modify `src/game.ts` -- wire lobby moves into `lobby` phase `moves` block;
  import lobby moves
- Modify `src/index.ts` -- export `LobbyState`, `SetPlayerReadyArgs`,
  `validateSetPlayerReadyArgs`, `validateCanStartMatch`
- Modify (01.5) `src/setup/buildInitialGameState.ts` -- add `lobby` field to
  return object (wiring only, no new behavior)
- Modify (01.5) existing structural tests if assertions change -- value-only
  updates
- Add required `// why:` comments on `ctx.events.setPhase`, `G.lobby.started`,
  and `ctx.currentPlayer` usage

### WP-011 DOES NOT:

- No custom REST API routes beyond boardgame.io defaults
- No matchmaking, ranking, or player search
- No reconnect flow (WP-012)
- No persistence boundaries documentation (WP-013)
- No UI changes
- No authentication beyond `ctx.currentPlayer`
- No new error types -- reuse `MoveResult`/`MoveError` from `coreMoves.types.ts`
- No modification of `makeMockCtx` in `src/test/mockCtx.ts`
- No modification of WP-010 endgame files (`src/endgame/*`)
- No modification of WP-009A/009B rule files (`src/rules/*`)
- No modification of WP-008A contract files (`coreMoves.types.ts`,
  `coreMoves.gating.ts`, `coreMoves.validate.ts`)
- No `boardgame.io` imports in lobby type or validate files
- No `throw` in lobby validators or moves
- No `.reduce()` or nested ternaries
- No `Math.random()`
- No axios or node-fetch in `create-match.mjs`
- No speculative helpers, convenience abstractions, or "while I'm here"
  improvements

If something feels questionable, it almost certainly belongs in a **later WP**.

---

## Files Allowed to Change (Allowlist)

Only the following files **may be created or modified** during this execution:

    packages/game-engine/src/lobby/lobby.types.ts               -- new
    packages/game-engine/src/lobby/lobby.validate.ts             -- new
    packages/game-engine/src/lobby/lobby.moves.ts                -- new
    packages/game-engine/src/lobby/lobby.moves.test.ts           -- new
    apps/server/scripts/create-match.mjs                         -- new
    packages/game-engine/src/game.ts                              -- modified
    packages/game-engine/src/types.ts                             -- modified
    packages/game-engine/src/index.ts                             -- modified

### Runtime Wiring Allowance (01.5)

This WP adds `lobby: LobbyState` to `LegendaryGameState`. Per
`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, minimal wiring
edits to the following files are permitted solely to restore type and
assertion correctness:

- `packages/game-engine/src/setup/buildInitialGameState.ts` -- add `lobby`
  field to return object
- `packages/game-engine/src/game.test.ts` or other structural tests --
  value-only assertion updates if move count or structural shape changes

No new behavior may be introduced.

---

## Files Explicitly Locked (Read-Only)

The following files **must not be changed**:

    packages/game-engine/src/endgame/endgame.types.ts              -- WP-010
    packages/game-engine/src/endgame/endgame.evaluate.ts           -- WP-010
    packages/game-engine/src/rules/ruleHooks.types.ts              -- WP-009A contract
    packages/game-engine/src/rules/ruleHooks.validate.ts           -- WP-009A contract
    packages/game-engine/src/rules/ruleHooks.registry.ts           -- WP-009A contract
    packages/game-engine/src/rules/ruleRuntime.execute.ts          -- WP-009B
    packages/game-engine/src/rules/ruleRuntime.effects.ts          -- WP-009B
    packages/game-engine/src/rules/ruleRuntime.impl.ts             -- WP-009B
    packages/game-engine/src/moves/coreMoves.types.ts              -- WP-008A contract
    packages/game-engine/src/moves/coreMoves.gating.ts             -- WP-008A contract
    packages/game-engine/src/moves/coreMoves.validate.ts           -- WP-008A contract
    packages/game-engine/src/moves/coreMoves.impl.ts               -- WP-008B
    packages/game-engine/src/moves/zoneOps.ts                      -- WP-008B
    packages/game-engine/src/turn/turnPhases.types.ts              -- WP-007A contract
    packages/game-engine/src/turn/turnPhases.logic.ts              -- WP-007A contract
    packages/game-engine/src/turn/turnLoop.ts                      -- WP-007B
    packages/game-engine/src/test/mockCtx.ts                       -- shared test helper
    packages/game-engine/src/state/zones.types.ts                  -- WP-006A contract
    packages/game-engine/src/setup/shuffle.ts                      -- WP-005B
    packages/game-engine/src/setup/playerInit.ts                   -- WP-006B
    packages/game-engine/src/setup/pilesInit.ts                    -- WP-006B
    packages/game-engine/src/matchSetup.types.ts                   -- WP-005A contract
    packages/game-engine/src/matchSetup.validate.ts                -- WP-005A

These are dependencies, not execution targets.

---

## Locked Values (Do Not Re-Derive)

### LobbyState (exact interface shape)

```ts
interface LobbyState {
  requiredPlayers: number;
  ready: Record<string, boolean>;
  started: boolean;
}
```

### LobbyState initialization (exact values)

```ts
{
  requiredPlayers: context.ctx.numPlayers,
  ready: {},
  started: false,
}
```

Note: `requiredPlayers` comes from `ctx.numPlayers` -- NOT from `MatchSetupConfig`.

### SetPlayerReadyArgs (exact interface shape)

```ts
interface SetPlayerReadyArgs {
  ready: boolean;
}
```

### Observability ordering (exact -- non-negotiable sequence inside startMatchIfReady)

1. `validateCanStartMatch(G.lobby)` -- if `ok: false`, return
2. `G.lobby.started = true` -- set the flag IN `G` first
3. `ctx.events.setPhase('setup')` -- then transition the phase

This order ensures the UI can observe `G.lobby.started` regardless of when
it reads `G` relative to the phase transition.

### Phase transition target (exact string)

`ctx.events.setPhase('setup')` -- the argument must be exactly `'setup'`.

### MoveError shape (reused from WP-008A -- do not redefine)

```ts
{ code: string; message: string; path: string }
```

### Required // why: comments

- `ctx.events.setPhase('setup')` in `startMatchIfReady`: lobby transitions to
  setup; `G.lobby.started` set first for UI observability
- `G.lobby.started` boolean: stored in `G` so UI can observe lobby completion
  regardless of read timing
- `ctx.currentPlayer` as ready-map key: ensures each player only sets their
  own readiness; boardgame.io passes the authenticated player ID through
  `ctx.currentPlayer`

---

## Pre-Flight Risk Resolutions (Locked for Execution)

These decisions were made during pre-flight and must not be revisited.

### Risk 1: buildInitialGameState requires lobby field

Adding `lobby: LobbyState` as a required field on `LegendaryGameState` means
`buildInitialGameState.ts` must include it in its return. Exercise 01.5
Runtime Wiring Allowance: add `lobby` initialization to the return object.
Import `LobbyState` from `../lobby/lobby.types.js`. This is minimal wiring
-- no new behavior, no branching. Follows precedent from WP-007B and WP-009B.

### Risk 2: Mock context shape for lobby move tests

`makeMockCtx` returns `SetupContext`, not `FnContext`. Lobby move tests must
build inline mock objects with `G` (including `lobby`), `events: { setPhase }`
(spy function), and `currentPlayer: '0'`. Do NOT modify `makeMockCtx.ts`.

### Risk 3: Lobby moves placement

Wire moves inside the `lobby` phase config block:
`lobby: { start: true, next: 'setup', moves: { setPlayerReady, startMatchIfReady } }`.
Not in the top-level `moves` object. Verify with grep after implementation.

### Risk 4: ctx.numPlayers access path

`buildInitialGameState` receives `context: SetupContext` where `numPlayers`
is at `context.ctx.numPlayers`. Lobby init uses this path inside
`buildInitialGameState`. No new interface needed.

### Risk 5: game.test.ts structural assertion updates

May need value-only updates under 01.5 if assertions about phase structure
or move counts change. No new test logic permitted.

### Risk 6: create-match.mjs smoke test

Script creation and static validation in execution. Manual smoke test
(Verification Step 8 in the WP) is deferred to the human.

---

## Test Expectations (Locked)

### Lobby tests -- `src/lobby/lobby.moves.test.ts` (6 tests)

1. `setPlayerReady({ ready: true })` sets `G.lobby.ready[playerId]` to `true`
2. `setPlayerReady({ ready: false })` sets `G.lobby.ready[playerId]` to `false`
3. `setPlayerReady` with invalid args (non-boolean) does not mutate `G`
4. `startMatchIfReady` with all players ready sets `started: true` and calls
   `ctx.events.setPhase`
5. `startMatchIfReady` with one player not ready does not mutate `G`
6. `JSON.stringify(G.lobby)` succeeds after all operations

**Prior test baseline:** 114 tests pass -- all must continue to pass. Existing
tests may require value-only updates under 01.5 if structural assertions
change (e.g., move count in `game.test.ts`).

**Test boundaries:** no `boardgame.io` imports in test file; inline mock
contexts (not `makeMockCtx`) for move tests; `node:test` + `node:assert`
only; `.test.ts` extension; no modifications to `mockCtx.ts` or other shared
test helpers.

---

## Behavioral Constraints (Hard Rules)

- One Work Packet only -- `WP-011`
- No scope expansion
- No cross-WP implementation
- No convenience abstractions
- `G.lobby` must be JSON-serializable at all times
- `G.lobby.started = true` BEFORE `ctx.events.setPhase('setup')` -- order is
  non-negotiable
- Lobby moves wired inside `lobby` phase `moves` block -- not top-level
- Reuse `MoveResult`/`MoveError` from `coreMoves.types.ts` -- no new error types
- Validators return `MoveResult`, never throw
- `create-match.mjs` uses Node v22 built-in `fetch` -- no axios, no node-fetch
- Every `ctx.events.setPhase()` call must have a `// why:` comment
- Control flow uses `if/else if/else` -- no nested ternaries
- No `boardgame.io` imports in lobby type or validate files
- `boardgame.io` imports are permitted ONLY in `lobby.moves.ts` (move
  functions receive framework context) and `game.ts`
- No new fields added to `LegendaryGameState` beyond `lobby: LobbyState`
- No modification to `makeMockCtx.ts`
- WP-010, WP-009A/009B, WP-008A files must not be modified
- `G` must remain JSON-serializable after all mutations
- ESM only, `node:` prefix on all Node built-in imports
- Test files use `.test.ts` extension
- Tests use `node:test` and `node:assert` only -- no `boardgame.io/testing`

---

## EC-Mode Execution Rules

- All code changes must map to **EC-011**
- No commit may be created without passing EC hooks
- Bugs are treated as **EC violations**, not ad-hoc fixes
- If an EC step cannot be satisfied:
  - Stop
  - Report the failure
  - Do not improvise

---

## Execution Outcome Requirements

By the end of WP-011 execution:

- All EC-011 checklist items must pass
- All tests must pass (114 existing + 6 new lobby tests)
- `LobbyState` has exactly 3 fields: `requiredPlayers`, `ready`, `started`
- `G.lobby` is initialized in `buildInitialGameState` with
  `requiredPlayers: context.ctx.numPlayers`, `ready: {}`, `started: false`
- `setPlayerReady` and `startMatchIfReady` are wired inside the `lobby` phase
  `moves` block (not top-level)
- `G.lobby.started = true` is set before `ctx.events.setPhase('setup')` in
  `startMatchIfReady`
- Every `ctx.events.setPhase()` call has a `// why:` comment
- No `throw` in `lobby.validate.ts`
- No inline readiness logic in `game.ts` -- delegates to lobby moves
- No `boardgame.io` imports in `lobby.types.ts` or `lobby.validate.ts`
- `create-match.mjs` exists, uses built-in `fetch`, has no axios/node-fetch
- No new error types -- `MoveResult`/`MoveError` reused
- `buildInitialGameState.ts` changes are 01.5 wiring only (lobby field added)
- No new fields in `LegendaryGameState` beyond `lobby`
- `makeMockCtx.ts` untouched
- WP-010/009A/009B/008A files untouched
- Architecture boundaries remain intact

---

## Verification Steps

```bash
# Step 1 -- build after lobby wiring
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 -- run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output -- all tests passing, 0 failing

# Step 3 -- confirm validators do not throw
grep "throw " packages/game-engine/src/lobby/lobby.validate.ts
# Expected: no output

# Step 4 -- confirm lobby moves are in the lobby phase (not top-level)
grep "setPlayerReady" packages/game-engine/src/game.ts
# Expected: match found inside the lobby phase config block

# Step 5 -- confirm G.lobby.started is set before setPhase call
grep -n "started\|setPhase" packages/game-engine/src/lobby/lobby.moves.ts
# Expected: started = true on an earlier line than setPhase

# Step 6 -- confirm create-match.mjs uses no external HTTP packages
grep "axios\|node-fetch" apps/server/scripts/create-match.mjs
# Expected: no output

# Step 7 -- confirm no require() in any generated file
grep -r "require(" packages/game-engine/src/lobby/
# Expected: no output

# Step 8 -- (MANUAL) smoke test the script against a running server
# Deferred to human -- not run in automated execution

# Step 9 -- confirm no boardgame.io imports in lobby type/validate files
grep "boardgame.io" packages/game-engine/src/lobby/lobby.types.ts packages/game-engine/src/lobby/lobby.validate.ts
# Expected: no output

# Step 10 -- confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in allowlist + 01.5 wiring files

# Step 11 -- confirm makeMockCtx.ts was not modified
git diff --name-only packages/game-engine/src/test/mockCtx.ts
# Expected: no output

# Step 12 -- confirm WP-010 files were not modified
git diff --name-only packages/game-engine/src/endgame/
# Expected: no output

# Step 13 -- confirm WP-009 files were not modified
git diff --name-only packages/game-engine/src/rules/
# Expected: no output

# Step 14 -- confirm WP-008A contract files were not modified
git diff --name-only packages/game-engine/src/moves/coreMoves.types.ts packages/game-engine/src/moves/coreMoves.gating.ts packages/game-engine/src/moves/coreMoves.validate.ts
# Expected: no output
```

---

## Post-Execution Obligations (Do Not Skip)

After successful execution, but **before committing**:

- Run the **PRE-COMMIT-REVIEW template** (`docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`)
- Update:
  - `docs/ai/STATUS.md` -- a match can now be created and players can join,
    ready up, and transition into gameplay via the lobby phase
  - `docs/ai/DECISIONS.md` -- at minimum: why `G.lobby.started` is a boolean
    flag stored in `G` rather than relying on `ctx.phase` alone; why
    `startMatchIfReady` transitions to `setup` rather than directly to `play`;
    why `ctx.currentPlayer` is used as the ready-map key
  - `docs/ai/work-packets/WORK_INDEX.md` -- mark WP-011 complete with date
- Commit using EC-mode hygiene rules (`EC-011:` prefix)

Execution is not considered complete until these steps are done.

---

## Final Instruction to Claude

This invocation is a **contract**, not a suggestion.

If there is any uncertainty about whether a change belongs in WP-011:

**DO NOT IMPLEMENT IT.**
