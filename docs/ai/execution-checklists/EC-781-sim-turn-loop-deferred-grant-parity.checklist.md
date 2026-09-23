# EC-781 — Sim / PAR / fixture turn loops resolve and clear deferred conditional grants (Execution Checklist)

**Source:** docs/ai/work-packets/WP-744-sim-turn-loop-deferred-grant-parity.md
**Layer:** Game Engine — observation harnesses (`src/simulation/**`, `src/test/fixtures/runFixture.ts`)
**Status:** Pending

## Before Starting
- [ ] Fresh worktree off `origin/main`. Run `pnpm install`, then `pnpm -r build` (exit 0). Record the engine-suite baseline count.
- [ ] Re-confirm the gap: none of `simulation.runner.ts`, `par.aggregator.ts`, `runFixture.ts`, `onBeginParity.ts` calls `resolveDeferredHeroGrants` or `clearDeferredConditionalGrants`. If WP-743 has landed, `onBeginParity.ts` already carries its two flag deletes; keep them and add beside them.
- [ ] Read: `game.ts` play-phase `turn.onMove` + `turn.onBegin` (~L763–818); `hero/heroEffects.execute.ts` `resolveDeferredHeroGrants` (~L5426); `hero/deferredConditionalGrants.ts`; `simulation/onBeginParity.ts` + its test; `simulation/simulation.captureMoves.test.ts` (the WP-732 round-trip pattern); the `replay.execute.ts` header.
- [ ] Confirm `pnpm sim:runtime-observed:check` passes on the untouched baseline (so any drift after the change is attributable), and `pnpm --filter @legendary-arena/dashboard typecheck` exits 0.
- [ ] Scope lock: only Files to Produce. Anything else → STOP.

## Locked Values (do not re-derive)
- **Resolve call:** `resolveDeferredHeroGrants(gameState, <the dispatched move's own context object>)`, once per successfully dispatched move, in each of the three loops.
- **Sim + PAR placement:** immediately **after** the existing `applyPileDepletionResourceLoss(gameState)`; skipped when `moveFn === undefined` (hold the context in a per-iteration variable that stays `undefined` on that path).
- **runFixture placement:** in `dispatchSingleMove`, immediately after `moveDispatch(moveContext, move.args)`, before the `endTurnFlag` rotation check.
- **Clear:** in `applyOnBeginParity`, `clearDeferredConditionalGrants(gameState)` then `if (gameState.villainOrMastermindDefeatedSinceResolve !== undefined) { delete gameState.villainOrMastermindDefeatedSinceResolve; }` — the `game.ts` `onBegin` order.
- **Imports:** `resolveDeferredHeroGrants` from `../hero/heroEffects.execute.js` (sim, PAR) / `../../hero/heroEffects.execute.js` (runFixture); `clearDeferredConditionalGrants` from `../hero/deferredConditionalGrants.js` (parity).
- **Dashboard pin:** `useInPlayCoverage.test.ts` real-seed `totalObs` 3012 → the value the regenerated feed yields (3011 at draft baseline `a4cfd995`; re-derive by running, never copy). `percentResolved` re-pinned only if it moves.

## Guardrails
- **No `game.ts`, `hero/**`, `moves/**`, `setup/**` change.** The live path is already correct.
- **Reuse the exported functions.** No re-implementation, no new helper module, no new `G` field, no new export.
- **`replay.execute.ts` is comment-only** (D-24322 stands). Do not assert sim ↔ `replayGame` equality in the new test.
- **Hash oracles byte-unchanged.** A moved sentinel `finalStateHash` or `PRE_WP080_HASH` is a bug to diagnose. Never re-pin.
- **Do not regenerate `data/par/**`.** The profiles are unaffected by this change and already stale on `main` for unrelated reasons; `data/par/**` must not appear in the `EC-781:` diff.
- **Derived artifacts via sanctioned commands only**; the dashboard re-pin carries a `Tests-changed:` trailer.
- **Runtime assertions only** (D-24372): no `any`, `@ts-ignore`, `@ts-expect-error`.

