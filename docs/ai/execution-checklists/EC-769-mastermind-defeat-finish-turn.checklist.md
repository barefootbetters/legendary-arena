# EC-769 — Mastermind Defeat: Finish the Turn (Execution Checklist)

**Source:** docs/ai/work-packets/WP-732-mastermind-defeat-finish-turn.md
**Layer:** Game Engine

## Before Starting
- [ ] On `origin/main` @ or after `78c624de`, clean working tree
- [ ] Target file set is EXACTLY `## Files to Produce` below — any edit outside it is a FAIL, surface as a blocker
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (baseline green)
- [ ] Read `docs/legendary-universal-rules-v23.md` §"Players Win" (~817-838) and `fightMastermind.ts`, `endgame.evaluate.ts`, `finalTurn.logic.ts`, `simulation.runner.ts` in full

## Locked Values (do not re-derive)
- New latch: `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING = 'mastermindDefeatedPending'`
- Terminal (unchanged): `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED = 'mastermindDefeated'`
- `evaluateEndgame` precedence, in order: `MATCH_ENDED_EARLY` (tie/endedEarly) → `MASTERMIND_DEFEATED` (heroes-win) → `MASTERMIND_DEFEATED_PENDING` (return `null`, suppress below) → `SCHEME_LOSS` (scheme-wins) → `FINAL_TURN_TIE` (tie)
- Promotion helper: `promoteMastermindVictoryIfPending(G)` in `endgame/mastermindVictory.logic.ts`
- Call sites for promotion (ALL THREE bgio-bypassing turn loops, PS-1): play-phase `turn.onEnd` in `game.ts` BEFORE `resolveFinalTurnTieIfUnresolved(G)`; the sim endTurn boundary in `simulation.runner.ts`; `rotateToNextTurn` in `test/fixtures/runFixture.ts`; in `replay/replay.execute.ts` AFTER the move loop, before `computeStateHash` (no rotation site — flat dispatch loop)
- `dropAllPendingPlayerChoices` is MOVED into `mastermindVictory.logic.ts` (not exported from `fightMastermind.ts`) — keep it pure
- DECISIONS entry: D-24553

## Guardrails
- The vanquish (both `defeatMastermindTacticCore` non–Final-Blow branch AND `awardMastermindOnFinalBlow`) sets `MASTERMIND_DEFEATED_PENDING`, NEVER the terminal counter. Terminal is set at exactly one new site (the promotion).
- While pending is latched, `evaluateEndgame` returns `null` and MUST NOT return `scheme-wins`/`tie`. Terminal `MASTERMIND_DEFEATED` is checked BEFORE `SCHEME_LOSS`.
- `MATCH_ENDED_EARLY` stays first — before both Mastermind branches.
- Relocate (do not delete) the D-24518 drop: remove the vanquish-site call (`fightMastermind.ts:421`) AND MOVE the `dropAllPendingPlayerChoices` helper into `mastermindVictory.logic.ts` (keep pure — do not export from the move module); the promotion calls it. A parked choice must survive the vanquish and be cleared only at the true end of game. The complete-`pending*`-field drift test + its pointer comment move with the function.
- Turn-loop parity is mandatory across ALL THREE harnesses (PS-1): `simulation.runner.ts`, `test/fixtures/runFixture.ts`, `replay/replay.execute.ts` each promote at their turn-end rotation. Patch-one makes the sim and the replay/record oracle disagree on Mastermind wins → a wrong non-terminal `finalStateHash` at §G re-record.
- Invert (do not delete) `endgame.evaluate.test.ts` `'loss takes priority when both schemeLoss and mastermindDefeated are set'` (`~:66-75`): `scheme-wins` → `heroes-win` under the new terminal-before-`SCHEME_LOSS` order, with a `// why:` citing the rulebook + D-24553 (Reward Integrity — an intentional product change, not gaming).
- Scheme-loss with NO Mastermind latch still ends immediately (Evil Wins is not deferred) — keep a regression case.
- `mastermindVictory.logic.ts` imports no boardgame.io (pure helper; `finalTurn.logic.ts` precedent); no `.reduce()`; moves never throw.
- Determinism: re-pin honestly and ONLY where a Mastermind-defeat fixture shifts (dual oracle + PAR/coop generators). Never edit a pin to force green. STOP if a non-Mastermind fixture's hash moves.

