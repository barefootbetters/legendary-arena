# EC-562 — Dashboard Money-Widget Source Badge Truthfulness (Execution Checklist)

**Source:** docs/ai/work-packets/WP-527-dashboard-money-widget-source-badge.md
**Layer:** App (`apps/dashboard`) — one WP, standard two-session lane, two-commit topology

## Before Starting
- [ ] Enumerate the EXACT target file set (= WP §5); any edit outside it is a FAIL
- [ ] Read `apps/dashboard/src/widgets/RevenueChartWidget.vue` — the CORRECT pattern to mirror (`useFetch` → `source` → `useDataFreshness(updatedAt, source)`, `v-if="sourceLabel"`); do not invent a new shape
- [ ] Read `apps/dashboard/src/composables/useDataFreshness.ts` — note it returns `'Never'` for `updatedAt === null` but `'NaNh ago'` for `undefined`/NaN
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` exits 0 (clean baseline)
- [ ] `pnpm --filter @legendary-arena/dashboard test` exits 0 (clean baseline)

## Locked Values (do not re-derive)
- Badge source = `ServiceResponse.source` (D-19804). Mock → `MOCK`; live (bare `{ data }` envelope, `source` undefined) → **no badge** via `v-if="sourceLabel"`. Mirror `RevenueChartWidget.vue` exactly.
- `useDataFreshness`: `relativeTime === 'Never'` when `updatedAt` is `null` / `undefined` / non-finite (`Number.isFinite` guard); `sourceLabel === ''` when `source` is `null` / `undefined`.
- `PaidActionErrorsWidget`: replace `sourceLabelRef = ref<'MOCK'>('MOCK')` + literal `<span class="source">MOCK</span>` with `summaryFetch.source` threaded through `useDataFreshness`, badge gated `v-if="sourceLabel"`.

## Guardrails
- **`NetRevenueChartWidget.vue` MUST NOT be edited** — its `MOCK` is the intentional D-19602 deduction-placeholder posture; its `NaNh ago` is fixed transitively by the `useDataFreshness` guard.
- **`RevenueChartWidget.vue` MUST NOT be edited** — already correct; it is the reference only.
- No server / `endpoints.ts` / route / mock-data change — app-render fix only.
- No new `DECISIONS.md` entry (enforces D-19804; preserves D-19602). No `NUMBER-LEDGER` edit (already reserved).
- `git diff --name-only` (impl commit) == exactly `PaidActionErrorsWidget.vue` + `useDataFreshness.ts` + `useDataFreshness.test.ts`.
- Two-commit topology: `EC-562:` implementation + `SPEC:` govern-close.

## Required `// why:` Comments
- `useDataFreshness.ts` at the non-finite guard: why absent/`NaN` `updatedAt` maps to `'Never'` (the live `/api/dash/*` bare `{ data }` envelope carries no `updatedAt`, so an unguarded subtraction renders `NaNh ago`).
- `PaidActionErrorsWidget.vue` at the badge wiring: why the source is read from the fetched `ServiceResponse.source` (D-19804) and hidden when absent — a hardcoded label mislabels live data.

## Files to Produce
- `apps/dashboard/src/widgets/PaidActionErrorsWidget.vue` — **modified** — badge from `summaryFetch.source`; remove hardcoded `MOCK`; `v-if="sourceLabel"`
- `apps/dashboard/src/composables/useDataFreshness.ts` — **modified** — non-finite/absent `updatedAt` → `'Never'`
- `apps/dashboard/src/composables/useDataFreshness.test.ts` — **new** — freshness-guard + source-label unit tests
- Govern-close: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/ai/STATUS.md`, `docs/05-ROADMAP-MINDMAP.md` (`📝`→`✅` + `roadmap:counts:write`). No `DECISIONS.md`/`NUMBER-LEDGER.md` in the diff.

## After Completing
- [ ] `pnpm --filter @legendary-arena/dashboard test` exits 0 (incl. new `useDataFreshness.test.ts`)
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` exits 0
- [ ] Dashboard Gates green (lint / typecheck / `test:coverage` ≥ 90/80/88 / format / build); `pnpm -r --no-bail test` green
- [ ] `git diff --name-only` = the three app files (only)
- [ ] Live-on-surface (D-24026): `dashboard.legendary-arena.com/monetization` — Paid-Action Errors shows no false `MOCK` badge and no `NaNh ago`; Net Revenue unchanged — operator-pending until deploy
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells
- Badge still shows `MOCK` on the deployed live page → the widget still hardcodes the label instead of reading `useFetch().source`
- `NaNh ago` still renders → the `useDataFreshness` guard uses `=== null` only; it must also catch `undefined` / non-finite (`Number.isFinite`)
- `NetRevenueChartWidget.vue` appears in the diff → out of scope; its `MOCK` is intentional (D-19602)
- Coverage gate reds → the new `useDataFreshness.test.ts` must cover the added guard branch (the composable is the testable unit; the `.vue` is not unit-tested)
