# EC-402 — Dashboard Billing + Revenue Endpoints (Server) (WP-373)

**Pairs with:** WP-373 · **Reserves:** D-24168 · **Lane:** standard two-session · **Status:** execution-prep 2026-07-13
**Layer:** Server (`apps/server`). New `apps/server/src/dashboard/` module + `/api/dash/*` sub-surface. Server-only; no migration, no dashboard-app change.

## Before Starting
- [ ] Baseline on `origin/main`. `pnpm -r build` before the DB-gated suite. DB-gated tests skip without `TEST_DATABASE_URL`.

## Locked Values (mirror the existing precedents)
- **Auth:** `requireAdminSession(koaContext.req, { verifier, accountResolver, database })` → `AdminSessionResult` (`ok`/`code` ∈ unauthorized|forbidden|lookup_failed). Mirror `adminBilling.routes.ts` exactly: `Cache-Control: no-store` FIRST statement; gate; on `ok` run logic → `{ data }`; `unauthorized`→401 `{code,reason}`, `forbidden`→403, `lookup_failed`/throw→500 `{code:'internal_error'}`. Deps interface mirrors `AdminBillingRouteDependencies` (`requireAdminSession` + optional `verifier`/`accountResolver`).
- **Range:** `DateRange = '7d'|'14d'|'30d'|'90d'` + `RANGE_DAYS` map (define locally, mirror `analytics.logic.ts`). `readRangeParam(query) → DateRange|null`; null → 400 `{code:'invalid_request'}`. `/revenue` takes NO range (recent LIMIT).
- **Envelope:** bare `{ data: T }` (D-20503). Response types byte-match the dashboard shapes (drift note → `apps/dashboard/src/types/index.ts` + `billingHealthMocks.ts`):
  - `BillingHealth` (8 readonly fields): windowStart/End (ISO), webhookFailureRate/Count/TotalCount, intentAbandonmentRate/AbandonedCount/TotalCount.
  - `BillingHealthSparklines = { webhook: {date,rate}[], intent: {date,rate}[] }` (date = `YYYY-MM-DD`).
  - `RevenueRecord = { id, date(YYYY-MM-DD), amount(DOLLARS), source, currency(UPPER) }`.
  - `DailyMetric = { date(YYYY-MM-DD), value }`.
- **Sources (verified):**
  - Webhook failure = `legendary.stripe_events` `count(*) FILTER (WHERE process_error IS NOT NULL)` / `count(*)` in the window (`received_at`).
  - Intent abandonment = `legendary.stripe_checkout_sessions` `count(*) FILTER (WHERE intent_status IN ('expired','canceled'))` / `count(*)` (`created_at`).
  - Revenue amount = `stripe_events.payload->'data'->'object'->>'amount_total'` (cents → **÷100 dollars**) + `->>'currency'` (**upper**) for `event_type='checkout.session.completed'`; source = `COALESCE(checkout_sessions.entitlement_key,'stripe')` via LEFT JOIN on `payload->'data'->'object'->>'id' = session_id`. **Skip rows with NULL `amount_total`** (never zero-coerce into totals).
- **Rate invariants (D-19603):** `0 ≤ rate ≤ 1`; **zero-total window → rate 0 (never NaN)**; `count = round(total×rate)` holds by construction (counts are exact, rate = count/total).
- **SQL discipline:** column-enumerated; explicit `$n` binds (cast `::int`/`::bigint`); `for...of` in JS aggregation (no `.reduce()` branching); day series via `generate_series` LEFT JOIN so empty days render (rate 0 / value 0). ORDER BY in SQL (no JS re-sort).

## Guardrails
- [ ] No engine/registry/preplan/`boardgame.io` import; server layer reads Postgres.
- [ ] Every route: `no-store` first + `requireAdminSession` first-gate. Read-only (no write/migration/Stripe API).
- [ ] Revenue amount never fabricated; NULL `amount_total` skipped. Dollars (÷100), currency uppercased.

## Files to Produce
- `apps/server/src/dashboard/dashboardBilling.types.ts` (new)
- `apps/server/src/dashboard/dashboardBilling.logic.ts` (new) + `.test.ts`
- `apps/server/src/dashboard/dashboardBilling.routes.ts` (new) + `.test.ts`
- `apps/server/src/dashboard/dashboardBilling.integration.test.ts` (new, DB-gated)
- `apps/server/src/server.mjs` (register `registerDashboardBillingRoutes(server.router, pool, { requireAdminSession, verifier, accountResolver: verifier===undefined?undefined:accountResolver })`)
- `docs/ai/REFERENCE/api-endpoints.md` (4 `Wired` rows, `Auth = authenticated-session-required` admin-noted, D-11804)

## Routes
`GET /api/dash/metrics/billing/health?range=` · `GET /api/dash/metrics/billing/health/sparklines?range=` · `GET /api/dash/revenue` · `GET /api/dash/metrics/revenue?range=`

## Tests
- `logic.test.ts` (fake pool): rate math + zero-total→0 + `count=round(total×rate)`; abandonment/failure counting; day bucketing/fill; `amount_total` extraction (valid ÷100, NULL skipped), currency upper, source COALESCE.
- `routes.test.ts` (fake router + injected gate): `no-store` first; `requireAdminSession` gate (401/403/500); range 400; `{data}` shape.
- `integration.test.ts` (DB-gated, `--test-concurrency=1`): seed `stripe_events` + `stripe_checkout_sessions`, assert all 4; clean up in `after()`.

## After Completing
- [ ] `pnpm -r build` 0; server no-DB suite green; DB-gated integration green.
- [ ] D-24168 → Active; WORK_INDEX WP-373 `[x]`; EC_INDEX EC-402 row; STATUS; `api-endpoints.md` 4 rows; `wiki/dashboard.md` note (in-progress → wired); mindmap 📝→✅ + counts.
- [ ] D-24026 operator-pending (deploy + live flip + prod Stripe data).

## Common Failure Smells
- Revenue 100× off → forgot ÷100 (cents→dollars); lowercase currency → uppercase.
- NaN rate on empty window → guard zero-total → 0.
- Missing the admin gate first-statement → mirror adminBilling.
- jsonb `->>` returns text → cast `::bigint` before summing.
- generate_series timezone drift → use UTC (`date_trunc('day', … AT TIME ZONE 'UTC')` consistently) so day buckets match `YYYY-MM-DD`.