## Required `// why:` Comments
- `endgame.types.ts` new member: it is the victory-assured latch, not a game-ender on its own (mirror `FINAL_TURN_TRIGGERED`).
- `endgame.evaluate.ts`: the precedence inversion — once victory is assured the normal loss-before-win order no longer applies for the rest of the turn (cite the rulebook + D-24553).
- `fightMastermind.ts`: both vanquish sites defer to pending (cite Players-Win + D-24553); the removed vanquish-site drop relocated to turn end.
- `mastermindVictory.logic.ts`: promote pending → terminal at turn end; drop any still-pending choice (relocated D-24518).
- `game.ts` turn.onEnd: promotion runs AFTER the onTurnEnd rule pipeline and BEFORE `resolveFinalTurnTieIfUnresolved` (so the promoted terminal makes `evaluateEndgame !== null` and the tie skips); terminal is order-independent vs `SCHEME_LOSS` only because `evaluateEndgame` checks terminal first.
- `simulation.runner.ts`: sim endTurn-boundary promotion parity (mirror the `applyPileDepletionResourceLoss` turn.onMove note).
- `runFixture.ts` + `replay.execute.ts`: the promotion is turn-loop-harness parity for the deferred win (cite PS-1) — replay.execute has no rotation site so it goes post-loop before the hash.

## Files to Produce
- `packages/game-engine/src/endgame/endgame.types.ts` — **modified** — add the latch constant
- `packages/game-engine/src/endgame/endgame.evaluate.ts` — **modified** — new precedence
- `packages/game-engine/src/endgame/mastermindVictory.logic.ts` — **new** — `promoteMastermindVictoryIfPending` + the moved `dropAllPendingPlayerChoices`
- `packages/game-engine/src/moves/fightMastermind.ts` — **modified** — pending at vanquish; REMOVE the vanquish-site drop call + the helper (moved)
- `packages/game-engine/src/game.ts` — **modified** — turn.onEnd promotion call
- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** — sim endTurn promotion
- `packages/game-engine/src/test/fixtures/runFixture.ts` — **modified** — turn-end-rotation promotion (PS-1)
- `packages/game-engine/src/replay/replay.execute.ts` — **modified** — post-move-loop promotion (before `computeStateHash`; no rotation site) (PS-1)
- `packages/game-engine/src/endgame/endgame.evaluate.test.ts` — **modified** — precedence cases + inverted loss-vs-win regression
- `packages/game-engine/src/endgame/mastermindVictory.logic.test.ts` — **new** — promotion tests + relocated pending-field drift test
- `packages/game-engine/src/moves/fightMastermind.test.ts` — **modified** — pending-not-terminal + parked-choice-survives; drift test moves out
- `packages/game-engine/src/simulation/simulation.captureMoves.test.ts` — **modified** — real-registry Mastermind-win sim↔runFixture round-trip parity (PS-1)
- `packages/game-engine/src/game.test.ts` — **modified if needed** — turn-end vanquish → gameover
- engine hash oracles + PAR/coop baselines — **verify; re-pin/regenerate only where a Mastermind-defeat fixture shifts**
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — governance close-out

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm -r build` exits 0; `pnpm -r test` exits 0
- [ ] Determinism: sentinel/replay pins unchanged (no fixture defeats a Mastermind); PAR/coop baselines regenerated honestly if the win distribution shifted — documented in D-24553
- [ ] Live-on-surface verification (D-24026) — a Mastermind win finishes the turn then ends heroes-win on play.legendary-arena.com; recorded in STATUS.md
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — D-24553 landed (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-732 checked off with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-769 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0

## Common Failure Smells
- Mastermind-win games recorded as `maxTurns`/stuck in sim → the endTurn promotion (§E) is missing or mis-ordered.
- A real-registry Mastermind-win round-trip where `runFixture`/replay outcome ≠ sim outcome → only the sim was patched; `runFixture.ts` and/or `replay.execute.ts` still miss the turn-end promotion (PS-1).
- `dropAllPendingPlayerChoices` still imported from `fightMastermind.ts` → it was exported instead of moved; move it into `mastermindVictory.logic.ts` to keep the endgame helper boardgame.io-free.
- A pending choice dangling on the victory screen → the relocated D-24518 drop is not running at the turn-end promotion.
- A scheme-loss ending the game during the finished winning turn → the pending-suppression branch is missing or ordered after `SCHEME_LOSS`.
- A sentinel/replay `finalStateHash` moving → a non-Mastermind fixture picked up the latch (leak); STOP and investigate, do not re-pin blindly.
