# EC-036 — AI Playtesting & Balance Simulation (Execution Checklist)

**Source:** docs/ai/work-packets/WP-036-ai-playtesting-balance-simulation.md
**Layer:** Game Engine / Simulation Tooling

**Execution Authority:**
This EC is the authoritative execution checklist for WP-036.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-036.

---

## Before Starting

- [ ] WP-035 complete: release process with validation gates exists
- [ ] `ClientTurnIntent` exported from `intent.types.ts` (WP-032)
- [ ] `UIState` exported from `uiState.types.ts` (WP-028)
- [ ] `filterUIStateForAudience` exported (WP-029)
- [ ] `ReplayInput`, `computeStateHash` exported (WP-027)
- [ ] `FinalScoreSummary` exported from `scoring.types.ts` (WP-020)
- [ ] `makeMockCtx` exported (WP-005B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-036.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `AIPolicy = { name: string; decideTurn(playerView: UIState, legalMoves: LegalMove[]): ClientTurnIntent }`
- `LegalMove = { name: string; args: unknown }`
- `SimulationResult = { gamesPlayed: number; winRate: number; averageTurns: number; averageScore: number; escapedVillainsAverage: number; woundsAverage: number; seed: string }`
- AI receives filtered `UIState` (player audience) — same as human player
- AI submits `ClientTurnIntent` through the same pipeline as humans

---

## Guardrails

- AI is tooling, not gameplay (D-0701) — lives outside the engine
- AI cannot inspect hidden state — receives `filterUIStateForAudience` only
- All AI randomness uses seeded RNG — never `Math.random()`
- AI decisions are deterministic — same seed + same state = same decision
- `AIPolicy` is not stored in `G` — external to engine
- No `.reduce()` in simulation logic
- No modifications to engine gameplay logic
- No `boardgame.io` imports in simulation files

---

## Required `// why:` Comments

- `ai.types.ts`: AI receives filtered UIState; AI is tooling, not gameplay (D-0701)
- `ai.random.ts`: random policy establishes baseline; sophisticated policies are future work
- `ai.legalMoves.ts`: AI can only choose from legal moves; same constraint as humans
- `simulation.runner.ts`: simulation uses the full engine pipeline — same as multiplayer

---

## Files to Produce

- `packages/game-engine/src/simulation/ai.types.ts` — **new** — AIPolicy, LegalMove, SimulationConfig, SimulationResult
- `packages/game-engine/src/simulation/ai.random.ts` — **new** — createRandomPolicy
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **new** — getLegalMoves
- `packages/game-engine/src/simulation/simulation.runner.ts` — **new** — runSimulation
- `packages/game-engine/src/types.ts` — **modified** — re-export simulation types
- `packages/game-engine/src/index.ts` — **modified** — export simulation API
- `packages/game-engine/src/simulation/simulation.test.ts` — **new** — 8 tests

---

## Common Failure Smells (Optional)

- AI reads unfiltered `G` directly instead of filtered `UIState`
- `Math.random()` used instead of seeded RNG
- Simulation modifies engine gameplay files
- AI policy stored in `G` instead of kept external

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No `boardgame.io` import in simulation files
- [ ] No `Math.random()` in simulation
- [ ] No engine gameplay files modified (confirmed with `git diff`)
- [ ] `docs/ai/STATUS.md` updated
      (AI simulation framework; random policy baseline; D-0701, D-0702)
- [ ] `docs/ai/DECISIONS.md` updated
      (same pipeline as humans; random baseline; simulation seeds)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-036 checked off with date
