# EC-622 — Endgame: PAR Derivation, Grade Scale, and Named Penalties (Execution Checklist)

**Source:** docs/ai/work-packets/WP-587-endgame-par-derivation-and-grade-scale.md
**Layer:** Game Engine (data exposure) + Arena Client (display). No server change.

## Before Starting
- [ ] Preconditions A–C in WP-587 pass (parScore present but no parBaseline; bands only in the if-ladder; server returns row.score_breakdown verbatim)
- [ ] Baseline: `pnpm --filter @legendary-arena/game-engine build && test` exit 0 (note count); replay/sentinel green (hashes must stay byte-identical)

## Locked Values (do not re-derive)
- `ScoreBreakdown.parBaseline: ParBaseline` — field-copied in buildScoreBreakdown (no alias; D-2801 / D-4806); display-only, never re-entered into scoring.
- `SCORE_GRADE_BANDS` = single source of truth: `{ grade, maxFinalScore }`, inclusive-upper ceilings, `null` on the worst band; ceilings ascend; grades in SCORE_GRADES order.
- Client owns ALL words + range formatting + penalty names + PAR-derivation strings (D-24392 / D-24367). Engine ships numbers/enums only.
- PAR-derivation reuses match-derived weights; a non-derivable weight (e.g. escape weight at 0 escapes) is shown SYMBOLICALLY — never fabricated.
- NO server change (jsonb pass-through). NO scoringConfigVersion bump. NO game-state-hash re-pin. parBaseline OPTIONAL on the client type.

## Guardrails (execution order matters)
1. `parScoring.grade.ts`: add `ScoreGradeBand` + `SCORE_GRADE_BANDS`; refactor `gradeForFinalScore` to iterate the bands (keep the total-function fallback).
2. `parScoring.types.ts`: add `readonly parBaseline: ParBaseline` to `ScoreBreakdown`.
3. `parScoring.logic.ts`: `import type { ParBaseline }`; field-copy `parBaseline` into buildScoreBreakdown's return.
4. `index.ts`: barrel-export `SCORE_GRADE_BANDS` + `ScoreGradeBand`.
5. Rebuild the engine BEFORE the arena-client typecheck (arena-client imports the built dist).
6. `competitionApi.ts`: `CompetitiveParBaseline` + optional `parBaseline?` on `CompetitiveScoreBreakdown`.
7. `scoreCalcDisplay.ts`: PENALTY_LABELS (one/many) → name penalties in the substituted line; `buildParDerivation` + `ParDerivation`; wire `parDerivation` into `buildWorkedScoreCalc`. Under `exactOptionalPropertyTypes`, the optional `parDerivation` field needs `| undefined` in its type.
8. `gradeDisplay.ts`: `buildGradeScale` (import `SCORE_GRADE_BANDS`; format ranges with the true minus U+2212).
9. `EndgameSummary.vue`: render the PAR-derivation block (inside the worked calc, `v-if="workedCalc.parDerivation"`) + the grade scale (`v-if="gradeScale"`, current row marked by text + `aria-current`, not colour).
10. Tests: engine grade-band drift pin + buildScoreBreakdown parBaseline; arena-client named penalties + PAR derivation + graceful degradation + buildGradeScale + component render. UPDATE the two existing WP-584 assertions that expect the old `(N × W)` penalty format.

- **Determinism:** scoring is server-side; NO `G`/move/fixture change → both hash oracles byte-identical. If a hash oracle moves, STOP — you strayed out of scope.
- **No server edit.** The breakdown is jsonb pass-through; do NOT touch competition.logic.ts / migrations.
- **Copy boundary.** No player-facing word or range string in `packages/` — the engine ships numbers/enums only.

## Required `// why:` Comments
- On `parBaseline` (type + copy): display-only projection, field-copied for the no-alias invariant, cite D-24396 / D-2801.
- On `SCORE_GRADE_BANDS` + the gradeForFinalScore refactor: single source of truth for classification + scale.
- On the symbolic escape-weight fallback: never fabricate a weight the match didn't reveal.
- On the `| undefined` in the optional `parDerivation` type: exactOptionalPropertyTypes.

## Files to Produce
- `packages/game-engine/src/scoring/parScoring.grade.ts`, `parScoring.types.ts`, `parScoring.logic.ts`, `index.ts` — **modified**
- `packages/game-engine/src/scoring/parScoring.grade.test.ts`, `parScoring.logic.test.ts` — **modified**
- `apps/arena-client/src/lib/api/competitionApi.ts`, `vfx/scoreCalcDisplay.ts`, `vfx/gradeDisplay.ts`, `components/hud/EndgameSummary.vue` — **modified**
- `apps/arena-client/src/vfx/scoreCalcDisplay.test.ts`, `vfx/gradeDisplay.test.ts`, `components/hud/EndgameSummary.test.ts` — **modified**

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green (+ new tests); replay/sentinel green (hash oracles byte-unchanged)
- [ ] `pnpm -r build`; `(cd apps/arena-client && pnpm vue-tsc --noEmit && pnpm test)` green
- [ ] `pnpm -r --no-bail test` — no new failures; `lagn-v1.json` CRLF churn reverted
- [ ] Live-on-surface (D-24026): endgame shows PAR derivation + grade scale (your row marked) + named penalties
- [ ] STATUS names WP-587 (+ hash-oracle outcome, D-24026 pending); DECISIONS D-24396 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`

## Common Failure Smells (Optional)
- `exactOptionalPropertyTypes` error assigning `parDerivation` → the optional field needs `| undefined` in its type.
- arena-client vue-tsc "Cannot find module @legendary-arena/preplan" / stale engine exports → run `pnpm -r build` first (arena-client imports built dist).
- A hash oracle moved → you touched a game-state field; scoring must not.
- The PAR line shows a fabricated escape weight → the symbolic fallback wasn't used for a non-derivable weight.
- The WP-584 component/vfx tests fail on `(6 × 300)` → update them to the named `(6 scheme twists × 300)` format.
