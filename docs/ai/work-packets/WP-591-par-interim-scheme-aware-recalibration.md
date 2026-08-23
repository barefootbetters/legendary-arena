# WP-591 — Interim Scheme-Aware PAR Recalibration

**Status:** Draft 2026-08-23 — executing this session. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (endgame grade) + `legends.legendary-arena.com` (leaderboard). Competitive grades become meaningful — a solid win grades B, an exceptional game A/Legendary, a loss D/F — across all schemes. D-24026 live-verification applies.
**Primary Layer:** Game Engine (scoring formula + grade bands) + the seed PAR generator/artifacts, with an Arena Client display follow-through.
**Dependencies:** WP-585 (rulebook-faithful RawScore), WP-586 (`isBystanderCard`), WP-587/588 (endgame PAR-derivation display + per-player). WP-422/D-24242 (seed PAR surface). All landed. Baseline `origin/main` at draft: `ff61bd87`.

## Goal

The competitive PAR is uncalibrated and mis-grades in **both** directions. The seed baseline is scheme-**blind** (`bystandersPar = clamp(2, 8, 8 − ⌈D/2⌉)`), but bystander rescues are scheme-**driven** — validated from 13 real-game diagnostics (extracted via `scripts/extract-par-anchors.mjs`): Midtown Bank Robbery rescues 24–37 bystanders, Cosmic Cube 3–4. So the single PAR (−1150) makes bystander-flood schemes pin at Legendary AND makes bystander-light schemes grade *wins* as F.

**Simulation calibration (VISION §26 Phase-2) is the real fix but is deferred:** the competent AI is too weak to be a valid competent-play reference — a spike showed its 55th-percentile game is near break-even (~0 to −1400 raw) vs a competent human's −5170. Strengthening the AI is a separate parallel arc. This WP is the **interim**: author scheme-aware baselines from the observed anchors so grades are sensible now.

Operator decisions (2026-08-23): **option A** (extend PAR to model twists — physical baselines); **solid win = B, exceptional = A/Legendary**; **loss penalty by margin** (not auto-F).

## User-Visible Impact

Grades become meaningful and scheme-fair. A solid win lands B; an exceptional game (e.g. a 37-bystander Midtown run) lands A/Legendary; a weak win lands C; a loss lands D/F (via the loss penalty). Cosmic Cube wins stop grading F; Midtown wins stop pinning at Legendary. Existing leaderboard entries are **not** retroactively changed — they keep their pinned version + stored breakdown; new submissions score under the new baselines (`scoringConfigVersion 4` / `rawScoreSemanticsVersion 3`).

## Contract (Locked by D-24400)

1. **Scheme-aware baselines.** `baselineForScenario(schemeSlug, difficulty, playerCount)` replaces the flat template — per-scheme profiles anchored to the observed competent-win medians (structural estimates for Killbots / Portals / Legacy Virus / Negative Zone, which have no game yet). The scheme sets bystander + twist expectations; player count scales the reward totals; difficulty mildly modulates VP + escapes.
2. **Physical baselines (option A).** `ParBaseline` gains `schemeTwistsPar` + `bystandersLostPar`; `computeParScore` subtracts those penalties, so PAR models the same penalties as the raw score and the baseline stays physically meaningful (the WP-587 endgame PAR-derivation display stays honest).
3. **Loss penalty.** `computeRawScore` adds a flat `LOSS_PENALTY` (6000) when `ScoringInputs.matchLost` is true (derived from `evaluateEndgame(...).outcome === 'scheme-wins'`), so a bystander-heavy loss can never out-grade a competent win. Exposed as `ScoreBreakdown.weightedLossPenalty`.
4. **Retuned grade bands.** `SCORE_GRADE_BANDS`: Legendary ≤ −2000, A ≤ −700, B ≤ 700, C ≤ 2000, D ≤ 4000, F. Validated against all 13 real anchor games.
5. **Versions.** `scoringConfigVersion 3→4`, `rawScoreSemanticsVersion 2→3`; existing `competitive_scores` rows keep their pinned versions (no retroactive invalidation). 128 seed artifacts + configs regenerated.

