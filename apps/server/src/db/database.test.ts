/**
 * Tests for the long-lived pg.Pool factory (WP-115).
 *
 * All tests are pure — no database. `new Pool()` does not open a connection
 * until the first checkout, so `createPool()` can be constructed and torn down
 * (`closePool`) in-process without a live PostgreSQL. The load-bearing assertion
 * is the crash-guard regression added 2026-07-22: the pool MUST carry an
 * 'error' listener, because node-postgres turns an unhandled pool 'error'
 * (an idle client the backend terminates) into an uncaughtException that crashes
 * the process — the root cause of the api.legendary-arena.com 502 crash loop.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createPool, closePool } from './database.js';

describe('createPool', () => {
  test('attaches an error listener so a terminated idle client cannot crash the process', async () => {
    const pool = createPool();
    try {
      // why: without at least one 'error' listener, pg re-emits an idle-client
      // backend error as an uncaughtException and the server process exits.
      assert.ok(
        pool.listenerCount('error') >= 1,
        'createPool must attach a pool-level error listener (crash-guard for backend-terminated idle clients)',
      );
    } finally {
      await closePool(pool);
    }
  });

  test('the attached error listener swallows an emitted idle-client error without throwing', async () => {
    const pool = createPool();
    try {
      // why: emitting 'error' with a listener present must not throw; with no
      // listener this same emit would surface as an uncaughtException. pg passes
      // the failed client as the second argument, which the handler ignores.
      assert.doesNotThrow(() => {
        pool.emit('error', new Error('simulated backend termination of an idle client'));
      });
    } finally {
      await closePool(pool);
    }
  });
});
