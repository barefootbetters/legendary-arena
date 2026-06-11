# WP-235 — Pipeline Page Sweep Trend View (Cadence-Aware Multi-Run Anomaly Trends)

**Status:** Draft
**Primary Layer:** App (`apps/dashboard/**` only). No Game Engine / Registry / Server / migration change — the sweep read endpoint (`GET /api/sweep/latest`), the `sweep_runs` store, and the `useSweepHealth` composable already exist and are reused unchanged.
**Dependencies:** WP-230 (`useSweepHealth` composable + the Pipeline page sweep wiring + `deriveTrendDirection`) ✅, WP-209 (`GET /api/sweep/latest` returning `{ latest, recentRuns[≤30] }` via `fetchRecentSweepRuns`) ✅, WP-195 (the 4-class anomaly taxonomy classifier) ✅, WP-204 (the dashboard ECharts surface `BaseChart.vue`) ✅, WP-234 (the weekly full-corpus sweep + its **`-weekly-w<windowIndex>` runId grammar** that makes cadence segmentation meaningful) ✅. Parallel-safe with WP-231/232/233/236 (App-layer-only; touches no engine/server/handoff/inspection file).

---

## Goal

After this session the dashboard's Pipeline page renders a **cadence-aware sweep trend view**: a multi-run chart of the per-cell **anomaly rate** across the last 30 sweep runs, with the **daily 2×2 smoke** runs and the **weekly full-corpus** runs (WP-234) visually distinguished. The trend reuses the existing `recentRuns` payload (`GET /api/sweep/latest` → `useSweepHealth`) — no new endpoint, server function, or migration. Because the daily smoke (4 cells) and the weekly sweep (~2,120 cells) both land in `legendary.sweep_runs` with wildly different cell counts, the trend is **rate-normalized** (anomalies ÷ cellCount) so the magnitude gap does not dominate, and runs are segmented by **cadence derived from the runId suffix** so the operator can see whether the deeper weekly sweep's anomaly rate is trending up or down across the 10-run rotation cycle, and which window each weekly run covered.

---

## Assumes

- WP-230 complete. Specifically:
  - `apps/dashboard/src/composables/useSweepHealth.ts` exposes `recentRuns: ComputedRef<readonly SweepRunSummary[]>` (up to 30, most-recent-first) and `totalAnomalySparkline`, and is a pure function of `(fetchStateGetter, currentTimeMs)` (no internal `Date.now()`).
  - `apps/dashboard/src/pages/pipeline/PipelinePage.vue` already samples `Date.now()` once at the render boundary, constructs the sweep fetch state, calls `useSweepHealth`, and renders a sweep summary bar + sparkline (the trend chart slots into this existing section).
- WP-209 complete. `GET /api/sweep/latest` (authenticated-session) returns `{ data: { latest: SweepRunSummary | null, recentRuns: SweepRunSummary[] } }`; `SweepRunSummary = { runId, submittedAt, startedAt, cellCount, anomalyCounts: Record<string, number> }` (anomaly keys widened to `string`, D-20703). `fetchRecentSweepRuns` returns up to 30 rows ordered `submitted_at DESC`.
- WP-234 complete. The weekly combine submits runIds of form `<shortSha>-<compactTimestampUtc>-weekly-w<windowIndex>`; the daily smoke submits `<shortSha>-<compactTimestampUtc>` (no suffix). The `-weekly-w<N>` suffix is the documented, operator-auditable cadence + rotation-window signal (WP-234 §Locked Contract Values, D-23402: "an operator can audit the rotation from `sweep_runs` alone").
- WP-204 complete. `apps/dashboard/src/components/charts/BaseChart.vue` wraps `vue-echarts` (`VChart`) with a declarative `EChartsOption` prop; `echarts` + `vue-echarts` are already dependencies (no new npm dep).
- `apps/dashboard` has `test` (`node --import tsx --test src/**/*.test.ts`), `typecheck` (`vue-tsc --noEmit`), and `build` (`vite build`) scripts; all three currently exit 0 (the executor records the baseline — including any **pre-existing** `vue-tsc` errors — before coding; see Context).

