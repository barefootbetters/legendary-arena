# WP-531 — Re-anchor the Penalty Weights to the Rulebook 4:3:1 Ratio

**Layer:** Scoring reference + config data (docs + `data/scoring-configs`) — **no engine logic change**
**EC:** [EC-566](../execution-checklists/EC-566-penalty-weight-4-3-1-rulebook-anchor.checklist.md)
**Status:** Draft 2026-08-12
**Baseline:** drafted off `origin/main` @ `993d053c` (reserve-first: WP-531/EC-566/D-24342 claimed via a prior minimal ledger commit)
**Lane:** standard two-session (PAR / scoring is barred from the Lightweight Lane per 01.0a §Eligibility gate #6; SAFE-KNOBS §"Explicitly Non-Configurable" lists scoring formulas as a governed surface)

## Goal

Re-anchor the three **rulebook** penalty weights — `bystanderLost`,
`schemeTwistNegative`, `villainEscaped` — to the community/rulebook **4:3:1**
ratio, now that both missing producers are live (`bystanderLost` / WP-528,
`schemeTwistNegative` / WP-529). The Legendary Leagues Total Score subtracts
`4 × bystanders − 3 × twists − 1 × escapes`; expressed in this engine's
centesimal weights that is **`villainEscaped = 100` (1.00) : `schemeTwistNegative
= 300` (3.00) : `bystanderLost = 400` (4.00)**. This corrects both the frozen
reference surface (currently `200 / 400 / 500` = 2:4:5) and the test scenario
config (currently `100 / 50 / 300`) — neither of which matches the ratio, and
the test config in particular ranks a scheme twist (`50`) *below* a villain
escape (`100`), the opposite of the rulebook. This WP changes **weight data and
the reference doc only** — no engine logic, no producer, no `G` state.

## Assumes

- **WP-048 ✅** — the scoring formula (`computeRawScore`) and `ScoringWeights` /
  `PenaltyEventWeights` contract; weights are consumed as data, so changing their
  values needs no code change.
- **WP-528 ✅ + WP-529 ✅** — `bystanderLost` and `schemeTwistNegative` producers
  are now live, so the re-anchored weights actually bear on real scores (before
  them, two of the three re-anchored penalties counted `0` regardless of weight).
- **The 4:3:1 ratio is externally validated** — the community "Legendary Leagues"
  ranking / rulebook Total Score (`docs/12-SCORING-REFERENCE.md` already cites the
  moral hierarchy; the ewiki Scoring page's "External weight anchor" subsection
  records the 4:3:1 corroboration from the cross-system review).
- **Structural invariants hold under 400/300/100** (§Contract) — verified against
  `validateScoringConfig` and `12-SCORING-REFERENCE §Structural Invariants`.

## Context (Read First)

`12-SCORING-REFERENCE.md` is the **frozen scoring surface** (SAFE-KNOBS §220 —
scoring formulas are explicitly *not* a customer-safe knob; a change here
"requires an engine modification and a `DECISIONS.md` entry"). So even though the
diff is just numbers, this is a **governed** change: a `DECISIONS.md` entry
(D-24342) + a `scoringConfigVersion` bump on any config whose weights change.

**Why now:** the penalty producers only just went live (WP-528/529). Until then,
re-anchoring `bystanderLost` / `schemeTwistNegative` weights was moot — they
counted `0`. With both producing real counts, the weights now determine how much
a lost civilian and an advancing scheme actually cost, so aligning them to the
rulebook's established 4:3:1 hierarchy is the natural follow-up (and was
explicitly deferred as out-of-scope by WP-528/529).

