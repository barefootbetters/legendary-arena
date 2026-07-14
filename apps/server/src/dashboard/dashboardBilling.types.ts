/**
 * Dashboard Billing + Revenue Endpoints — Types (WP-373 / EC-402)
 *
 * The server-side response shapes for the `/api/dash/*` billing + revenue feeds.
 * These **byte-match** the dashboard's own contract types so the dashboard's
 * `endpoints.ts` client can consume them unchanged; the dashboard has no server
 * import and vice-versa, so the shapes are mirrored here.
 *
 * **Drift source of truth:** `apps/dashboard/src/types/index.ts` (`BillingHealth`,
 * `RevenueRecord`, `DailyMetric`) + `apps/dashboard/src/services/billingHealthMocks.ts`
 * (`BillingHealthSparklines` / `BillingHealthSparklinePoint`). If those move, this
 * mirror must move with them.
 *
 * Authority: WP-373 §Contract; D-24168; D-19603 (billing-health forward contract);
 * D-20503 (bare `{ data: T }` envelope).
 */

import type { AdminSessionResult } from '../auth/adminSession.js';
import type {
  AccountResolver,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';

/**
 * Minimal structural database surface (a `pg.Pool`-compatible `query`). Kept
 * local so this module couples to no other module's `DatabaseClient` alias.
 */
export interface DatabaseClient {
  query(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ rows: ReadonlyArray<Record<string, unknown>> }>;
}

/** The closed set of dashboard date ranges (mirrors `analytics` `DateRange`). */
export type DashboardRange = '7d' | '14d' | '30d' | '90d';

/** Trailing-day span for each range. */
export const DASHBOARD_RANGE_DAYS: Readonly<Record<DashboardRange, number>> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '90d': 90,
};

/**
 * Billing health over a window. Byte-compatible with the dashboard `BillingHealth`
 * (the D-19603 forward-contract wire shape — 8 fields, exact names). Rates are in
 * `[0, 1]`; a zero-total window yields rate `0`, never `NaN`.
 */
export interface BillingHealth {
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly webhookFailureRate: number;
  readonly webhookFailureCount: number;
  readonly webhookTotalCount: number;
  readonly intentAbandonmentRate: number;
  readonly intentAbandonedCount: number;
  readonly intentTotalCount: number;
}

/** One day's rate on a billing-health sparkline (date = `YYYY-MM-DD`). */
export interface BillingHealthSparklinePoint {
  readonly date: string;
  readonly rate: number;
}

/** The two per-day sparklines that accompany the aggregate `BillingHealth`. */
export interface BillingHealthSparklines {
  readonly webhook: readonly BillingHealthSparklinePoint[];
  readonly intent: readonly BillingHealthSparklinePoint[];
}

/**
 * One completed-purchase revenue record. Byte-compatible with the dashboard
 * `RevenueRecord`. `amount` is in **whole currency units (dollars)** — the
 * Stripe `amount_total` is cents, divided by 100 here — and `currency` is
 * upper-cased, matching the mock convention.
 */
export interface RevenueRecord {
  readonly id: string;
  readonly date: string;
  readonly amount: number;
  readonly source: string;
  readonly currency: string;
}

/** A single `{ date, value }` time-series point (byte-compatible with `DailyMetric`). */
export interface DailyMetric {
  readonly date: string;
  readonly value: number;
}

/**
 * The caller-injected dependencies for the dashboard billing routes. Mirrors the
 * `AdminBillingRouteDependencies` shape so `server.mjs` can thread the same
 * `requireAdminSession` + `verifier` + `accountResolver` bundle.
 */
export interface DashboardBillingRouteDependencies {
  readonly requireAdminSession: (
    request: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<AdminSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
}
