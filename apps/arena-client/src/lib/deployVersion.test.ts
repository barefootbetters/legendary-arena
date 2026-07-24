// why: jsdom globals (fetch stubbing target) installed before the module under test.
import '../testing/jsdom-setup';

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isNewerBuildAvailable,
  fetchDeployedSha,
  DEPLOY_VERSION_URL,
} from './deployVersion';

/**
 * Tests for the WP-418 deploy-freshness helpers. `isNewerBuildAvailable` is a
 * pure comparison (no I/O); `fetchDeployedSha` wraps a `globalThis.fetch` of
 * `version.json` and MUST fail soft (any error / missing / unparseable ⇒ null).
 */

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---- isNewerBuildAvailable (pure) ----

test('isNewerBuildAvailable — true only when both shas are non-empty and differ', () => {
  assert.equal(isNewerBuildAvailable('abc123', 'def456'), true, 'different shas ⇒ newer');
});

test('isNewerBuildAvailable — same sha is not newer', () => {
  assert.equal(isNewerBuildAvailable('abc123', 'abc123'), false, 'identical shas ⇒ not newer');
});

test('isNewerBuildAvailable — empty / null / undefined on either side is fail-soft false', () => {
  assert.equal(isNewerBuildAvailable('', 'def456'), false, 'empty baked ⇒ false');
  assert.equal(isNewerBuildAvailable('abc123', ''), false, 'empty fetched ⇒ false');
  assert.equal(isNewerBuildAvailable(null, 'def456'), false, 'null baked ⇒ false');
  assert.equal(isNewerBuildAvailable('abc123', null), false, 'null fetched ⇒ false');
  assert.equal(isNewerBuildAvailable(undefined, 'def456'), false, 'undefined baked ⇒ false');
  assert.equal(isNewerBuildAvailable('abc123', undefined), false, 'undefined fetched ⇒ false');
  assert.equal(isNewerBuildAvailable('', ''), false, 'both empty ⇒ false');
});

// ---- fetchDeployedSha (fail-soft I/O) ----

/** Stub fetch to resolve with a canned status + JSON body. */
function stubFetch(status: number, body: unknown): void {
  globalThis.fetch = (async (url: unknown) => {
    assert.equal(url, DEPLOY_VERSION_URL, 'fetches the version.json path');
    return {
      status,
      json: async () => body,
    } as Response;
  }) as typeof globalThis.fetch;
}

test('fetchDeployedSha — returns the gitSha from a 200 body', async () => {
  stubFetch(200, { gitSha: 'deadbee' });
  assert.equal(await fetchDeployedSha(), 'deadbee');
});

test('fetchDeployedSha — a non-200 response is fail-soft null', async () => {
  stubFetch(404, { gitSha: 'deadbee' });
  assert.equal(await fetchDeployedSha(), null, '404 ⇒ null');
});

test('fetchDeployedSha — a rejected fetch is fail-soft null', async () => {
  globalThis.fetch = (async () => {
    throw new Error('Simulated network failure.');
  }) as typeof globalThis.fetch;
  assert.equal(await fetchDeployedSha(), null, 'network error ⇒ null');
});

test('fetchDeployedSha — an unparseable body is fail-soft null', async () => {
  globalThis.fetch = (async () =>
    ({
      status: 200,
      json: async () => {
        throw new Error('Unexpected token.');
      },
    }) as unknown as Response) as typeof globalThis.fetch;
  assert.equal(await fetchDeployedSha(), null, 'bad JSON ⇒ null');
});

test('fetchDeployedSha — a sha-less / empty-sha body is fail-soft null', async () => {
  stubFetch(200, { notGitSha: 'x' });
  assert.equal(await fetchDeployedSha(), null, 'missing gitSha ⇒ null');
  stubFetch(200, { gitSha: '' });
  assert.equal(await fetchDeployedSha(), null, 'empty gitSha ⇒ null');
});
