# EC-010 — Endgame Conditions (Execution Checklist)

> Reference EC — other ECs should follow this structure and level of strictness.

**Source:** docs/ai/work-packets/WP-010-victory-loss-conditions-minimal-mvp.md
**Layer:** Game Engine / Endgame

**Execution Authority:**
This EC is the authoritative execution checklist for WP-010.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-010.

---

## Before Starting

- [ ] WP-009B complete: `G.counters`, `G.messages`, `G.hookRegistry` exist
- [ ] `game.ts` has a `play` phase with `onTurnStart` / `onTurnEnd` hooks
- [ ] `makeMockCtx` exists in `src/test/mockCtx.ts`
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-010.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `ENDGAME_CONDITIONS.ESCAPED_VILLAINS = 'escapedVillains'`
- `ENDGAME_CONDITIONS.SCHEME_LOSS = 'schemeLoss'`
- `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED = 'mastermindDefeated'`
- `ESCAPE_LIMIT = 8`

- `EndgameOutcome` values:
  - `'heroes-win'`
  - `'scheme-wins'`

- `EndgameResult` shape:
  - `{ outcome: EndgameOutcome; reason: string }`

- **Evaluation order (exact priority — do not reorder):**
  1. `escapedVillains >= ESCAPE_LIMIT`
     → `{ outcome: 'scheme-wins', reason: 'Too many villains escaped.' }`
  2. `schemeLoss >= 1`
     → `{ outcome: 'scheme-wins', reason: 'The scheme has been completed.' }`
  3. `mastermindDefeated >= 1`
     → `{ outcome: 'heroes-win', reason: 'The mastermind has been defeated.' }`
  4. otherwise → `null`

- Missing counter keys evaluate as `0` via `?? 0`

---

## Guardrails

- `evaluateEndgame(G)` is pure:
  - no mutation
  - no I/O
  - no logging
  - no throw
- `endIf` delegates entirely to `evaluateEndgame`
  - no inline `G.counters[...]` logic
- All counter access uses `ENDGAME_CONDITIONS` constants
  - never string literals
- Loss conditions are evaluated before victory
  - simultaneous conditions result in scheme win
- No boolean fields in `G`
  - numeric counters only (`>= 1` is truthy)
- No `boardgame.io` imports in endgame files
- Control flow uses `if / else if / else`
  - no nested ternaries

---

## Required `// why:` Comments

- `ESCAPE_LIMIT = 8`
  - explain: Legendary MVP rule; becomes config later
- Evaluation order block
  - explain: loss-before-victory rule precedence
- `endIf` in `game.ts`
  - explain: pure delegation to engine logic
- Priority-order test
  - explain: prevents regression on loss-vs-victory ordering

---

## Files to Produce

- `src/endgame/endgame.types.ts` — **new**
  EndgameResult, ENDGAME_CONDITIONS, ESCAPE_LIMIT
- `src/endgame/endgame.evaluate.ts` — **new**
  Pure `evaluateEndgame` function
- `src/game.ts` — **modified**
  Wire `endIf` into play phase
- `src/types.ts` — **modified**
  Re-export endgame types
- `src/index.ts` — **modified**
  Export new public API
- `src/endgame/endgame.evaluate.test.ts` — **new**
  Node:test coverage (6 tests)

---

## Common Failure Smells (Optional)

- Heroes win when scheme should win
  → evaluation order violated
- Game ends immediately on start
  → missing counters default not handled
- Endgame logic hard to test
  → side effects inside `evaluateEndgame`
- Tests brittle to wording changes
  → reason strings not treated as locked values

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No `throw` in `endgame.evaluate.ts`
- [ ] No inline `G.counters[...]` logic in `endIf`
- [ ] `docs/ai/STATUS.md` updated
      (match can now end via 3 MVP conditions)
- [ ] `docs/ai/DECISIONS.md` updated
      (loss-before-victory, numeric counters, ESCAPE_LIMIT)
- [ ] `docs/ai/work-packets/WORK_INDEX.md`
      WP-010 checked off with date
