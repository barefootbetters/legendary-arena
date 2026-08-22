# EC-620 — Rulebook-Faithful Scoring: Remove the Per-Round Cost (Execution Checklist)

**Source:** docs/ai/work-packets/WP-585-rulebook-faithful-scoring-drop-round-cost.md
**Layer:** Game Engine (scoring + generator + par.storage) + regenerated PAR artifacts + Arena Client display + docs/tests

## Before Starting
- [ ] Preconditions A–C in WP-585 pass (RawScore has a round term; generator has roundCost + versions; rulebook present)
- [ ] Baseline: `pnpm --filter @legendary-arena/game-engine build && test` exit 0; capture `finalStateHash` / `PRE_WP080_HASH` (must stay byte-identical)

## Locked Values (do not re-derive)
- `RawScore = Penalties − (BP × bystanderReward) − (VP × vpReward)` — NO round term.
- Rulebook 4:3:1 penalties + bystander/VP rewards + all weights UNCHANGED. Only roundCost/roundsPar/weightedRoundCost are removed.
- `scoringConfigVersion 2→3`; `rawScoreSemanticsVersion 1→2` (both in `generate-seed-par.mjs`; the semantics const also in `par.storage.ts`).
- `ScoringInputs.rounds` is KEPT (informational; shown as a given, not scored). `computeParScore` sets `rounds: 0`.
- Seed artifacts regenerated in-place v1 (pre-release/uncalibrated exception to 12.1 immutability).

## Guardrails (execution order matters)
1. Engine types (`parScoring.types.ts`): remove `ScoringWeights.roundCost`, `ParBaseline.roundsPar`, `ScoreBreakdown.weightedRoundCost`; keep `ScoringInputs.rounds`.
2. Engine logic (`parScoring.logic.ts`): drop the term in `computeRawScore` / `computeParScore` (rounds:0) / `buildScoreBreakdown`; remove the `roundCost>0` + `roundsPar>=0` checks in `validateScoringConfig`.
3. `par.storage.ts`: `CURRENT_RAW_SCORE_SEMANTICS_VERSION 1→2`; drop `roundsPar` from `validateParStore` baselineFields + the redundancy check + `isSeedArtifactShape`.
4. `generate-seed-par.mjs`: `DEFAULT_WEIGHTS` drop roundCost; `baselineFromDifficulty` drop roundsPar; `SCORING_CONFIG_VERSION 2→3`; `RAW_SCORE_SEMANTICS_VERSION 1→2`. Rebuild the engine BEFORE regenerating (the generator imports the built dist).
5. **WRITE-ONCE regenerate:** `rm -rf data/par/seed/v1 data/scoring-configs && pnpm par:seed:generate && pnpm par:seed:test`. (writeSeedParArtifact refuses to overwrite — the rm is mandatory.)
6. Client: `competitionApi.ts` drop `weightedRoundCost`; `scoreCalcDisplay.ts` drop the round term (keep "Rounds" given); `EndgameSummary.vue` unchanged (renders verbatim).
7. Docs: `docs/12-SCORING-REFERENCE.md` formula + W_R + seed example.
8. Tests: drop the round-monotonicity test + ADD a rounds-invariance test; fix hand-calc + every fixture carrying roundCost/roundsPar (engine + arena-client + server).

- **Server equality trap:** `competition.logic.ts` fail-closes if `computeParScore(config) !== parValue`. Regeneration is MANDATORY or every live submission fails. Spot-verify one artifact's parValue == hand-computed new formula.
- **Determinism:** scoring is server-side; NO `G`/move/fixture change → both hash oracles byte-identical. If a hash oracle moves, STOP — you strayed out of scope.
- No retroactive invalidation — do NOT touch existing `competitive_scores` rows or migrations; the version bumps + per-row pinned breakdown handle old data.

## Required `// why:` Comments
- On each removal: the rulebook has no round penalty; Scheme Twists are its length proxy (cite the v23 Scoring section + D-24394).
- On the version bumps: formula-shape change → both pins.
- On `computeParScore rounds: 0` and `ScoringInputs.rounds` kept informational.

## Files to Produce
- `packages/game-engine/src/scoring/parScoring.types.ts`, `parScoring.logic.ts` — **modified**
- `packages/game-engine/src/simulation/par.storage.ts` — **modified**
- `scripts/generate-seed-par.mjs` — **modified**
- `data/par/seed/v1/**` + `data/scoring-configs/**` — **regenerated (128 each @ v3)**
- `apps/arena-client/src/lib/api/competitionApi.ts`, `vfx/scoreCalcDisplay.ts` — **modified**
- `docs/12-SCORING-REFERENCE.md` — **modified**
- engine + arena-client + server test files carrying round refs — **modified**

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green; replay/sentinel green (hash oracles byte-unchanged)
- [ ] `grep -rn "roundCost\|roundsPar\|weightedRoundCost"` in `packages/game-engine/src` + `apps/*/src` returns only comments/`.test` (no production code)
- [ ] `grep -rl "roundCost\|roundsPar" data/par/seed/v1 data/scoring-configs` → 0; scoringConfigVersion:3 on all 128
- [ ] `(cd apps/arena-client && pnpm vue-tsc --noEmit && pnpm test)` green; server tests green
- [ ] `pnpm par:seed:test`; `pnpm -r build`; `pnpm -r --no-bail test` — no new failures; `lagn-v1.json` CRLF churn reverted
- [ ] Live-on-surface (D-24026): endgame worked calc has no round-cost line; score reflects rulebook penalties
- [ ] STATUS names WP-585 (+ hash-oracle outcome, D-24026 pending); DECISIONS D-24394 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`

## Common Failure Smells (Optional)
- Live submissions fail with `replay_verification_failed` → a stale artifact (parValue ≠ new computeParScore); you forgot to regenerate.
- A hash oracle moved → you touched a game-state field; scoring must not.
- vue-tsc/tsc error on a removed field → a fixture still carries roundCost/roundsPar.
- The endgame still shows a round-cost line → scoreCalcDisplay still threads the round term.
