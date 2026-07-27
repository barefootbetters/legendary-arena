/**
 * Dashboard Runtime Health — Routes (WP-439 / EC-474)
 *
 * Registers one read-only, `admin-session-required` GET on the `/api/dash/*`
 * surface, backing the dashboard's runtime-health tile:
 *
 *   * GET /api/dash/system/runtime → RuntimeHealthSnapshot  (live process metrics)
 *
 * Mirrors the WP-374 `dashboardGameplay` idiom: `Cache-Control: no-store` first
 * (D-11504), `requireAdminSession` (WP-159) gate, bare `{ data: T }` body
 * (D-20503). Unlike the gameplay/billing routes it takes NO database for its data
 * (the metric is sampled from `process`); the pool is passed only so the admin
 * gate can look up the session's account.
 *
 * Authority: WP-439 §Scope; D-24258; D-20503; D-11504.
 */

import { getRuntimeHealthSnapshot } from './dashboardRuntime.logic.js';
import type {
  DashboardRuntimeRouteDependencies,
  DatabaseClient,
} from './dashboardRuntime.types.js';
import type { RequireAuthenticatedSessionOptions } from '../auth/sessionToken.types.js';

/** Minimal structural Koa context surface this handler touches. */
interface KoaDashboardContext {
  readonly req: Parameters<
    DashboardRuntimeRouteDependencies['requireAdminSession']
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
 * the mapped error response and returns `false`. (Mirrors the WP-374
 * `dashboardGameplay` gate — the same three-code mapping.)
 */
async function passesAdminGate(
  koaContext: KoaDashboardContext,
  database: DatabaseClient,
  deps: DashboardRuntimeRouteDependencies,
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
 * Register the dashboard runtime-health route. The router is mutated in place;
 * returns `void`.
 */
export function registerDashboardRuntimeRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: DashboardRuntimeRouteDependencies,
): void {
  router.get('/api/dash/system/runtime', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      if ((await passesAdminGate(koaContext, database, deps)) === false) {
        return;
      }
      const data = getRuntimeHealthSnapshot();
      koaContext.status = 200;
      koaContext.body = { data };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { code: 'internal_error' };
    }
  });
}
