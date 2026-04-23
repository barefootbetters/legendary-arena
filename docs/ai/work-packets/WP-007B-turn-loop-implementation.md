# WP-007B — Turn Loop Implementation

**Status:** Complete
**Primary Layer:** Game Engine / Turn Loop
**Dependencies:** WP-007A

---

## Session Context

WP-007A locked `MatchPhase`, `TurnStage`, `TURN_STAGES`, and the pure
transition helpers — no boardgame.io wiring was included. This packet wires
those contracts into the actual `LegendaryGame` configuration: `G.currentStage`
is added to `LegendaryGameState`, the `play` phase resets it on each turn, and
`advanceTurnStage` uses `getNextTurnStage` exclusively — no duplicated stage
ordering anywhere.

---

## Goal

Wire the turn structure contracts from WP-007A into the boardgame.io `Game()`
configuration so that a running match can enter the `play` phase and advance
deterministically through `start → main → cleanup`, ending the turn and passing
to the next player.

After this session:
- `G.currentStage: TurnStage` is part of `LegendaryGameState`
- `advanceTurnStage(G, ctx)` moves `G.currentStage` forward, or calls
  `ctx.events.endTurn()` when `getNextTurnStage` returns `null`
- The `play` phase in `LegendaryGame` resets `G.currentStage = 'start'` on
  each new turn via `onBegin`
- An integration test confirms all three stage transitions without a live server

---

## Assumes

- WP-007A complete. Specifically:
  - `packages/game-engine/src/turn/turnPhases.types.ts` exports `MatchPhase`,
    `TurnStage`, `TURN_STAGES` (WP-007A)
  - `packages/game-engine/src/turn/turnPhases.logic.ts` exports
    `getNextTurnStage`, `isValidTurnStageTransition` (WP-007A)
  - `packages/game-engine/src/turn/turnPhases.validate.ts` exports
    `validateTurnStageTransition` (WP-007A)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `packages/game-engine/src/game.ts` exports `LegendaryGame` with phases
  `lobby`, `setup`, `play`, `end` (WP-002)
- `packages/game-engine/src/setup/buildInitialGameState.ts` produces a valid
  `G` that passes `validateGameStateShape` (WP-005B, WP-006B)
