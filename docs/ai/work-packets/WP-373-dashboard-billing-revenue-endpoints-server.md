# WP-373 — Dashboard Billing + Revenue Endpoints (Server): wire `/api/dash` billing-health + revenue to Stripe data

**Status:** Draft 2026-07-13 · **READY (not blocked — all hard-deps Done)** · **Standard two-session lane** (a new server sub-surface `/api/dash/*` + a new module + 4 read endpoints over existing Stripe tables; server-only). Pairs with **EC-402** (execution-prep). Reserves **D-24168** (lands at execution).
**Primary Layer:** Server (`apps/server`)
**User-Visible Surface:** `dashboard.legendary-arena.com` — the `/monetization` and `/overview` billing/revenue widgets flip from mock to live once the deploy sets `VITE_USE_MOCKS=false` + `VITE_API_BASE_URL`. **D-24026 live-verify APPLIES** (operator-pending; also requires prod Stripe data).
**Dependencies:** WP-133/134 (Stripe checkout + webhook tables, `billing.config` price allowlist) ✅; WP-159 (`requireAdminSession`) ✅; WP-206 (the dashboard's `analyticsLiveFetchers` + the `/api/analytics/*` range/response pattern to mirror) ✅. **No unmerged dependency — executable now.**
**Baseline:** `origin/main` @ (capture at execution).

---

## Goal

Wire the first slice of the dashboard's live `/api/dash/*` family to real data:
**billing-health and revenue**, read from the existing Stripe tables. Today the
dashboard's `endpoints.ts` client calls `/api/dash/metrics/billing/health`,
`…/sparklines`, `/revenue`, and `/metrics/revenue` in live mode, but **no server
route serves them** (only `/api/analytics/*` exists), so the feeds are mock-only.
This packet stands up the `/api/dash/*` server sub-surface and implements the
four billing/revenue routes, honoring the **D-19603 forward contract** for
billing-health. It is the first of several WPs that will populate `/api/dash/*`
(matches / players / KPIs follow; `/system/nodes` + `/alerts` remain blocked on
absent infrastructure).

---

## User-Visible Impact

With the routes live and the deploy flipped to live mode, the dashboard's
billing-health widget shows the **real** webhook-failure and checkout-abandonment
rates, and the revenue widgets show **real** completed-purchase totals — instead
of synthetic mock data. (Empty/low numbers if prod Stripe volume is low is the
accurate reflection, per the legends-board "empty = data-supply state" precedent.)

---

## Assumes

- **The Stripe tables exist and carry the needed columns** (migration 012,
  WP-133/134): `legendary.stripe_events` (`event_type`, `payload jsonb`,
  `process_error`, `received_at`) and `legendary.stripe_checkout_sessions`
  (`intent_status ∈ {open,completed,expired,canceled}`, `price_id`,
  `entitlement_key`, `created_at`, `completed_at`). (Verified.)
- **The revenue dollar amount is NOT stored as a column.** The price allowlist
  (`billing.config`) maps `price_id → entitlementKey` only; there is no `amount`
  column on `stripe_checkout_sessions`. The amount lives in the stored
  `checkout.session.completed` webhook envelope at
  `stripe_events.payload -> 'data' -> 'object' -> 'amount_total'` (Stripe minor
  units / cents) with `-> 'currency'`. This is the sole in-repo revenue-amount
  source. (Verified: the full envelope is stored; no code reads `amount_total`
  today.)
- **No `finance` role exists** — only `is_admin` + `requireAdminSession` (WP-159;
  `adminSession.ts` notes a future `player_roles` table). So the D-19603
  "finance/admin role gate" resolves to **`admin-session-required`**, matching the
  existing `GET /api/admin/billing/history`. (Verified.)
- **The dashboard already targets these paths.** `apps/dashboard/.../endpoints.ts`
  calls `apiClient.get('/metrics/billing/health' | '/metrics/billing/health/sparklines'
  | '/revenue' | '/metrics/revenue')` against base `…/api/dash`, expecting a
  `ServiceResponse<T>`-compatible body. **No dashboard code change is needed** —
  only the server routes + a deploy-env flip. (Verified.)

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` **D-19603** (+ D-19605) — the billing-health forward
  contract: response byte-compatible with `BillingHealth`, rate invariants
  (`0.0 ≤ rate ≤ 1.0`; `count = round(total × rate)`), auth gate, `DateRange`
  normalization. This WP **fulfills** it.
- `apps/dashboard/src/types/index.ts` — the exact `BillingHealth` (8 fields),
  `RevenueRecord`, `DailyMetric` shapes the server must produce; and
  `billingHealthMocks.ts#BillingHealthSparklines`.
- `apps/dashboard/src/services/{endpoints.ts,api.ts,analyticsLiveFetchers.ts}` —
  the client paths (`/api/dash/*` base), the `ServiceResponse` envelope, the
  `range` param encoding.
- `apps/server/src/analytics/analytics.routes.ts` — the closest server precedent:
  `range` validation, the bare `{ data: T }` response (D-20503), `no-store`,
  registration shape. Mirror it.
- `apps/server/src/billing/{billing.config.ts,adminBilling.routes.ts,billingHistory.logic.ts,processStripeEvent.logic.ts}` — the price allowlist, the admin-billing route/gate idiom, and the checkout-session query shape to reuse.

---

## Non-Negotiable Constraints

- ESM; `node:` prefixed built-ins; human-style code per `00.6`; JSDoc; `.test.ts`.
- **Server-layer only.** No engine/registry/preplan import; no `boardgame.io`.
  Reads Postgres (billing tables) — server layer is allowed to.
- **New `/api/dash/*` sub-surface.** Routes are `GET /api/dash/metrics/billing/health`,
  `GET /api/dash/metrics/billing/health/sparklines`, `GET /api/dash/revenue`,
  `GET /api/dash/metrics/revenue`. New module `apps/server/src/dashboard/`
  (the future home of all `/api/dash/*` routes).
- **`admin-session-required` on every route** — `requireAdminSession` (WP-159) as
  the FIRST statement of each handler (no inline `is_admin` check); `401/403` per
  the WP-159 closed union. `Cache-Control: no-store` first statement of every
  response (incl. error paths).
- **D-19603 forward contract for billing-health.** Response is byte-compatible
  with `BillingHealth` (the 8 fields, exact names); rate invariants hold
  (`0 ≤ rate ≤ 1`; a zero-denominator window yields `rate = 0`, not `NaN`); the
  `range` maps to a UTC day window via the analytics `DateRange` handling.
- **Revenue amount provenance is explicit.** Amount = `amount_total` (integer
  minor units) from the `checkout.session.completed` envelope of
  `stripe_events`; currency = the envelope `currency`. Never invented, never from
  the allowlist (which has no amount). A malformed/absent `amount_total` row is
  skipped with a `// why:` note — never coerced to 0 silently in a way that
  distorts totals (documented).
- **Read-only.** No writes to any table; no migration. Determinism N/A (a live DB
  read); no `Math.random()` in the response path.
- **Types mirror the dashboard contract inline.** The server defines its own
  response types matching the dashboard shapes exactly (no cross-app import —
  the dashboard has no server import and vice-versa); a drift note points at
  `apps/dashboard/src/types/index.ts` as the contract source.

---

## Scope (In)

### A) `dashboard/dashboardBilling.types.ts` (new)
- Server-side response types byte-matching the dashboard's `BillingHealth` (8
  fields), `BillingHealthSparklines`, `RevenueRecord`, `DailyMetric`; the bare
  `{ data: T }` envelope (D-20503); the `DASHBOARD_RANGES` closed set + day map
  (mirror analytics).

