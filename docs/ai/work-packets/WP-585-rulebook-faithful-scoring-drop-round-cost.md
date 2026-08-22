# WP-585 — Rulebook-Faithful Scoring: Remove the Per-Round Cost

**Status:** Draft 2026-08-22 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (endgame score) + `legends.legendary-arena.com` (leaderboard). Competitive RawScore no longer includes a per-round cost; game length is penalized only via Scheme Twists, exactly as the printed rulebook scores it. D-24026 live-verification applies.
**Primary Layer:** Game Engine (`packages/game-engine`) scoring + the seed PAR generator/artifacts, with an Arena Client display follow-through.
**Dependencies:** WP-584 / D-24393 (the endgame worked-calculation display this updates); WP-422 / D-24242 (the seed PAR surface + artifacts); WP-531 / D-24342 (the 4:3:1 penalty anchor). All landed. Baseline `origin/main` at draft: `f545fa32`.

## Goal

The competitive RawScore penalizes game length **twice**: an LA-invented per-round cost (`roundCost`, 50/round) **plus** the rulebook's Scheme-Twist penalty. The Marvel Legendary v23 "Scoring" section (verified against `docs/Marvel Legendary Universal Rules v23.txt`) subtracts only **−4 per Bystander lost, −3 per Scheme/Plot Twist, −1 per Villain escaped** (the 4:3:1 anchor) and has **no round/turn penalty at all** — Scheme Twists are its length proxy. So the round cost is the redundant, non-canonical term. This WP removes it, making RawScore rulebook-faithful:

```
RawScore = Penalties − (BP × bystanderReward) − (VP × vpReward)
```

The bystander/VP rewards and penalty weights are **unchanged** — the deliberate LA moral-hierarchy (Vision goals 20-26) stays; only the redundant round cost goes. (Operator decision: "option 1, rulebook-purist," 2026-08-22, after inspecting the printed rulebook.)

## User-Visible Impact

Endgame and leaderboard scores no longer carry a round-cost term; two runs that differ only in length but reveal the same twists now score the same on that axis. Every scenario's PAR shifts down by its old `roundsPar × 50`. The endgame worked calculation drops the "Round cost" line (Rounds stays as an informational given). Existing leaderboard entries are **not** retroactively changed — they keep their pinned version + stored breakdown; new submissions score under the new formula (`scoringConfigVersion 3` / `rawScoreSemanticsVersion 2`). D-24026 applies.

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

```bash
# A. RawScore currently includes a round-cost term
grep -q "weightedRoundCost" packages/game-engine/src/scoring/parScoring.logic.ts && grep -q "roundCost" packages/game-engine/src/scoring/parScoring.types.ts && echo "A_OK"
# Expected: A_OK

# B. The seed generator carries roundCost + the current versions
grep -q "roundCost: 50" scripts/generate-seed-par.mjs && grep -q "SCORING_CONFIG_VERSION = 2" scripts/generate-seed-par.mjs && echo "B_OK"
# Expected: B_OK

# C. The rulebook confirms 4:3:1 and no round penalty (primary source present)
grep -q "for each Scheme/Plot Twist" "docs/Marvel Legendary Universal Rules v23.txt" && echo "C_OK"
# Expected: C_OK
```

## Context (Read First)

- **The rulebook is the authority.** `docs/Marvel Legendary Universal Rules v23.txt` "Scoring" section: subtract −4/bystander-lost, −3/twist, −1/escape; no round/turn term. LA's `roundCost` was an addition (`docs/12-SCORING-REFERENCE.md` W_R) that double-counts length.
- **Scoring is server-side, end-of-match, and NOT in the game-state hash.** `parScoring.logic.ts` derives inputs from terminal G but adds no G field; removing `roundCost` does **not** touch `finalStateHash` / `PRE_WP080_HASH`. Only the PAR **artifact** hashes change (expected, separate).
- **PAR artifacts are write-once** (`docs/12.1-PAR-ARTIFACT-INTEGRITY.md`; `par.storage.ts writeSeedParArtifact` refuses overwrite). Regeneration requires deleting `data/par/seed/v1` + `data/scoring-configs` first, then `pnpm par:seed:generate`. This is a pre-release, **uncalibrated** seed (Phase-2 simulation will replace it), so regenerating v1 in place is an acceptable exception to the immutability doctrine; the version bumps record the change.
- **No retroactive invalidation.** `legendary.competitive_scores` rows pin `par_version`, `scoring_config_version`, and the full `score_breakdown` jsonb. The server never re-scores an existing row (idempotency fast-path). `rawScoreSemanticsVersion 1→2` is the designed filter so old (v1-semantics) and new (v2-semantics) entries are distinguishable.
- **Server defense-in-depth:** `competition.logic.ts` fail-closes a submission if `computeParScore(config) !== parValue`. Both sides recompute from the regenerated artifact, so they agree — **but only if the artifact is regenerated**; a stale artifact would fail-close every live submission.

## Scope (In)

