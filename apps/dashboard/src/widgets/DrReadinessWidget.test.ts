/**
 * DrReadinessWidget tests (WP-517 / EC-552).
 *
 * The widget is a thin template over `useFetch(fetchDrReadiness)`; its LIVE path
 * is the admin-gated GET /api/dash/dr-readiness and its mock-mode path is
 * `mockDrReadiness`. The test runner is `node --test` (no `@vue/test-utils`), so
 * this file locks the widget's mock-mode DATA CONTRACT — the payload the tile
 * renders by default — against a FIXED `nowMs` (no clock, no network). The
 * server-side derivation is covered by `dashboardDrReadiness.routes.test.ts`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mockDrReadiness } from '../services/drReadinessMocks.js';

// A fixed reference instant so the derived dates are deterministic: 2026-08-09.
const NOW_MS = Date.UTC(2026, 7, 9, 12, 0, 0);

test('mockDrReadiness wraps the payload with the MOCK freshness label + updatedAt', () => {
  const response = mockDrReadiness(NOW_MS);
  assert.equal(response.source, 'MOCK');
  assert.equal(response.updatedAt, NOW_MS);
});

test('mockDrReadiness data is the healthy mock-mode posture', () => {
  const { data } = mockDrReadiness(NOW_MS);
  assert.equal(data.source, 'mock');
  assert.equal(data.overdue, false);
  assert.equal(data.nextDue, '2026-09-01');
  assert.deepEqual(data.lastDrill, { date: '2026-08-01', result: 'pass' });
});

test('mockDrReadiness rolls the next-due date over a year boundary (UTC)', () => {
  const { data } = mockDrReadiness(Date.UTC(2026, 11, 15, 0, 0, 0));
  assert.equal(data.nextDue, '2027-01-01');
  assert.deepEqual(data.lastDrill, { date: '2026-12-01', result: 'pass' });
});
