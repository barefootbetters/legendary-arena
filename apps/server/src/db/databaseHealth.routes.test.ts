/**
 * Tests for the database health route `GET /health/db` (D-24711).
 *
 * Pure: no live database and no HTTP listener. A fake pool stands in for
 * pg.Pool (answers, rejects, or never answers), and a fake Koa router captures
 * the registered handler so it can be invoked directly.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkDatabaseHealth,
  registerDatabaseHealthRoute,
  type DatabaseHealthQueryable,
} from './databaseHealth.routes.js';

interface FakeKoaContext {
  status: number;
  body: unknown;
  headers: Map<string, string>;
  set: (headerName: string, headerValue: string) => void;
}

type Handler = (koaContext: FakeKoaContext) => Promise<void>;

/** Records handlers by `METHOD path`. */
class FakeRouter {
  readonly handlers = new Map<string, Handler>();
  get(path: string, handler: Handler): void {
    this.handlers.set(`GET ${path}`, handler);
  }
}

/** A fresh fake Koa context with a header map. */
function makeKoaContext(): FakeKoaContext {
  const headers = new Map<string, string>();
  return {
    status: 404,
    body: undefined,
    headers,
    set(headerName: string, headerValue: string) {
      headers.set(headerName, headerValue);
    },
  };
}

const answeringPool: DatabaseHealthQueryable = {
  query: async () => ({ rows: [{ '?column?': 1 }] }),
};

const failingPool: DatabaseHealthQueryable = {
  query: async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
  },
};

// why: a database that accepts the connection but never answers — the case a
// plain try/catch misses and only the timeout catches.
const hangingPool: DatabaseHealthQueryable = {
  query: () => new Promise(() => undefined),
};

describe('checkDatabaseHealth (D-24711)', () => {
  test('answers 200 ok with a latency when SELECT 1 succeeds', async () => {
    const result = await checkDatabaseHealth(answeringPool, 1000);
    assert.equal(result.httpStatus, 200);
    assert.equal(result.body.status, 'ok');
    assert.equal(result.body.database, 'ok');
    assert.ok('latencyMs' in result.body && result.body.latencyMs >= 0);
  });

  test('answers 503 query_failed when SELECT 1 rejects, without echoing the error', async () => {
    const result = await checkDatabaseHealth(failingPool, 1000);
    assert.equal(result.httpStatus, 503);
    assert.deepEqual(result.body, { status: 'error', database: 'unreachable', reason: 'query_failed' });
    assert.ok(!JSON.stringify(result.body).includes('ECONNREFUSED'));
  });

  test('answers 503 timeout when SELECT 1 never answers', async () => {
    const result = await checkDatabaseHealth(hangingPool, 20);
    assert.equal(result.httpStatus, 503);
    assert.deepEqual(result.body, { status: 'error', database: 'unreachable', reason: 'timeout' });
  });

  test('a query that rejects after the timeout does not become an unhandled rejection', async () => {
    let rejectLater: (reason: Error) => void = () => undefined;
    const lateFailingPool: DatabaseHealthQueryable = {
      query: () => new Promise((_resolve, reject) => {
        rejectLater = reject;
      }),
    };
    let unhandledCount = 0;
    const onUnhandled = () => {
      unhandledCount += 1;
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const result = await checkDatabaseHealth(lateFailingPool, 10);
      assert.equal(result.body.status, 'error');
      rejectLater(new Error('Connection terminated due to connection timeout'));
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(unhandledCount, 0);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

describe('GET /health/db route (D-24711)', () => {
  test('registers exactly the one route', () => {
    const router = new FakeRouter();
    registerDatabaseHealthRoute(router, answeringPool);
    assert.deepEqual([...router.handlers.keys()], ['GET /health/db']);
  });

  test('sets no-store, 200 and the ok body when the database answers', async () => {
    const router = new FakeRouter();
    registerDatabaseHealthRoute(router, answeringPool, 1000);
    const koaContext = makeKoaContext();
    await router.handlers.get('GET /health/db')!(koaContext);
    assert.equal(koaContext.headers.get('Cache-Control'), 'no-store');
    assert.equal(koaContext.status, 200);
    assert.equal((koaContext.body as { status: string }).status, 'ok');
  });

  test('sets no-store and 503 when the database is down', async () => {
    const router = new FakeRouter();
    registerDatabaseHealthRoute(router, failingPool, 1000);
    const koaContext = makeKoaContext();
    await router.handlers.get('GET /health/db')!(koaContext);
    assert.equal(koaContext.headers.get('Cache-Control'), 'no-store');
    assert.equal(koaContext.status, 503);
    assert.deepEqual(koaContext.body, { status: 'error', database: 'unreachable', reason: 'query_failed' });
  });
});