**Game Engine:**
- `scoring/parScoring.types.ts` — remove `ScoringWeights.roundCost`, `ParBaseline.roundsPar`, `ScoreBreakdown.weightedRoundCost`; keep `ScoringInputs.rounds` (informational).
- `scoring/parScoring.logic.ts` — drop the round-cost term in `computeRawScore`, `computeParScore` (`rounds: 0`), `buildScoreBreakdown`; remove the `roundCost > 0` and `roundsPar >= 0` checks in `validateScoringConfig`; update docs/comments.
- `simulation/par.storage.ts` — `CURRENT_RAW_SCORE_SEMANTICS_VERSION 1→2`; drop `roundsPar` from `validateParStore` baseline fields + redundancy check + `isSeedArtifactShape` guard.

**Seed generator + artifacts:**
- `scripts/generate-seed-par.mjs` — `DEFAULT_WEIGHTS` drop `roundCost`; `baselineFromDifficulty` drop `roundsPar`; `SCORING_CONFIG_VERSION 2→3`; `RAW_SCORE_SEMANTICS_VERSION 1→2`.
- Regenerate `data/par/seed/v1/**` (128 scenarios + index) + `data/scoring-configs/**` (128 configs): `rm -rf data/par/seed/v1 data/scoring-configs && pnpm par:seed:generate && pnpm par:seed:test`. Every `parValue` drops by `roundsPar × 50`; every `artifactHash` recomputes.

**Arena Client:**
- `lib/api/competitionApi.ts` — remove `weightedRoundCost` from the local `CompetitiveScoreBreakdown`.
- `vfx/scoreCalcDisplay.ts` — drop the round term from the formula / substituted / products strings; keep "Rounds" as an informational given.
- `components/hud/EndgameSummary.vue` — renders `workedCalc` verbatim; the round line drops out via the helper (no template change beyond that).

**Docs + tests:**
- `docs/12-SCORING-REFERENCE.md` — update the formula, the W_R component, and the seed PAR example to reflect no round cost.
- Tests: `parScoring.logic.test.ts` (drop the round-monotonicity test; add a "rounds no longer scores" assertion; fix hand-calc + fixtures), `par.storage.test.ts` (roundsPar → a surviving baseline field), `scoringConfigLoader` / `par.aggregator` / `uiState.build.par` fixtures, arena-client `scoreCalcDisplay.test.ts` / `EndgameSummary.test.ts`, server `competition.logic` / `leaderboard.logic` / `parGate` fixtures.

## Out of Scope

- The bystander reward and VP weight, and the moral-hierarchy design — unchanged (a deliberate LA departure the operator did not question). Only the round cost is removed.
- Publishing a new PAR version (v2) — regenerate v1 in place (pre-release/uncalibrated exception; version pins record the change).
- Phase-2 simulation calibration — separate, still upcoming.
- Any game-state / move / G change — none; scoring only.

## Files Expected to Change

- `packages/game-engine/src/scoring/parScoring.types.ts`, `parScoring.logic.ts` — **modified**
- `packages/game-engine/src/simulation/par.storage.ts` — **modified**
- `scripts/generate-seed-par.mjs` — **modified**
- `data/par/seed/v1/**` (128 + index), `data/scoring-configs/**` (128) — **regenerated**
- `apps/arena-client/src/lib/api/competitionApi.ts`, `vfx/scoreCalcDisplay.ts` — **modified**
- `docs/12-SCORING-REFERENCE.md` — **modified**
- engine + arena-client + server test fixtures/assertions — **modified**
- `docs/ai/DECISIONS.md` / `STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` — **modified**

Cross-layer (engine + generator + artifacts + client + server tests); single-session lane.

## Contract (Locked by D-24394)

- **Full removal** of `roundCost` / `roundsPar` / `weightedRoundCost`; `RawScore = Penalties − (BP × bystanderReward) − (VP × vpReward)`; `ScoringInputs.rounds` kept informational.
- Bystander/VP rewards + penalty weights **unchanged**.
- **Both version pins bumped:** `scoringConfigVersion 2→3`, `rawScoreSemanticsVersion 1→2`. No retroactive invalidation.
- Seed PAR artifacts **regenerated** (v1 in place; pre-release exception to 12.1 immutability).
- **No game-state-hash re-pin** (scoring is server-side); PAR artifact hashes change (expected).
- The server `computeParScore === parValue` equality holds because the artifact is regenerated.

### Determinism / persistence
No engine `G` / fixture / move touched → `finalStateHash` / `PRE_WP080_HASH` byte-identical (verify via the green replay/sentinel suites). PAR artifact hashes recompute. `competitive_scores` rows keep their pinned version + breakdown.

## Acceptance Criteria