### B) `dashboard/dashboardBilling.logic.ts` (new, pure query layer)
- `getBillingHealth(pool, windowStart, windowEnd)` → counts webhook failures
  (`stripe_events` where `process_error IS NOT NULL` in window) / total, and
  checkout abandonment (`stripe_checkout_sessions` where `intent_status IN
  ('expired','canceled')`) / total; returns the 8-field `BillingHealth` with the
  D-19603 rate invariants (zero-total → rate 0).
- `getBillingHealthSparklines(pool, windowStart, windowEnd)` → per-UTC-day rates
  across the window.
- `getRevenueRecords(pool, limit)` → recent completed purchases with
  `amount_total`/`currency` extracted from the `stripe_events` envelope.
- `getRevenueDaily(pool, windowStart, windowEnd)` → `DailyMetric[]` summing
  `amount_total` per UTC day. Column-enumerated SQL, explicit binds; `for...of`
  aggregation (no `.reduce()` branching).

### C) `dashboard/dashboardBilling.routes.ts` (new) + `server.mjs` wiring
- `registerDashboardBillingRoutes(router, pool, { requireAdminSession })` mounting
  the 4 routes; each: `no-store` → `requireAdminSession` → validate `range` (where
  present) → delegate to logic → `{ data }`. Wired in `server.mjs` alongside the
  other `register*Routes` calls.

### D) `docs/ai/REFERENCE/api-endpoints.md` (D-11804)
- 4 new `Wired` rows (`Auth = authenticated-session-required`, admin-noted), whole
  rows, in the same commit.

### E) Tests
- `dashboardBilling.logic.test.ts`: rate math (incl. zero-total → 0 and the
  `count = round(total×rate)` invariant); abandonment/failure counting; day
  bucketing; `amount_total` extraction (valid, missing → skipped) — fake pool.
