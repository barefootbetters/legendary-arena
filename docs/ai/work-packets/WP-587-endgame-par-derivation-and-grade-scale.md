# WP-587 — Endgame: PAR Derivation, Grade Scale, and Named Penalties

**Status:** Draft 2026-08-22 — executing this session. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (endgame screen). The endgame now shows (a) how PAR was derived from the scenario baseline, (b) the full grade scale with the player's row marked, and (c) named penalties in the worked calculation ("7 scheme twists", not "7 penalties"). D-24026 live-verification applies.
**Primary Layer:** Game Engine (`packages/game-engine`) exposes the data; Arena Client (`apps/arena-client`) renders it. No server change (jsonb pass-through).
**Dependencies:** WP-583 / D-24392 (the grade badge + `gradeForFinalScore`); WP-584 / D-24393 (the worked calculation this extends); WP-585 / D-24394 (rulebook-faithful RawScore); WP-586 / D-24395 (the bystander count feeding these numbers). All landed. Baseline `origin/main` at draft: `88beb955`.

## Goal

The endgame screen shows the competitive score, its worked raw-score calculation, and a grade badge — but three things the operator asked for are missing:

1. **PAR's derivation.** The screen shows the final PAR value (e.g. −1150) but not *where it came from*. PAR is the same formula applied to the scenario's expected baseline: `(escapesPar × 100) − (bystandersPar × 200) − (victoryPointsPar × 10)`. Show that derivation.
2. **The grade scale.** The badge says "Grade A" but not what score a B / A / Legendary needs. Show the full band scale with the player's row marked.
3. **Named penalties.** The worked calc's substituted line reads `(7 × 300)` — the operator asked to name it: `(7 scheme twists × 300)`.

Operator approved the layout via a `show_widget` mockup before build.

## User-Visible Impact

Below the raw-score calculation the endgame screen adds a "PAR for this scenario" block (the baseline counts + the same formula → the verbatim PAR value) and a "Grade scale" block (every band, its final-score range, and a "← your score" marker on the earned grade). The penalty terms in the worked calc are named. Records persisted before WP-587 have no `parBaseline` in their stored breakdown, so the PAR-derivation block is simply omitted for them (the PAR value still shows); the grade scale needs only `finalScore` and always shows.

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

```bash
# A. ScoreBreakdown exposes parScore but not parBaseline yet
grep -q "readonly parScore: number;" packages/game-engine/src/scoring/parScoring.types.ts && ! grep -q "readonly parBaseline: ParBaseline;" packages/game-engine/src/scoring/parScoring.types.ts && echo "A_OK"
# Expected: A_OK

# B. The grade bands live only inside gradeForFinalScore's if-ladder
grep -q "const LEGENDARY_MAX" packages/game-engine/src/scoring/parScoring.grade.ts && ! grep -q "SCORE_GRADE_BANDS" packages/game-engine/src/scoring/parScoring.grade.ts && echo "B_OK"
# Expected: B_OK

# C. The server returns the breakdown verbatim (jsonb pass-through — no field rebuild)
grep -q "scoreBreakdown: row.score_breakdown" apps/server/src/competition/competition.logic.ts && echo "C_OK"
# Expected: C_OK
```

## Context (Read First)

- **The server is a jsonb pass-through for the breakdown.** `competition.logic.ts` persists the whole engine `ScoreBreakdown` to `score_breakdown` jsonb and returns `row.score_breakdown` verbatim (`scoreBreakdown: row.score_breakdown`). Adding `parBaseline` to `buildScoreBreakdown`'s output rides along automatically — **no server code change**.
- **Scoring is server-side, end-of-match, and NOT in the game-state hash.** `parBaseline` is a display projection of the config's baseline; it adds no `G` field, so `finalStateHash` / `PRE_WP080_HASH` are untouched.
- **No scoringConfigVersion bump.** This is additive display data, not a scoring-formula or weight change; the score values are identical.
- **Copy boundary (D-24392 / D-24367).** The engine ships enums and numeric bands only; every player-facing word ("Legendary", grade ranges, penalty names) lives in `apps/arena-client`. The PAR-derivation and grade-scale strings are built client-side.
- **Old records degrade gracefully.** Rows persisted before WP-587 have no `parBaseline` in their stored jsonb, so the client type marks it optional and the PAR-derivation block is omitted for them.

## Scope (In)

