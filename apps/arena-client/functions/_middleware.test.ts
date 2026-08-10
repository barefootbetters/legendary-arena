/**
 * Tests for the `_middleware` asset-shell guard — Client App edge subsurface.
 *
 * Focused on the 2026-08-10 CDN cache-poisoning fix: a request under `/assets/`
 * whose served response is the SPA HTML shell (a missing hashed chunk) must
 * return an uncacheable `404`, while a real asset and ordinary SPA navigations
 * pass through unchanged. The profile-meta enrichment path (which needs a live
 * `HTMLRewriter` / `fetch`) is covered by `lib/buildProfileMeta.test.ts` and is
 * not exercised here — every case below returns before that path runs.
 *
 * Runner: `node:test` (native). No game-framework, engine, or registry imports.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './_middleware';

/**
 * Build a minimal Pages-Functions context whose `next()` resolves to a caller-
 * supplied response. Typed loosely via `unknown` because the test only uses the
 * three members the middleware reads (`request`, `env`, `next`).
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
    'https://play.legendary-arena.com/assets/index-DHXnxNt7.js',
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
    'https://play.legendary-arena.com/assets/index-DHXnxNt7.js',
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
  const shell = htmlShellResponse();
  const context = makeContext(
    'https://play.legendary-arena.com/some/deep/spa-route',
    shell,
  );

  const response = await onRequest(context);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
});

test('a CSS asset that fell back to the HTML shell also returns a 404', async () => {
  const context = makeContext(
    'https://play.legendary-arena.com/assets/index-Bc8_E8DQ.css',
    htmlShellResponse(),
  );

  const response = await onRequest(context);

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
