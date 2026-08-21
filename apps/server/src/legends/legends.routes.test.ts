/**
 * Tests for the legends-publisher health route (WP-142 / EC-157).
 *
 * All tests are pure (no live database, no HTTP listener): a fake Koa
 * router captures the registered handler. This route is a public,
 * unauthenticated, bodyless health endpoint — there is no auth-gate to
 * exercise and no request body to parse — so the harness asserts the
 * exact registered route and that the handler forwards the publisher
 * health snapshot to the response body.
 *
 * Layer-boundary: imports nothing from the engine runtime, the
 * registry runtime, or any UI package.
 *
 * Authority: WP-142 §D; EC-157 §Locked Values; D-14206.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { registerLegendsPublisherRoutes } from './legends.routes.js';
import { getLegendsPublisherHealth } from './legends.scheduler.js';

type Handler = (koaContext: { body: unknown }) => void;

/**
 * Fake Koa router that records handlers by `METHOD path` so a test can
 * invoke them directly without an HTTP listener.
 */
class FakeRouter {
  readonly handlers = new Map<string, Handler>();
  get(path: string, handler: Handler): void {
    this.handlers.set(`GET ${path}`, handler);
  }
}

function registerAndGet(): Map<string, Handler> {
  const router = new FakeRouter();
  registerLegendsPublisherRoutes(router);
  return router.handlers;
}

describe('legends publisher health route (WP-142)', () => {
  test('registers exactly the one locked route', () => {
    const handlers = registerAndGet();
    const keys = [...handlers.keys()];
    assert.deepEqual(keys, ['GET /health/legends-publisher']);
  });

  test('forwards the publisher health snapshot to the response body', () => {
    const handlers = registerAndGet();
    const koaContext = { body: undefined as unknown };
    handlers.get('GET /health/legends-publisher')!(koaContext);
    // why: the handler sets the body to the module-level health state returned
    // by getLegendsPublisherHealth() — the same object reference, so an identity
    // check proves the wiring without coupling to the snapshot's contents.
    assert.equal(koaContext.body, getLegendsPublisherHealth());
  });
});