## Required `// why:` Comments
- Each resolve call site: mirrors `game.ts` `turn.onMove` (WP-568 / D-24377, WP-656 / D-24467); why after pile depletion (live order); WP-744 / D-24567. In runFixture, also the D-24273 capture → replay lockstep with the sim.
- Each `applyOnBeginParity` addition: the whole-turn window ends at the turn boundary; mirrors `game.ts` `onBegin` for the rebuilt loops; the guarded delete keeps a never-set `G` byte-unchanged.
- Each resolve call site also notes that the move context's `events` is inert for the resolver (no hero effect calls `endTurn`/`setPhase`; `setActivePlayers` is `typeof`-guarded), matching live's events-less call.
- The `replay.execute.ts` header extension: why this harness still skips the deferred-grant lifecycle (D-24322).
- The dashboard re-pin: a dated comment in the file's house style naming WP-744 / D-24567 and the old → new value.

## Files to Produce
- `packages/game-engine/src/simulation/onBeginParity.ts` — **modified** — clear + guarded delete + module/function JSDoc
- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** — per-move resolve
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** — per-move resolve
- `packages/game-engine/src/test/fixtures/runFixture.ts` — **modified** — per-move resolve
- `packages/game-engine/src/replay/replay.execute.ts` — **modified** — header comment only
- `packages/game-engine/src/simulation/onBeginParity.test.ts` — **modified** — clear case (keys absent) + never-set no-op case
- `packages/game-engine/src/simulation/deferredGrantParity.test.ts` — **new** — WP §F round trip: 0-cost Mastermind (≥3 Tactics, Final Blow off) + one cost-0 Diamond-Form-text hero; two-phase spy policy (Phase 1 recruit/play/one fight while in play; Phase 2 never play, one fight/turn) reading `playerView.log`, no `decisionLog`; locked patterns `/gained \+3 recruit from/` and `/ability is waiting/` on `LogEntry.text`; asserts (a) grant after the fight not the play, (b) Phase-2 fight adds no grant, (c) the filtered `runFixture` `messages` subsequence equals the sim's; two loud preconditions (card played; a Phase-2 fight with no copy in play). No new export; no sim ↔ `replayGame` assertion
- `docs/ai/coverage/runtime-observed-hollows.json` — **modified** — `pnpm sim:runtime-observed`
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **modified** — paired `totalObs` re-pin

## After Completing
- [ ] `pnpm -r build` exits 0; engine suite green (baseline → new counts in the `EC-781:` body).
- [ ] The resolve grep in WP §Verification returns exactly 3 code matches, one per loop file.
- [ ] `pnpm sim:runtime-observed:check` and `pnpm sim:coverage --check` exit 0; `pnpm --filter @legendary-arena/dashboard prebuild:coverage` then the dashboard suite and `pnpm --filter @legendary-arena/dashboard typecheck` exit 0.
- [ ] Test counts: baseline (4121 at draft) + 2 `it` in `onBeginParity.test.ts` + the new file (one `describe`, one round-trip test carrying (a), (b), (c)); record exact numbers.
- [ ] The `EC-781:` body states the runtime-observed per-mechanic delta and its cause (fixed-seed games played out differently — hollow detection runs only when a deferred grant fires), with `hollowEffectsDropped` 0 and no non-terminated games.
- [ ] `git diff --name-only` ⊆ Files to Produce; no `data/par/**`, no `game.ts`.
- [ ] Governance (`SPEC:` close): if WP-743 is still Draft, amend its §Out of Scope sim-gap bullet per WP-744 §Context; DECISIONS D-24567 Active; STATUS states "No user-observable change — infrastructure only" (D-24026); WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`, `pnpm roadmap:counts:write`, `roadmap:counts:check` exits 0.

## Common Failure Smells (Optional)
- **Sentinel hash moves.** The resolve ran on a path the sentinel exercises with a stale edge flag, or the clear was placed before a move instead of at rotation. The sentinel has no wait-and-see hook; it must not move.
- **Round-trip grant lines differ.** runFixture's call is missing or placed after the rotation, so a grant fires in the sim but not in the fixture (or vice versa).
- **Grant fires at play, not after the fight.** The test card's condition was already true at play; the test proves nothing about deferred resolution.
- **Resolver throws / reads turn 0.** A context without `ctx.turn` was passed; pass the dispatched move's own context.
- **Test passes vacuously.** The seed never brings the card to hand, or the game ends before a Phase-2 fight; the two preconditions must fail loudly.
- **Game ends in the first positive turn.** The policy took more than one Tactic per turn; cap fights at one per turn.
- **A future deferred effect calls `events.endTurn`.** It would end the turn in the harnesses only (live passes no `events`); treat as a new parity question.
- **`runtime-observed` still stale after regen.** `dist` not rebuilt before `pnpm sim:runtime-observed` (it imports the engine `dist`).