### Determinism / persistence
Scoring is server-side, end-of-match, and adds no `G` field → `finalStateHash` / `PRE_WP080_HASH` byte-identical (verify via the green replay/sentinel suites). `deriveScoringInputs` sets `matchLost` internally, so there is **no server route change** (jsonb pass-through). PAR artifact hashes recompute (expected).

## Scope (In)

**Game Engine:** `scoring/parScoring.types.ts` (`ParBaseline` += `schemeTwistsPar`/`bystandersLostPar`; `ScoringInputs` += `matchLost?`; `ScoreBreakdown` += `weightedLossPenalty`); `scoring/parScoring.logic.ts` (`LOSS_PENALTY`; `computeRawScore` loss term; `computeParScore` twist + bystander-lost terms; `deriveScoringInputs` sets `matchLost`; `buildScoreBreakdown`; `validateScoringConfig` new-field checks); `scoring/parScoring.grade.ts` (retuned `SCORE_GRADE_BANDS`); `simulation/par.aggregator.ts` (`deriveScoringInputsFromFinalState` sets `matchLost`); `simulation/par.storage.ts` (new baseline fields in validators + `CURRENT_RAW_SCORE_SEMANTICS_VERSION 2→3`).

**Generator + artifacts:** `scripts/generate-seed-par.mjs` (`baselineForScenario` scheme-aware; `SCORING_CONFIG_VERSION 3→4`, `RAW_SCORE_SEMANTICS_VERSION 2→3`); `scripts/extract-par-anchors.mjs` (new committed calibration tool); regenerate `data/par/seed/v1/**` + `data/scoring-configs/**` (128 each).

**Arena Client:** `lib/api/competitionApi.ts` (mirror the new optional fields); `vfx/scoreCalcDisplay.ts` (PAR derivation twist term; raw calc loss-penalty term); `components/hud/EndgameSummary.vue` (Expected-twists given).

**Docs + tests:** `docs/12-SCORING-REFERENCE.md`; engine + arena-client tests.

## Out of Scope

- Simulation calibration itself (deferred — AI-strengthening arc first).
- Any weight change (bystanderReward/vpReward/penalty weights unchanged).
- Any `G` / move / fixture change; any server route/library change.
- Precise per-mastermind / per-villain-slice tuning (scheme + player count dominate; difficulty is a mild modulation only).

## Acceptance Criteria

1. `computeParScore` subtracts twist + bystander-lost penalties from the baseline; `ParBaseline` carries both new fields; `validateScoringConfig` checks them.
2. `computeRawScore` adds `LOSS_PENALTY` iff `matchLost`; `buildScoreBreakdown` exposes `weightedLossPenalty`; `deriveScoringInputs` / `deriveScoringInputsFromFinalState` set `matchLost` from the endgame outcome.
3. `SCORE_GRADE_BANDS` retuned; the boundary test pins the new ceilings.
4. `baselineForScenario` is scheme-aware; all 128 regenerated configs carry `scoringConfigVersion:4` and a 5-field `parBaseline`; `computeParScore === parValue` holds (`par:seed:test` green).
5. The 13 real anchor games grade per target (solid win B, exceptional A/Legendary, weak win C, loss D/F) — validated offline.
6. No game-state-hash re-pin; engine + arena-client (`vue-tsc`) + `pnpm -r --no-bail test` green.

## Verification Steps