**Scale decision (locked in D-24342):** the ratio is 4:3:1; the absolute scale
is `400 / 300 / 100` with `villainEscaped = 100` as the rulebook's "1" unit — the
minimal centesimal mapping. The alternative `800 / 600 / 200` (keeping the
reference's current `villainEscaped = 200`) is rejected as non-minimal; the
rulebook's lightest penalty maps to `1.00`, not `2.00`.

**What does NOT change:** `mastermindTacticUntaken` (+100) and
`scenarioSpecificPenalty` (scenario-defined) are Legendary-Arena-specific
penalties **not** part of the rulebook triple — they keep their current values.
The reward weights (`W_BP` bystanderReward, `W_VP`, `W_R`) are unchanged.

## Non-Negotiable Constraints

- **No engine logic change.** Weights are data; `computeRawScore` /
  `validateScoringConfig` / `deriveScoringInputs` are untouched. If any `.ts`
  under `packages/game-engine/src/scoring/` needs an edit beyond a test, STOP —
  that is out of scope.
- **Locked values:** `villainEscaped = 100`, `schemeTwistNegative = 300`,
  `bystanderLost = 400`. `mastermindTacticUntaken` and `scenarioSpecificPenalty`
  unchanged.
- **Update all FOUR weight-bearing reference surfaces consistently** (they will
  otherwise drift): the default-weights table, the "Default Values Satisfy All
  Invariants" worked block, the "Full Formula (Expanded)" line, **and the
  "Worked Example" section** (both players' Raw Score formulas + Final Scores +
  the "Why Player A Wins Decisively" narrative). A surface left at the old weight
  makes the frozen doc self-contradictory.
- **Bump `scoringConfigVersion`** on any `ScenarioScoringConfig` whose weights
  change (the test config: `1 → 2`). Per VISION §22, a weight change is a new
  version; historical entries keep their version.
- **Preserve the structural invariants** exactly (§Contract) — the moral
  hierarchy must not erode.
- **Full file contents** for every changed file; ESM/Node v22+ for any test.
  Human-style code (`docs/ai/REFERENCE/00.6-code-style.md`).
- **Session protocol:** one WP; scaffold-first (below); two-commit topology
  (`EC-566:` + `SPEC:`).

## Scope (In)

- `docs/12-SCORING-REFERENCE.md` — set the three rulebook penalty weights to
  `100 / 300 / 400` in **all four** weight-bearing places: (1) the
  default-weights table, (2) the "Default Values Satisfy All Invariants" block
  (rewrite the three worked comparisons), (3) the "Full Formula (Expanded)"
  line, and (4) the **"Worked Example" section** — recompute both players' Raw
  Score formulas and Final Scores with the new penalty weights (reward weights
  `W_BP 300` / `W_VP 50` are UNCHANGED, so only the penalty coefficients move).
  Verified targets (PAR stays `−1200`): **Player A** Raw `−1600 → −1900`
  [`(10×100)+(2×100)+(0×400)+(1×300)−(6×300)−(32×50)`], Final `−400 → −700`,
  result "4.00 → **7.00 under PAR**"; **Player B** Raw `−500 → −700`
  [`(10×100)+(1×100)+(1×400)+(0×300)−(1×300)−(38×50)`], Final `+700 → +500`,
  result "7.00 → **5.00 over PAR**"; the gap narrative `11.00 → 12.00`.
- `data/scoring-configs/test-scheme-par--test-mastermind-par--test-villain-group-par.json`
  — `penaltyEventWeights`: `villainEscaped 100` (unchanged), `schemeTwistNegative
  50 → 300`, `bystanderLost 300 → 400`; `scoringConfigVersion 1 → 2`.
- Tests that assert the old weights/scores — reconcile to the new values
  (scaffold-first surfaces them). Candidates: `scoring/parScoring.logic.test.ts`,
  `scoring/scoringConfigLoader.test.ts`, `simulation/par.aggregator.test.ts`.
- `wiki/scoring.md` — the "External weight anchor" subsection already names
  400/300/100 as a Phase-1 *seed*; update it to note the ratio is now the adopted
  reference **default** (D-24342), but **preserve the calibration-supremacy
  caveat** ("published weights remain whatever `validateScoringConfig` accepts
  under a pinned `scoringConfigVersion`" — simulation still supersedes seed).
  Re-run the wiki link gate.
- Land D-24342.

## Out of Scope

- **Any engine logic** (`computeRawScore`, `validateScoringConfig`, producers).
- **`mastermindTacticUntaken` / `scenarioSpecificPenalty` weights** — not in the
  rulebook triple.
- **The reward weights** (`bystanderReward`, `victoryPointReward`, `roundCost`).
- **Authoring production `ScenarioScoringConfig`s** — none exist; this establishes
  the anchor for when they are authored.
- **PAR baseline re-calibration** — PAR uses the same weights via
  `computeParScore`, but no calibrated production PAR artifact exists to re-derive.

## Files Expected to Change

- `docs/12-SCORING-REFERENCE.md` — **modified** — four weight surfaces (table,
  invariants block, Full Formula, **Worked Example** recompute).
- `data/scoring-configs/test-scheme-par--test-mastermind-par--test-villain-group-par.json`
  — **modified** — `penaltyEventWeights` + `scoringConfigVersion`.
- `packages/game-engine/src/scoring/parScoring.logic.test.ts` — **modified** (if
  scaffold shows breaks) — reconcile asserted scores.
- `packages/game-engine/src/scoring/scoringConfigLoader.test.ts` — **modified**
  (if scaffold shows breaks).
- `packages/game-engine/src/simulation/par.aggregator.test.ts` — **modified** (if
  scaffold shows breaks).
- `wiki/scoring.md` — **modified** (if it needs the applied/recommended tweak).
- `docs/ai/DECISIONS.md` — **modified** — D-24342 Drafted → Active.
- Governance close: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`
  (📝 → ✅ + counts), `docs/ai/STATUS.md`.

> **Scaffold-first (01.0a Step 3 / 01.4 Empirical Scaffold).** Changing weights
> changes every computed `rawScore` / `parScore` / `finalScore` in tests that use
> the test config or hand-built weights. The executor MUST edit the weights on a
> throwaway branch and run `pnpm --filter @legendary-arena/game-engine test`
> **and** `pnpm -r --no-bail test` (server consumers), record every failing
> assertion, and fold the reconciliations into scope BEFORE claiming READY.

## Contract

- Penalty weights become `villainEscaped = 100`, `schemeTwistNegative = 300`,
  `bystanderLost = 400` (centesimal). `mastermindTacticUntaken = 100` and
  `scenarioSpecificPenalty` (scenario-defined) unchanged.
- **All three structural invariants preserved** (`12-SCORING-REFERENCE §Invariants`,
  enforced by `validateScoringConfig`):
  - Inv 1 `W_BP > villainEscaped`: reference `300 > 100` ✓; test config `200 > 100` ✓.
  - Inv 2 `bystanderLost > villainEscaped`: `400 > 100` ✓.
  - Inv 3 `bystanderLost > W_BP`: reference `400 > 300` ✓; test config `400 > 200` ✓.
- `scoringConfigVersion` bumped on every config whose weights change (test config
  `1 → 2`); no engine type or signature changes; no `G` state touched (no
  `finalStateHash` impact — scoring is post-match derivation).
- **No persisted score is invalidated:** no production `ScenarioScoringConfig` or
  `legendary.competitive_scores` row exists under the old weights, so no historical
  re-score is owed; the version bump is the forward comparability boundary.

## Acceptance Criteria

1. `12-SCORING-REFERENCE.md` shows `villainEscaped 100 / schemeTwistNegative 300 /
   bystanderLost 400` in the default-weights table, the invariants worked block,
   the Full Formula, **and the Worked Example** (both players recomputed to the
   verified targets; Player A "7.00 under PAR", Player B "5.00 over PAR", 12.00
   gap) — consistently, no surface left at the old value (`grep` for `200`/`500`
   as a penalty coefficient returns none).
2. The test config's `penaltyEventWeights` are `{villainEscaped:100,
   schemeTwistNegative:300, bystanderLost:400, mastermindTacticUntaken:25,
   scenarioSpecificPenalty:40}` and `scoringConfigVersion` is `2`.
3. `validateScoringConfig` accepts the updated test config (all three invariants
   hold); a synthetic config violating an invariant is still rejected
   (non-vacuous).
4. Every test asserting a `rawScore`/`parScore`/`finalScore` or a weight value is
   reconciled to the new weights and passes.
5. `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0;
   `pnpm -r --no-bail test` exits 0.
6. No file under `packages/game-engine/src/scoring/**` changed except tests
   (`git diff --name-only` — no engine-logic edit).

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → 0.
3. `pnpm -r --no-bail test` → whole workspace 0-fail.
4. `pnpm -r build` → 0; `git status` shows no unexpected generated-artifact drift
   (confirm the lagn-spec schema / any scoring-config-derived artifact is
   unaffected, or regenerate + commit if it tracks the version).
5. `git diff --name-only` matches the allowlist; no non-test `scoring/*.ts`.
6. `pnpm wiki-viewer:check-links` → 0 (if `wiki/scoring.md` edited).

## Definition of Done

- [ ] `12-SCORING-REFERENCE.md` re-anchored on all three surfaces; test config
      weights + `scoringConfigVersion` updated.
- [ ] Invariants preserved; `validateScoringConfig` accepts the config; test
      reconciliations green; control (invariant-violating config) still rejected.
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` 0;
      `pnpm -r --no-bail test` 0; `pnpm -r build` 0; `wiki-viewer:check-links` 0.
- [ ] No engine-logic file changed (only tests + data + docs).
- [ ] D-24342 Active; `STATUS.md`, `WORK_INDEX.md` (`[x]`), `EC_INDEX.md` (Done),
      roadmap node ✅ + `roadmap:counts:check` 0.
- [ ] **No files outside `## Files Expected to Change` were modified.**

## Vision Alignment

Triggers §17.1 #1 (scoring / PAR). **Serves VISION §20–26** — aligns the penalty
weights to the established community/rulebook moral hierarchy the scoring model is
built to encode (`12-SCORING-REFERENCE §Why Bystander Losses Are Weighted
Highest`), so Final Score ranks heroic play over cold containment with the
externally-validated 4:3:1 relationship. Honors **§22** (immutability /
version-pinning): the weight change is a `scoringConfigVersion` increment, not a
retroactive edit; no persisted score exists to invalidate. **§24** (deterministic
scoring) is untouched — this is a data change, no logic, no `ctx.random`, no `G`
state, so `finalStateHash` is unaffected. **No conflict** with any clause.
**NG-1 (no pay-to-win):** untouched. **Determinism preserved:** data-only.

## User-Visible Impact

**User-Visible Surface = play.legendary-arena.com** (Final Score — a lost
civilian now costs 4× a villain escape and a scheme twist 3×, matching the
rulebook). **D-24026 live-verify operator-pending** — observable once a production
`ScenarioScoringConfig` is authored with these weights; the reference + test
config change is correct regardless. STATUS should record "authoring-standard +
test config re-anchored; player-observable once a production config ships."

## §20 (Funding / support affordances)

**N/A** — scoring-weight data + reference doc only; no navigation, registry,
profile, or funding affordance, and no user-visible donate/support copy.

## Lint Gate Self-Review (00.3)

Recorded after the 00.3 gate run: all sections PASS or explicit N/A (§21 N/A — no
HTTP endpoint or library-function surface; weights are data consumed by the
existing formula). Structure follows the WP-528/529 siblings.

## Gate Verdicts

Run as three independent subagents against the WP+EC.

- **Pre-flight (01.4):** NOT READY → **resolved to READY.** PS-1 (a number
  collision — a parallel `paibok` session reserved WP-531/EC-566/D-24342 too) was
  a **transient mid-collision state**: reserve-first-to-main held (my reserve
  #1352 merged first), the `paibok` session renumbered to WP-532/EC-567/D-24343,
  and `origin/main` `ledger:numbers:check` now passes with only this WP's
  reservation on those numbers. PS-2 (the Worked Example is a fourth weight
  surface) is folded — Scope/Files/AC-1 now cover it with verified recomputed
  values.
- **Copilot (01.7):** RISK → resolved in-place. Finding 1 (Worked Example
  surface) folded as above; Finding 2 (`villainEscaped` now at parity with
  `mastermindTacticUntaken`/`roundCost`) recorded as deliberate in D-24342;
  Finding 3 (`wiki/scoring.md` seed-vs-applied) — Scope now preserves the
  calibration-supremacy caveat while marking the ratio the adopted default.
- **Lint (00.3):** **ALL PASS / N/A** — all required sections present; §17 cites
  clause numbers, §20 justified, §21 N/A, DoD scope-boundary checkbox present.

## History

- Reserves **D-24342** (Drafted 2026-08-12). Reserved-first in
  [NUMBER-LEDGER](../NUMBER-LEDGER.md): WP-531 / EC-566 / D-24342.
- Completes the penalty arc's weight side after the producer side (WP-528/529).
- Hard-deps: **WP-048 ✅** + **WP-528 ✅** + **WP-529 ✅**.
