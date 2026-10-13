/**
 * Database health endpoint — `GET /health/db` (D-24711).
 *
 * `GET /health` answers `{ status: 'ok' }` without touching PostgreSQL, so it
 * stays 200 while the database is down: the server process is up, but every
 * signed-in route returns 500 and live matches stall. The external uptime
 * monitor and the droplet's on-box monitor both watch `/health`, so a dead
 * database raised no alert. This route runs `SELECT 1` through the shared
 * pool and answers 503 when that fails or takes too long, so a monitor
 * pointed here alerts on a database outage.
 *
 * `/health` itself is unchanged: the deploy health gate, `pnpm check`, and
 * the domain probes keep their process-only meaning.
 *
 * Layer-boundary contract: no engine, registry, preplan, or UI imports.
 */

/** The single query the check runs; any pg.Pool satisfies this shape. */
export interface DatabaseHealthQueryable {
  query: (queryText: string) => Promise<unknown>;
}

/** The response body. `reason` is a closed set; error details stay in the server log. */
export type DatabaseHealthBody =
  | { status: 'ok'; database: 'ok'; latencyMs: number }
  | { status: 'error'; database: 'unreachable'; reason: 'timeout' | 'query_failed' };

/** The HTTP status plus body a check produces. */
export interface DatabaseHealthResult {
  httpStatus: 200 | 503;
  body: DatabaseHealthBody;
}

// why: 3 s sits under the pool's 5 s connectionTimeoutMillis, so a database
// that accepts no connections answers `timeout` before the pool gives up, and
// well under the monitors' own request timeouts. A healthy SELECT 1 on
// localhost takes about a millisecond.
export const DATABASE_HEALTH_TIMEOUT_MS = 3000;

/**
 * Runs `SELECT 1` against the pool, bounded by a timeout.
 *
 * Never throws: every failure becomes a 503 result.
 *
 * @param pool - The shared pg.Pool (or any object with a `query` method).
 * @param timeoutMs - How long to wait before answering `timeout`.
 * @returns The HTTP status and body to send.
 */
export async function checkDatabaseHealth(
  pool: DatabaseHealthQueryable,
  timeoutMs: number = DATABASE_HEALTH_TIMEOUT_MS,
): Promise<DatabaseHealthResult> {
  const startedAt = Date.now();
  const queryPromise = pool.query('SELECT 1');
  // why: when the timeout wins the race, the query keeps running and may reject
  // later (the pool gives up after 5 s). Observing that rejection here keeps it
  // from surfacing as an unhandled rejection.
  queryPromise.catch(() => undefined);

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<'timeout'>((resolve) => {
    timeoutHandle = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  try {
    const outcome = await Promise.race([queryPromise.then(() => 'ok' as const), timeoutPromise]);
    if (outcome === 'timeout') {
      console.error(`[health/db] SELECT 1 did not answer within ${timeoutMs} ms; reporting the database unreachable.`);
      return { httpStatus: 503, body: { status: 'error', database: 'unreachable', reason: 'timeout' } };
    }
    return { httpStatus: 200, body: { status: 'ok', database: 'ok', latencyMs: Date.now() - startedAt } };
  } catch (queryError) {
    // why: log only the message, never the error object — a pg error carries
    // its whole Connection, which floods the log (same rule as createPool).
    const detail = queryError instanceof Error ? queryError.message : String(queryError);
    console.error(`[health/db] SELECT 1 failed; reporting the database unreachable: ${detail}`);
    return { httpStatus: 503, body: { status: 'error', database: 'unreachable', reason: 'query_failed' } };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/** The slice of a Koa context the handler writes. */
interface DatabaseHealthKoaContext {
  status: number;
  body: unknown;
  set: (headerName: string, headerValue: string) => void;
}

/**
 * Registers `GET /health/db` on the Koa router.
 *
 * @param router - The server's Koa router instance.
 * @param pool - The shared pg.Pool.
 * @param timeoutMs - Optional override of the check timeout (tests).
 */
// why: no auth, like `/health` and `/health/legends-publisher` — the body is an
// up/down flag, a latency, and a closed reason code. No connection details,
// error text, PII, or game state are returned.
export function registerDatabaseHealthRoute(
  router: { get: (path: string, handler: (koaContext: DatabaseHealthKoaContext) => Promise<void>) => void },
  pool: DatabaseHealthQueryable,
  timeoutMs: number = DATABASE_HEALTH_TIMEOUT_MS,
): void {
  router.get('/health/db', async (koaContext) => {
    // why: a monitor must see the database's state now, never a cached answer.
    koaContext.set('Cache-Control', 'no-store');
    const result = await checkDatabaseHealth(pool, timeoutMs);
    koaContext.status = result.httpStatus;
    koaContext.body = result.body;
  });
}
