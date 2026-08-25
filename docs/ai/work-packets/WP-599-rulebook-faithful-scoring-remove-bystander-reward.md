# WP-599 — Rulebook-Faithful Scoring: Remove the Invented Bystander Reward

**Status:** Draft 2026-08-24 — executing this session.
**User-Visible Surface:** `play.legendary-arena.com` (endgame report card / grade) + `legends.legendary-arena.com` (leaderboard). The competitive score stops double-counting rescued bystanders and matches the printed rulebook. D-24026 live-verification applies.
**Primary Layer:** Game Engine (scoring formula + weights + grade bands) + the seed PAR generator/artifacts, with a minimal Arena Client display follow-through.
**Dependencies:** WP-585 (rulebook-faithful RawScore, roundCost removal), WP-586 (`isBystanderCard`), WP-587/588 (endgame PAR-derivation + per-player display), WP-591 (scheme-aware PAR + grade bands + LOSS_PENALTY). All landed. **Supersedes D-24408** (the "keep 200, watch" dominance policy). Baseline `origin/main` at draft: `08d48cbe`.

## Goal

The endgame report card revealed a **double-count**: a rescued bystander scored −200 (the dedicated `bystanderReward`) **and** its own printed 1 VP (−10, inside the summed `victoryPoints`) = −210. Investigating it surfaced the deeper, operator-named issue: **the −200 reward has no basis in the rules.** The Marvel Legendary v23 rulebook scores a win as *Victory Points minus penalties* (−4/bystander carried away, −3/twist, −1/escape); the community "Legendary Leagues" Total Score `VP − 4·lost − 3·twists − 1·escapes` is the same shape. A rescued bystander contributes **only its 1 VP** — there is **no** positive rescue reward. LA's `bystanderReward` (and the VISION §21 invariants 1 & 3 that required it) was an invented layer.

Operator decision (2026-08-24, with D-24408 in view): **full rulebook fidelity** — remove the invented reward and rescale penalties to true VP-units, superseding D-24408's "don't reweight" posture.

## User-Visible Impact

A rescued bystander is worth exactly its 1 VP (−10), counted once. The report card no longer credits bystanders on two lines. Raw scores compress ~10× (VP-dominated), so PAR, the loss penalty, and the grade bands are re-derived — grades stay meaningful (a 34-bystander Midtown win grades A, a competent win B, a bystander-heavy loss D, a low-VP loss F). Existing leaderboard entries are **not** retroactively changed (they keep their pinned `scoringConfigVersion 4` + stored breakdown); new submissions score under `scoringConfigVersion 5` / `rawScoreSemanticsVersion 4`. The game-**winner** VP (rulebook table result) still counts bystanders at 1 VP each — only the competitive score changed.

## Contract (Locked by D-24409)

1. **Remove `bystanderReward`** from `ScoringWeights` and `weightedBystanderReward` from `ScoreBreakdown`. A rescued bystander scores only as its 1 VP (already inside `victoryPoints`). VP is the sole reward term.
2. **Rescale penalties to true VP-units** (1 VP = 10): `villainEscaped 100→10`, `schemeTwistNegative 300→30`, `bystanderLost 400→40` (the rulebook 4:3:1, now same scale as VP); the inert LA-only penalties `mastermindTacticUntaken 25→10` and `scenarioSpecificPenalty 40→10`. New formula: `RawScore = P − (VP × 10) + lossPenalty`, mirroring `VP − 4·lost − 3·twists − 1·escapes`.
3. **Invariants.** Remove structural invariants 1 (`bystanderReward > villainEscaped`) and 3 (`bystanderLost > bystanderReward`); keep 2 (`bystanderLost > villainEscaped`, 40 > 10) as the sole surviving moral-hierarchy invariant. Heroism now lives entirely on the heavy loss penalty, as the rulebook encodes it.
4. **Recalibration.** `LOSS_PENALTY 6000→800`; `SCORE_GRADE_BANDS` re-derived (Legendary ≤ −500, A ≤ −250, B ≤ 150, C ≤ 500, D ≤ 1100, F), validated against the same 13 real anchor games as D-24400. Interim / operator-tunable.
5. **Versions.** `scoringConfigVersion 4→5`, `rawScoreSemanticsVersion 3→4`; 128 `data/scoring-configs` + 128 `data/par/seed/v1` artifacts + index regenerated (`pnpm par:seed:generate`); existing `competitive_scores` rows keep pinned versions (no retroactive invalidation).

### Determinism / persistence
Scoring is server-side, end-of-match, adds no `G` field → `finalStateHash` / `PRE_WP080_HASH` byte-identical (no re-pin). No server route change (`buildScoreBreakdown` shape change is jsonb pass-through). `computeParScore === parValue` holds after regen (both use the new formula). PAR artifact hashes recompute (expected).

## Scope (In)

**Game Engine:** `scoring/parScoring.types.ts` (drop `ScoringWeights.bystanderReward`, `ScoreBreakdown.weightedBystanderReward`); `scoring/parScoring.logic.ts` (`computeRawScore` / `computeParScore` / `buildScoreBreakdown` drop the reward term; `validateScoringConfig` drop invariants 1 & 3 + the reward check, keep 2; `LOSS_PENALTY 800`); `scoring/parScoring.grade.ts` (re-derived `SCORE_GRADE_BANDS`).

**Generator + artifacts:** `scripts/generate-seed-par.mjs` (`DEFAULT_WEIGHTS` drop bystanderReward; `DEFAULT_PENALTY_EVENT_WEIGHTS` 10/40/30/10/10; `SCORING_CONFIG_VERSION 5`, `RAW_SCORE_SEMANTICS_VERSION 4`); `scripts/extract-par-anchors.mjs` (weights synced to the new model); regenerate `data/par/seed/v1/**` + `data/scoring-configs/**` (128 each).

**Arena Client (minimal correctness — polish deferred):** `lib/api/competitionApi.ts` (`weightedBystanderReward` → optional, legacy rows); `vfx/scoreCalcDisplay.ts` (drop the bystander term from the worked formula, ledger, and PAR derivation — VP already covers bystanders).

**Docs + tests:** `docs/12-SCORING-REFERENCE.md`, `wiki/scoring.md`, `docs/ai/DECISIONS.md` (D-24409, supersede D-24408); engine + arena-client tests updated.

## Scope (Out)
- **Report-card display polish** — rescued/lost terminology, a penalties/awards scoring legend, RAW SCORE / BY PLAYER restyling (the operator's original three asks) — is a **separate follow-up PR** on top of the corrected model.
- **`data/par/profile/v1` diagnostic profiles** (WP-597) carry stale rawScore bins; not server-read, no CI gate — regeneration (a simulation sweep) is a deferred follow-up.
- **VISION §20-26** — if the removal contradicts a literal VISION statement about a rescue reward, that authority-tier edit is surfaced to the operator, not made here.