Baseline: `origin/main @ 41dcdce` (WP-234 + the roadmap reconcile landed 2026-06-10/11).

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Session Context

WP-230 wired sweep data into the Pipeline page's agent lanes and added a single-series sparkline of total anomalies. WP-234 then added a **weekly full-corpus sweep** alongside the daily 2×2 smoke. Both cadences write to the same `legendary.sweep_runs` table, so the `recentRuns` window an operator now sees is a **mix of two run shapes**:

- **daily smoke** — 4 cells (2 schemes × 2 masterminds), runId `<sha>-<ts>`, near-always 0 anomalies (it is a "did anything fundamentally break?" smoke).
- **weekly full-corpus** — ≤ 2,120 cells (a 20-scheme rotating window × 106 masterminds), runId `<sha>-<ts>-weekly-w<N>`, the cadence that actually surfaces anomalies across the corpus.

A naive trend that plots **raw** total-anomaly counts or cell counts across `recentRuns` is a meaningless sawtooth — the occasional weekly run's ~2,120 cells dwarfs the daily 4-cell runs. The fix is the knowledge WP-234 deliberately built in: the weekly runId carries a disjoint `-weekly-w<N>` suffix **specifically so the two cadences are distinguishable in `sweep_runs`**. WP-235 consumes that suffix to (a) **segment** the trend by cadence and (b) plot a **per-cell rate** (anomalies ÷ cellCount) that is comparable across cadences. The result answers the operator question the raw sparkline cannot: *is the deep weekly sweep's anomaly rate trending up or down as the rotation advances through the corpus?*

**Scope discipline.** The WP-235 placeholder listed a menu of candidate features (health-rate-over-time, anomaly-class breakdown, new-vs-resolved per run, Builder velocity) and two open decisions (chart library, tab-vs-inline). This WP resolves the open decisions — **reuse `BaseChart.vue` (ECharts); render inline** in the existing Pipeline sweep section — and scopes v1 to the **cadence-aware rate trend** (the highest-value slice, and the one the WP-234 knowledge directly motivates). New-vs-resolved-per-run and Builder-velocity analytics are deferred (§Out of Scope + §Future Work) to keep v1 a tight, single-layer read-path change.

**Pre-existing dashboard typecheck drift (read before coding).** `apps/dashboard` `vue-tsc` errors have historically shipped to `main` because `typecheck` was not in prior WP DoDs (WP-229/WP-230 era). This WP puts `typecheck` (`vue-tsc --noEmit`) **explicitly in the DoD + Acceptance Criteria**. The executor MUST record the `typecheck` baseline at session start; WP-235 must not *add* a `vue-tsc` error, but a pre-existing failing baseline is documented (not silently inherited or "fixed" out of scope).

---

## Scope (In)

### A) Cadence + trend derivation (`apps/dashboard/src/composables/useSweepTrend.ts` — NEW)

- Pure helper `classifyRunCadence(runId)` → `{ cadence: 'weekly' | 'daily', windowIndex: number | null }`. A runId matching `/-weekly-w(\d+)$/` is `weekly` with the parsed `windowIndex`; any other runId is `daily` with `windowIndex = null`. Operates on the **runId string grammar only** (WP-209 + WP-234 contract) — never on the anomaly taxonomy keys (opaque, D-20703) or on `cellCount` magnitude.
- Pure helper `deriveSweepTrendPoints(recentRuns)` → `readonly SweepTrendPoint[]` ordered **oldest → newest** (the server returns most-recent-first; the trend reverses for left-to-right time). Each `SweepTrendPoint = { runId, submittedAt, cadence, windowIndex, cellCount, totalAnomalies, anomalyRate }` where `totalAnomalies` = sum of `anomalyCounts` values (explicit `for...of`, no `.reduce()` per code-style) and `anomalyRate = cellCount > 0 ? totalAnomalies / cellCount : 0` (the `cellCount > 0` guard makes a 0-cell run — e.g. a clamped weekly tail — rate 0, never a divide-by-zero `NaN`).
- A thin `useSweepTrend(recentRunsGetter)` composable wrapping the helpers into the `ComputedRef`s the page consumes, mirroring `useSweepHealth`'s pure-function discipline (a function of its inputs; no internal `Date.now()`).
- No `.reduce()` in any helper; explicit `for...of` / `.map` / `.filter`; full-word names; a `// why:` documenting that cadence derives from the runId suffix grammar (a WP-209/WP-234 contract), NOT from cellCount or the opaque anomaly keys (D-23502).

