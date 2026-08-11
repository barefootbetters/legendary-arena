# WP-527 — Dashboard Money-Widget Source Badge Truthfulness (Paid-Action Errors + freshness NaN)

**Status:** Draft 2026-08-10
**Layer:** App (`apps/dashboard`) — one WP, standard two-session lane (two-commit topology: `EC-562:` impl + `SPEC:` close)
**User-Visible Surface:** `dashboard.legendary-arena.com` (operator dashboard — Monetization page)
**Baseline:** drafted off `origin/main` @ `cb88d24b` (2026-08-10)
**EC:** EC-562 · **Reserves:** none (enforces D-19804; preserves D-19602) · **Hard-dep:** none

## Non-Negotiable Constraints

- Code must follow `docs/ai/REFERENCE/00.6-code-style.md` (human-style, explicit, junior-readable).
- The executor produces **complete files**, never diffs or `// … unchanged` snippets.
- The freshness/source badge reflects **`ServiceResponse.source`** (D-19804), mirroring the
  already-correct `RevenueChartWidget.vue` — mock mode → `MOCK`; live mode (the server's bare
  `{ data }` envelope carries no `source`) → **no badge**, via `v-if="sourceLabel"`.
- **`NetRevenueChartWidget.vue` is NOT touched.** Its `MOCK` badge is the intentional D-19602
  deduction-placeholder posture; its `NaNh ago` is fixed transitively by the `useDataFreshness`
  guard, with no widget edit.
- No server change; no `endpoints.ts` / route / mock-data change. App-layer only.

## 1. Goal

The Monetization page's **Paid-Action Errors** widget stops showing a hardcoded `MOCK` source
badge on **live** Stripe billing-health data, and the money widgets stop rendering `NaNh ago`
freshness on the live (bare-`{ data }`-envelope) fetch path. The source badge — the operator's
mock-vs-live trust signal — tells the truth again.

## 2. Assumes

- The `/api/dash/*` billing feeds are live server-side (WP-373: `/api/dash/metrics/billing/health`
  (+`/sparklines`), `/revenue`, `/metrics/revenue`), and the deployed dashboard runs with the LIVE
  flip on (`VITE_USE_MOCKS` off + `VITE_API_BASE_URL` set) — **observed 2026-08-10** on
  `dashboard.legendary-arena.com/monetization` (the billing widgets fetch live, returning
  empty-real `0/0` data / "No revenue records found").
- `apps/dashboard/src/widgets/RevenueChartWidget.vue` already implements the correct pattern
  (`useFetch` → `source` → `useDataFreshness(updatedAt, source)`, `v-if="sourceLabel"`) — the
  reference to mirror.
- `useDataFreshness` returns `'Never'` when `updatedAt === null` but `'NaNh ago'` when `updatedAt`
  is `undefined` / non-finite; the live bare-`{ data }` envelope yields `updatedAt === undefined`.
- D-19804 (freshness label owned by `ServiceResponse.source`) governs; **D-19602** (NetRevenue
  deduction-placeholder posture) is preserved unchanged.

## 3. Context

Verifying WP-517's "billing/gameplay fetch live" claim on the deployed Monetization page
(2026-08-10) surfaced two widget defects behind a misleading `MOCK` badge:

- **`PaidActionErrorsWidget.vue`** hardcodes the badge — `sourceLabelRef = ref<'MOCK'>('MOCK')`
  and a literal `<span class="source">MOCK</span>` — with **no rationale**. It fetches live
  billing-health (`fetchBillingHealth`, live when `VITE_USE_MOCKS` is off) and renders real `0/0`
  data, but always labels it `MOCK`. This is a genuine mislabel: the dashboard's own Edge Cases
  tell the operator *"Confirm the `source: 'MOCK'` envelope before trusting any number"* — a badge
  that lies defeats the signal.
- Both money widgets render **`NaNh ago`** because the live server route returns a bare `{ data }`
  envelope (no `updatedAt`), and `useDataFreshness` computes `now − undefined = NaN`.

`RevenueChartWidget.vue` already dodges both — it derives from the real `source` and hides the
badge when `source` is absent (live). This WP makes `PaidActionErrorsWidget` follow that pattern
and hardens `useDataFreshness` so no widget renders `NaNh ago`.

**NetRevenue is intentionally left alone.** Its `MOCK` reflects `REVENUE_DEDUCTIONS.isMock` — the
placeholder royalty deductions the net-margin model uses (D-19602), which are genuinely mock even
when the revenue feed is live. Re-sourcing that badge (splitting revenue-provenance from
deductions-completeness) is a distinct UX decision, explicitly **deferred** (§4 Out).

## 4. Scope

**In:**
- `PaidActionErrorsWidget.vue`: derive the badge from the fetched `ServiceResponse.source`
  (`summaryFetch.source` → `useDataFreshness`), mirroring `RevenueChartWidget`; remove the
  hardcoded `sourceLabelRef = ref<'MOCK'>('MOCK')` and the literal `<span class="source">MOCK</span>`;
  gate the badge with `v-if="sourceLabel"` (live → source undefined → no badge; mock → `MOCK`).
- `useDataFreshness.ts`: treat a non-finite / absent `updatedAt` the same as `null` → return
  `'Never'`, so no consumer renders `NaNh ago`.
