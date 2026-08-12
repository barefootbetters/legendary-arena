# EC-564 — Wire the `schemeTwistNegative` Penalty Producer (Execution Checklist)

**Source:** docs/ai/work-packets/WP-529-scheme-twist-negative-penalty-producer.md
**Layer:** Game Engine

## Before Starting
- [ ] Baseline: branch off `origin/main`; confirm hard-deps **WP-048 ✅** + **D-24178 ✅** are on `main`.
- [ ] Read the `escapes` counter read (`parScoring.logic.ts` `const escapes = gameState.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0`) — the exact pattern to mirror; and `schemeHandlers.ts` `buildGenericTwistEffects` (increments `G.counters.schemeTwistCount`).
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (record the baseline test count)
- [ ] **Scaffold-first (mandatory):** prototype BOTH derivations, then run `pnpm --filter @legendary-arena/game-engine test` AND `pnpm -r --no-bail test` (`deriveScoringInputs` has cross-package consumers in `apps/server` — engine-only green can hide a downstream break). Record which (if any) existing tests shift; fold every break into scope BEFORE implementing. A "purely additive" claim by reasoning is INVALID for this WP.

## Locked Values (do not re-derive)
- Derivation (both functions, identical): `schemeTwistNegative = gameState.counters.schemeTwistCount ?? 0`. The `?? 0` mirrors the lazy-counter pattern (absent counter = 0).
- Counter key: `schemeTwistCount` (plain `G.counters` key, incremented by `schemeHandlers.ts buildGenericTwistEffects` for EVERY revealed scheme twist).
- Two derivation sites: `deriveScoringInputs` (`parScoring.logic.ts`) and `deriveScoringInputsFromFinalState` (`par.aggregator.ts`).
- **Count ALL twists** (D-24340) — do NOT filter by any polarity/outcome classification. Every Legendary scheme twist is player-negative (the rulebook `-3 x twists`).
- `PenaltyEventType` union + `PENALTY_EVENT_TYPES` array: **unchanged** (no contract edit).
- No new `G` / `LegendaryGameState` field, no counter — **derivation only**.

## Guardrails
- Both derivations stay **pure, end-of-match, read-only** — never mutate `G` (D-4802/D-4804); no `ctx.random`; no `boardgame.io` import in `parScoring.logic.ts`.
- **Keep the two copies symmetric** — the same counter read in `parScoring.logic.ts` AND `par.aggregator.ts`, else calibrated PAR is systematically easier than the live score.
- Do **not** add a `G` field — the counter already exists; deriving from it keeps `finalStateHash`/`PRE_WP080_HASH` byte-identical. (STOP if tempted to add one.)
- Do **not** touch `computeParScore` / `ParBaseline` (baseline keeps `schemeTwistNegative: 0`).
- Do **not** touch the other safe-skips (`bystanderLost` [WP-528], `mastermindTacticUntaken`, `scenarioSpecificPenalty`) in either function.
- Control-revert MUST be non-vacuous (reverting either function to `0` fails a test).

## Required `// why:` Comments
- At each `schemeTwistNegative` derivation site (both functions): explain it counts every scheme twist via the durable `G.counters.schemeTwistCount` (D-24340 — all twists are player-negative, the rulebook `-3 x twists`; no polarity classification), mirrors the `escapes` counter read, and derives from existing state so no new `G` field / no hash re-pin.
- Correct the `deriveScoringInputsFromFinalState` function JSDoc (`par.aggregator.ts`): once `bystanderLost` (WP-528) and `schemeTwistNegative` (this WP) are produced, only `mastermindTacticUntaken` + `scenarioSpecificPenalty` remain safe-skipped — do not leave a stale "all remaining types safe-skip" claim.

## Files to Produce
- `packages/game-engine/src/scoring/parScoring.logic.ts` — **modified** — `deriveScoringInputs` counter read + `// why:`.
- `packages/game-engine/src/scoring/parScoring.logic.test.ts` — **modified** — AC-1..AC-4 tests.
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** — `deriveScoringInputsFromFinalState` same counter read + `// why:` + JSDoc fix.
- `packages/game-engine/src/simulation/par.aggregator.test.ts` — **modified** — AC-5 symmetry test.
- `wiki/scoring.md` — **modified** — mark the producer live: (a) flip the `schemeTwistNegative` table row + status-list line; (b) rewrite the "scheme-twist outcomes **that qualify**" polarity prose → "counts **every** scheme twist (D-24340, no polarity/qualification)"; (c) reconcile the stale "only `villainEscaped` has a producer" / "the other four … 0" prose; (d) the "Penalty producer status — **four of five** safe-skip" heading + slug are referenced by THREE internal links — rename the heading count-neutral ("Penalty producer status") and update all three links to the new slug ATOMICALLY, then confirm `wiki-viewer:check-links` = 0 broken anchors. **WP-528 coordination:** WP-528 touches the same heading/table + the same `par.aggregator.ts` JSDoc — phrase the heading count and the JSDoc against THIS branch's actual producer set (do not assume `bystanderLost` is live unless WP-528 merged into the base), and re-check the shared row/anchor for a merge conflict before the SPEC commit.
- `docs/ai/DECISIONS.md` — **modified** — D-24340 Drafted → Active.
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
- `schemeTwistNegative` still `0` in a match with twists → read the wrong counter key or forgot the `?? 0` path.
- Live score counts it but calibrated PAR does not → the `par.aggregator.ts` copy was missed (asymmetry bug).
- A shifted `finalStateHash` → someone added a `G` field instead of reading the existing counter; revert to the counter read.
- Whole-workspace red while engine-only green → a downstream fixture asserted a pre-wiring `rawScore` on a twist-carrying terminal state; fold it into scope (scaffold should have caught it).
