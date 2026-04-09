# EC-007A — Turn Structure & Phases Contracts (Execution Checklist)

**Source:** docs/ai/work-packets/WP-007A-turn-structure-phases-contracts.md
**Layer:** Game Engine / Contracts

**Execution Authority:**
This EC is the authoritative execution checklist for WP-007A.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-007A.

---

## Before Starting

- [ ] WP-006B complete: setup output passes both zone validators
- [ ] `LegendaryGame` has 4 phases: `lobby`, `setup`, `play`, `end` (WP-002)
- [ ] `makeMockCtx` exists in `src/test/mockCtx.ts` (WP-005B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-007A.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `MatchPhase` — exactly 4 values (maps 00.2 SS8.2 lifecycle):
  `'lobby'` | `'setup'` | `'play'` | `'end'`

- `TurnStage` — exactly 3 values in canonical order:
  `'start'` | `'main'` | `'cleanup'`

- `MATCH_PHASES: readonly MatchPhase[]` — all 4 in order

- `TURN_STAGES: readonly TurnStage[]` — all 3 in order

- `TurnPhaseError`: `{ code: string; message: string; path: string }`

- Valid transitions: `start -> main`, `main -> cleanup`

- `getNextTurnStage('cleanup')` returns `null`

---

## Guardrails

- Phase names must match 00.2 SS8.2 lifecycle mapping exactly — do not invent alternates
- `turnPhases.logic.ts` must not import from `boardgame.io` — pure helper
- Validators return structured results — never throw
- Drift-detection tests required for both `MATCH_PHASES` and `TURN_STAGES`
- No gameplay logic in this packet — contracts only
- No hardcoded stage/phase strings outside the canonical definitions

---

## Required `// why:` Comments

- `turnPhases.types.ts`: mapping 00.2 SS8.2 lifecycle (`Lobby -> Setup -> In Progress -> Completed`) to boardgame.io phases (`lobby -> setup -> play -> end`)
- Drift tests: failure means a value was added to the type but not the array, or vice versa

---

## Files to Produce

- `packages/game-engine/src/turn/turnPhases.types.ts` — **new** — `MatchPhase`, `TurnStage`, canonical arrays
- `packages/game-engine/src/turn/turnPhases.logic.ts` — **new** — `getNextTurnStage`, `isValidTurnStageTransition`
- `packages/game-engine/src/turn/turnPhases.validate.ts` — **new** — `validateTurnStageTransition`
- `packages/game-engine/src/types.ts` — **modified** — re-export new types
- `packages/game-engine/src/index.ts` — **modified** — export new public API
- `packages/game-engine/src/turn/turnPhases.contracts.test.ts` — **new** — 7 tests including 2 drift-detection

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No `boardgame.io` import in `turnPhases.logic.ts`
- [ ] No `throw` in `turnPhases.validate.ts`
- [ ] `docs/ai/STATUS.md` updated — what turn contracts are now exported
- [ ] `docs/ai/DECISIONS.md` updated — why `TurnStage` separate from boardgame.io stages; why `null` not cycle
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-007A checked off with date