- `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Turn Stage Cycle"
  subsection in full. It explains why `G.currentStage` is stored in `G` and
  not `ctx`, the full `advanceTurnStage` flow, why `ctx.events.endTurn()` is
  called when `getNextTurnStage` returns `null`, and why manual player index
  rotation is forbidden. This subsection is the authoritative reference for
  every design decision in this packet.
- `packages/game-engine/src/game.ts` — read it entirely before modifying.
  This is the primary modification target. Understand the existing phase
  structure, move stubs, and `setup()` call before adding turn loop wiring.
- `packages/game-engine/src/turn/turnPhases.logic.ts` — the WP-007A helpers.
  `getNextTurnStage` and `isValidTurnStageTransition` must be used in
  `turnLoop.ts` — do not duplicate the stage ordering.
- `packages/game-engine/src/turn/turnPhases.types.ts` — `TurnStage` and
  `TURN_STAGES`. The `play` phase wiring must reference these; do not hardcode
  stage name strings in `game.ts`.
- `packages/game-engine/src/test/mockCtx.ts` — the integration test calls
  functions directly with a mock context; no live server needed.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.2` — `G` and `ctx` are
  boardgame.io runtime state. The turn loop stores `currentStage` in `G` (so
  it is observable to moves and JSON-serializable); it does not store it in
  `ctx`.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 2 (no factory
  functions — build the phase config inline in `game.ts`), Rule 4 (no
  abbreviations), Rule 6 (`// why:` comments on stage advancement and
  `ctx.events.endTurn()`), Rule 8 (no `.reduce()` in stage logic), Rule 13
  (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- Never throw inside boardgame.io move functions — return void on invalid input
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets,
  or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in helpers
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- No hardcoded stage string literals (`'start'`, `'main'`, `'cleanup'`) in
  `turnLoop.ts` or `game.ts` — use `TURN_STAGES` and `getNextTurnStage` from
  WP-007A exclusively
- `G.currentStage` is stored in `G`, never in `ctx` — add a `// why:` comment
  explaining that boardgame.io's `ctx` does not expose the inner stage in a form
  that moves can read, and that storing it in `G` makes it observable to moves
  (for stage gating) and JSON-serializable (for replay and snapshots)
- `ctx.events.endTurn()` must have a `// why:` comment: boardgame.io manages
  player rotation; manual player index rotation is forbidden
- WP-007A contract files (`turnPhases.types.ts`, `turnPhases.logic.ts`,
  `turnPhases.validate.ts`) must not be modified in this packet
- Integration test uses `makeMockCtx` from `src/test/mockCtx.ts` — do not
  import from `boardgame.io` or `boardgame.io/testing`

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **TurnStage values** (this packet must never hardcode these as string
  literals in `turnLoop.ts` or `game.ts` — use `getNextTurnStage` and
  `TURN_STAGES` from WP-007A instead):
  `'start'` | `'main'` | `'cleanup'`
  Valid transitions: `start → main`, `main → cleanup`.
  `getNextTurnStage('cleanup')` returns `null` → call `ctx.events.endTurn()`.

- **Phase names** (this packet wires the `play` phase specifically — the
  `onBegin` hook resets `G.currentStage = 'start'` on each new turn):
  `'lobby'` | `'setup'` | `'play'` | `'end'`

---

## Scope (In)

### A) `src/turn/turnLoop.ts` — new
- `advanceTurnStage(G: LegendaryGameState, ctx: Ctx): LegendaryGameState`
  - Calls `getNextTurnStage(G.currentStage)` from `turnPhases.logic.ts`
  - If next stage is not `null`: sets `G.currentStage = next` and returns
    updated `G`
  - If next stage is `null` (current is `cleanup`): calls
    `ctx.events.endTurn()` and returns `G` unchanged
- `// why:` comment on `ctx.events.endTurn()`: boardgame.io manages player
  rotation; calling it directly is the correct pattern for stage-based turn
  flow; manual index rotation is forbidden
- `// why:` comment on storing `currentStage` in `G` (not `ctx`): `ctx` does
  not expose inner stage in a form moves can read; `G` makes it observable for
  stage gating and JSON-serializable for replay
- No hardcoded stage strings — uses `getNextTurnStage` only

### B) `src/types.ts` — modified
- Add `currentStage: TurnStage` to `LegendaryGameState` — part of `G`, not
  `ctx`; serializable; reset to `'start'` on each turn

### C) `src/game.ts` — modified
- Wire the `play` phase:
  - `turn.onBegin`: set `G.currentStage = 'start'` (reset on each new turn)
  - Add `advanceStage` move that calls `advanceTurnStage(G, ctx)`
  - All stage references use `TurnStage` constants from `turnPhases.types.ts` —
    no bare string literals for stage names
- Keep all other existing phase stubs and move stubs unchanged

### D) `src/index.ts` — modified
- Export `advanceTurnStage` if needed by tests or consumers

### E) Tests — `src/turn/turnLoop.integration.test.ts` — new
- Uses `node:test` and `node:assert` only
- Uses `makeMockCtx` from `src/test/mockCtx.ts`
- Does not import from `boardgame.io` or `boardgame.io/testing`
- Calls functions directly — no live server
- Four assertions:
  1. `advanceTurnStage` with `currentStage = 'start'` → `G.currentStage === 'main'`
  2. `advanceTurnStage` with `currentStage = 'main'` → `G.currentStage === 'cleanup'`
  3. `advanceTurnStage` with `currentStage = 'cleanup'` → `ctx.events.endTurn`
     was called (spy on the mock)
  4. `JSON.stringify(G)` does not throw after each transition

---

## Out of Scope

- No gameplay moves (play card, recruit, fight)
- No win/loss conditions
- No scheme twist or master strike logic
- No city or HQ logic
- No persistence or PostgreSQL access
- No server or UI changes
- WP-007A contract files (`turnPhases.types.ts`, `turnPhases.logic.ts`,
  `turnPhases.validate.ts`) must not be modified
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/turn/turnLoop.ts` — **new** — stage advancement
  helper
- `packages/game-engine/src/types.ts` — **modified** — add
  `currentStage: TurnStage` to `LegendaryGameState`
- `packages/game-engine/src/game.ts` — **modified** — wire `play` phase turn
  loop
- `packages/game-engine/src/index.ts` — **modified** — export `advanceTurnStage`
  if needed
- `packages/game-engine/src/turn/turnLoop.integration.test.ts` — **new** —
  integration test

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### G State
- [ ] `LegendaryGameState` in `src/types.ts` has `currentStage: TurnStage`
- [ ] `currentStage` is set to `'start'` in the `play` phase `onBegin` hook
      in `src/game.ts`
- [ ] `G` remains JSON-serializable after adding `currentStage` — confirmed by
      the integration test

### Turn Loop
- [ ] `src/turn/turnLoop.ts` exports `advanceTurnStage`
- [ ] `advanceTurnStage` has a `// why:` comment on `ctx.events.endTurn()`
- [ ] `advanceTurnStage` has a `// why:` comment on storing `currentStage`
      in `G` rather than `ctx`
- [ ] `advanceTurnStage` calls `getNextTurnStage` from WP-007A — no duplicated
      stage ordering in `turnLoop.ts`
- [ ] No hardcoded stage string literals in `turnLoop.ts`
      (confirmed with `Select-String`)
- [ ] No hardcoded stage string literals in `game.ts`
      (confirmed with `Select-String`)
- [ ] `advanceTurnStage` calls `ctx.events.endTurn()` when `getNextTurnStage`
      returns `null`

### Integration Test
- [ ] `advanceTurnStage` with `currentStage = 'start'` → `G.currentStage === 'main'`
- [ ] `advanceTurnStage` with `currentStage = 'main'` → `G.currentStage === 'cleanup'`
- [ ] `advanceTurnStage` with `currentStage = 'cleanup'` → `ctx.events.endTurn`
      was called
- [ ] Integration test does not import from `boardgame.io` or
      `boardgame.io/testing` (confirmed with `Select-String`)
- [ ] Integration test uses `makeMockCtx` from `src/test/mockCtx.ts`

### WP-007A Contract Protection
- [ ] `src/turn/turnPhases.types.ts` was not modified
      (confirmed with `git diff --name-only`)
- [ ] `src/turn/turnPhases.logic.ts` was not modified
      (confirmed with `git diff --name-only`)
- [ ] `src/turn/turnPhases.validate.ts` was not modified
      (confirmed with `git diff --name-only`)

### Build and Tests
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test
      files, including WP-007A contract tests)

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after wiring changes
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests (includes WP-007A contract tests)
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no hardcoded stage strings in turnLoop.ts
Select-String -Path "packages\game-engine\src\turn\turnLoop.ts" -Pattern "'start'|'main'|'cleanup'"
# Expected: no output (WP-007A constants used instead)

# Step 4 — confirm no hardcoded stage strings in game.ts
Select-String -Path "packages\game-engine\src\game.ts" -Pattern "'start'|'main'|'cleanup'"
# Expected: no output

# Step 5 — confirm integration test has no boardgame.io import
Select-String -Path "packages\game-engine\src\turn\turnLoop.integration.test.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 6 — confirm WP-007A contract files were not modified
git diff --name-only packages/game-engine/src/turn/turnPhases.types.ts packages/game-engine/src/turn/turnPhases.logic.ts packages/game-engine/src/turn/turnPhases.validate.ts
# Expected: no output (all three files untouched)

# Step 7 — confirm no files outside scope were changed
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
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test
      files, including WP-007A contract tests)
- [ ] No hardcoded stage strings in `turnLoop.ts` (confirmed with `Select-String`)
- [ ] No hardcoded stage strings in `game.ts` (confirmed with `Select-String`)
- [ ] No `boardgame.io` import in the integration test
      (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] WP-007A outputs were not modified (confirmed with `git diff --name-only`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — the turn loop is now wired; what a running
      match can do after this packet
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why `currentStage` is stored
      in `G` rather than `ctx`; why the integration test calls functions
      directly rather than using `boardgame.io/testing`
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-007B checked off with today's date
