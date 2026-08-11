# EC-563 — Wire the `bystanderLost` Penalty Producer (Execution Checklist)

**Source:** docs/ai/work-packets/WP-528-bystander-lost-penalty-producer.md
**Layer:** Game Engine

## Before Starting
- [ ] Baseline: branch off `origin/main`; confirm hard-deps **WP-048 ✅** + **D-24314 ✅** (bystander carry-away into `G.escapedPile`) are on `main`.
- [ ] Read the `bystandersRescued` loops (`parScoring.logic.ts:74-81`, `par.aggregator.ts:695-702`) — the derivation to mirror, victory-zone → escaped-pile.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (record the baseline test count)
- [ ] **Scaffold-first (mandatory):** prototype BOTH derivations, run the engine suite, record which (if any) existing tests shift. Fold every break into scope BEFORE implementing. A "purely additive" claim by reasoning is INVALID for this WP.

## Locked Values (do not re-derive)
- Discriminator: `gameState.villainDeckCardTypes[extId] === 'bystander'` (verbatim, same as the rescued-count loops).
- Source zone: `gameState.escapedPile`. `carryEscapedBystandersToPile` (D-24314) feeds it from BOTH escape sites — `villainDeck.reveal.ts:274` and `rules/schemeTwistResolvers.ts:650`; the pile also holds the escaped villain card (typed `'villain'`) and one hero-deck-top case — count `'bystander'`-typed entries wherever they originate.
- Two derivation sites, identical logic: `deriveScoringInputs` (`parScoring.logic.ts:88-91`) and `deriveScoringInputsFromFinalState` (`par.aggregator.ts:711`).
- Absent/empty escaped pile → count `0` (no throw).
- `PenaltyEventType` union + `PENALTY_EVENT_TYPES` array: **unchanged** (no contract edit).
- No new `G` / `LegendaryGameState` field, no counter, no event log — **derivation only**.

## Guardrails
- Both derivations stay **pure, end-of-match, read-only** — never mutate `G` (D-4802/D-4804); no `ctx.random`; no `boardgame.io` import in `parScoring.logic.ts`.
- **Keep the two copies symmetric** — the same escaped-pile count in `parScoring.logic.ts` AND `par.aggregator.ts`, else calibrated PAR is systematically easier than the live score it normalizes.
- Do **not** double-count: villains in `escapedPile` are the `villainEscaped`/`ESCAPED_VILLAINS` count — count only `bystander`-typed entries here.
- Do **not** add a `G` field — deriving from existing `escapedPile` keeps `finalStateHash`/`PRE_WP080_HASH` byte-identical. A counter forces a dual re-pin (STOP if tempted).
- Do **not** touch `computeParScore` / `ParBaseline` (PAR baseline keeps `bystanderLost: 0`).
- Do **not** touch the other three safe-skips (`schemeTwistNegative`, `mastermindTacticUntaken`, `scenarioSpecificPenalty`) in either function.
- Control-revert MUST be non-vacuous (reverting either function to `0` fails a test).

## Required `// why:` Comments
- At each `bystanderLost` derivation site (both functions): explain it counts `bystander`-typed `escapedPile` entries (carried-away civilians, D-24314; both escape paths), mirrors `bystandersRescued`, and derives from existing state so no new `G` field / no hash re-pin (D-24339).
- Correct the `deriveScoringInputsFromFinalState` function JSDoc (`par.aggregator.ts` ~673-675): "all five penalty-event types follow the WP-048 safe-skip" is now false — only three remain (`schemeTwistNegative`, `mastermindTacticUntaken`, `scenarioSpecificPenalty`); `villainEscaped` and `bystanderLost` are produced.

## Files to Produce
- `packages/game-engine/src/scoring/parScoring.logic.ts` — **modified** — `deriveScoringInputs` derivation + `// why:`.
- `packages/game-engine/src/scoring/parScoring.logic.test.ts` — **modified** — AC-1..AC-5 tests.
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** — `deriveScoringInputsFromFinalState` same derivation + `// why:`.
- `packages/game-engine/src/simulation/par.aggregator.test.ts` — **modified** — AC-6 symmetry test (incl. scheme-twist-carried bystander).
- `wiki/scoring.md` — **modified** — flip `bystanderLost` producer status to live.
- `docs/ai/DECISIONS.md` — **modified** — D-24339 Drafted → Active.
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — governance close.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (count rose)
- [ ] `pnpm -r --no-bail test` exits 0 (whole workspace); `pnpm wiki-viewer:check-links` exits 0
- [ ] `pnpm -r build` exits 0; `git status` shows no unexpected generated-artifact drift
- [ ] Sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical (STOP + investigate on any shift)
- [ ] Control-revert non-vacuous in both suites (documented in the summary)
- [ ] `git diff --name-only` matches the Files-to-Produce allowlist (no scope creep)
- [ ] `docs/ai/STATUS.md` updated; `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done; roadmap node ✅ then `pnpm roadmap:counts:write`, `pnpm roadmap:counts:check` exits 0
- [ ] Live-on-surface verification (D-24026) — operator-pending; STATUS notes the effect is player-observable once a production `ScenarioScoringConfig` exists

## Common Failure Smells
- `bystanderLost` still `0` in a match that lost civilians → the loop read the wrong zone (players' `victory` instead of `escapedPile`) or the wrong type.
- Live score counts it but calibrated PAR does not → the `par.aggregator.ts` copy was missed (asymmetry bug).
- A shifted `finalStateHash` → someone added a `G` field/counter instead of deriving; revert to the pure derivation.
- Whole-workspace red while engine-only green → a downstream fixture asserted a pre-wiring `rawScore`; fold it into scope (scaffold should have caught it).
