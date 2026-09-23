# EC-786 — Sim / PAR loops resolve a seat choice addressed to a non-active seat (Execution Checklist)

**Source:** docs/ai/work-packets/WP-749-sim-non-active-seat-choice-dispatch.md
**Layer:** Game Engine — observation harnesses (`src/simulation/**`, `src/test/fixtures/runFixture.ts`)
**Status:** Pending

## Before Starting
- [ ] Fresh worktree off `origin/main`. Run `pnpm install`, then `pnpm -r build` (exit 0). Record the engine-suite baseline count.
- [ ] Re-confirm the gap: neither `runPerTurnLoop` nor the PAR `simulateOneGame` ever builds a lifecycle context or move context for a seat other than `currentPlayer`; `runFixture`'s `MOVE_MAP` has no `resolveSeatChoice`.
- [ ] Read: `moves/seatChoice.resolve.ts` (L1–320); the `ai.legalMoves.ts` seat-choice short-circuit; `rules/tacticHandlers.ts` Vanishing Illusions + `moves/seatChoiceTactics.ts` `applyVanishingIllusionsKo`; `simulation.captureMoves.test.ts`; `deferredGrantParity.test.ts`.
- [ ] Run the PAR attribution baseline: `node scripts/generate-par-profiles.mjs --version v1 --sample 200` on the untouched tree. If `data/par/profile/v1/**` drifts, STOP and land that drift as its own `INFRA:` re-pin first (WP §D).
- [ ] Scope lock: only Files to Produce. Anything else → STOP.

## Locked Values (do not re-derive)
- **Trigger:** `gameState.pendingSeatChoice !== undefined` **and** `getOutstandingSeats(choice)` is non-empty **and** does not include `currentPlayer`. Acting seat = `outstandingSeats[0]`.
- **Placement:** immediately after the `evaluateEndgame` check, before the active seat's lifecycle context / `getLegalMoves` / policy call. Ends with `continue`.
- **Move:** `getLegalMoves(gameState, { phase: 'play', turn, currentPlayer: actingSeat, numPlayers })`; dispatch only when the result is exactly one move named `resolveSeatChoice`, with its `args` unchanged, via `MOVE_MAP.resolveSeatChoice` and a context built by the loop's own `buildMoveContext` for `actingSeat` with a fresh `{ triggered: false }` end-turn flag. No policy call.
- **After dispatch:** sim → `onMoveDispatched({ playerId: actingSeat, moveName, args })` when defined; PAR → `movesDispatched += 1`. Both → `applyPileDepletionResourceLoss(gameState)` then `resolveDeferredHeroGrants(gameState, context)`.
- **Stuck path:** sim `Simulation warning: seat <seat> owes a seat choice but has no single resolveSeatChoice move — flagging game <gameIndex> as stuck.` + `turnsElapsed = maxTurns`; PAR `PAR aggregator warning: seat <seat> owes a seat choice but has no single resolveSeatChoice move — flagging game as stuck.` + `turnsElapsed = MAX_TURNS_PER_GAME`; then `break`.
- **runFixture:** `resolveSeatChoice: (context, args) => resolveSeatChoice(context as never, args as never)` in `MOVE_MAP`.
- **Imports:** `getOutstandingSeats` added to the existing `../moves/seatChoice.resolve.js` import in both loops; `resolveSeatChoice` from `../../moves/seatChoice.resolve.js` in `runFixture`.

## Guardrails
- **No live-path change:** nothing under `game.ts`, `moves/**`, `rules/**`, `hero/**`, `setup/**`, `simulation/ai.legalMoves.ts`.
- **Never synthesize a choice.** The dispatched args are `getLegalMoves`' own; no policy is consulted for the non-active seat.
- **Hash oracles byte-unchanged.** A moved sentinel `finalStateHash` or `PRE_WP080_HASH` is a bug to diagnose. Never re-pin.
- **`runtime-observed` and `sim:coverage` must not drift.** If either `:check` fails, STOP and report; do not regenerate or re-pin the dashboard.
- **PAR profiles via the sanctioned command only**; never hand-edited; the full `fidelity-report.{json,md}` is what gets committed (a `--limit` run rewrites it).
- **Runtime assertions only** (D-24372): no `any`, `@ts-ignore`, `@ts-expect-error`.

