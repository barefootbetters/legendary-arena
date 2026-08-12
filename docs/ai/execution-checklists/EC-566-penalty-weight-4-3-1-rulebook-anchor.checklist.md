# EC-566 — Re-anchor the Penalty Weights to the Rulebook 4:3:1 Ratio (Execution Checklist)

**Source:** docs/ai/work-packets/WP-531-penalty-weight-4-3-1-rulebook-anchor.md
**Layer:** Scoring reference + config data (docs + `data/scoring-configs`) — no engine logic

## Before Starting
- [ ] Baseline: branch off `origin/main`; confirm hard-deps **WP-048 ✅ + WP-528 ✅ + WP-529 ✅** (both producers live).
- [ ] Read `12-SCORING-REFERENCE.md` §"Penalty Events" table + §"Structural Invariants" + §"Full Formula", and `validateScoringConfig` (`parScoring.logic.ts`) for the three invariant checks.
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 (record baseline count).
- [ ] **Scaffold-first (mandatory):** edit the weights, then run `pnpm --filter @legendary-arena/game-engine test` AND `pnpm -r --no-bail test` (server consumers). Record every failing score/weight assertion; fold reconciliations into scope BEFORE implementing. A "no tests change" claim by reasoning is INVALID.

## Locked Values (do not re-derive)
- Penalty weights (centesimal): `villainEscaped = 100` (unchanged), `schemeTwistNegative = 300`, `bystanderLost = 400` — the rulebook 4:3:1 with escape = the 1.00 unit.
- `mastermindTacticUntaken = 100` (reference) / `25` (test config) and `scenarioSpecificPenalty` — **unchanged** (not in the rulebook triple).
- Test config `scoringConfigVersion`: `1 → 2`.
- FOUR reference surfaces to update together: default-weights table; "Default Values Satisfy All Invariants" worked block; "Full Formula (Expanded)" line; **"Worked Example" section** (recompute both players — reward weights W_BP 300 / W_VP 50 UNCHANGED; PAR stays −1200). Verified targets: Player A Raw −1600→**−1900**, Final −400→**−700** ("7.00 under PAR"); Player B Raw −500→**−700**, Final +700→**+500** ("5.00 over PAR"); gap 11.00→**12.00**.

## Guardrails
- **No engine logic change** — only tests, data (`data/scoring-configs/*.json`), and docs. Any non-test edit under `packages/game-engine/src/scoring/**` → STOP (out of scope).
- Update ALL FOUR reference surfaces (table + invariants block + Full Formula + Worked Example) + the test config consistently — a half-update leaves the frozen surface self-contradictory (table says 100 but a Worked Example still computes ×200).
- **Preserve all three structural invariants** (`W_BP > villainEscaped`; `bystanderLost > villainEscaped`; `bystanderLost > W_BP`) — verify with the new numbers in both the reference (W_BP 300) and the test config (bystanderReward 200).
- Bump `scoringConfigVersion` on the test config (weight change = new version, VISION §22).
- No `G` state touched → `finalStateHash` unaffected (scoring is post-match derivation); do NOT re-record any state-hash fixture for this WP.
- Control (invariant guard) stays non-vacuous: a synthetic weight set violating an invariant must still be rejected by `validateScoringConfig`.

## Required `// why:` Comments
- None in engine code (no logic change). In the reference doc, note beside the table that the three weights are anchored to the rulebook 4:3:1 ratio (D-24342). If a test's expected score is updated, a one-line `// why:` naming D-24342 + the new weight keeps the magic number auditable.

## Files to Produce
- `docs/12-SCORING-REFERENCE.md` — **modified** — FOUR weight surfaces to 100/300/400 (table + invariants block + Full Formula + Worked Example recompute per Locked Values).
- `data/scoring-configs/test-scheme-par--test-mastermind-par--test-villain-group-par.json` — **modified** — `penaltyEventWeights` (schemeTwistNegative 50→300, bystanderLost 300→400) + `scoringConfigVersion` 1→2.
- `packages/game-engine/src/scoring/parScoring.logic.test.ts` / `scoring/scoringConfigLoader.test.ts` / `simulation/par.aggregator.test.ts` — **modified** IF scaffold shows breaks (reconcile asserted scores).
- `wiki/scoring.md` — **modified** if the anchor is stated as recommended (→ applied).
- `docs/ai/DECISIONS.md` — **modified** — D-24342 Drafted → Active.
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — governance close.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0
- [ ] `pnpm -r --no-bail test` exits 0; `pnpm wiki-viewer:check-links` exits 0 (if wiki edited)
- [ ] `pnpm -r build` exits 0; `git status` shows no unexpected generated-artifact drift
- [ ] `git diff --name-only` = the allowlist; NO non-test `scoring/*.ts`
- [ ] Invariants verified with the new numbers; `validateScoringConfig` accepts the test config; control still rejects a violating config
- [ ] `docs/ai/STATUS.md` updated; `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done; roadmap node ✅ then `pnpm roadmap:counts:write`, `pnpm roadmap:counts:check` exits 0
- [ ] Live-on-surface verification (D-24026) — operator-pending; STATUS notes player-observable once a production `ScenarioScoringConfig` ships

## Common Failure Smells
- A reference surface left at the old weight → the doc contradicts itself (table says 100 but the Full Formula still says x200).
- A test still asserting an old `rawScore` → the scaffold step was skipped or a consumer suite (server) not run.
- Tempted to also "fix" `mastermindTacticUntaken` or the reward weights → out of scope; only the rulebook triple.
- A re-recorded state-hash fixture → wrong; weights don't touch `G`, so no hash should move.
