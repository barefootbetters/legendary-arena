# EC-008B — Core Moves Implementation (Execution Checklist)

**Source:** docs/ai/work-packets/WP-008B-core-moves-implementation.md
**Layer:** Game Engine / Moves

**Execution Authority:**
This EC is the authoritative execution checklist for WP-008B.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-008B.

---

## Before Starting

- [ ] WP-008A complete: `MoveResult`, `MoveError`, validators, gating exported
- [ ] `shuffleDeck` exists in `src/setup/shuffle.ts` (WP-005B)
- [ ] `G.currentStage` tracked in `G`; `advanceStage` wired (WP-007B)
- [ ] `makeMockCtx` exists in `src/test/mockCtx.ts` (WP-005B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-008B.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `MoveError`: `{ code: string; message: string; path: string }` — imported from WP-008A

- `PlayerZones` keys and move-to-zone mapping:
  `drawCards`: `deck -> hand` | `playCard`: `hand -> inPlay` | `endTurn`: `inPlay + hand -> discard`

- Stage gates: `drawCards` in `['start', 'main']` | `playCard` in `['main']` | `endTurn` in `['cleanup']`

- Three-step move ordering: validate args -> check stage gate -> mutate `G`

---

## Guardrails

- Every move follows exact three-step ordering — no other ordering permitted
- `zoneOps.ts` helpers return new arrays — never mutate inputs
- `zoneOps.ts` must not import from `boardgame.io`; no `Math.random`
- No `.reduce()` in zone operations — use `for...of`
- Reshuffle in `drawCards` uses `shuffleDeck` from `shuffle.ts` — never `Math.random()`
- Moves never throw — return void on invalid input
- WP-008A files (`coreMoves.types.ts`, `coreMoves.validate.ts`, `coreMoves.gating.ts`) must NOT be modified
- Integration test uses `makeMockCtx` — no `boardgame.io` or `boardgame.io/testing`

---

## Required `// why:` Comments

- `endTurn` `ctx.events.endTurn()`: boardgame.io manages rotation; manual index rotation forbidden
- `drawCards` reshuffle path: standard Legendary rule; `ctx.random` ensures determinism
- `zoneOps.ts`: extracting ops makes them testable and keeps moves under 30 lines

---

## Files to Produce

- `packages/game-engine/src/moves/zoneOps.ts` — **new** — `moveCardFromZone`, `moveAllCards`
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **new** — `drawCards`, `playCard`, `endTurn`
- `packages/game-engine/src/game.ts` — **modified** — wire implementations into `play` phase moves
- `packages/game-engine/src/index.ts` — **modified** — export helpers if needed
- `packages/game-engine/src/moves/coreMoves.integration.test.ts` — **new** — 9 tests

---

## Common Failure Smells (Optional)

- Cards disappear during draw — `moveCardFromZone` mutating input arrays instead of returning new ones
- Reshuffle not triggered — deck exhaustion check missing or `shuffleDeck` not called with `ctx`
- Move executes in wrong stage — stage gate check missing or ordered after mutation
- `endTurn` does not advance player — `ctx.events.endTurn()` call missing

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (including WP-008A tests)
- [ ] No `Math.random` in new or modified files
- [ ] `zoneOps.ts` has no `boardgame.io` import
- [ ] WP-008A contract files untouched (`git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what moves are functional; draw/play/end turn in rotation
- [ ] `docs/ai/DECISIONS.md` updated — why `zoneOps` returns new arrays; why moves return void on failure
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-008B checked off with date