1. `computeRawScore` includes no round term: two inputs differing only in `rounds` yield the **same** RawScore; the round-monotonicity test is gone, replaced by a rounds-invariance assertion.
2. `ScoringWeights` has no `roundCost`; `ParBaseline` no `roundsPar`; `ScoreBreakdown` no `weightedRoundCost`; `ScoringInputs.rounds` retained. `validateScoringConfig` no longer checks either removed field.
3. Every regenerated seed artifact + scoring-config carries `scoringConfigVersion:3`, `rawScoreSemanticsVersion:2`, no `roundCost`/`roundsPar`, and a `parValue` equal to `computeParScore` under the new formula (server equality holds).
4. The endgame worked calculation has no round-cost line; "Rounds" still shows as an informational given.
5. No game-state-hash re-pin (both oracles byte-unchanged); engine + arena-client (`vue-tsc`) + server tests green; `pnpm -r --no-bail test` no new failures.
6. `docs/12-SCORING-REFERENCE.md` formula + example updated; no production code references the removed fields.

## Verification Steps

```bash
grep -rn "roundCost\|roundsPar\|weightedRoundCost" packages/game-engine/src apps/server/src apps/arena-client/src | grep -vE "\.test\.|// why|WP-585"; echo "expect none (only comments)"
grep -rl "roundCost\|roundsPar" data/par/seed/v1 data/scoring-configs | wc -l   # expect 0
grep -roE "\"scoringConfigVersion\":3" data/scoring-configs | wc -l              # expect 128
pnpm --filter @legendary-arena/game-engine build && pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -4   # replay/sentinel green = no hash re-pin
(cd apps/arena-client && pnpm vue-tsc --noEmit && pnpm test 2>&1 | tail -3)
pnpm par:seed:test && pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -6
# Live (post-deploy; D-24026): finish a ranked match; the endgame worked calc has no round-cost line and the score reflects the rulebook penalties.
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–C passed
- [ ] All 6 Acceptance Criteria pass
- [ ] Verification Steps produce expected output (live step post-deploy)
- [ ] Full removal; both version pins bumped; artifacts regenerated (128 @ v3); no production round references
- [ ] No game-state-hash re-pin (both oracles byte-unchanged); no `G`/move/fixture change
- [ ] `docs/12-SCORING-REFERENCE.md` updated; engine + arena-client + server + `pnpm -r --no-bail` green
- [ ] `docs/ai/STATUS.md` Done entry names WP-585 + D-24026 operator-pending
- [ ] `docs/ai/DECISIONS.md` D-24394 landed Active
- [ ] WORK_INDEX + EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-620:` for code/artifacts, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed (operator-pending)

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-22)
Dependencies verified on `main` @ `f545fa32`. Primary source (rulebook) verified: 4:3:1 penalties, no round penalty. A scoping scaffold mapped the full blast radius (engine types/logic/validation, generator, par.storage, 256 artifacts, client, ~13 test files) and confirmed FULL removal is cleaner than zero-weight. **Mutation boundary:** scoring is server-side, no `G`/hash/fixture; both oracles untouched. Write-once artifact trap + server equality check identified and mitigated (rm-then-regenerate; both version pins bumped).

### Copilot (`01.7`) — verdict: **PASS** (2026-08-22)
Layer boundary (engine scoring + generator + client display + test fixtures) — clean. Determinism (server-side scoring; no game-state hash) — clean. Contract fidelity (removes the redundant non-canonical term; keeps the rulebook 4:3:1 penalties + the deliberate LA moral-hierarchy) — clean. Scope (only roundCost/roundsPar/weightedRoundCost; no reward/weight retune; v1 regenerate not v2 publish) — clean. **RISK considered:** stale artifact → live fail-close (mitigated by mandatory regeneration + par:seed:test); retroactive invalidation (mitigated by pinned per-row version + breakdown + the rawScoreSemanticsVersion filter); immutability doctrine (pre-release/uncalibrated seed exception, documented). Locked in AC-1/AC-3 + D-24394.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)
§1–§21 pass; closed allowlist across engine/generator/artifacts/client/docs/tests + governance; `node:test`; `// why:` on every removal citing the rulebook; §17 N/A; §20 N/A; §21 N/A (no endpoint change — the persisted `score_breakdown` shape narrows harmlessly, no server route/library change). No ❌ triggers.

## Vision Alignment
**Clauses touched:** §10 (rulebook fidelity — scoring now matches the printed game), §20-26 (scoring model — removes a non-canonical penalty; the moral hierarchy is preserved), §22 (determinism — server-side scoring, no game-state hash change). **Conflict assertion:** `No conflict` — makes scoring more faithful without altering determinism, the moral hierarchy, or any game rule. **Non-Goal proximity:** none. **Determinism:** no engine `G`/fixture → both hash oracles byte-identical.

## Funding Surface Gate
**N/A** — a scoring-fidelity change; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update
**N/A** — no HTTP endpoint or `apps/server/src/**` library-function signature change. The `POST /api/competition/scores` + `GET /api/me/scores` response shapes narrow (a jsonb field drops from new records) but no endpoint/library contract changes. `docs/ai/REFERENCE/api-endpoints.md` unaffected.