**Game Engine:**
- `scoring/parScoring.grade.ts` — add `ScoreGradeBand` + `SCORE_GRADE_BANDS` (grade + inclusive-upper `maxFinalScore`, `null` on the worst band) as the single source of truth; refactor `gradeForFinalScore` to iterate it.
- `scoring/parScoring.types.ts` — add `readonly parBaseline: ParBaseline` to `ScoreBreakdown`.
- `scoring/parScoring.logic.ts` — `buildScoreBreakdown` field-copies `parBaseline` into the output (no alias, D-2801 / D-4806); import `ParBaseline`.
- `index.ts` — barrel-export `SCORE_GRADE_BANDS` + `ScoreGradeBand`.

**Arena Client:**
- `lib/api/competitionApi.ts` — add `CompetitiveParBaseline` + optional `parBaseline?` on `CompetitiveScoreBreakdown`.
- `vfx/scoreCalcDisplay.ts` — name each penalty in the substituted line (singular/plural); add a `ParDerivation` built from the baseline reusing the match-derived weights (escape weight symbolic when the match had 0 escapes — never fabricated).
- `vfx/gradeDisplay.ts` — add `buildGradeScale` (words + range formatting client-side).
- `components/hud/EndgameSummary.vue` — render the PAR-derivation block (inside the worked calc) + the grade scale (current row marked by text + `aria-current`, not colour).

**Tests:** engine grade-band drift pin + buildScoreBreakdown parBaseline; arena-client scoreCalcDisplay (named penalties, PAR derivation, graceful degradation), gradeDisplay (buildGradeScale), EndgameSummary (PAR block + grade scale render).

## Out of Scope

- The grade-band thresholds themselves (unchanged tunable values from WP-583).
- Any weight/formula/PAR-artifact change; any scoringConfigVersion bump.
- The leaderboard grade scale (endgame screen only; a follow-up).
- Any server route/library/persistence change (jsonb pass-through).
- Any `G` / move / fixture change.

## Files Expected to Change

- `packages/game-engine/src/scoring/parScoring.grade.ts`, `parScoring.types.ts`, `parScoring.logic.ts`, `index.ts` — **modified**
- `packages/game-engine/src/scoring/parScoring.grade.test.ts`, `parScoring.logic.test.ts` — **modified (new tests)**
- `apps/arena-client/src/lib/api/competitionApi.ts`, `vfx/scoreCalcDisplay.ts`, `vfx/gradeDisplay.ts`, `components/hud/EndgameSummary.vue` — **modified**
- `apps/arena-client/src/vfx/scoreCalcDisplay.test.ts`, `vfx/gradeDisplay.test.ts`, `components/hud/EndgameSummary.test.ts` — **modified (new tests)**
- `docs/ai/DECISIONS.md` / `STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` — **modified**

Cross-layer (engine + arena-client); single-session lane.

## Contract (Locked by D-24396)

- `ScoreBreakdown.parBaseline` is a **field-copied** display projection (no alias; JSON-serializable, D-2801 / D-4806); never re-entered into scoring.
- `SCORE_GRADE_BANDS` is the **single source of truth** for classification and the displayed scale; `gradeForFinalScore` iterates it; runtime drift-pinned against `SCORE_GRADES` and the boundary table.
- The client owns all player-facing words, grade-range formatting, penalty names, and PAR-derivation strings (D-24392 / D-24367).
- The PAR-derivation line **never fabricates a weight** — a weight not derivable from the match (e.g. the escape weight with 0 escapes) is shown symbolically.
- **No server change** (jsonb pass-through); **no game-state-hash re-pin** (server-side, no `G` field); **no scoringConfigVersion bump**; `parBaseline` optional on the client type so pre-WP-587 records degrade gracefully.

### Determinism / persistence
No engine `G` / fixture / move touched → `finalStateHash` / `PRE_WP080_HASH` byte-identical (verify via the green replay/sentinel suites). No PAR artifact change. `competitive_scores` rows are not recomputed; new rows carry `parBaseline` in their jsonb, old rows do not.

## Acceptance Criteria