## Required `// why:` Comments
- Each loop's branch: WP-749 / D-24573; the live framework routes a seat choice to the addressed seat (WP-684 / D-24501) but the loop only drives `currentPlayer`; the default is the disconnect/timeout default so an all-bot resolution is replay-identical; outstanding seats act before the blocked active seat; the post-move mirrors match live `onMove` for any move.
- The stuck path: why it fails loudly instead of retrying; note `getLegalMoves` does not clamp `defaultOptionIndex` (unlike the timeout path), so the backstop for an out-of-range default is `MAX_MOVE_STEPS_PER_TURN` in the sim and `MAX_MOVES_PER_GAME` in PAR.
- `runFixture`'s map entry: the sim capture → fixture replay lockstep (D-24273); `dispatchSingleMove` already passes `move.playerId`.

## Files to Produce
- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** — the branch
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** — the branch
- `packages/game-engine/src/test/fixtures/runFixture.ts` — **modified** — map entry (import beside the other move imports; may correct the stale non-core-entry count comment)
- `packages/game-engine/src/simulation/seatChoiceDispatch.test.ts` — **new** — WP §E locked recipe: single-Tactic mock `core`/`loki` (Vanishing Illusions), a locked literal seed, ≥ 8 `vAttack '0'` villain copies, `bystandersCount: 4` (supply pile only; not validated on the sim path), `vAttack '9'` henchmen; strict-priority policies — seat 1 reveal → first `fightVillain` (shared flag) → advance → end; seat 0 reveal → `fightMastermind` iff flag → advance → end; loud precondition = the Vanishing Illusions fight-effect line present and the no-villain line absent; asserts (a) a captured `resolveSeatChoice` with `playerId '1'` after seat 0's `fightMastermind` and before its next `endTurn`, (b) `endgameReached` + `heroes-win` and the `/KO'd .+ from their Victory Pile \(Vanishing Illusions\)\./` line after the fight, (c) `runFixture` replays the capture and reproduces that line. Fallback: Random Acts pass-left per WP §E, recorded in the commit body. +1 test, +1 suite
- `data/par/profile/v1/**` — **modified** — regenerated

## After Completing
- [ ] `pnpm -r build` exits 0; engine suite green (baseline → new counts in the `EC-786:` body).
- [ ] `pnpm sim:runtime-observed:check` and `pnpm sim:coverage --check` exit 0 with no regeneration.
- [ ] PAR: negative-zone / Loki / brotherhood+enemies-of-asgard `stuckAtCapCount` ≤ 10; the legacy-virus / Dr Doom / masters-of-evil control file has no diff; totals 25600; a second `--limit` run byte-identical; full fidelity report restored — all via the WP §Verification commands. The commit body lists the aggregate win / loss / stuck before → after and explains any residual stuck games in the Loki scenarios (verify with an uncommitted one-off: `runSimulation` on the midtown / Loki / brotherhood+enemies-of-asgard config, grepping each stuck game's messages for `owes a seat choice`; record the count in the commit body; do not commit the script).
- [ ] `git diff --name-only` ⊆ Files to Produce; no `game.ts`, no `ai.legalMoves.ts`, no dashboard file.
- [ ] Governance (`SPEC:` close): STATUS states "No user-observable change — infrastructure only" (D-24026); DECISIONS D-24573 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`, `pnpm roadmap:counts:write`, `roadmap:counts:check` exits 0.

## Common Failure Smells (Optional)
- **Loki PAR still stuck.** The branch sits after the policy call, or its trigger also requires the current player to be addressed.
- **Infinite loop / step-budget stuck.** The branch ran while the current player was itself outstanding, or the seat's move was dispatched with `playerID: currentPlayer` (rejected silently, choice never clears).
- **`runFixture` throws "unknown move name"** on a captured trace. The map entry is missing.
- **Control scenario or runtime-observed moved.** The branch fires when no seat choice is open, or a policy call / decision log slipped into it.
- **Test passes vacuously.** No choice ever parked (the non-fighting seat had no Villain in its Victory Pile); the precondition must fail loudly.