- `useDataFreshness.test.ts` (**new**): unit-test the guard (null / undefined / NaN → `'Never'`;
  a finite recent timestamp → a relative string) and the `sourceLabel` passthrough (null/undefined
  → `''`; `'MOCK'` → `'MOCK'`).

**Out:**
- **`NetRevenueChartWidget.vue` — no change** (D-19602 `MOCK` preserved; its `NaNh ago` fixed via
  the composable guard). A future WP MAY split its badge into revenue-source vs
  deductions-completeness — deferred, not in scope here.
- `RevenueChartWidget.vue` — no change (already correct; the reference pattern).
- No server / envelope change (adding `source`/`updatedAt` to the bare `{ data }` server envelope
  is a separate cross-layer contract WP). No `endpoints.ts`, route, or mock-data change.

## 5. Files Expected to Change

- `apps/dashboard/src/widgets/PaidActionErrorsWidget.vue` — **modified** — badge derives from
  `summaryFetch.source`; hardcoded `MOCK` removed; `v-if="sourceLabel"`.
- `apps/dashboard/src/composables/useDataFreshness.ts` — **modified** — non-finite/absent
  `updatedAt` → `'Never'`.
- `apps/dashboard/src/composables/useDataFreshness.test.ts` — **new** — freshness-guard +
  source-label unit tests.
- Govern-close ledgers: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/ai/STATUS.md`,
  `docs/05-ROADMAP-MINDMAP.md`. **No `DECISIONS.md` entry** (enforces D-19804; preserves D-19602).
  `NUMBER-LEDGER.md` already reserved (not in the execution diff).

`git diff --name-only` for the `EC-562:` commit = exactly the three app files above.

## 6. Contract

- The money-widget freshness badge reflects `ServiceResponse.source` (D-19804): mock → `MOCK`;
  live (bare `{ data }` envelope, `source` undefined) → **no badge** (mirrors `RevenueChartWidget`).
- `useDataFreshness(updatedAt, source)`: `relativeTime === 'Never'` whenever `updatedAt` is
  `null` / `undefined` / non-finite; `sourceLabel === ''` when `source` is `null` / `undefined`.
- **No `NaNh ago` renders on any widget.**
- `NetRevenueChartWidget`'s D-19602 `MOCK` (deductions placeholder) is unchanged.

## 7. Acceptance Criteria

- [ ] `PaidActionErrorsWidget` shows **no** `MOCK` badge when the feed is live (`source` undefined) and shows `MOCK` only in mock mode — structurally identical to `RevenueChartWidget` (badge derives from `useFetch().source`, gated by `v-if="sourceLabel"`).
- [ ] `useDataFreshness` returns `'Never'` for `updatedAt` null / undefined / NaN (unit-tested); a finite recent value still yields a relative string.
- [ ] No widget renders `NaNh ago` (Net Revenue + Paid-Action Errors read `Never` on the live bare-envelope path).
- [ ] `NetRevenueChartWidget` badge behavior unchanged (still the D-19602 `MOCK`); no edit to that file.
- [ ] Dashboard Gates green (lint / typecheck / `test:coverage` ≥ 90/80/88 / format / build).

## 8. Verification Steps

1. `pnpm --filter @legendary-arena/dashboard test` (incl. the new `useDataFreshness.test.ts`) green.
2. `pnpm --filter @legendary-arena/dashboard typecheck` exits 0.
3. Dashboard Gates green.
4. Live (D-24026, post-deploy): on `dashboard.legendary-arena.com/monetization`, Paid-Action
   Errors shows no false `MOCK` badge and no `NaNh ago`; Net Revenue unchanged.

## 9. User-Visible Impact

Operator/admin only (behind the dashboard's Hanko + Cloudflare Access gate). The Monetization
page's Paid-Action Errors widget no longer falsely flags live billing data as `MOCK`, and the
freshness line reads `Never` instead of `NaNh ago` on the live path. No player-facing surface.
Verified live per D-24026 (Step 8.4).

## 10. Definition of Done

- [ ] §4–6 implemented; all §7 criteria pass.
- [ ] Dashboard Gates + `pnpm --filter @legendary-arena/dashboard test` green; `git diff --name-only` = the three app files.
- [ ] WORK_INDEX/EC_INDEX/STATUS/mindmap updated; `roadmap:counts:check` exits 0.
- [ ] No new `D-entry` (enforces D-19804; D-19602 preserved).
- [ ] D-24026 live-verification recorded (operator-pending until deploy).

## Lint Gate Self-Review

Per `00.3` (21 sections): constraints block + `00.6` reference present (§1/§2); User-Visible
Surface declared + §9 present (§15.1); 5 acceptance criteria (§14). §21 **N/A** — no API endpoint
or library-function surface added/changed (the server `/api/dash/*` routes are unchanged; this is a
client-render fix). §17 (operator-trust/observability: the source badge is the mock-vs-live
signal). §20 N/A (no scoring/RNG/funding surface). §9 N/A (no shell scripts).

Gate verdicts (2026-08-10): pre-flight **READY TO EXECUTE**; copilot **PASS**; lint **PASS**
(self-reviewed at draft).