1. `ScoreBreakdown` has `parBaseline`; `buildScoreBreakdown` sets it as a copy (not aliased to the config); `parScore` still equals `computeParScore` of that baseline.
2. `SCORE_GRADE_BANDS` exists, is barrel-exported, lists every grade once in `SCORE_GRADES` order with only the worst band unbounded; `gradeForFinalScore` iterates it and agrees at every boundary (runtime drift pin).
3. The worked-calc substituted line names each penalty ("7 scheme twists × 300", singular/plural correct).
4. `buildParDerivation` returns the baseline formula + substituted line reusing the match-derived weights; a non-derivable weight shows symbolically; the PAR value is verbatim; `undefined` when no `parBaseline`.
5. `buildGradeScale` returns one entry per band with correct ranges and exactly one `isCurrent`; `EndgameSummary` renders the PAR-derivation block (when present) and the grade scale (current row marked by text + `aria-current`).
6. No game-state-hash re-pin (both oracles byte-unchanged); engine + arena-client (`vue-tsc`) + `pnpm -r --no-bail test` green.

## Verification Steps

```bash
pnpm --filter @legendary-arena/game-engine build && pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -4   # replay/sentinel green = no hash re-pin
pnpm -r build && (cd apps/arena-client && pnpm vue-tsc --noEmit && pnpm test 2>&1 | tail -3)
pnpm -r --no-bail test 2>&1 | tail -6
# Live (post-deploy; D-24026): finish a ranked match; the endgame shows the PAR derivation, the grade scale with your row marked, and named penalties.
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–C passed
- [ ] All 6 Acceptance Criteria pass
- [ ] Verification Steps produce expected output (live step post-deploy)
- [ ] Engine exposes parBaseline + SCORE_GRADE_BANDS; client renders all three additions; no server change
- [ ] No game-state-hash re-pin (both oracles byte-unchanged); no `G`/move/fixture change; no scoringConfigVersion bump
- [ ] engine + arena-client `vue-tsc` + `pnpm -r --no-bail` green; `lagn-v1.json` CRLF churn reverted
- [ ] `docs/ai/STATUS.md` Done entry names WP-587 + D-24026 operator-pending
- [ ] `docs/ai/DECISIONS.md` D-24396 landed Active
- [ ] WORK_INDEX + EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-622:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed (operator-pending)

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-22)
Dependencies verified on `main` @ `88beb955`. Data-flow traced: `buildScoreBreakdown` → `score_breakdown` jsonb → `row.score_breakdown` returned verbatim → client `CompetitiveScoreBreakdown`, so a new breakdown field reaches the client with no server change. **Mutation boundary:** scoring is server-side, no `G`/hash/fixture; no scoringConfigVersion bump (additive display data). Copy boundary honored: engine ships `SCORE_GRADE_BANDS` numbers + `parBaseline`; client owns all words/ranges. Old-row degradation handled (optional client field).

### Copilot (`01.7`) — verdict: **PASS** (2026-08-22)
Layer boundary (engine data + client display; no server) — clean. Determinism (server-side; no `G` field; no hash re-pin) — clean. Contract fidelity (single-source `SCORE_GRADE_BANDS`; field-copied `parBaseline`; PAR line never fabricates a weight; no copy in `packages/`) — clean. Scope (display only; no weights/artifacts/version bump) — clean. **RISK considered:** a required `parBaseline` breaking hand-built ScoreBreakdown literals (checked — only `buildScoreBreakdown` builds one in production; the client mirror is optional); exactOptionalPropertyTypes on the optional display field (handled with an explicit `| undefined`); grade-band drift (runtime-pinned). Locked in AC-1..AC-5 + D-24396.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)
§1–§21 pass; closed allowlist across engine scoring/index + arena-client vfx/api/hud + tests + governance; `node:test`; `// why:` on the new engine field, the bands, and each display helper citing D-24396; §17 N/A; §20 N/A; §21 N/A (no endpoint or `apps/server/src/**` library-function signature change — the returned breakdown shape widens by one optional field, a jsonb pass-through). No ❌ triggers.

## Vision Alignment
**Clauses touched:** §20-26 (scoring legibility — shows PAR's derivation and the grade scale; no scoring change), §22 (determinism — server-side scoring, no game-state hash change), §24 (competitive integrity — display only, values rendered verbatim). **Conflict assertion:** `No conflict` — adds legibility without altering determinism, weights, or any game rule. **Non-Goal proximity:** none. **Determinism:** no engine `G`/fixture → both hash oracles byte-identical.

## Funding Surface Gate
**N/A** — an endgame-legibility display change; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update
**N/A** — no HTTP endpoint or `apps/server/src/**` library-function signature change. The `POST /api/competition/scores` + `GET /api/me/scores` response shapes gain one optional jsonb field (`scoreBreakdown.parBaseline`) via pass-through; no server route/library contract changes. `docs/ai/REFERENCE/api-endpoints.md` unaffected.
