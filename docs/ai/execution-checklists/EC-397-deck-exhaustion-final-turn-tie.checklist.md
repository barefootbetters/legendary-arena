# EC-397 — Deck-Exhaustion Final Turn → Tie (Execution Checklist)

**Source:** docs/ai/work-packets/WP-367-deck-exhaustion-final-turn-tie.md
**Layer:** Game Engine (+ one server competition mapping)

## Before Starting
- [ ] Target file set = exactly the `Files to Produce` list below; any edit outside it is a FAIL — surface as a blocker.
- [ ] `packages/game-engine/src/endgame/endgame.types.ts` exports `ENDGAME_CONDITIONS` + `EndgameOutcome`
- [ ] `G.heroDeck` (WP-135) and `performVillainReveal` (WP-014A) exist as described
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (baseline 1906)

## Locked Values (do not re-derive)
- `ENDGAME_CONDITIONS`: `ESCAPED_VILLAINS='escapedVillains'`, `SCHEME_LOSS='schemeLoss'`, `MASTERMIND_DEFEATED='mastermindDefeated'`, `FINAL_TURN_TRIGGERED='finalTurnTriggered'`, `FINAL_TURN_TIE='finalTurnTie'`
- `EndgameOutcome = 'heroes-win' | 'scheme-wins' | 'tie'`
- `evaluateEndgame` order: escaped-villains (loss) → schemeLoss (loss) → mastermindDefeated (win) → **tie (last)**
- Phases `'lobby' | 'setup' | 'play' | 'end'`; stages `'start' | 'main' | 'cleanup'`

## Guardrails
- The latch is **sticky** — set `FINAL_TURN_TRIGGERED` once, never clear it (a refilled deck must not cancel the final turn).
- The latch **never** ends the game — only the `FINAL_TURN_TIE` counter (set at turn end) does, via `evaluateEndgame`.
- Tie is ranked **last** in `evaluateEndgame`; a win/loss during the final turn wins/loses, never ties.
- `resolveFinalTurnTieIfUnresolved` sets the tie only when latched AND `evaluateEndgame(G) === null`.
- `finalTurn.logic.ts` imports no `boardgame.io`; use `ENDGAME_CONDITIONS.*`, never string literals.
- Removing the villain reshuffle drops the `shuffleDeck` import — confirm no other use in the file.
- Any outcome-typed field references `EndgameOutcome` (single source), never a re-spelled union.
- STOP means HARD STOP: a scope-list violation is a blocker, not a judgment call.

## Required `// why:` Comments
- `endgame.types.ts`: both new counter keys — what each is and that the latch never ends the game.
- `endgame.evaluate.ts`: the tie branch — why it is checked last.
- `game.ts` `onMove`: sticky latch after every play move (the refill edge).
- `game.ts` `onEnd`: tie resolved after onTurnEnd effects, guarded on no win/loss.
- `villainDeck.reveal.ts`: no reshuffle — exhaustion is terminal (D-24160).
- `uiState.build.ts`: present-only-when-latched + suppressed once game-over; generic reason on refill.
- `competition.logic.ts`: `tie → null` (not a decisive competitive result).
- `sweep.analyze.ts`: tie lands in the non-decisive winner bucket.

## Files to Produce
- `packages/game-engine/src/endgame/endgame.types.ts` — **modified** — `'tie'` + two counter keys
- `packages/game-engine/src/endgame/endgame.evaluate.ts` — **modified** — tie branch (last)
- `packages/game-engine/src/endgame/finalTurn.logic.ts` — **new** — latch + tie helpers
- `packages/game-engine/src/endgame/finalTurn.logic.test.ts` — **new** — helper tests
- `packages/game-engine/src/endgame/endgame.evaluate.test.ts` — **modified** — tie tests
- `packages/game-engine/src/game.ts` — **modified** — onMove latch + onEnd tie
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — remove reshuffle
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **modified** — no-reshuffle test
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `UIFinalTurnState` + optional field
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — build `finalTurn`
- `packages/game-engine/src/ui/uiState.build.finalTurn.test.ts` — **new** — projection tests
- `packages/game-engine/src/index.ts` — **modified** — re-export `UIFinalTurnState`
- `packages/game-engine/src/persistence/persistence.types.ts` — **modified** — `result: EndgameOutcome`
- `packages/game-engine/src/test/fixtures/fixtureSchema.ts` — **modified** — accept `'tie'`
- `packages/game-engine/src/simulation/sweep.analyze.ts` — **modified** — accept `'tie'`
- `apps/server/src/competition/competition.logic.ts` — **modified** — `tie → null`

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (1922)
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm sim:coverage --check` OK (sentinel `finalStateHash` unchanged)
- [ ] Live-on-surface: `User-Visible Surface = play.legendary-arena.com` — D-24026 operator-pending on deploy
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated (D-24159, D-24160, D-24161)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date

## Common Failure Smells
- Game ends the instant a deck empties → the latch is being read as an end condition (it must not be; only `FINAL_TURN_TIE` ends the game).
- A refill cancels the final turn → the latch is not sticky (guard the early-return on already-latched).
- `sim:coverage` sentinel churns → the reshuffle removal changed a fixture that exhausts the villain deck; investigate before re-pinning.
