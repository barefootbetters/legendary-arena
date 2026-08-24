/**
 * Tests for the registry-viewer `_middleware` asset-shell guard.
 *
 * A request under `/assets/` whose served response is the SPA HTML shell (a
 * missing hashed chunk) must return an uncacheable `404`, while a real asset and
 * ordinary SPA navigations pass through unchanged.
 *
 * NOTE (per the arena-client incident): these tests mock `context.next()`, so
 * they prove the guard LOGIC but NOT that Cloudflare actually invokes the
 * Function in production. That wiring depends on the `legendary-arena` Pages
 * project Root directory being `apps/registry-viewer`; verify it live with a
 * bogus-asset probe (see `_middleware.ts`), not with these tests alone.
 *
 * Runner: `node:test` (native).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './_middleware';

/**
 * Build a minimal Pages-Functions context whose `next()` resolves to a caller-
 * supplied response. Typed loosely via `unknown` because the guard only reads
 * `request` and `next`.
 *
 * @param url The request URL.
 * @param nextResponse The response `context.next()` should resolve to.
 * @param method The request method (defaults to GET).
 * @returns A context object accepted by `onRequest`.
 */
function makeContext(
  url: string,
  nextResponse: Response,
  method = 'GET',
): Parameters<typeof onRequest>[0] {
  return {
    request: new Request(url, { method }),
    env: {},
    next: async () => nextResponse,
  } as unknown as Parameters<typeof onRequest>[0];
}

/**
 * Build the SPA HTML shell response Cloudflare Pages' fallback serves for an
 * unmatched path (200 + text/html).
 */
function htmlShellResponse(): Response {
  return new Response('<!DOCTYPE html><html><head></head><body></body></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

test('missing hashed asset (HTML shell at an /assets/ URL) returns an uncacheable 404', async () => {
  const context = makeContext(
    'https://cards.legendary-arena.com/assets/index-DHXnxNt7.js',
    htmlShellResponse(),
  );

  const response = await onRequest(context);

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-type') ?? '', /text\/plain/);
});

test('a real hashed asset (javascript content-type) passes through unchanged', async () => {
  const realAsset = new Response('const __vite__=1', {
    status: 200,
    headers: {
      'content-type': 'application/javascript',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
  const context = makeContext(
    'https://cards.legendary-arena.com/assets/index-DHXnxNt7.js',
    realAsset,
  );

  const response = await onRequest(context);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/javascript');
  assert.equal(
    response.headers.get('cache-control'),
    'public, max-age=31536000, immutable',
  );
});

test('an ordinary SPA navigation (HTML at a non-asset path) passes through unchanged', async () => {
  const context = makeContext(
    'https://cards.legendary-arena.com/some/deep/spa-route',
    htmlShellResponse(),
  );

  const response = await onRequest(context);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
});

test('a CSS asset that fell back to the HTML shell also returns a 404', async () => {
  const context = makeContext(
    'https://cards.legendary-arena.com/assets/index-Bc8_E8DQ.css',
    htmlShellResponse(),
  );

  const response = await onRequest(context);

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