```bash
pnpm --filter @legendary-arena/game-engine build && pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -4   # replay/sentinel green = no hash re-pin
rm -rf data/par/seed/v1 data/scoring-configs && pnpm par:seed:generate && pnpm par:seed:test
grep -roE '"scoringConfigVersion":4' data/scoring-configs | wc -l   # expect 128
pnpm -r build && (cd apps/arena-client && pnpm vue-tsc --noEmit && pnpm test 2>&1 | tail -3)
pnpm -r --no-bail test 2>&1 | tail -6
# Live (post-deploy; D-24026): finish ranked matches on a flood and a light scheme; grades are sensible (a solid win ~B, an exceptional game A/Legendary, a loss D/F).
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] All 6 Acceptance Criteria pass
- [ ] Verification Steps produce expected output (live step post-deploy)
- [ ] Scheme-aware baselines; twist-aware physical PAR; loss penalty; retuned bands; versions bumped; 128 regenerated @ v4
- [ ] No game-state-hash re-pin (both oracles byte-unchanged); no `G`/move/fixture change; no server route change
- [ ] `docs/12-SCORING-REFERENCE.md` updated; engine + arena-client + `pnpm -r --no-bail` green; `lagn-v1.json` CRLF churn reverted
- [ ] `docs/ai/STATUS.md` Done entry names WP-591 + D-24026 operator-pending
- [ ] `docs/ai/DECISIONS.md` D-24400 landed Active
- [ ] WORK_INDEX + EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-626:` for code/artifacts, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed (operator-pending)

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-23)
Grounded in 13 extracted real-game anchors + the registry's per-scheme `villainDeckBystanderCount`/twist-capture signals. Model validated offline against all 13 games (grades match the operator target). Sim-calibration ruled out this cycle by an empirical spike (competent AI too weak). **Mutation boundary:** scoring is server-side, no `G`/hash/fixture; `deriveScoringInputs` sets `matchLost` internally → no server route change. Write-once artifact trap + `computeParScore===parValue` guard handled (rm-then-regenerate; both version pins bumped).

### Copilot (`01.7`) — verdict: **PASS** (2026-08-23)
Layer boundary (engine scoring + generator + client display) — clean. Determinism (server-side; no game-state hash; no `G` field) — clean. Contract fidelity (physical baselines via twist-aware PAR; loss penalty outcome-gated; scheme-aware from validated anchors; retuned bands) — clean. Scope (interim; no weight change; sim-calibration deferred) — clean. **RISK considered:** over-correcting light schemes (avoided — scheme-aware, Cosmic Cube stays low); a loss out-grading a win (fixed by the loss penalty, validated); stale artifact → live fail-close (mitigated by mandatory regeneration + `par:seed:test`); sparse data → approximate numbers (explicitly interim, superseded by sim). Locked in AC-1..AC-5 + D-24400.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)
§1–§21 pass; closed allowlist across engine scoring/simulation + generator + artifacts + client + tests + governance; `node:test`; `// why:` on every new field, the loss penalty, and each baseline profile citing D-24400; §17 N/A; §20 N/A; §21 N/A (no endpoint or `apps/server/src/**` library signature change — the returned breakdown widens by optional jsonb fields via pass-through). No ❌ triggers.

## Vision Alignment
**Clauses touched:** §20-26 (scoring model — makes PAR scheme-fair and grades meaningful; interim ahead of §26 Phase-2 simulation), §22 (determinism — server-side, no game-state hash change), §24 (competitive integrity — a loss can no longer out-grade a win). **Conflict assertion:** `No conflict` — improves calibration fidelity without altering determinism or any game rule; explicitly interim, superseded by simulation. **Non-Goal proximity:** none. **Determinism:** no engine `G`/fixture → both hash oracles byte-identical.

## Funding Surface Gate
**N/A** — a scoring-calibration change; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update
**N/A** — no HTTP endpoint or `apps/server/src/**` library-function signature change. The `POST /api/competition/scores` + `GET /api/me/scores` response shapes gain optional jsonb fields (`scoreBreakdown.parBaseline.{schemeTwistsPar,bystandersLostPar}`, `weightedLossPenalty`, `inputs.matchLost`) via pass-through; no route/library contract changes. `docs/ai/REFERENCE/api-endpoints.md` unaffected.