- `dashboardBilling.routes.test.ts`: `requireAdminSession` first (401/403);
  `range` validation; `{ data }` shape; `no-store`. Fake router + injected gate.
- DB-gated integration (skip-when-no-`TEST_DATABASE_URL`): seed `stripe_events` +
  `stripe_checkout_sessions`, assert the four responses; clean up in `after()`.

---

## Out of Scope

- **The other `/api/dash/*` endpoints** (`/kpis`, `/players`, `/matches`,
  `/metrics/dau`) — later WPs.
- **`/system/nodes` and `/alerts`** — no data source exists (infra telemetry / an
  alerting model); explicitly deferred until that infrastructure is built.
- **No dashboard-app code change** — the client already calls these paths; the
  live flip is a deploy-env action (`VITE_USE_MOCKS=false` + `VITE_API_BASE_URL`),
  not code.
- **No new `finance` role / `player_roles` table** — admin gate for now; a finance
  role is a separate future decision.
- **No migration / no write path / no Stripe API call** — read-only over stored data.

---

## Files Expected to Change

- `apps/server/src/dashboard/dashboardBilling.types.ts` — **new**
- `apps/server/src/dashboard/dashboardBilling.logic.ts` — **new** (+ `.test.ts`)
- `apps/server/src/dashboard/dashboardBilling.routes.ts` — **new** (+ `.test.ts`)
- `apps/server/src/dashboard/dashboardBilling.integration.test.ts` — **new** (DB-gated)
- `apps/server/src/server.mjs` — **modified** (one `registerDashboardBillingRoutes` wiring)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** (4 rows, D-11804)
- Governance: `WORK_INDEX.md` + `DECISIONS.md` (**D-24168**) + `STATUS.md` + `wiki/dashboard.md` + mindmap. `EC_INDEX.md` + EC-402 at execution-prep.

**1 new module (types+logic+routes) + 3 test files + 1 wiring + 1 catalog. Standard two-session lane.** No engine/registry/migration touch.

---

## Contract

- **Routes (all `admin-session-required`):** `GET /api/dash/metrics/billing/health?range=`,
  `GET /api/dash/metrics/billing/health/sparklines?range=`, `GET /api/dash/revenue`,
  `GET /api/dash/metrics/revenue?range=`. Body: `{ data: T }` (D-20503).
- **Locked Values:**

| Key | Value |
|---|---|
| Surface | `/api/dash/*` (new; module `apps/server/src/dashboard/`) |
| Auth | `requireAdminSession` (WP-159), first statement; D-19603 finance→admin |
| Billing-health source | `stripe_events.process_error` (webhook fail) + `stripe_checkout_sessions.intent_status ∈ {expired,canceled}` (abandon) |
| Revenue amount source | `stripe_events.payload->'data'->'object'->'amount_total'` (cents) + `->'currency'`, `checkout.session.completed` only |
| Rate invariants | `0 ≤ rate ≤ 1`; zero-total → 0 (never NaN); `count = round(total×rate)` (D-19603) |
| Response envelope | bare `{ data: T }` (D-20503); `no-store` first statement |
| Range | mirror the analytics `DateRange` closed set + UTC day map |

---

## Acceptance Criteria

1. The 4 routes are registered under `/api/dash/*`, each gated by
   `requireAdminSession` as its first statement (401/403 per WP-159), `no-store`
   set on every path (**AC-1**).
2. `getBillingHealth` returns the 8-field `BillingHealth` with real
   failure/abandonment rates and the D-19603 invariants (zero-total → 0)
   (**AC-2**).
3. Revenue endpoints derive the amount from `amount_total` (cents) + `currency`
   in the completed-checkout envelope; a row missing `amount_total` is skipped,
   not zero-coerced into the totals (**AC-3**).
4. Response bodies are `{ data: T }` byte-compatible with the dashboard's
   `BillingHealth` / `BillingHealthSparklines` / `RevenueRecord[]` /
   `DailyMetric[]` shapes (**AC-4**).
5. `api-endpoints.md` gains 4 whole `Wired` rows (D-11804); no dashboard-app code
   change (**AC-5**).
6. Server no-DB suite green; DB-gated integration green against local Postgres;
   `pnpm -r build` 0 (**AC-6**).

---

## Verification Steps

