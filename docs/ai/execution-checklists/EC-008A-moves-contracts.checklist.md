# EC-008A — Core Moves Contracts (Execution Checklist)

**Source:** docs/ai/work-packets/WP-008A-core-moves-contracts.md
**Layer:** Game Engine / Contracts

**Execution Authority:**
This EC is the authoritative execution checklist for WP-008A.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-008A.

---

## Before Starting

- [ ] WP-007B complete: `G.currentStage` tracked, `advanceStage` wired in `play` phase
- [ ] `TurnStage`, `TURN_STAGES` exported from `turnPhases.types.ts` (WP-007A)
- [ ] `CardExtId`, `PlayerZones` exported from `zones.types.ts` (WP-006A)
- [ ] `makeMockCtx` exists in `src/test/mockCtx.ts` (WP-005B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-008A.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `MoveError`: `{ code: string; message: string; path: string }` — engine-wide contract

- `MoveResult`: `{ ok: true } | { ok: false; errors: MoveError[] }`

- `CoreMoveName` — exactly 3 values: `'drawCards'` | `'playCard'` | `'endTurn'`

- `CORE_MOVE_NAMES: readonly CoreMoveName[]` — all 3 in canonical order

- `MOVE_ALLOWED_STAGES`:
  `drawCards`: `['start', 'main']` | `playCard`: `['main']` | `endTurn`: `['cleanup']`

- `PlayCardArgs.cardId` typed as `CardExtId` — not plain `string`

- `EndTurnArgs = Record<string, never>` — no payload

---

## Guardrails

- `MoveResult`/`MoveError` are the engine-wide contract — no future packet may redefine them
- `PlayCardArgs.cardId` imports `CardExtId` from `zones.types.ts`
- Stage gating references `TurnStage` from `turnPhases.types.ts` — no hardcoded strings outside `MOVE_ALLOWED_STAGES`
- All four validators return structured results — never throw
- Drift-detection test required for `CORE_MOVE_NAMES`
- No move implementations that mutate `G` in this packet — contracts only
- No `boardgame.io` import in `coreMoves.gating.ts`

---

## Required `// why:` Comments

- `MoveResult`/`MoveError`: engine-wide contract — every future packet imports these
- `MOVE_ALLOWED_STAGES`: each stage assignment explaining design decision
- Drift test: failure means a move name added to type but not array

---

## Files to Produce

- `packages/game-engine/src/moves/coreMoves.types.ts` — **new** — move names, payloads, `MoveResult`/`MoveError`
- `packages/game-engine/src/moves/coreMoves.gating.ts` — **new** — `MOVE_ALLOWED_STAGES`, `isMoveAllowedInStage`
- `packages/game-engine/src/moves/coreMoves.validate.ts` — **new** — 4 pure validators
- `packages/game-engine/src/types.ts` — **modified** — re-export move contracts
- `packages/game-engine/src/index.ts` — **modified** — export new public API
- `packages/game-engine/src/moves/coreMoves.contracts.test.ts` — **new** — 9 tests including drift-detection

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No `throw` in any validator
- [ ] No `boardgame.io` import in `coreMoves.gating.ts`
- [ ] `docs/ai/STATUS.md` updated — what move contracts are now exported
- [ ] `docs/ai/DECISIONS.md` updated — stage assignments for each move
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-008A checked off with date
