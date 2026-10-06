# EC-828 — Dashboard Overview, Business First (Execution Checklist)

**Source:** docs/ai/work-packets/WP-791-dashboard-overview-business-first.md
**Layer:** App (`apps/dashboard`) only — one WP, single session, two-commit topology

## Before Starting
- [ ] `origin/main` contains INFRA #2558 (`infraCostActuals.ts` Sep 2026) and #2562 (`OpsAtAGlanceStripWidget` reads `fetchInfraCostActuals`)
- [ ] Read `widgets/DrReadinessWidget.vue` (local `fetchDrReadiness` + mock), `widgets/RuntimeHealthWidget.vue`, `utils/runtimeHealth.ts` (`computeRuntimeHealthStatus`), `utils/format.ts` (`formatUptime`) — reuse them; the strip's DR fetcher wraps the live body in `liveEnvelope(response.data.data)` (the widget's bare `response.data` leaves `source` undefined)
- [ ] Read `composables/useDailyChecklist.ts` — the `localStorage` idiom `useOperatingInputs` copies (but wraps `getItem` too)
- [ ] In a fresh worktree, generate the dashboard's gitignored inputs before `test` (`pnpm --filter @legendary-arena/dashboard prebuild:snapshot|prebuild:coverage|prebuild:effect-index|prebuild:par`, `node scripts/wiki-lint.mjs --json apps/dashboard/src/data/wiki-lint.json`, `node apps/dashboard/scripts/build-coach-eval.mjs`) — otherwise import-crash "failures"
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` + `test` green at baseline
- [ ] Enumerate the EXACT target file set (= WP §5 / Files to Produce); any edit outside it is a FAIL

## Locked Values (do not re-derive)
- Storage key **`la-dashboard-operating-inputs`**; record `{ version: 1, cashBalanceCents, otherFixedMonthlyCents, royaltyRateBasisPoints, updatedAt }`; fields `integer ≥ 0 | null`; rate `0..10000`
- Invalid / missing / wrong-version / throwing storage → all fields `null`, never throws
- `save(form)` replaces the whole record (never merges); blank → `null`; returns `false` when `setItem` throws → widget shows **"Not saved — browser storage unavailable"**
- `revenue_30d` KPI is **dollars** → cents via `Math.round(value * 100)`; `revenue30dCents: number | null` (`null` while loading/failed)
- `infraMonthlyCents` = sum of `INFRA_COST_ACTUALS[].monthToDateCents`
- Royalties = `Math.round(revenue30dCents * royaltyRateBasisPoints / 10000)`; Net = revenue − royalties − costs; Runway months = `cashBalanceCents / -net`, one decimal
- Card states are discriminated unions; Runway adds `'profitable'` (net ≥ 0). Precedence: `unavailable` > `not-entered` > `profitable` > `value`
- Window: `t >= nowMs - 7 * 86_400_000 && t <= nowMs` (inclusive); empty/unparseable `startedAt` and `lastActive` excluded
- Finished = started in window and `outcome !== 'in_progress'` (ties count as unfinished); label **"Finished with a winner (7d)"**; players label **"Scored or joined (7d)"**
- Caps: 50 matches returned → `"<count>+"`; 100 players returned → `"<count>+"`
- Card builders take `{ data, error, source }`; classify `ApiError` without editing `api.ts`/`useFetch`: `code` ∈ {`unauthorized`,`forbidden`,`401`,`403`} → auth; else `retryable === true` → unreachable; else unknown; `source === 'MOCK'` → value, no chip
- `describeServerCard`: success → `Up · <formatUptime>`, chip healthy→`On track`, watch→`Needs attention`, saturated→`Off track`; unreachable → `Unreachable` + `Off track`; auth/unknown → `—`, no chip
- `describeDrDrillCard`: `source==='mock'` → **"Not connected"**; github + `lastDrill===null` → **"None recorded"**; any fetch error → `—` (all no chip); else date + result, chip `Off track` if `overdue`, else `On track`
- Overview order: `BusinessPulseWidget` → KPI cards `total_players`, `new_players_30d`, `total_matches`, `revenue_30d`, `hero_win_rate_30d` → `EngagementStripWidget` → `OpsAtAGlanceStripWidget` → `DailyExecutionPanel`; no range selector, no `useDateRange`
- Relocations: `VisionCard`, `GovernanceKpiStrip`, `GovernanceThroughputWidget`, `StatusFeedWidget` → `VisionRoadmapPage.vue` ("Build governance"); `DauChartWidget`, `AcquisitionFunnelStripWidget` → `PlayerAnalyticsPage.vue`; `AlertsPanel` → mounted nowhere (file kept)
- Ops strip drops `useDateRange`, `usePublicSurfaceHealth`, `useErrorRateMonitor`, `fetchUptimeProbes`, `fetchErrorRateSnapshots` imports
- New freshness label `'LOCAL'` (added like `'BUILD'`, D-19804)

## Guardrails
- `apps/dashboard` only; no server/endpoint/migration/`packages/**`/API-catalog change
- **No financial value in source**, comments included (do not copy the WP's "1250 = 12.5%" example); nothing new imports `REVENUE_DEDUCTIONS`; `revenueDeductions.ts` untouched
- `OperatingInputs`, `computeBusinessPulse`, `computeEngagement`, `describeServerCard`, `describeDrDrillCard` live in `utils/overviewPulse.ts`, which is pure (`nowMs` injected; no `Date.now()`, storage, or fetch)
- `getItem`, `setItem`, `JSON.parse` each in `try/catch` with a `// why:`; widgets render with storage unavailable
- Missing data renders `—` / "Not entered", never `0` / `$0.00`, never a chip
- `OpsAtAGlanceStripWidget.test.ts` test 1 (cost card reads real actuals) kept word for word; tests 2–3 rewritten for the new cards, and the `EC-828:` commit names that behavior change
- `OverviewPage.test.ts` guards match `import … from` lines and template tags only
- Relocated/unmounted widget files are not edited or deleted; `git diff --name-only` == the allowlist; two-commit topology (`EC-828:` + `SPEC:`)

## Required `// why:` Comments
- Browser-only storage of operating inputs (public repo → never committed)
- Dollars→cents conversion of `revenue_30d`; infra month-to-date treated as a full month (valid while `AS_OF` is a month-end date)
- Cap rules (feed limits + sort orders, D-24169; rows skipped after `LIMIT`); ties counted as unfinished
- DR "Not connected" branch (prod has no `DASH_GITHUB_TOKEN`) and Server 401/403 → `—`
- Every `catch` that swallows a `localStorage` failure; each relocated widget's new mount

## Files to Produce
- `apps/dashboard/src/pages/dashboard/OverviewPage.vue` — **modified**
- `apps/dashboard/src/pages/dashboard/OverviewPage.test.ts` — **new**
- `apps/dashboard/src/widgets/BusinessPulseWidget.vue` — **new**
- `apps/dashboard/src/composables/useOperatingInputs.ts` + `.test.ts` — **new**
- `apps/dashboard/src/utils/overviewPulse.ts` + `.test.ts` — **new**
- `apps/dashboard/src/widgets/EngagementStripWidget.vue` — **new**
- `apps/dashboard/src/widgets/OpsAtAGlanceStripWidget.vue` + `.test.ts` — **modified**
- `apps/dashboard/src/composables/useDataFreshness.ts` + `.test.ts` — **modified**
- `apps/dashboard/src/widgets/DailyExecutionPanel.vue` — **modified**
- `apps/dashboard/src/pages/vision/VisionRoadmapPage.vue` — **modified** (01.5)
- `apps/dashboard/src/pages/players/PlayerAnalyticsPage.vue` — **modified** (01.5)
- Govern-close: `WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md` (D-24653 Active), `docs/ai/STATUS.md`, `docs/05-ROADMAP-MINDMAP.md` (`📝`→`✅`)

## After Completing
- [ ] Dashboard `typecheck` exit 0 (the command's own exit, not a pipe's); `test`, `lint`, `format:check`, `test:coverage`, `build` green
- [ ] `rg -n "(cashBalanceCents|otherFixedMonthlyCents|royaltyRateBasisPoints)\s*[:=]\s*\d" apps/dashboard/src -g '!*.test.ts'` → 0 lines; `rg -n REVENUE_DEDUCTIONS apps/dashboard/src` → no new importer
- [ ] Local preview: WP §8 step 3 numbers reproduce exactly; no `MOCK` tag on `/overview` with `VITE_USE_MOCKS` unset
- [ ] `git diff --name-only` = the allowlist
- [ ] D-24653 Active; WORK_INDEX checked with date; mindmap `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] `STATUS.md`: "User-visible: dashboard Overview leads with money, engagement, real health"; D-24026 operator-pending

## Common Failure Smells
- `$0.00` net before inputs → `null` treated as `0`; Runway `Infinity`/`NaN` → dividing when net ≥ 0 or not-entered
- Tests flip by day → `Date.now()` inside `overviewPulse.ts`
- Dashboard tests "fail" at import in a new worktree → prebuild inputs not generated
- DR card green in prod → mock-source branch missing; DR tag blank → fetcher returns `response.data`
- Server chip disagrees with `/system` → chip not derived from `computeRuntimeHealthStatus`
- Overview guard test fails on a comment → guard matches bare names instead of import lines
