/**
 * Dashboard Matches + Players + KPIs — Routes (WP-374 / EC-403)
 *
 * Registers three read-only, `admin-session-required` GETs on the `/api/dash/*`
 * surface (the WP-373 module), backing the dashboard's gameplay + KPI widgets.
 * Each mirrors the WP-373 `dashboardBilling` idiom: `Cache-Control: no-store`
 * first (D-11504), `requireAdminSession` (WP-159) gate, bare `{ data: T }` body
 * (D-20503).
 *
 *   * GET /api/dash/matches → MatchRecord[]  (bgio-blob match-summary projection, D-24169)
 *   * GET /api/dash/players → PlayerRecord[] (players + competitive_scores aggregate)
 *   * GET /api/dash/kpis    → KpiSnapshot[]  (derivable KPIs + prior-window trends)
 *
 * The startup `registry` is injected to build the ext_id → display-name resolver
 * once (the WP-361 idiom); no per-request registry work, no engine import.
 *
 * Authority: WP-374 §Scope; D-24169; D-20503; D-11504.
 */

import {
  getKpiSnapshots,
  getMatchRecords,
  getPlayerRecords,
} from './dashboardGameplay.logic.js';
import type {
  DashboardGameplayRouteDependencies,
  DatabaseClient,
} from './dashboardGameplay.types.js';
import { buildNameResolver, type ResolveName } from '../match/matchLagn.logic.js';
import type { RequireAuthenticatedSessionOptions } from '../auth/sessionToken.types.js';

/** Minimal structural Koa context surface these handlers touch. */
interface KoaDashboardContext {
  readonly req: Parameters<
    DashboardGameplayRouteDependencies['requireAdminSession']
  >[0];
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
 * Run the admin gate. Returns `true` for an authenticated admin; otherwise writes
 * the mapped error response and returns `false`. (Mirrors the WP-373
 * `dashboardBilling` gate — the second copy; abstract only on a third.)
 */
async function passesAdminGate(
  koaContext: KoaDashboardContext,
  database: DatabaseClient,
  deps: DashboardGameplayRouteDependencies,
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
  koaContext.status = 500;
  koaContext.body = { code: 'internal_error' };
  return false;
}

/**
 * Register the three dashboard gameplay/KPI routes. The router is mutated in
 * place; returns `void`.
 */
export function registerDashboardGameplayRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: DashboardGameplayRouteDependencies,
): void {
  // why: build the ext_id → display-name map ONCE (the registry is frozen for the
  // process lifetime), not per request — the WP-361 name-resolver idiom.
  const resolveName: ResolveName = buildNameResolver(deps.registry);

  router.get('/api/dash/matches', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      if ((await passesAdminGate(koaContext, database, deps)) === false) {
        return;
      }
      const data = await getMatchRecords(database, resolveName);
      koaContext.status = 200;
      koaContext.body = { data };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { code: 'internal_error' };
    }
  });

  router.get('/api/dash/players', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      if ((await passesAdminGate(koaContext, database, deps)) === false) {
        return;
      }
      const data = await getPlayerRecords(database);
      koaContext.status = 200;
      koaContext.body = { data };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { code: 'internal_error' };
    }
  });

  router.get('/api/dash/kpis', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      if ((await passesAdminGate(koaContext, database, deps)) === false) {
        return;
      }
      const data = await getKpiSnapshots(database);
      koaContext.status = 200;
      koaContext.body = { data };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { code: 'internal_error' };
    }
  });
}
