/**
 * api.ts tests — the apiClient bearer request interceptor (WP-373/374 live-auth fix).
 *
 * The `endpoints.ts` family (billing/revenue/matches/players/kpis) hits
 * `admin-session-required` `/api/dash/*` routes, so the apiClient must attach the
 * operator's Hanko bearer from the shared `authToken.ts` seam.
 */

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

import { attachAuthHeader } from './api.js';
import { registerAuthTokenReader } from './authToken.js';

function makeConfig(): InternalAxiosRequestConfig {
  return { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
}

afterEach(() => {
  // why: reset the shared token seam so a token set here does not leak into other suites.
  registerAuthTokenReader(() => null);
});

test('attachAuthHeader sets the Bearer header when the operator token is present', () => {
  registerAuthTokenReader(() => 'operator-token');
  const result = attachAuthHeader(makeConfig());
  assert.equal(result.headers.get('Authorization'), 'Bearer operator-token');
});

test('attachAuthHeader attaches no header when the token is null (fails closed at the server)', () => {
  registerAuthTokenReader(() => null);
  const result = attachAuthHeader(makeConfig());
  assert.ok(!result.headers.get('Authorization'), 'no Authorization header when unauthenticated');
});