```pwsh
pnpm -r build   # 0
pnpm --filter @legendary-arena/server exec node --import tsx --test "src/dashboard/**/*.test.ts"   # unit green
# DB-gated (local Postgres): TEST_DATABASE_URL set + migrations current, --test-concurrency=1
Select-String -Path "apps\server\src\dashboard\dashboardBilling.routes.ts" -Pattern "requireAdminSession|/api/dash|no-store"
Select-String -Path "apps\server\src\dashboard\dashboardBilling.logic.ts" -Pattern "amount_total|process_error|intent_status"
Select-String -Path "apps\server\src\dashboard\*.ts" -Pattern "boardgame.io|game-engine|registry"   # no output
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] 4 `/api/dash/*` billing/revenue routes live, admin-gated, `no-store`; new `apps/server/src/dashboard/` module
- [ ] Billing-health honors D-19603 (shape + rate invariants + auth); revenue amount from `amount_total` envelope (skip-on-missing)
- [ ] No engine/registry/`boardgame.io` import; no migration; no dashboard-app code change
- [ ] Server no-DB suite green; DB-gated integration green; `pnpm -r build` 0
- [ ] `DECISIONS.md` **D-24168** landed (Active); `WORK_INDEX` (WP-373) + `STATUS.md` + `api-endpoints.md` (4 rows) + `wiki/dashboard.md` + mindmap updated
- [ ] **User-visible verification (D-24026):** APPLIES but **deploy + prod-Stripe-data-dependent** — with the dashboard flipped to live mode against prod, the billing-health + revenue widgets render real figures. Operator-pending; proof at execution is the DB-gated integration suite (seeded rows → asserted responses).

---

## Vision Alignment

§Operating Posture (revenue visibility is the standing highest-leverage gap —
this makes real billing health + revenue observable to the operator). Business &
commerce (monetization is normal healthy operations — surfacing it is pro-revenue,
not to be softened). NG-1 N/A (no gameplay). Determinism N/A (a live DB read; no
RNG in the response path). §23(b) N/A.

## Lint Gate Self-Review (00.3)

§1–§21 PASS or N/A-with-reason. §5 standard lane (new module + 4 routes + catalog);
§8 Server boundary (Postgres read; no engine/registry import); §11 admin gate on
every route; §15.1 APPLIES but deploy+prod-data-dependent (integration suite is
the execution proof); §17 operating-posture/commerce, determinism N/A; §21
APPLIES — 4 new `Wired` endpoint rows in `api-endpoints.md` (D-11804 whole-row),
`Auth = authenticated-session-required`. §18 greps target `requireAdminSession` /
`/api/dash` / `amount_total` / `process_error` + the no-engine-import absence check.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight (01.4): READY.** All hard-deps Done on `main` (Stripe tables +
`requireAdminSession` + the analytics route pattern). Single layer (server).
Scope locked to billing+revenue (4 endpoints); the rest of `/api/dash/*` is
explicitly out of scope.

**Copilot (01.7): PASS.** Failure modes pinned: (a) inventing a revenue amount →
**`amount_total` from the stored envelope is the sole source; skip-on-missing,
never fabricate**; (b) `NaN` rate on a zero-total window → **zero-total → 0
invariant**; (c) missing the admin gate → **`requireAdminSession` first statement,
tested**; (d) drift from the dashboard shape → **types mirror
`apps/dashboard/src/types/index.ts` exactly, with a drift note**; (e) wrong prefix
→ **`/api/dash/*` to match the dashboard `apiClient` base (no client change)**;
(f) coupling to Stripe envelope shape → **narrow, defensive jsonb extraction with
a `// why:` note, mirroring `processStripeEvent`'s existing payload parsing**. No
BLOCK.

## Decision (reserved, lands at execution)

Reserves **D-24168**: wire the dashboard's `/api/dash/*` billing + revenue
endpoints to real Stripe data (the first `/api/dash/*` server slice). Locks: (1) a
new `apps/server/src/dashboard/` module + the `/api/dash/*` sub-surface; (2) four
read-only `admin-session-required` routes (`GET /api/dash/metrics/billing/health`,
`…/sparklines`, `/revenue`, `/metrics/revenue`); (3) **billing-health fulfills the
D-19603 forward contract** — `BillingHealth`-byte-compatible, rate invariants
(`0 ≤ rate ≤ 1`; zero-total → 0; `count = round(total×rate)`), the finance/admin
gate resolved to admin (no `finance` role exists); (4) **revenue amount source =
`stripe_events.payload->data->object->amount_total` (cents) + `currency` from the
`checkout.session.completed` envelope** — the price allowlist carries no amount;
skip-on-missing, never fabricated; (5) failure/abandonment from
`stripe_events.process_error` + `stripe_checkout_sessions.intent_status`; (6) bare
`{ data: T }` envelope (D-20503); (7) no migration, no write, no dashboard-app
change (live flip is a deploy-env action). `/system/nodes` + `/alerts` remain
blocked on absent infrastructure; `/kpis` / `/players` / `/matches` / DAU are
later WPs. Drafted 2026-07-13; not yet landed.