### B) Trend chart component (`apps/dashboard/src/components/charts/SweepTrendChart.vue` — NEW)

- Consumes `SweepTrendPoint[]` (a prop), assembles a declarative `EChartsOption`, and renders via the existing `BaseChart.vue`. Plots `anomalyRate` over `submittedAt` with the **daily** and **weekly** runs as two distinguished series (distinct color/symbol), so the cadence split is visually obvious and the rate axis is comparable across both. Tooltip surfaces cadence, `windowIndex` (for weekly), `cellCount`, and `totalAnomalies` per point.
- Renders nothing meaningful for an empty point set (delegates the empty/loading state to the page, matching the existing summary-bar gating).
- No hardcoded `SweepAnomalyClass` union member; anomaly magnitude is consumed only as the pre-summed `totalAnomalies` / `anomalyRate` numbers.

### C) Pipeline page wiring (`apps/dashboard/src/pages/pipeline/PipelinePage.vue` — MODIFIED)

- Inline-render `SweepTrendChart` in the existing sweep section (below the summary bar + sparkline), gated on the same `hasSweepData` condition. Derive the points via `useSweepTrend` from the existing `recentRuns` (no new fetch, no new `Date.now()` read).

### D) Mock cadence mix (`apps/dashboard/src/services/sweepHealthMocks.ts` — MODIFIED)

- The 30 deterministic mock runs become a realistic **daily + weekly mix**: most runs daily-style (small `cellCount`, runId without a weekly suffix), with periodic weekly runs (runId `…-weekly-w<N>` cycling the window index, `cellCount` ~2,000) so the cadence segmentation + rate normalization are demonstrable in MOCK mode. Deterministic seeding + the 36h-freshness spacing are preserved.

### E) Tests (`apps/dashboard/src/composables/useSweepTrend.test.ts` — NEW)

- `node:test` cases (≥ 8): `classifyRunCadence` for a weekly suffix (with window index), a daily runId (null window), and a non-matching/edge runId; `deriveSweepTrendPoints` oldest→newest ordering, the `anomalyRate` computation, the 0-cell divide-by-zero guard, a mixed daily+weekly input, and an empty input; plus a mock-data assertion that `sweepHealthMocks` now contains both cadences.

### F) Decisions

- Reserve **D-23501** (sweep trend view is a client-side projection over the existing 30-run `recentRuns`: reuses `GET /api/sweep/latest` + `useSweepHealth`; inline in the Pipeline page; chart via `BaseChart.vue`/ECharts — NO new endpoint/server/migration/dep) and **D-23502** (cadence segmentation + rate normalization: cadence derives from the `-weekly-w<N>` runId suffix grammar — a WP-209/WP-234 contract, NOT cellCount magnitude or the opaque anomaly taxonomy, D-20703 preserved; the trend metric is per-cell `anomalyRate` so the daily-4-cell vs weekly-~2,120-cell magnitude gap does not dominate).

---

## Out of Scope

