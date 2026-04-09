# EC-007B — Turn Loop Implementation (Execution Checklist)

**Source:** docs/ai/work-packets/WP-007B-turn-loop-implementation.md
**Layer:** Game Engine / Turn Loop

**Execution Authority:**
This EC is the authoritative execution checklist for WP-007B.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-007B.

---

## Before Starting

- [ ] WP-007A complete: `TurnStage`, `TURN_STAGES`, `getNextTurnStage`, `isValidTurnStageTransition` exported
- [ ] `LegendaryGame` has phases `lobby`, `setup`, `play`, `end` (WP-002)
- [ ] `buildInitialGameState` produces valid `G` passing validators (WP-005B, WP-006B)
- [ ] `makeMockCtx` exists in `src/test/mockCtx.ts` (WP-005B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-007B.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `TurnStage` values (never hardcode as string literals in `turnLoop.ts` or `game.ts`):
  `'start'` | `'main'` | `'cleanup'`

- Valid transitions: `start -> main`, `main -> cleanup`

- `getNextTurnStage('cleanup')` returns `null` -> call `ctx.events.endTurn()`

- Phase names: `'lobby'` | `'setup'` | `'play'` | `'end'`

- `play` phase `onBegin` resets `G.currentStage = 'start'`

---

## Guardrails

- No hardcoded stage string literals in `turnLoop.ts` or `game.ts` — use `TURN_STAGES` and `getNextTurnStage`
- `G.currentStage` stored in `G`, never in `ctx`
- `ctx.events.endTurn()` for player rotation — manual index rotation forbidden
- WP-007A files (`turnPhases.types.ts`, `turnPhases.logic.ts`, `turnPhases.validate.ts`) must NOT be modified
- Integration test uses `makeMockCtx` — no `boardgame.io` or `boardgame.io/testing` import
- `advanceTurnStage` calls `getNextTurnStage` — no duplicated stage ordering

---

## Required `// why:` Comments

- `advanceTurnStage`: why `ctx.events.endTurn()` is correct — boardgame.io manages rotation
- `advanceTurnStage`: why `currentStage` stored in `G` not `ctx` — observable to moves, JSON-serializable
- `game.ts` `play` phase `onBegin`: resetting stage to `'start'` each turn

---

## Files to Produce

- `packages/game-engine/src/turn/turnLoop.ts` — **new** — `advanceTurnStage(G, ctx)`
- `packages/game-engine/src/types.ts` — **modified** — add `currentStage: TurnStage` to `LegendaryGameState`
- `packages/game-engine/src/game.ts` — **modified** — wire `play` phase turn loop
- `packages/game-engine/src/index.ts` — **modified** — export `advanceTurnStage`
- `packages/game-engine/src/turn/turnLoop.integration.test.ts` — **new** — 4 assertions

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (including WP-007A contract tests)
- [ ] No hardcoded stage strings in `turnLoop.ts` or `game.ts`
- [ ] No `boardgame.io` import in integration test
- [ ] WP-007A contract files untouched (`git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — turn loop wired; what a match can do
- [ ] `docs/ai/DECISIONS.md` updated — why `currentStage` in `G`; why direct function calls not `boardgame.io/testing`
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-007B checked off with date
