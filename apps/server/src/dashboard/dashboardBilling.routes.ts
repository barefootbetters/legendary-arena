/**
 * Dashboard Billing + Revenue Endpoints — Routes (WP-373 / EC-402)
 *
 * Registers the first `/api/dash/*` sub-surface: four read-only,
 * `admin-session-required` GETs that back the dashboard's billing-health +
 * revenue widgets. Each handler mirrors the `adminBilling.routes.ts` idiom:
 * `Cache-Control: no-store` as the first statement (D-11504), `requireAdminSession`
 * (WP-159) as the auth gate, then a bare `{ data: T }` body (D-20503).
 *
 *   * GET /api/dash/metrics/billing/health?range=            → BillingHealth
 *   * GET /api/dash/metrics/billing/health/sparklines?range= → BillingHealthSparklines
 *   * GET /api/dash/revenue                                  → RevenueRecord[]
 *   * GET /api/dash/metrics/revenue?range=                   → DailyMetric[]
 *
 * D-19603's "finance/admin role gate" resolves to admin — no `finance` role
 * exists (only `is_admin`), matching `GET /api/admin/billing/history`.
 *
 * Authority: WP-373 §Scope C; D-24168; D-19603; D-20503; D-11504.
 */

import {
  getBillingHealth,
  getBillingHealthSparklines,
  getRevenueDaily,
  getRevenueRecords,
} from './dashboardBilling.logic.js';
import {
  DASHBOARD_RANGE_DAYS,
  type DashboardBillingRouteDependencies,
  type DashboardRange,
  type DatabaseClient,
} from './dashboardBilling.types.js';
import type { RequireAuthenticatedSessionOptions } from '../auth/sessionToken.types.js';

// why: the dashboard revenue table shows the most recent purchases; 50 is a
// generous recent window (the mock shows 30) without unbounded reads.
const REVENUE_RECORD_LIMIT = 50;

/**
 * Minimal structural Koa context surface these handlers touch (no `@koa/router`
 * import — mirrors the adminBilling/analytics route modules).
 */
interface KoaDashboardContext {
  readonly req: Parameters<
    DashboardBillingRouteDependencies['requireAdminSession']
  >[0];
  readonly request: { readonly query: Record<string, unknown> };
  set(field: string, value: string): void;
  status: number;
  body: unknown;
}

interface KoaRouter {
  get(
    path: string,
    handler: (koaContext: KoaDashboardContext) => Promise<void> | void,
  ): unknown;
}

/**
 * Narrow the `range` query parameter to the closed `DashboardRange` set, or null.
 *
 * @param query The Koa request query bag.
 * @returns The validated range, or `null` when absent/invalid.
 */
function readRangeParam(query: Record<string, unknown>): DashboardRange | null {
  const raw = query.range;
  if (raw === '7d' || raw === '14d' || raw === '30d' || raw === '90d') {
    return raw;
  }
  return null;
}

/**
 * Run the shared admin gate. Returns `true` when the caller is an authenticated
 * admin; otherwise writes the mapped error response and returns `false`.
 */
async function passesAdminGate(
  koaContext: KoaDashboardContext,
  database: DatabaseClient,
  deps: DashboardBillingRouteDependencies,
): Promise<boolean> {
  const authResult = await deps.requireAdminSession(koaContext.req, {
    verifier: deps.verifier,
    accountResolver: deps.accountResolver,
    database: database as unknown as RequireAuthenticatedSessionOptions['database'],
  });
  if (authResult.ok === true) {
    return true;
  }
  if (authResult.code === 'unauthorized') {
    koaContext.status = 401;
    koaContext.body = { code: 'unauthorized', reason: authResult.reason };
    return false;
  }
  if (authResult.code === 'forbidden') {
    koaContext.status = 403;
    koaContext.body = { code: 'forbidden', reason: authResult.reason };
    return false;
  }
  // why: 'lookup_failed' — an admin-flag lookup error is a server fault, not a
  // client one; collapse to a bare 500 (no reason leaked).
  koaContext.status = 500;
  koaContext.body = { code: 'internal_error' };
  return false;
}

/**
 * Register the four dashboard billing/revenue routes on the supplied Koa router.
 * The router is mutated in place; returns `void`.
 */
export function registerDashboardBillingRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: DashboardBillingRouteDependencies,
): void {
  router.get('/api/dash/metrics/billing/health', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      if ((await passesAdminGate(koaContext, database, deps)) === false) {
        return;
      }
      const range = readRangeParam(koaContext.request.query);
      if (range === null) {
        koaContext.status = 400;
        koaContext.body = { code: 'invalid_request' };
        return;
      }
      const data = await getBillingHealth(database, DASHBOARD_RANGE_DAYS[range]);
      koaContext.status = 200;
      koaContext.body = { data };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { code: 'internal_error' };
    }
  });

  router.get('/api/dash/metrics/billing/health/sparklines', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      if ((await passesAdminGate(koaContext, database, deps)) === false) {
        return;
      }
      const range = readRangeParam(koaContext.request.query);
      if (range === null) {
        koaContext.status = 400;
        koaContext.body = { code: 'invalid_request' };
        return;
      }
      const data = await getBillingHealthSparklines(
        database,
        DASHBOARD_RANGE_DAYS[range],
      );
      koaContext.status = 200;
      koaContext.body = { data };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { code: 'internal_error' };
    }
  });

  router.get('/api/dash/revenue', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      if ((await passesAdminGate(koaContext, database, deps)) === false) {
        return;
      }
      const data = await getRevenueRecords(database, REVENUE_RECORD_LIMIT);
      koaContext.status = 200;
      koaContext.body = { data };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { code: 'internal_error' };
    }
  });

  router.get('/api/dash/metrics/revenue', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      if ((await passesAdminGate(koaContext, database, deps)) === false) {
        return;
      }
      const range = readRangeParam(koaContext.request.query);
      if (range === null) {
        koaContext.status = 400;
        koaContext.body = { code: 'invalid_request' };
        return;
      }
      const data = await getRevenueDaily(database, DASHBOARD_RANGE_DAYS[range]);
      koaContext.status = 200;
      koaContext.body = { data };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { code: 'internal_error' };
    }
  });
}
