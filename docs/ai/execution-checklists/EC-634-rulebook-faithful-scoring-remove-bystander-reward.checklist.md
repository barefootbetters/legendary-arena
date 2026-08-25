# EC-634 — Rulebook-Faithful Scoring: Remove the Invented Bystander Reward (Execution Checklist)

**Source:** docs/ai/work-packets/WP-599-rulebook-faithful-scoring-remove-bystander-reward.md
**Layer:** Game Engine (scoring types + logic + grade) + generator + regenerated PAR artifacts + minimal Arena Client display + docs/tests.

## Before Starting
- [x] Baseline: engine `build && test` exit 0; replay/sentinel green (hashes must stay byte-identical)
- [x] D-24408 read and consciously superseded (operator decision, full rulebook fidelity)
- [x] The 13-game anchor model re-validated under the new weights (win A/B, weak win C, loss D/F)

## Locked Values (do not re-derive)
- Remove `ScoringWeights.bystanderReward` and `ScoreBreakdown.weightedBystanderReward`. VP is the sole reward; a rescued bystander scores only its 1 VP (inside `victoryPoints`).
- Penalty weights (true VP-units): `villainEscaped 10`, `bystanderLost 40`, `schemeTwistNegative 30`, `mastermindTacticUntaken 10`, `scenarioSpecificPenalty 10`. `victoryPointReward 10`.
- `RawScore = P − (VP × 10) + lossPenalty`. Invariants: remove 1 & 3, keep 2 (`bystanderLost > villainEscaped`).
- `LOSS_PENALTY = 800`. `SCORE_GRADE_BANDS`: Legendary ≤ −500, A ≤ −250, B ≤ 150, C ≤ 500, D ≤ 1100, F.
- Versions: `scoringConfigVersion 4→5`, `rawScoreSemanticsVersion 3→4` (generator consts).

## Guardrails (execution order matters)
1. Engine types (`parScoring.types.ts`): drop `bystanderReward` from `ScoringWeights`; drop `weightedBystanderReward` from `ScoreBreakdown`; update the rawScore jsdoc. `ParBaseline` (incl. `bystandersPar`) and `ScoringInputs.bystandersRescued` are KEPT (informational — the luck read + PAR-derivation display still use them).
2. Engine logic (`parScoring.logic.ts`): `computeRawScore` (drop the reward term + `effectiveBystanders`); `computeParScore` (drop reward — `bystandersRescued` stays as an inert input); `buildScoreBreakdown` (drop the reward compute + the returned field); `validateScoringConfig` (drop the `bystanderReward > 0` check + invariants 1 & 3, keep 2); `LOSS_PENALTY = 800`.
3. Engine grade bands (`parScoring.grade.ts`): re-derive `SCORE_GRADE_BANDS`.
4. `generate-seed-par.mjs`: `DEFAULT_WEIGHTS = { victoryPointReward: 10 }`; `DEFAULT_PENALTY_EVENT_WEIGHTS = {10,40,30,10,10}`; `SCORING_CONFIG_VERSION 5`, `RAW_SCORE_SEMANTICS_VERSION 4`. `extract-par-anchors.mjs`: weights synced (no bystanderReward; penalties 10/40/30; raw = penalties − vp×10).
5. **Rebuild engine BEFORE regenerating** (generator imports the built dist).
6. **WRITE-ONCE regenerate:** `rm -rf data/par/seed/v1 data/scoring-configs && pnpm par:seed:generate`.
7. Client: `competitionApi.ts` (`weightedBystanderReward` → optional); `scoreCalcDisplay.ts` (`buildWorkedScoreCalc` + `buildParDerivation` + `buildRawLedger` drop the bystander term — VP covers bystanders).
8. Tests: engine (hand-calc → 400; bystander-monotonicity → bystander-INVARIANCE; invariant-1/3 tests → invariant-2 test; grade boundaries; `par.aggregator` seedParDelta pin 1200→200); arena-client (fixtures to new scale: penalties ×30, no bystander term, LOSS_PENALTY 800, bands −500/−250; grade-range test). **Rebuild the engine after the grade-band retune before re-running client tests** (client imports the dist).
9. Docs: `docs/12-SCORING-REFERENCE.md`, `wiki/scoring.md`, `docs/ai/DECISIONS.md` (D-24409 supersedes D-24408).

- **Determinism:** scoring is server-side; NO `G`/move/fixture change → both hash oracles byte-identical. If a hash oracle moves, STOP.
- **Server equality trap:** `computeParScore(config) === parValue` must hold post-regen (else live submissions fail-close). Regeneration is MANDATORY. Spot-check: parValue = P(par counts) − VPpar×10.
- **No server edit:** `buildScoreBreakdown` shape change is jsonb pass-through; do NOT touch `competition.logic.ts` / migrations. Legacy rows keep pinned versions.
- **CRLF trap:** revert any `lagn-v1.json` line-ending-only churn after `pnpm -r build` (judge by `git diff --numstat`, not `git status`).

## Required `// why:` Comments
- On the removed reward term, the invariant removal, and the version bumps: cite WP-599 / D-24409 (supersedes D-24408) — non-rulebook invention removed, formula-shape change, no retroactive invalidation.
- On `LOSS_PENALTY` and the grade bands: interim/tunable, validated against the 13 anchors.

## After Completing
- [x] engine `build && test` green (2897/0); replay/sentinel green
- [x] `grep -c '"scoringConfigVersion":5' data/scoring-configs/*.json` = 128; parValue spot-check passes
- [x] `pnpm -r build` green; arena-client `vue-tsc` clean + tests green (1430/0); server scoring logic tests green (63/0); `lagn-v1.json` CRLF churn reverted
- [ ] Live-on-surface (D-24026): a ranked match's report card shows VP-only earned side, no bystander double-count, sensible grade
- [ ] STATUS names WP-599 (+ hash-oracle outcome, D-24026 pending); DECISIONS D-24409 Active (D-24408 superseded); WORK_INDEX `[x]`; EC_INDEX Done; mindmap node; `pnpm roadmap:counts:write`
