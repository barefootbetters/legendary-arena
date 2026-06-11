# EC-268 — Pipeline Page Sweep Trend View (Execution Checklist)

**Source:** docs/ai/work-packets/WP-235-pipeline-sweep-trend-view.md
**Layer:** App (`apps/dashboard/**` only). No Game Engine / Registry / Server / migration change.

> Use locked values from WP-235 verbatim. EC-268 is the operational order +
> gates + failure smells; if EC-268 and WP-235 conflict, WP-235 wins.

## Before Starting
- [ ] **WP-230 landed.** `apps/dashboard/src/composables/useSweepHealth.ts` exposes `recentRuns` (≤ 30, most-recent-first); the Pipeline page renders a sweep summary bar + sparkline and samples `Date.now()` once at the render boundary.
- [ ] **WP-209 read path present.** `GET /api/sweep/latest` returns `{ latest, recentRuns[] }`; `SweepRunSummary = { runId, submittedAt, startedAt, cellCount, anomalyCounts: Record<string, number> }` (keys widened to `string`, D-20703).
- [ ] **WP-234 runId grammar present.** Weekly runIds end `-weekly-w<windowIndex>`; daily smoke runIds have no suffix. This is the cadence signal.
- [ ] **Charting present.** `apps/dashboard/src/components/charts/BaseChart.vue` (`vue-echarts`/`echarts`) exists; `echarts`/`vue-echarts` are already deps (no new dep).
- [ ] Read WP-235 §Goal, §Session Context, §Scope (In/Out), §Locked Contract Values, §Acceptance Criteria.
- [ ] **Record the dashboard baseline:** `pnpm --filter @legendary-arena/dashboard test`, `… typecheck` (`vue-tsc --noEmit`), `… build` all exit 0. Note the pre-existing case count AND any pre-existing `vue-tsc` errors (do NOT fix out of scope; do NOT add new ones).

