# EC-626 — Interim Scheme-Aware PAR Recalibration (Execution Checklist)

**Source:** docs/ai/work-packets/WP-591-par-interim-scheme-aware-recalibration.md
**Layer:** Game Engine (scoring + generator + par.storage) + regenerated PAR artifacts + Arena Client display + docs/tests.

## Before Starting
- [ ] Baseline: `pnpm --filter @legendary-arena/game-engine build && test` exit 0; replay/sentinel green (hashes must stay byte-identical)
- [ ] The 13-game anchor model is validated (solid win B, exceptional A/Legendary, weak win C, loss D/F)

## Locked Values (do not re-derive)
- `ParBaseline` += `schemeTwistsPar`, `bystandersLostPar`. `computeParScore` subtracts twist + bystander-lost penalties (physical baselines, option A).
- `LOSS_PENALTY = 6000`; `computeRawScore` adds it when `inputs.matchLost === true`. `matchLost = evaluateEndgame(...).outcome === 'scheme-wins'`.
- `SCORE_GRADE_BANDS`: Legendary ≤ −2000, A ≤ −700, B ≤ 700, C ≤ 2000, D ≤ 4000, F.
- Versions: `scoringConfigVersion 3→4`, `rawScoreSemanticsVersion 2→3` (generator + `par.storage` const).
- Scheme profiles = observed competent-win medians (1p/2p) per scheme; 3p/4p/5p extrapolated; mild difficulty modulation centered at D=5. Bystanders/twists scheme-driven; VP/escapes player+difficulty.

## Guardrails (execution order matters)
1. Engine types: `ParBaseline` (+2 fields), `ScoringInputs.matchLost?`, `ScoreBreakdown.weightedLossPenalty`.
2. Engine logic: `LOSS_PENALTY`; `computeRawScore` loss term; `computeParScore` twist+lost terms + `matchLost:false`; `deriveScoringInputs` sets `matchLost` (import `evaluateEndgame`); `buildScoreBreakdown` (loss term + copy the 2 baseline fields + `weightedLossPenalty` + carry `matchLost`); `validateScoringConfig` (+2 non-negative checks).
3. Engine grade bands: retune `SCORE_GRADE_BANDS`.
4. `par.aggregator.ts`: `deriveScoringInputsFromFinalState` sets `matchLost` (symmetric with the live path).
5. `par.storage.ts`: `CURRENT_RAW_SCORE_SEMANTICS_VERSION 2→3`; add the 2 baseline fields to `baselineFields`, the config-vs-artifact equality, and `isSeedArtifactShape`.
6. `generate-seed-par.mjs`: `baselineForScenario(schemeSlug, difficulty, playerCount)` (derive slug via `stripSetAbbreviation(scenario.schemeExtId)` — the scenario has `schemeExtId`, NOT `schemeSlug`); bump both versions; update the `export {...}` list.
7. Rebuild engine BEFORE regenerating (generator imports the built dist).
8. **WRITE-ONCE regenerate:** `rm -rf data/par/seed/v1 data/scoring-configs && pnpm par:seed:generate && pnpm par:seed:test`.
9. Client: `competitionApi.ts` (optional mirrors); `scoreCalcDisplay.ts` (`buildParDerivation` twist term + `baseline.twists`; raw calc loss-penalty term); `EndgameSummary.vue` (Expected-twists given).
10. Tests: engine (twist-aware PAR, loss penalty, grade boundaries; fix ParBaseline fixtures in parScoring.logic/par.aggregator/par.storage tests — add the 2 fields); arena-client (twist term, loss penalty, retuned grade values; fix range/grade fixtures). `scripts/extract-par-anchors.mjs` committed.
11. Docs: `docs/12-SCORING-REFERENCE.md`.

- **Determinism:** scoring is server-side; NO `G`/move/fixture change → both hash oracles byte-identical. If a hash oracle moves, STOP.
- **Server equality trap:** `computeParScore(config) === parValue` must hold post-regen (else live submissions fail-close). Regeneration is MANDATORY.
- **No server edit:** `deriveScoringInputs` sets `matchLost` internally; do NOT touch `competition.logic.ts` / migrations.

## Required `// why:` Comments
- On the loss penalty, the twist-aware `computeParScore`, and each `ParBaseline` field: cite D-24400.
- On the scheme profiles: observed anchors + structural estimates; interim ahead of sim calibration.
- On the version bumps: formula-shape change; no retroactive invalidation.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green (+ new tests); replay/sentinel green
- [ ] `pnpm par:seed:test`; `grep -c '"scoringConfigVersion":4' data/scoring-configs/*` = 128
- [ ] `pnpm -r build`; `(cd apps/arena-client && pnpm vue-tsc --noEmit && pnpm test)` green; `pnpm -r --no-bail test` no new failures; `lagn-v1.json` CRLF churn reverted
- [ ] Live-on-surface (D-24026): flood + light scheme grades are sensible
- [ ] STATUS names WP-591 (+ hash-oracle outcome, D-24026 pending); DECISIONS D-24400 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`

## Common Failure Smells (Optional)
- All scenarios get the DEFAULT profile → `scenario.schemeSlug` is undefined; use `stripSetAbbreviation(scenario.schemeExtId)`.
- A hash oracle moved → you touched a game-state field; scoring must not.
- Live submissions fail `replay_verification_failed` → stale artifact; you forgot to regenerate.
- ParBaseline fixture typecheck/`deepEqual` failures → a test config missing `schemeTwistsPar`/`bystandersLostPar`.
