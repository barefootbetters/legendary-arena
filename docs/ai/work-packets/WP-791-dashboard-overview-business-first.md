# WP-791 — Dashboard Overview, Business First (money row + real-data-only Overview)

**Status:** Draft 2026-10-02
**Layer:** App (`apps/dashboard`) only — one WP, single execution session (two-commit topology: `EC-828:` impl + `SPEC:` close)
**User-Visible Surface:** `dashboard.legendary-arena.com/overview` (operator dashboard, behind Hanko + Cloudflare Access); relocated widgets appear on `/vision` and `/players`
**Baseline:** drafted off `origin/main` @ `4e8ce54f` (2026-10-02; reservation landed in #2563)
**Reserves:** D-24653 · **EC:** EC-828 · **Hard-deps:** none open (WP-373 ✅, WP-374 ✅, WP-439 ✅, WP-517 ✅, INFRA #2558 ✅, INFRA #2562 ✅)

## Non-Negotiable Constraints

- Code must follow `docs/ai/REFERENCE/00.6-code-style.md` (human-style, explicit, junior-readable; full-word names; `// why:` on non-obvious choices; no nested ternaries; functions ~30 lines).
- The executor produces **complete files**, never diffs, patches, or `// … unchanged` snippets.
- **Dashboard app only.** No `apps/server/**`, no `packages/**`, no new `/api/dash/*` endpoint, no migration. Every number the new tiles show comes from an endpoint or config that already exists, or from operator input stored in the browser.
- **No operator financial input is ever committed.** The repository is **public**; cash balance, fixed costs, and the royalty rate are entered in the dashboard and stored only in the operator's browser (`localStorage`). No default, sample, or placeholder value for them appears in source.
- **No fabricated verdicts.** A card whose data is missing or not yet entered shows `—` or "Not entered"; a card backed by mock data never shows a status chip (production mock-only DR payload → "Not connected"; `VITE_USE_MOCKS` dev mode → the mock value with no chip, per INFRA #2562). §6 is the per-card contract.
- ESM only, Node v22+. If any item in this WP or EC-828 is unclear, stop and ask; do not guess.

## Vision Alignment

- **Clauses touched:** §14 (Explicit Decisions, No Silent Drift — D-24653 records the Overview contract, the D-19602 amendment, and the end of the WP-203/WP-204 additive-only rule rather than dropping them silently) and Financial Sustainability ("No Margin, No Mission": revenue, royalties, costs, and runway on the operator's first screen).
- **Conflict:** none. Operator-only surface; no player-facing, paid, persuasive, or cosmetic change, so none of NG-1..NG-8 is crossed.
- **Determinism:** N/A (dashboard app; no engine, `G`, replay, or hash surface).

## 1. Goal

Make the Overview answer the survival question first: **is the business making
or losing money, and is anyone playing?** The top of the page becomes a money
row (revenue, royalties, costs, net, cash runway), followed by engagement
(players and matches) and real health (server, DR drill, infra cost). Every
tile on the Overview shows real data (`LIVE`, `CACHED`, or operator-entered
`LOCAL`). Nothing on it is `MOCK`. The build and governance widgets move to the
Vision & Roadmap page; the DAU chart and acquisition strip move to Players; the
Alerts panel, whose feed has no server route, is unmounted.

## 2. Assumes

- `GET /api/dash/kpis` serves `revenue_30d` in **dollars** (float), plus `total_players`, `new_players_30d`, `total_matches` (WP-374 / D-24169; `dashboardGameplay.logic.ts` `revenue30d`).
- `GET /api/dash/matches` returns the **50** most recently updated matches as `MatchRecord { startedAt, duration, outcome: 'in_progress'|'hero_wins'|'villain_wins', … }`, and `GET /api/dash/players` the **100** newest players as `PlayerRecord { lastActive, … }` (D-24169; `MATCH_LIST_LIMIT = 50`, `PLAYER_LIST_LIMIT = 100`).
- `GET /api/dash/system/runtime` returns `RuntimeHealthSnapshot { uptimeSeconds, cpuPercent, … }` (WP-439 / D-24258); `GET /api/dash/dr-readiness` returns `DrReadiness { lastDrill, nextDue, overdue, source }` (WP-517 / D-24330).
- `apps/dashboard/src/config/infraCostActuals.ts` exports `fetchInfraCostActuals()` (`source: 'CACHED'`) and `INFRA_COST_ACTUALS_AS_OF` (INFRA #2558, Sep 2026 = $146.35); `OpsAtAGlanceStripWidget` already reads it (INFRA #2562).
- Reused helpers exist: `services/endpoints.ts` exports `liveEnvelope`, `fetchKpiSnapshots`, `fetchMatchRecords`, `fetchPlayerRecords`, `fetchRuntimeHealth`; `composables/useFetch.ts` returns `{ data, error, source, … }`; `services/api.ts` `normalizeError` yields `ApiError { message, code?, retryable? }` (`code` falls back to the HTTP status string; `retryable` = 5xx / network / timeout); `utils/runtimeHealth.ts` exports `computeRuntimeHealthStatus`; `utils/format.ts` exports `formatUptime`; `widgets/DrReadinessWidget.vue` holds the local DR fetcher + mock; `/api/dash/kpis` also serves `hero_win_rate_30d` live.
- `useDataFreshness` already extends the fetched-data source labels with the additive `'BUILD'` label (D-19804); `'LOCAL'` follows that precedent.
- `/api/dash/alerts` has **no server route** (D-24169 §6 "blocked on absent infrastructure"), and DAU has **no signal** (D-24169 §6 "`/metrics/dau` deferred").
- `GET /api/dash/dr-readiness` serves a **mock** payload (`source: 'mock'`, `lastDrill: null`, `overdue: false`) while `DASH_GITHUB_TOKEN` is unset, which is the production state today (`dashboardDrReadiness.logic.ts:188-195`; STATUS WP-517 live-verify).
- `/api/dash/players` is ordered by `created_at DESC`, and `PlayerRecord.lastActive` = the player's last competitive score, else registration (`dashboardGameplay.logic.ts:143-162`); `/api/dash/matches` is ordered by `updated_at DESC` and may carry an empty `startedAt` (logic.ts:126).
- `config/revenueDeductions.ts` commits a placeholder `royaltyPercent: 0.2` (`isMock: true`) under D-19602, which planned to swap the real rate into that file.
- `hero_win_rate_30d` is mounted only on the Overview (`GameplayPage.vue` has no `KpiCard`).
- The Vision & Roadmap page (`pages/vision/VisionRoadmapPage.vue`) is the dashboard's build/roadmap surface; the Pipeline page's layout is locked to four lanes (D-22901), so governance widgets do not go there.

## 3. Context

On 2026-10-02 the live Overview showed 9 players, 2 new in 30 days, 2 matches,
and $0 revenue, while Render alone cost $146.35 for September. The page never
put those side by side. Its top half was governance (vision text, governance
KPIs, throughput, STATUS feed). Lower down, an `Ops at a Glance` card said a mock
6.7% "On track" while System Health said the real 71.4% (fixed by INFRA #2562).
The Acquisition strip, Alerts, and DAU chart can only ever show mock, an error,
or "no data" in production. Alerts in particular polls a route that does not
exist, so it is unmounted rather than moved (the `fetchServerNodes` precedent in
`SystemHealthPage.vue`).

WP-203 and WP-204 required their strips to be "additive-only" on the Overview.
That constraint protected those packets' own scope; it is not a standing rule.
**D-24653** replaces it with an Overview content contract (business-first order,
no MOCK tile), so this WP may remove and relocate widgets.

**Why browser storage for financial inputs (not a committed config or a server
table).** The repo is public, so cash and the royalty rate cannot be committed
the way infra vendor spend is. A server-side store would cross into
`apps/server` (new table, endpoint, admin write path) and double the WP. The
dashboard is single-operator, and the Daily Execution panel already keeps the
operator's own state in `localStorage` (`la-dashboard-checklist-*`). A durable,
cross-device store is a follow-up if the operator wants it.

**Why one WP of ~15 files rather than a split.** All files are in one app;
there is no contract file, no server or engine edge, and one D-entry. Splitting
the money row from the cleanup would ship an intermediate Overview with the mock
tiles gone and nothing in their place, or the money row above tiles that still
lie. The 01.0a split heuristic (">~10 files") is weighed against that and
declined.

**Deferred (not this WP):** visitors and the top of the funnel (needs a
Cloudflare Web Analytics token and a server read path); a server-stored
operating-inputs record; guest-vs-signed-in match split (not in `MatchRecord`).

## 4. Scope

**In:**
- **Money row** — new `BusinessPulseWidget`, the first widget under the page header. Five cards: Revenue (30d), Royalties (30d), Costs (monthly), Net (monthly), Cash runway. Includes an inline "Edit operating inputs" form (cash balance, other fixed monthly costs, royalty rate %).
- **Operating inputs** — new `useOperatingInputs` composable: read/validate/write one `localStorage` record; every access in `try/catch`; renders correctly when storage is unavailable.
- **Pure math** — new `utils/overviewPulse.ts`: `computeBusinessPulse(…)`, `computeEngagement(…)`, and the health card builders `describeServerCard(…)` / `describeDrDrillCard(…)`, plus the `OperatingInputs` type (integer cents; injected `nowMs`; no clock or storage reads).
- **Engagement row** — new `EngagementStripWidget`: matches started (7d), "Finished with a winner (7d)", "Scored or joined (7d)" players, from `/api/dash/matches` + `/api/dash/players`.
- **Health row** — `OpsAtAGlanceStripWidget`'s two mock cards (worst surface, error rate) are replaced by **Server** (runtime) and **DR drill** (DR readiness); the cost card is unchanged.
- **Overview layout** — `OverviewPage.vue` renders in this order: page header + "since you last looked" (unchanged, including its `useLastVisit` mark-on-mount) → `BusinessPulseWidget` → KPI grid (`total_players`, `new_players_30d`, `total_matches`, `revenue_30d`, `hero_win_rate_30d`) → `EngagementStripWidget` → `OpsAtAGlanceStripWidget` → `DailyExecutionPanel`. The range selector is removed from the Overview: after this change no Overview widget reads `useDateRange`, so it would control nothing.
- **Relocations** — `VisionCard`, `GovernanceKpiStrip`, `GovernanceThroughputWidget`, `StatusFeedWidget` → top of `VisionRoadmapPage.vue` under a "Build governance" heading; `DauChartWidget` + `AcquisitionFunnelStripWidget` → `PlayerAnalyticsPage.vue` (the strip's own "View full funnel →" link becomes a link to the page it sits on; accepted). `AlertsPanel` is unmounted (mounted nowhere; file kept). `RevenueChartWidget` is removed from the Overview only (it already lives on Monetization).
- **`LOCAL` freshness label** — `DataFreshnessSource` gains `'LOCAL'`; `DailyExecutionPanel` reports `'LOCAL'` instead of `'MOCK'`.

**Out:**
- No server, endpoint, migration, `packages/**`, or API-catalog change.
- No change to `KpiCard`, `useFetch`, the D-22601 mock-mode banner, or any widget's internals other than `OpsAtAGlanceStripWidget` and `DailyExecutionPanel`'s source label.
- No change to infra budgets (`infraCostBudgets.ts`) or actuals.
- No deletion of any relocated or unmounted widget file; no change to the Pipeline page or `SystemHealthPage.vue`.
- No change to `config/revenueDeductions.ts`; the new code does not import `REVENUE_DEDUCTIONS`.
- Cloudflare visitor analytics, server-stored inputs, Stripe fees, and taxes are not modelled.

## 5. Files Expected to Change

- `apps/dashboard/src/pages/dashboard/OverviewPage.vue` — **modified** — new order; removed imports/mounts per §4.
- `apps/dashboard/src/pages/dashboard/OverviewPage.test.ts` — **new** — import-anchored source guards (no relocated or MOCK-backed widget imported; mount order).
- `apps/dashboard/src/widgets/BusinessPulseWidget.vue` — **new** — money row + operating-inputs form.
- `apps/dashboard/src/composables/useOperatingInputs.ts` — **new** — `localStorage` record.
- `apps/dashboard/src/composables/useOperatingInputs.test.ts` — **new** — stubbed-storage tests (round-trip, invalid reads, replace-on-save, `setItem` failure).
- `apps/dashboard/src/utils/overviewPulse.ts` — **new** — pure `computeBusinessPulse`, `computeEngagement`, `describeServerCard`, `describeDrDrillCard`, and the `OperatingInputs` type.
- `apps/dashboard/src/utils/overviewPulse.test.ts` — **new** — pure-function tests for all five exports' branches.
- `apps/dashboard/src/widgets/EngagementStripWidget.vue` — **new** — three engagement cards fed by `computeEngagement`.
- `apps/dashboard/src/widgets/OpsAtAGlanceStripWidget.vue` — **modified** — Server + DR drill cards replace the two mock cards.
- `apps/dashboard/src/widgets/OpsAtAGlanceStripWidget.test.ts` — **modified** — guards updated for the new cards.
- `apps/dashboard/src/composables/useDataFreshness.ts` — **modified** — `'LOCAL'` label.
- `apps/dashboard/src/composables/useDataFreshness.test.ts` — **modified** — `'LOCAL'` case.
- `apps/dashboard/src/widgets/DailyExecutionPanel.vue` — **modified** — source `'LOCAL'`.
- `apps/dashboard/src/pages/vision/VisionRoadmapPage.vue` — **modified** (01.5 wiring — import + mount the four governance widgets).
- `apps/dashboard/src/pages/players/PlayerAnalyticsPage.vue` — **modified** (01.5 wiring — import + mount `DauChartWidget`, `AcquisitionFunnelStripWidget`).
- Govern-close ledgers: `WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md` (D-24653 Active), `docs/ai/STATUS.md`, `docs/05-ROADMAP-MINDMAP.md` (`📝`→`✅`). `NUMBER-LEDGER.md` is already reserved (not in the execution diff).

## 6. Contract

**D-24653 — Overview content contract** (lands Active at execution):
1. **Order.** Money → KPIs → engagement → health → the operator's daily checklist. Build/governance widgets do not appear on the Overview.
2. **No MOCK on the Overview (production).** With `VITE_USE_MOCKS` unset, every Overview widget reads `LIVE` or `CACHED` data, or operator-entered `LOCAL` data. A widget that can only be mock or permanently empty in production is relocated, not shown. (The one-line "Since you last looked" repo-change summary stays: it is a text line from the build snapshot, not a widget, and it is real data.)
3. **No committed financial inputs.** Operator cash, fixed costs, and royalty rate live in browser storage only while the repo is public. This **amends D-19602**: the real royalty rate is never swapped into `config/revenueDeductions.ts` while the repo is public; that file's placeholder stays `isMock: true`. Consequently the Monetization page's `NetRevenueChartWidget`, which reads that placeholder, stays flagged MOCK and is not the source of truth for royalties; the Overview's LOCAL rate is.
4. Supersedes the WP-203/WP-204 "additive-only" Overview placement constraint.

**Operating-inputs record** (`localStorage` key **`la-dashboard-operating-inputs`**, JSON):

```
OperatingInputs = {
  version: 1,
  cashBalanceCents:      number | null,   // integer ≥ 0
  otherFixedMonthlyCents: number | null,  // integer ≥ 0; costs beyond infra (subscriptions, domains, …)
  royaltyRateBasisPoints: number | null,  // integer 0..10000 (e.g. 1250 = 12.5%)
  updatedAt:             string           // ISO-8601, set on save
}
```

The `OperatingInputs` type is defined in `utils/overviewPulse.ts` (the pure module)
and imported by the composable and the widget. A missing key, unparseable JSON,
wrong `version`, or any out-of-range field reads as "all fields `null`" (never
throws). `getItem`, `setItem`, and `JSON.parse` are each inside `try/catch`. The
form converts dollars and percent to cents and basis points at save time.

**`computeBusinessPulse({ revenue30dCents, infraMonthlyCents, inputs })`** returns one
result per card, each a discriminated union on `state`:
`{ state: 'value', valueCents }` · `{ state: 'not-entered' }` · `{ state: 'unavailable' }`,
and for Runway also `{ state: 'value', months }` · `{ state: 'profitable' }`.
`revenue30dCents` is `number | null`: it comes from `fetchKpiSnapshots()` → `revenue_30d`
(dollars → cents), and is `null` while that fetch is loading or failed.
**Precedence (every card):** `unavailable` > `not-entered` > `profitable` > `value`.
- Revenue = `revenue30dCents`; `unavailable` if `null`.
- Royalties = `round(revenue30dCents × royaltyRateBasisPoints / 10000)`; `unavailable` if revenue is `null`, else `not-entered` if the rate is `null`.
- Costs = `infraMonthlyCents + otherFixedMonthlyCents`; when other costs are `null` the value is infra only and the card says "infra only" (Costs is never `unavailable`).
- Net = `revenue30dCents − royalties − costs`; inherits `unavailable` / `not-entered` from Royalties.
- Runway = `unavailable` / `not-entered` inherited from Net; else `not-entered` if cash is `null`; else `profitable` when net ≥ 0; else `months` = `cashBalanceCents ÷ (−net)`, one decimal.
- `infraMonthlyCents` = the sum of `INFRA_COST_ACTUALS` month-to-date figures. That is a full month only while `INFRA_COST_ACTUALS_AS_OF` is a month-end date (it is: `2026-09-30`); a `// why:` records this.

**`computeEngagement({ matches, players, nowMs })`** → counts over the trailing 7 days; a
timestamp `t` is in the window when `t >= nowMs − 7×86 400 000` (inclusive) and `t <= nowMs`:
- Matches with an empty or unparseable `startedAt`, and players with an empty or unparseable `lastActive`, are excluded.
- Matches started = `startedAt` in window. Matches finished = started in window **and** `outcome !== 'in_progress'`. Ties are projected as `'in_progress'` by `/api/dash/matches` (D-24169 maps only heroes-win / scheme-wins), so they count as unfinished: a known undercount, recorded in a `// why:`. The card is labelled **"Finished with a winner (7d)"**.
- Players card label: **"Scored or joined (7d)"** = `lastActive` in window (`lastActive` is last competitive score, else registration).
- Caps: the matches card shows `"<count>+"` whenever the feed returned 50 records, and the players card `"<count>+"` whenever it returned 100. Neither feed is ordered by the timestamp being counted (`updated_at` / registration), so no window test can prove completeness. A `// why:` also records that the server skips rows without `initial_state` after its `LIMIT`, so a truncated feed can arrive short of 50.

**Health card builders.** The card text and chip are computed by pure functions in
`utils/overviewPulse.ts`, `describeServerCard(result)` and `describeDrDrillCard(result)`,
so they are unit-tested; the widget only renders their output.
  - **Error classification** (both builders take `{ data, error, source }` from `useFetch`; `error` is the dashboard `ApiError { message, code?, retryable? }`, which carries no HTTP status, so neither `services/api.ts` nor `useFetch` is edited):
    - `error.code` in {`unauthorized`, `forbidden`, `401`, `403`} (`normalizeError` falls back to the status string when the body has no `code`) → auth problem.
    - else `error.retryable === true` (HTTP 5xx, `network_error`, `timeout`) → unreachable.
    - any other error → unknown.
    - `source === 'MOCK'` (mock mode) → the value with no chip (the INFRA #2562 rule).
- **Server**:
  - Success → `Up · <uptime>`, with the chip from `computeRuntimeHealthStatus` (`utils/runtimeHealth.ts`, the same grading System Health uses): healthy → `On track`, watch → `Needs attention`, saturated → `Off track`.
  - Unreachable error → `Unreachable` + `Off track`.
  - Auth-problem error (a dashboard sign-in issue, not a server problem) or unknown error → `—`, no chip.
- **DR drill**:
  - `source === 'mock'` → **"Not connected"**, no chip.
  - Source `github` with `lastDrill === null` → **"None recorded"**, no chip.
  - Any fetch error (auth, unreachable, or unknown) → `—`, no chip.
  - Otherwise → the last drill date + result, with chip `Off track` when `overdue`, else `On track`.
  - The strip's local DR fetcher returns `liveEnvelope(response.data.data)` (imported from `services/endpoints.js`), so its source tag reads `LIVE`.
- **Cost**: unchanged.
- **Source tags and mock mode**: each card carries its own tag (`LIVE` / `CACHED · as of …`). In mock mode (`VITE_USE_MOCKS`), a card whose data is `MOCK` shows its value with no chip (the INFRA #2562 rule).
- **Imports**: the strip drops its `useDateRange`, `usePublicSurfaceHealth`, `useErrorRateMonitor`, `fetchUptimeProbes`, and `fetchErrorRateSnapshots` imports.

**Saving operating inputs.** `save(formValues)` writes the **whole** record from the
form (replace, never merge with the prior record); a blank field saves `null`.
`save` returns `true` on success and `false` when `setItem` throws, in which case the
widget shows **"Not saved — browser storage unavailable"** so a reload cannot
silently lose the entry.

## 7. Acceptance Criteria

- [ ] `OverviewPage.vue` mounts exactly, in order: `BusinessPulseWidget`, the five KPI cards, `EngagementStripWidget`, `OpsAtAGlanceStripWidget`, `DailyExecutionPanel`, with KPI cards `total_players`, `new_players_30d`, `total_matches`, `revenue_30d`, `hero_win_rate_30d`; it imports none of `VisionCard`, `GovernanceKpiStrip`, `GovernanceThroughputWidget`, `StatusFeedWidget`, `DauChartWidget`, `RevenueChartWidget`, `AcquisitionFunnelStripWidget`, `AlertsPanel`, `useDateRange` (`OverviewPage.test.ts`; its guards match only `import … from` lines and template tags, so `// why:` comments naming a relocated widget do not trip them).
- [ ] The four governance widgets render on `/vision`; `DauChartWidget` + `AcquisitionFunnelStripWidget` on `/players`; `AlertsPanel` is mounted on no page.
- [ ] `computeBusinessPulse` and `computeEngagement` are pure (injected `nowMs`, no clock/storage) and unit-tested: royalties rounding, infra-only costs, net, runway months, `profitable` at net ≥ 0, every `not-entered` and `unavailable` path and the precedence order, the inclusive 7-day window edges, empty/unparseable `startedAt` and `lastActive` exclusion, ties as unfinished, and both cap rules. `describeServerCard` / `describeDrDrillCard` are unit-tested with one case per branch in §6: success (each runtime status), auth error (`unauthorized`, `forbidden`, `401`, `403`), unreachable (`retryable: true`), unknown error, and `source === 'MOCK'`; plus, for DR, mock payload, `lastDrill === null`, overdue, and not overdue.
- [ ] `useOperatingInputs` round-trips a valid record; a missing key, bad JSON, wrong version, negative or non-integer values, a rate > 10000, and a throwing `localStorage` all read as all-`null` without throwing; `save` replaces (never merges), saves blanks as `null`, and returns `false` when `setItem` throws (tested with a stubbed storage).
- [ ] With no operating inputs entered, the money row shows Revenue and Costs (infra only) and "Not entered" for Royalties, Net, and Runway — no status chips, no zeros standing in for missing data.
- [ ] `OpsAtAGlanceStripWidget` imports neither `fetchUptimeProbes` nor `fetchErrorRateSnapshots`; it reads `/api/dash/system/runtime` + `/api/dash/dr-readiness` (via `liveEnvelope`), and no longer imports `useDateRange`, `usePublicSurfaceHealth`, or `useErrorRateMonitor`. In `OpsAtAGlanceStripWidget.test.ts`, test 1 (the cost card reads the real actuals) is kept word for word; tests 2–3 are rewritten for the new cards, and the execution commit names that intended behavior change.
- [ ] `DailyExecutionPanel` shows `LOCAL`; `useDataFreshness` maps `'LOCAL'` to a label (test).
- [ ] No source file contains a cash, fixed-cost, or royalty-rate default, and nothing new imports `REVENUE_DEDUCTIONS` (grep gate in the EC).
- [ ] Dashboard `typecheck` exit 0; dashboard `test` green; Dashboard Gates CI green (`lint`, `format:check`, `typecheck`, `test:coverage` thresholds, `build`).

## 8. Verification Steps

1. `pnpm --filter @legendary-arena/dashboard typecheck` → exit 0.
2. Generate the dashboard's gitignored inputs if running in a fresh worktree (`pnpm --filter @legendary-arena/dashboard prebuild:snapshot`, `prebuild:coverage`, `prebuild:effect-index`, `prebuild:par`, then `node scripts/wiki-lint.mjs --json apps/dashboard/src/data/wiki-lint.json` and `node apps/dashboard/scripts/build-coach-eval.mjs`), then `pnpm --filter @legendary-arena/dashboard test` → all pass.
3. Local preview of `/overview`: money row shows "Not entered" before input; after entering cash $1,000, other costs $50, royalty 10%, with revenue $0 → Royalties $0.00, Costs $196.35, Net −$196.35, Runway 5.1 months. Reload keeps the values (localStorage).
4. `/vision` and `/players` show the relocated widgets; no page mounts `AlertsPanel`.
5. Dashboard Gates locally: `pnpm --filter @legendary-arena/dashboard lint`, `format:check`, `test:coverage`, `build`.
6. Live (D-24026, post-deploy): `dashboard.legendary-arena.com/overview` shows no `MOCK` tag anywhere; the operator enters real inputs.

## 9. User-Visible Impact

Operator-only. The Overview opens on revenue vs. costs and runway, then players
and matches, then server / DR / cost health, all from real data or the
operator's own entries. Governance widgets are one click away on Vision &
Roadmap. No player-facing change.

## 10. Definition of Done

- [ ] §4–6 implemented; all §7 criteria pass.
- [ ] Dashboard typecheck + tests + Dashboard Gates green; `git diff --name-only` = the EC allowlist.
- [ ] D-24653 Active in `DECISIONS.md`; WORK_INDEX / EC_INDEX / STATUS / mindmap updated; `roadmap:counts:check` exits 0.
- [ ] D-24026 live verification recorded (operator-pending until deploy).

## Lint Gate Self-Review

Per `00.3` (21 sections), verdicts recorded at draft (re-run after the F1–F3 fixes):
the constraints block cites `00.6`, requires complete files, adds ESM/Node v22 and stop-and-ask, and
its "no fabricated verdicts" rule matches §6 (§1/§2). Assumes lists every reused helper
and its shape (§3). Exact allowlist of 15 dashboard files + ledgers; the >8-file split is weighed and declined (§5).
User-Visible Surface declared, §9 present, D-24026 live item in the DoD (§15.1); 9 binary
acceptance criteria (§14); tests use `node:test` with stubbed storage and an injected `nowMs` (§12).
§17 cites §14 (Explicit Decisions) + Financial Sustainability, no NG-1..8 crossing,
determinism N/A. §18: the EC grep gate's policed literals are kept out of source and comments.
§20 N/A (operator-only internal analytics; no funding copy or affordance). §21 N/A (no
`apps/server/**`; consumes only existing `/api/dash/*` routes). §9/§10/§11 N/A (no scripts,
no new env var, no auth change). §19 N/A (commit-time rule; baseline = HEAD). EC-828 within the 100-line ceiling.

Gate verdicts (2026-10-02): pre-flight READY TO EXECUTE; copilot PASS; lint PASS.
