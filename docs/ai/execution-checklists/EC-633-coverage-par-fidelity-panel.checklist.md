# EC-633 — /coverage PAR Fidelity Panel (Execution Checklist)

**Source:** docs/ai/work-packets/WP-598-coverage-par-fidelity-panel.md
**Layer:** App (apps/dashboard) + build-time data bundle

## Before Starting
- [ ] WP-597 data on `main`: `data/par/profile/v1/fidelity-report.json` + 128 profiles
- [ ] `pnpm --filter @legendary-arena/dashboard build` exits 0
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` exits 0 (REQUIRED — vue-tsc)
- [ ] Scope lock: the CODE files are exactly the 12 code entries in `Files to
      Produce`; `docs/05-ROADMAP-MINDMAP.md` (also listed) and the other
      governance/closeout docs (STATUS, DECISIONS, WORK_INDEX, EC_INDEX) are the
      expected out-of-band edits, NOT code-scope violations

## Locked Values (do not re-derive)
- Source: `data/par/profile/v1/fidelity-report.json` (per scenario: `scenarioKey`,
  `winRate`, `lossRate`, `minWinningTurn` number|null, `monotoneImproving`,
  `stuckAtCapCount`, `binCount`, `sampleSize`, `tooEasyRank`; + `generatedAt`,
  `sample`, `scenarioCount`, `skipped[]`) and per-scenario profiles (`bins[]` =
  `{ turnCount, gameCount, medianRawScore, p25RawScore, p75RawScore, winRate,
  medianVictoryPoints }` + `winCount`/`lossCount`/`sampleSize`/`minWinningTurn`/`stuckAtCapCount`/`monotoneImproving`)
- scenarioKey → profile filename: `scenarioKey.replaceAll('::','--').replaceAll('+','_') + '.json'`
- `medianRawScore` / p25 / p75 can be NEGATIVE — chart y-axis must not assume ≥ 0
- Bundle shape (one combined file): `{ report, profiles: { [scenarioKey]: profile }, error? }`
- Chart lib: `echarts` + `vue-echarts` via `BaseChart.vue`; mirror `SweepTrendChart.vue`
  (theme colors via `getComputedStyle` + `dashboard-theme-change` refresh)

## Guardrails
- App/client typecheck is MANDATORY (`vue-tsc --noEmit`) — Before + After
- Read-only build-time bundle — NO runtime fetch, NO `mocks.ts` entry, NO
  server/API/engine change
- The build script NEVER throws — missing/malformed source → empty stub with an
  `error` field; the composable surfaces it as a legible empty panel
- Bundle is GITIGNORED + regenerated — add to `.gitignore` + `check-generated-data.mjs`;
  never commit `src/data/par-fidelity.json`
- NO new npm dependency; NO `zod` added to apps/dashboard — plain TS interface + cast
  (the `useCoverageLedger` form), not a zod schema
- Append a `<section>` to CoveragePage.vue reusing its scoped `.summary`/`.headline`/
  `.count-chip`/`.cov-table`/`.badge` classes — do NOT extract a new tile component
- Chart option logic lives in a PURE exported `buildParSweetSpotOption(profile,
  colors): EChartsOption` (`.ts`) and the TEST targets it directly — the dashboard
  runner (`node --import tsx --test`) cannot load `.vue` and has no
  `@vue/test-utils`/`jsdom`, so NEVER mount the component in a test (the
  `DrReadinessWidget.test.ts` "test the data contract, not the mount" precedent);
  `ParSweetSpotChart.vue` only resolves theme colors + delegates
- Report rows live at `report.scenarios` (array); the `ParProfile`/`ParFidelityReport`
  interfaces declare only the consumed subset (the cast tolerates extra fields)
- Label the panel a FIDELITY DIAGNOSTIC (a caption), never competitive PAR
- Add a `prebuild:par` step to the ci.yml Dashboard Gates job BEFORE typecheck, or
  the new static import won't resolve in CI
- STOP (do not improvise) if a dashboard/ECharts API differs from the WP — surface it

## Required `// why:` Comments
- the too-easy threshold in `useParFidelity` (what winRate counts as "too easy")
- the never-throw + empty-stub in `build-par-fidelity.mjs` (a missing source must
  not break the dashboard build)
- the chart y-axis allowing negatives (medianRawScore is a golf score; lower better)

## Files to Produce
- `apps/dashboard/scripts/build-par-fidelity.mjs` — **new** — bundle builder
- `apps/dashboard/src/types/parFidelity.ts` — **new** — TS interfaces
- `apps/dashboard/src/composables/useParFidelity.ts` — **new** — cast composable
- `apps/dashboard/src/components/charts/parSweetSpotOption.ts` — **new** — pure `buildParSweetSpotOption(profile, colors)` (the testable option logic)
- `apps/dashboard/src/components/charts/ParSweetSpotChart.vue` — **new** — thin wrapper (resolve theme colors → `buildParSweetSpotOption` → `BaseChart`)
- `apps/dashboard/src/pages/coverage/CoveragePage.vue` — **modified** — the panel section
- `apps/dashboard/package.json` — **modified** — `prebuild:par` + build chain + pretest guard
- `apps/dashboard/.gitignore` — **modified** — the generated bundle
- `apps/dashboard/scripts/check-generated-data.mjs` — **modified** — bundle guard entry
- `.github/workflows/ci.yml` — **modified** — `prebuild:par` step in Dashboard Gates
- `apps/dashboard/src/composables/useParFidelity.test.ts` — **new** — composable tests
- `apps/dashboard/src/components/charts/parSweetSpotOption.test.ts` — **new** — pure option-builder tests (no `.vue` mount)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip the WP-598 node glyph

## After Completing
- [ ] `pnpm --filter @legendary-arena/dashboard prebuild:par` writes the bundle
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/dashboard test:coverage` passes (lines 90 / branches 80 / functions 88)
- [ ] `pnpm --filter @legendary-arena/dashboard build` exits 0
- [ ] Live-on-surface (D-24026): the panel renders on the deployed
      dashboard.legendary-arena.com/coverage (tiles + table + click-to-expand curve)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — D-24407 flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-598 checked off; `EC_INDEX.md` EC-633 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅`, then `pnpm roadmap:counts:write`;
      `pnpm roadmap:counts:check` exits 0

## Common Failure Smells
- CI Dashboard Gates fails at typecheck/build "cannot find module ../data/par-fidelity.json"
  → the `prebuild:par` step was not added to ci.yml before typecheck
- Local `pnpm test` crashes on the missing bundle → `check-generated-data.mjs` /
  `pretest` guard was not extended
- The curve renders clipped/empty for negative scores → the y-axis was set `min: 0`
- Coverage thresholds fail → the new composable/chart lack fixture-injected tests