## Locked Values (verbatim from WP-235 — do not re-derive)
- **Cadence grammar:** `classifyRunCadence(runId)` → runId matching `/-weekly-w(\d+)$/` ⇒ `{ cadence: 'weekly', windowIndex: <int> }`; otherwise `{ cadence: 'daily', windowIndex: null }`. Match on the runId STRING only.
- **Trend metric:** `totalAnomalies` = sum of `anomalyCounts` values (explicit `for...of`, no `.reduce()`); `anomalyRate = cellCount > 0 ? totalAnomalies / cellCount : 0` (the guard makes a 0-cell run rate 0, never `NaN`). Rate-normalized so the daily-4-cell vs weekly-~2,120-cell magnitude gap does not dominate.
- **Ordering:** `deriveSweepTrendPoints` returns points **oldest → newest** (reverse the server's most-recent-first `recentRuns`); equal-timestamp ties keep input order (stable).
- **`SweepTrendPoint`:** `{ runId, submittedAt, cadence, windowIndex, cellCount, totalAnomalies, anomalyRate }`.
- **Data source:** the existing `recentRuns` (≤ 30) from `useSweepHealth`. NO new fetch / endpoint / store function / migration; NO change to the 30-run LIMIT.
- **Charting:** reuse `BaseChart.vue` (ECharts); render INLINE in the Pipeline sweep section; NO new route/tab; NO new dependency.
- **Purity:** `useSweepTrend` + helpers are pure functions of inputs — no internal `Date.now()` (the page samples the clock once at the render boundary).
- **Opaque keys (D-20703):** sum anomaly counts as opaque `Record<string, number>`; NO `SweepAnomalyClass` union member in the dashboard; cadence is NOT from the taxonomy or from `cellCount` magnitude.

## Guardrails
- **App layer only.** Touch only `apps/dashboard/**`. No `apps/server/**`, `packages/**`, `data/migrations/**`, `render.yaml`, `.env.example`. No `@legendary-arena/game-engine` import.
- **Reuse the read path.** `GET /api/sweep/latest`, `fetchRecentSweepRuns`, and `useSweepHealth` are byte-unchanged — the trend is a pure client projection over `recentRuns`.
- **No new dependency.** Chart via the existing `BaseChart.vue`/ECharts; `git diff package.json apps/dashboard/package.json` must be empty.
- **Cadence from the runId suffix ONLY** — never from `cellCount` magnitude (fragile threshold) or the anomaly taxonomy keys (opaque, D-20703).
- **Rate-normalize.** Plot `anomalyRate`, not raw counts — raw counts make the daily/weekly mix a meaningless sawtooth.
- **No `.reduce()`** in `classifyRunCadence` / `deriveSweepTrendPoints` — explicit `for...of` / `.map` / `.filter`.
- **`typecheck` is a DoD gate.** `vue-tsc --noEmit` must exit 0 with no NEW error vs the recorded baseline (dashboard typecheck has drifted silently before — do not add to it).
- **Purity preserved.** No new `Date.now()` read; the helpers are functions of `recentRuns` only.

## Required `// why:` Comments
- `useSweepTrend.ts` (cadence source) — cadence derives from the `-weekly-w<N>` runId suffix grammar (a WP-209 + WP-234 contract), NOT from `cellCount` magnitude or the opaque anomaly taxonomy keys (D-23502 / D-20703 preserved).
- `useSweepTrend.ts` (rate guard) — `cellCount > 0` guards the `anomalyRate` division so a 0-cell run (a clamped weekly tail) is rate 0, never a `NaN` that breaks the chart axis.
- `SweepTrendChart.vue` (two series) — daily-smoke and weekly-full-corpus runs are plotted as distinct series because they are different sweep cadences sharing one `sweep_runs` table; the rate normalization makes their y-values comparable (D-23501/D-23502).

## Files to Produce
- `apps/dashboard/src/composables/useSweepTrend.ts` — **new** (`classifyRunCadence`, `deriveSweepTrendPoints`, `useSweepTrend`).
- `apps/dashboard/src/components/charts/SweepTrendChart.vue` — **new** (ECharts trend via `BaseChart.vue`; daily/weekly distinguished; rate-normalized).
- `apps/dashboard/src/pages/pipeline/PipelinePage.vue` — **modified** (inline-render the trend chart in the existing sweep section).
- `apps/dashboard/src/services/sweepHealthMocks.ts` — **modified** (30 mock runs → daily + weekly cadence mix).
- `apps/dashboard/src/composables/useSweepTrend.test.ts` — **new** (≥ 8 `node:test` cases).
- `docs/ai/DECISIONS.md` — **modified** (D-23501 + D-23502 Active at close).
- `docs/ai/STATUS.md` — **modified** (at close).
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (WP-235 `[x]` at close).
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (EC-268 → Done at close).
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (WP-235 📝 → ✅ at close).

**Total: 10 files** (5 App-layer source/data/test + 5 governance). An additive `apps/dashboard/src/types/sweep.ts` `SweepTrendPoint` export is permitted (same layer) if preferred over an inline type.

## After Completing
- [ ] `pnpm --filter @legendary-arena/dashboard test` exits 0; ≥ 8 net-new cases (cadence parse incl. weekly/daily/edge; rate math; 0-cell guard; oldest→newest order; mixed input; empty input; mock-mix assertion); NO pre-existing case regresses.
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` exits 0 — no NEW `vue-tsc` error vs baseline.
- [ ] `pnpm --filter @legendary-arena/dashboard build` exits 0.
- [ ] Helpers + grammar: `grep -nE "classifyRunCadence|deriveSweepTrendPoints|-weekly-w" apps/dashboard/src/composables/useSweepTrend.ts` ≥ 3; `.reduce(` = 0 in that file.
- [ ] Opaque keys: no `endgame-reached|not-endgame|escaped-villain-cap|SweepAnomalyClass` literal in `useSweepTrend.ts` / `SweepTrendChart.vue`.
- [ ] Reuse: `BaseChart` referenced in `SweepTrendChart.vue`; `git diff package.json apps/dashboard/package.json` empty.
- [ ] Mock mix: `grep -n "weekly-w" apps/dashboard/src/services/sweepHealthMocks.ts` ≥ 1.
- [ ] Scope: `git diff --name-only` lists only the 10 Files-to-Produce; no `apps/server/**`, `packages/**`, `data/migrations/**`, `render.yaml`, `.env.example`; no new dep.
- [ ] `STATUS.md`, `DECISIONS.md` (D-23501..02 Active), `WORK_INDEX.md` (WP-235 `[x]`), `EC_INDEX.md` (EC-268 Done), `05-ROADMAP-MINDMAP.md` (WP-235 ✅) updated.

## Common Failure Smells
- Plotting raw `totalAnomalies` / `cellCount` instead of `anomalyRate` → the daily/weekly mix becomes a meaningless sawtooth (the weekly ~2,120 cells dwarf the daily 4).
- Inferring cadence from `cellCount` magnitude (a fragile threshold) instead of the `-weekly-w<N>` runId suffix → misclassifies a small weekly tail shard or a future cardinality change.
- Hardcoding a `SweepAnomalyClass` member or otherwise treating anomaly keys non-opaquely → D-20703 violation.
- Adding a new charting dep instead of reusing `BaseChart.vue` → no-new-dependency break.
- A divide-by-zero on a 0-cell run (no `cellCount > 0` guard) → `NaN` corrupts the chart axis.
- Adding a new endpoint / server function / `sweep_runs` column / migration → the trend is a pure client projection; reuse `recentRuns`.
- Introducing a `Date.now()` read in the composable → breaks the WP-204 render-boundary purity discipline.
- Shipping a new `vue-tsc` error because `typecheck` was not run → dashboard typecheck drift recurrence; it is a DoD gate here.
- A dedicated Trends tab/route → out of scope; render inline in the existing sweep section.

---

## DECISIONS.md Entries (D-23501..D-23502)

Reserved verbatim in `docs/ai/DECISIONS.md` (full text there; `Reserved (proposed)`
at draft → `Active` at execution close): **D-23501** — sweep trend view is a
client-side projection over the existing 30-run `recentRuns` (reuses
`GET /api/sweep/latest` + `useSweepHealth` + `BaseChart.vue`; inline; no new
endpoint/server/migration/dep). **D-23502** — cadence segmentation + rate
normalization (cadence from the `-weekly-w<N>` runId suffix grammar, NOT
`cellCount` or the opaque anomaly taxonomy; trend metric is per-cell
`anomalyRate`).