- **New-vs-resolved anomaly count per run + Builder velocity analytics** — deferred (§Future Work). v1 is the cadence-aware rate trend only; cross-run anomaly diffing (which anomalies appeared/cleared between runs) is a richer analysis that would benefit from the per-cell manifest, not just the summary `anomalyCounts`.
- **A per-anomaly-class breakdown chart** (stacked series by taxonomy key) — deferred. v1 plots the aggregate rate; the dashboard treats anomaly keys opaquely (D-20703), and a class-keyed chart needs a deliberate opaque-key legend design.
- **A dedicated Trends tab / route** — explicitly NOT built; the trend renders inline in the existing Pipeline sweep section (resolves the placeholder's open decision toward the lower-surface option).
- **Any new HTTP endpoint, server function, `sweep_runs` column, or migration** — the trend is a pure client projection over the existing `recentRuns` payload. `GET /api/sweep/latest`, `fetchRecentSweepRuns`, and `useSweepHealth` are reused unchanged.
- **A new charting dependency** — reuses the existing `echarts` / `vue-echarts` via `BaseChart.vue` (WP-204). No `package.json` dependency change.
- **Changing the 30-run LIMIT** — the trend consumes whatever `recentRuns` carries (≤ 30, locked by EC-241); raising the window is a separate WP touching the server query.
- **Parsing or rendering the `manifestBlob`** — the dashboard read path is blob-free (forensic blob is CI-only); the trend uses summary fields only.
- Engine / Registry / Server / Pre-Plan changes; cross-repo work.

---

## Files Expected to Change

- `apps/dashboard/src/composables/useSweepTrend.ts` — new (`classifyRunCadence`, `deriveSweepTrendPoints`, `useSweepTrend`; no `.reduce()`; cadence-from-runId `// why:`)
- `apps/dashboard/src/components/charts/SweepTrendChart.vue` — new (ECharts trend via `BaseChart.vue`; daily/weekly distinguished; rate-normalized)
- `apps/dashboard/src/pages/pipeline/PipelinePage.vue` — modified (inline-render the trend chart in the existing sweep section)
- `apps/dashboard/src/services/sweepHealthMocks.ts` — modified (30 mock runs become a daily + weekly cadence mix)
- `apps/dashboard/src/composables/useSweepTrend.test.ts` — new (≥ 8 `node:test` cases)
- `docs/ai/DECISIONS.md` — modified (D-23501 + D-23502 reserved → Active at execution close)
- `docs/ai/STATUS.md` — modified (Done entry, at execution close)
- `docs/ai/work-packets/WORK_INDEX.md` — modified (WP-235 row → Done, at execution close)
- `docs/ai/execution-checklists/EC_INDEX.md` — modified (EC-268 → Done, at execution close)
- `docs/05-ROADMAP-MINDMAP.md` — modified (WP-235 📝 → ✅, at execution close)

10 files total at execution: 5 source/data/test (all `apps/dashboard/**`) + 5 governance. No engine/server/registry/migration change, no new endpoint, no new dependency. (A `apps/dashboard/src/types/sweep.ts` addition for the client-only `SweepTrendPoint` type is permitted if the executor prefers a shared type file over an inline export — same App layer, additive; noted here so it is not an out-of-allowlist surprise.)

---

## Locked Contract Values

- **Cadence grammar (locked):** `classifyRunCadence(runId)` matches `/-weekly-w(\d+)$/` → `{ cadence: 'weekly', windowIndex: <parsed int> }`; any other runId → `{ cadence: 'daily', windowIndex: null }`. This mirrors the WP-234 weekly runId suffix and the WP-209 daily runId (no suffix). The match is on the runId string only.
- **Trend metric (locked):** `anomalyRate = cellCount > 0 ? totalAnomalies / cellCount : 0`; `totalAnomalies` = sum of the `anomalyCounts` record's values. Rate-normalized so the daily-4-cell vs weekly-~2,120-cell magnitude gap does not dominate the chart. A 0-cell run yields rate 0 (no `NaN`).
- **Ordering (locked):** `deriveSweepTrendPoints` returns points **oldest → newest** (reversing the server's most-recent-first `recentRuns`) so the chart's x-axis reads left-to-right in time. Within an equal-timestamp tie the input order is preserved (stable).
- **Data source (locked):** the existing `recentRuns` (≤ 30) from `useSweepHealth` / `GET /api/sweep/latest`. No new fetch, endpoint, store function, or migration. No change to the 30-run LIMIT.
- **Opaque anomaly keys (locked, D-20703 carry-forward):** anomaly counts are summed across keys as opaque `Record<string, number>` values; NO `SweepAnomalyClass` union member is hardcoded in the dashboard. Cadence is NOT inferred from the anomaly taxonomy or from `cellCount` magnitude — only from the runId suffix.
- **Charting (locked):** reuse `BaseChart.vue` (`vue-echarts` / `echarts`, WP-204). No new charting dependency. Inline in the Pipeline page; no new route/tab.
- **Purity (locked):** `useSweepTrend` and its helpers are pure functions of their inputs — no internal `Date.now()` (the page already samples the clock once at the render boundary, WP-204 discipline).

---

## Acceptance Criteria

1. `classifyRunCadence('abc1234-20260614T080000Z-weekly-w7')` → `{ cadence: 'weekly', windowIndex: 7 }`; `classifyRunCadence('abc1234-20260614T070000Z')` → `{ cadence: 'daily', windowIndex: null }` — verified by unit tests (incl. an edge runId that does not match the suffix).
2. `deriveSweepTrendPoints(recentRuns)` returns points ordered oldest → newest, each carrying `cadence`, `windowIndex`, `cellCount`, `totalAnomalies`, and `anomalyRate = totalAnomalies / cellCount` — verified by a unit test over a mixed daily+weekly input.
3. A 0-cell run yields `anomalyRate === 0` (no `NaN` / divide-by-zero); an empty `recentRuns` yields `[]` — verified by unit tests.
4. The Pipeline page renders `SweepTrendChart` inline in the sweep section when sweep data is present, and renders no chart when there are no runs — verified by a render/snapshot or a `hasSweepData`-gating assertion.
5. The chart distinguishes daily-smoke from weekly-full-corpus runs (two series) and is rate-normalized (`anomalyRate`), so the ~2,120-cell weekly runs do not dwarf the 4-cell daily runs — verified by the derive unit test (rates comparable) + the chart option assembling two series keyed by cadence.
6. MOCK mode shows a realistic daily + weekly mix: `sweepHealthMocks` contains both runIds without a weekly suffix AND runIds matching `-weekly-w<N>` with a larger `cellCount` — verified by a mock-data assertion test.
7. Anomaly keys remain opaque: no `SweepAnomalyClass` union member is hardcoded in `apps/dashboard`; cadence derives from the runId suffix, not from `cellCount` or the taxonomy — verified by grep (no taxonomy literals in the new files) + the cadence-classifier unit test.
8. No new npm dependency; no `apps/server/**`, `packages/**`, `data/migrations/**`, `render.yaml`, or `.env.example` change; `GET /api/sweep/latest` + `useSweepHealth` reused unchanged — verified by `git diff --name-only` (only the allowlist) + `git diff package.json` (empty) + `git diff apps/dashboard/package.json` (empty).
9. `pnpm --filter @legendary-arena/dashboard test` exits 0 with ≥ 8 net-new cases (all pre-existing green); `pnpm --filter @legendary-arena/dashboard typecheck` (`vue-tsc --noEmit`) exits 0 with NO new error vs the recorded baseline; `pnpm --filter @legendary-arena/dashboard build` exits 0.

---

## Verification Steps

```pwsh
# 1. Cadence + trend helpers present, no reduce
Select-String -Path "apps\dashboard\src\composables\useSweepTrend.ts" -Pattern "classifyRunCadence|deriveSweepTrendPoints|anomalyRate|-weekly-w"
# Expected: >= 4 lines
(Select-String -Path "apps\dashboard\src\composables\useSweepTrend.ts" -Pattern "\.reduce\(").Count
# Expected: 0

# 2. Opaque anomaly keys — no engine taxonomy literal in the new files
Select-String -Path "apps\dashboard\src\composables\useSweepTrend.ts","apps\dashboard\src\components\charts\SweepTrendChart.vue" -Pattern "endgame-reached|not-endgame|escaped-villain-cap|SweepAnomalyClass"
# Expected: no output

# 3. Chart reuses BaseChart (no new dep)
Select-String -Path "apps\dashboard\src\components\charts\SweepTrendChart.vue" -Pattern "BaseChart"
# Expected: >= 1 line
git diff apps/dashboard/package.json package.json
# Expected: no output

# 4. Mock cadence mix present
Select-String -Path "apps\dashboard\src\services\sweepHealthMocks.ts" -Pattern "weekly-w"
# Expected: >= 1 line

# 5. Scope boundary — dashboard only, no server/engine/migration
git diff --name-only apps/server/ packages/ data/migrations/ render.yaml .env.example
# Expected: no output

# 6. Tests + typecheck + build
pnpm --filter @legendary-arena/dashboard test 2>&1 | Select-Object -Last 3
pnpm --filter @legendary-arena/dashboard typecheck
pnpm --filter @legendary-arena/dashboard build
```

---

## Definition of Done

- [ ] All 9 Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output
- [ ] `pnpm --filter @legendary-arena/dashboard test` exits 0 (≥ 8 net-new; pre-existing green)
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` (`vue-tsc --noEmit`) exits 0 — NO new error vs the baseline recorded at session start
- [ ] `pnpm --filter @legendary-arena/dashboard build` exits 0
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`)
- [ ] No `apps/server/**`, `packages/**`, `data/migrations/**`, `render.yaml`, `.env.example` modified; no new npm dependency
- [ ] `GET /api/sweep/latest` + `useSweepHealth` reused unchanged (no server/composable contract edit)
- [ ] `docs/ai/STATUS.md` updated — the Pipeline page shows a cadence-aware multi-run sweep trend; daily smoke + weekly full-corpus distinguished
- [ ] `docs/ai/DECISIONS.md` updated — D-23501 (client-projection scope) + D-23502 (cadence + rate normalization) flipped Reserved → Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-235 checked off with today's date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-268 flipped Pending → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-235 flipped 📝 → ✅

---

## Vision Alignment

**Vision clauses touched:** §20-26 (scoring/PAR/simulation — the sweep is QA simulation; this WP visualizes its trend), §22 (determinism/replay).

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.` It is an operator-only dashboard read surface. It changes no game logic, no RNG sourcing, no scoring math, no replay storage. It adds no wall-clock read (the page already samples the clock once at the render boundary); the helpers are pure functions of `recentRuns`.

**Non-Goal proximity check:** none of NG-1..7 crossed — no user-facing, paid, persuasive, competitive, or monetization surface. The Pipeline page is an authenticated operator dashboard.

**Determinism preservation:** the engine + per-cell sweep determinism is untouched (§22); the trend is a read-only projection of already-classified `sweep_runs` summaries.

---

## Funding Surface Gate

**N/A — operator dashboard surface only; no global navigation, Registry Viewer, profile/account, or tournament funding affordances; no user-visible monetization copy.** None of the §20.1 trigger surfaces are present.

---

## API Catalog Update

**N/A — no HTTP endpoint added, modified, removed, or status-changed.** The trend view reuses the existing `GET /api/sweep/latest` (WP-209, already catalogued) with no contract change. §21.1 is not triggered (D-11804 obligation does not apply).

---

## Lint Gate Self-Review

Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`, all 21 sections reviewed 2026-06-10:

| § | Verdict | Note |
|---|---|---|
| 1 | PASS | All required sections present; Out of Scope lists ≥ 6 explicit exclusions (new-vs-resolved/velocity analytics, per-class breakdown, dedicated tab, new endpoint/migration, new dep, 30-run-LIMIT change, manifestBlob) |
| 2 | PASS | Locked values explicit: cadence grammar `/-weekly-w(\d+)$/`, rate metric + 0-cell guard, oldest→newest ordering, reuse of `recentRuns`/`BaseChart.vue`, opaque-key + purity locks |
| 3 | PASS | WP-230/209/195/204/234 deps listed with the exact reused exports (`useSweepHealth.recentRuns`, `GET /api/sweep/latest`, `BaseChart.vue`, the `-weekly-w<N>` runId grammar) |
| 4 | PASS | useSweepHealth / PipelinePage / sweepHealthMocks / BaseChart / D-20703 / WP-234 runId grammar all cited specifically |
| 5 | PASS | 10 files with new/modified disposition; App-layer-only; the optional `types/sweep.ts` addition pre-noted so it is not out-of-allowlist |
| 6 | PASS | New names (`classifyRunCadence`, `deriveSweepTrendPoints`, `useSweepTrend`, `SweepTrendPoint`, `anomalyRate`) full-word camelCase; `runId`/`cellCount`/`anomalyCounts`/`submittedAt` reused verbatim |
| 7 | PASS | No new npm dep; reuses existing `echarts`/`vue-echarts` via `BaseChart.vue` |
| 8 | PASS | App layer only; no `@legendary-arena/game-engine` import; no `G`/`ctx`; reads only the read-path projection |
| 9 | PASS | PowerShell verification commands; Vue SFC + TS; `node:test` runner |
| 10 | PASS | No secrets; reuses the existing authenticated read endpoint (no new token/secret) |
| 11 | PASS | No player-identity surface; operator-only dashboard; `## Out of Scope` serves as the limitations note |
| 12 | PASS | Tests use `node:test`; no boardgame.io; the LLM-nondeterministic finding text is never asserted (only cadence parse, rate math, ordering, mock-mix shape) |
| 13 | PASS | 6 exact `Select-String`/`git`/`pnpm` verification commands with expected output |
| 14 | PASS | 9 binary, observable acceptance criteria aligned to deliverables |
| 15 | PASS | DoD includes STATUS / DECISIONS / WORK_INDEX / EC_INDEX / ROADMAP + scope-boundary + the explicit `typecheck` gate |
| 16 | PASS | No premature abstraction — reuses `useSweepHealth` / `BaseChart.vue` / `deriveTrendDirection` precedent; `classifyRunCadence` / `deriveSweepTrendPoints` are single-purpose helpers; explicit `for...of` (no reduce); `// why:` on the cadence-from-runId lock |
| 17 | PASS | `## Vision Alignment` present with clause numbers + no-conflict + determinism-preservation |
| 18 | PASS | Verification greps target literal tokens (`classifyRunCadence`, `-weekly-w`, `BaseChart`, `weekly-w`) and a forbidden-token grep scoped to the two new files (no whole-file token grep that a legitimate identifier could self-trip) |
| 19 | N/A | No repo-state-summarizing artifact authored in this WP draft |
| 20 | N/A | Operator dashboard only; no funding surfaces (justified above) |
| 21 | N/A | No HTTP endpoint added/modified/removed — `GET /api/sweep/latest` reused unchanged (justified in `## API Catalog Update`) |

---

## Future Work Packets (Scoped From This Foundation)

- **New-vs-resolved anomaly diff per run** — a cross-run delta view (which anomaly cells appeared / cleared between consecutive runs); needs the per-cell `manifestBlob`, not just summary `anomalyCounts`, so it pairs with a blob-bearing read path.
- **Builder velocity overlay** — time-from-anomaly-appearance to handoff-resolution, joining `sweep_runs` trends with the WP-232/233 `finding_handoffs` lifecycle.
- **Per-anomaly-class trend breakdown** — a stacked-by-taxonomy-key chart with an opaque-key legend (D-20703-respecting).
- **Rotation-coverage view** — using the `-w<windowIndex>` suffix to show which of the 10 weekly windows have run in the current cycle (realizing WP-234's "audit the rotation from `sweep_runs` alone" intent as an explicit coverage grid).
