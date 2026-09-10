# EC-733 — Core Dr. Doom "Secrets of Time Travel" + extra-turn primitive (Execution Checklist)

**Source:** docs/ai/work-packets/WP-696-mastermind-tactic-extra-turn-core.md
**Layer:** Game Engine
**Status:** Pending

## Before Starting
- [ ] WP-497 (tactic-onFight framework / D-24300) on `main` — read `rules/tacticHandlers.ts`: `dispatchTacticOnFight`, an existing resolver (`resolveOctetOfValenceElectrons` for the lazy `G` field pattern), and the ext_id key format
- [ ] Read the turn model at HEAD — there are **TWO production end-turn paths** (the "single chokepoint" idea is FALSE, per gate review): (1) `turn/turnLoop.ts` `advanceTurnStage` (cleanup-stage auto-end → `context.events.endTurn()`); (2) the `endTurn` MOVE in `moves/coreMoves.impl.ts` (≈ L605) which calls `events.endTurn()` **directly**, NOT via `advanceTurnStage` (game.ts documents both paths, D-22002). BOTH must honor `G.extraTurns` or the extra turn drops on the normal end-turn (AC-2). Also read the play-phase `turn` config (default order, `onBegin` resets)
- [ ] Read how the harnesses bypass bgio — **THREE of them** (par.aggregator was the missing third): `simulation/simulation.runner.ts` manual rotation (`(policyIndex+1)%numPlayers`, ≈ L644); `simulation/par.aggregator.ts` advanceStage wrapper (≈ L425) + manual rotation (≈ L698) — the PAR scoring surface; `replay/replay.execute.ts` advanceStage/synthetic `endTurn`. (Test parity: `test/fixtures/runFixture.ts` ≈ L138.)
- [ ] Confirm boardgame.io `^0.50.0` honors `events.endTurn({ next: playerID })` (ends current turn, begins that player's turn, fires onEnd→onBegin)
- [ ] Confirm the lazy-hash pattern: `handSizeOverrides` / `lastPlayEffectsFired` are absent by default and NOT seeded in `buildInitialGameState`
- [ ] `pnpm -r build` 0; engine suite green

## Locked Values (do not re-derive)
- [ ] ext_id: `core-mastermind-dr-doom-secrets-of-time-travel` (mastermind slug `dr-doom`, tactic slug `secrets-of-time-travel`; printed "Fight: Take another turn after this one.")
- [ ] `G.extraTurns?: Record<string, number>` — resolver does `+= 1` (INCREMENT for stacking, NOT set-to-1); turn-end decrements, deletes at 0
- [ ] Extra turn is granted via `events.endTurn({ next: currentPlayer })` — NEVER manual `ctx.currentPlayer` rotation

## Guardrails
- [ ] All turn changes via `ctx.events.endTurn()` only; every call (bare or `{ next }`) carries a `// why:` comment
- [ ] `G.extraTurns` absent by default; NOT seeded in `buildInitialGameState`; decrement-to-delete (no leftover key)
- [ ] ALL THREE harnesses (sim runner, **par.aggregator**, replay executor) honor `G.extraTurns` at their manual rotation points, decrementing identically to `advanceTurnStage` (no live-vs-harness turn-count divergence; par.aggregator omission desyncs the PAR/`sim:runtime-observed` scoring surface)
- [ ] Moves never throw; `dispatchTacticOnFight` unknown id stays a silent no-op; resolver mutates `G`, never throws
- [ ] Deterministic: no `Math.random`, no wall-clock, no I/O, no `ctx.random.*`; no `.reduce()`; no `boardgame.io` import in `tacticHandlers.ts` / `turnLoop.ts`
- [ ] Default `turn.order` config UNCHANGED (Option A, not the rejected custom-order Option B)
- [ ] Re-pin: no committed fixture defeats this tactic → expect BYTE-IDENTICAL sentinel + `PRE_WP080` hashes. If one does defeat it → STOP + escalate (an inserted extra turn desyncs a recorded move-log replay — not a blind re-pin)

## Required `// why:` Comments
- [ ] The `endTurn({ next: currentPlayer })` branch in `advanceTurnStage` — cite WP-696 / D-24513, "take another turn," framework primitive not manual rotation
- [ ] `G.extraTurns` lazy-create + decrement-to-delete rationale (lazy-hash pattern; keeps normal games byte-identical)
- [ ] The dispatch case + resolver cite WP-696 / D-24513
- [ ] The sim/replay counter mirror — why the harness must duplicate the bgio turn-end logic

## Files to Produce
- [ ] `packages/game-engine/src/types.ts` — `+ extraTurns?: Record<string, number>` (not seeded)
- [ ] `packages/game-engine/src/turn/turnLoop.ts` — honor/decrement counter at turn-end via `endTurn({ next })`; widen `TurnLoopContext` (`currentPlayer`, `endTurn` opts) + `TurnLoopState` (`extraTurns?`)
- [ ] `packages/game-engine/src/rules/tacticHandlers.ts` — `resolveSecretsOfTimeTravel` + `SECRETS_OF_TIME_TRAVEL_TACTIC_ID` const + dispatch branch
- [ ] `packages/game-engine/src/game.ts` — KO-turn-end call passes `ctx.currentPlayer`; synthetic `endTurn` forwards `{ next }`
- [ ] `packages/game-engine/src/moves/coreMoves.impl.ts` — the endTurn move's DIRECT `events.endTurn()` (≈ L605) honors/decrements `G.extraTurns` → `events.endTurn({ next: currentPlayer })` (NOT an `advanceTurnStage` call)
- [ ] `packages/game-engine/src/simulation/simulation.runner.ts` — manual rotation honors `G.extraTurns`
- [ ] `packages/game-engine/src/simulation/par.aggregator.ts` — advanceStage wrapper (≈425) + manual rotation (≈698) honor `G.extraTurns` (added under gate review)
- [ ] `packages/game-engine/src/replay/replay.execute.ts` — advanceStage/synthetic `endTurn` honors `G.extraTurns`
- [ ] `packages/game-engine/src/test/fixtures/runFixture.ts` — (test-only) FOURTH manual-rotation harness (`rotateToNextTurn` ≈L281, synthetic `endTurn` ignores args ≈L213); honor `G.extraTurns` if a fixture test exercises an extra turn (low severity — no CI/scoring surface)
- [ ] `packages/game-engine/src/turn/turnLoop.test.ts` — grant/decrement/normal-rotation/stacking assertions
- [ ] `packages/game-engine/src/rules/tacticHandlers.test.ts` — resolver-increment + dispatch + unknown-id + harness-parity assertions
- [ ] `scripts/coverage/tactic-provenance.json` — one `executable` row; regenerate the effect-index
- [ ] NO card-data edit (resolver-only)

## After Completing
- [ ] engine suite green; `pnpm -r build` 0; control-stub proves the extra-turn/stacking/parity tests are non-vacuous
- [ ] grep fixtures/sentinels for `secrets-of-time-travel` → none defeats it; sentinel + `PRE_WP080` hashes byte-identical (or drift ESCALATED, documented — not blind-re-pinned)
- [ ] `pnpm effect-index:check` current after regen; `pnpm cards:check` reproducible; `pnpm sim:runtime-observed:check` current
- [ ] `git diff --name-only` = allowlist + governance only
- [ ] D-24513 Active; WORK_INDEX `[x]`; EC_INDEX `Done`; roadmap mindmap 📝→✅; `roadmap:counts:check` 0; STATUS close-out; two-commit topology (EC-733 impl + SPEC close)
- [ ] PR squash-merged when green; live-verify performed or operator-pending

## Common Failure Smells
- Counter honored only in `advanceTurnStage` → (a) the `endTurn` MOVE's direct `events.endTurn()` drops the extra turn on the normal end-turn path (AC-2 fails), and (b) sim/par.aggregator/replay rotate normally, dropping it in harnesses (the arc's foundational lockstep miss — honor the counter at ALL production rotation sites).
- `set`-to-1 instead of `+= 1` → two stacked extra-turn tactics grant one turn, not two.
- Manual `ctx.currentPlayer` rotation instead of `endTurn({ next })` → violates the turn-model rule; forbidden.
- `extraTurns` seeded in `buildInitialGameState` → `PRE_WP080` oracle re-pins for nothing.
- Blind-re-pinning the `core/dr-doom` sentinel when a fixture defeats this tactic → hides a replay desync; STOP and escalate instead.
