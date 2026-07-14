/**
 * dashboardBilling.logic tests (WP-373 / EC-402).
 *
 * Unit-tests the rate math + day-fill + jsonb amount parsing against a fake
 * database that returns canned row batches in query order. A fixed `nowMs` makes
 * the window/day enumeration deterministic. The SQL itself is covered by the
 * DB-gated integration suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  centsToDollars,
  computeRate,
  getBillingHealth,
  getBillingHealthSparklines,
  getRevenueDaily,
  getRevenueRecords,
} from './dashboardBilling.logic.js';
import type { DatabaseClient } from './dashboardBilling.types.js';

/** A fake DB that returns queued `{ rows }` batches in call order. */
function fakeDatabase(
  batches: ReadonlyArray<ReadonlyArray<Record<string, unknown>>>,
): { database: DatabaseClient; calls: { sql: string; params: readonly unknown[] }[] } {
  const calls: { sql: string; params: readonly unknown[] }[] = [];
  let index = 0;
  const database: DatabaseClient = {
    query: async (text: string, params?: readonly unknown[]) => {
      calls.push({ sql: text, params: params ?? [] });
      const rows = batches[index] ?? [];
      index += 1;
      return { rows };
    },
  };
  return { database, calls };
}

// why: a fixed midday-UTC instant so the window bounds and day buckets are stable.
const FIXED_NOW = Date.parse('2026-07-13T12:00:00.000Z');

test('computeRate returns 0 for a zero total (never NaN)', () => {
  assert.equal(computeRate(0, 0), 0);
  assert.equal(computeRate(5, 0), 0);
  assert.equal(computeRate(2, 10), 0.2);
});

test('centsToDollars divides by 100', () => {
  assert.equal(centsToDollars(5000), 50);
  assert.equal(centsToDollars(4999), 49.99);
});

test('getBillingHealth computes the 8 fields with real rates', async () => {
  const { database } = fakeDatabase([
    [{ total: '10', failures: '2' }], // webhook
    [{ total: '8', abandoned: '3' }], // intent
  ]);
  const health = await getBillingHealth(database, 30, FIXED_NOW);
  assert.equal(health.webhookTotalCount, 10);
  assert.equal(health.webhookFailureCount, 2);
  assert.equal(health.webhookFailureRate, 0.2);
  assert.equal(health.intentTotalCount, 8);
  assert.equal(health.intentAbandonedCount, 3);
  assert.equal(health.intentAbandonmentRate, 0.375);
  assert.equal(health.windowEnd, new Date(FIXED_NOW).toISOString());
  assert.ok(health.windowStart < health.windowEnd);
});

test('getBillingHealth on an empty window yields 0 rates (not NaN)', async () => {
  const { database } = fakeDatabase([
    [{ total: '0', failures: '0' }],
    [{ total: '0', abandoned: '0' }],
  ]);
  const health = await getBillingHealth(database, 7, FIXED_NOW);
  assert.equal(health.webhookFailureRate, 0);
  assert.equal(health.intentAbandonmentRate, 0);
  assert.ok(!Number.isNaN(health.webhookFailureRate));
});

test('getBillingHealthSparklines emits one point per UTC day, filling gaps with 0', async () => {
  // days=2 → window is [now-2d, now]; enumerate the covered UTC dates.
  const { database } = fakeDatabase([
    [{ day: '2026-07-12', total: '4', failures: '1' }], // webhook: only one day has data
    [], // intent: no rows → all zero
  ]);
  const sparklines = await getBillingHealthSparklines(database, 2, FIXED_NOW);
  // the window covers 2026-07-11..2026-07-13 (3 UTC dates)
  assert.equal(sparklines.webhook.length, 3);
  assert.equal(sparklines.intent.length, 3);
  const jul12 = sparklines.webhook.find((point) => point.date === '2026-07-12');
  assert.ok(jul12);
  assert.equal(jul12.rate, 0.25);
  // a day with no data is filled at rate 0
  const jul11 = sparklines.webhook.find((point) => point.date === '2026-07-11');
  assert.ok(jul11);
  assert.equal(jul11.rate, 0);
  assert.ok(sparklines.intent.every((point) => point.rate === 0));
});

test('getRevenueRecords converts cents→dollars, uppercases currency, and SKIPS a missing amount', async () => {
  const { database } = fakeDatabase([
    [
      { id: 'evt_1', date: '2026-07-13', amount_total: '5000', currency: 'USD', source: 'supporter' },
      { id: 'evt_2', date: '2026-07-12', amount_total: null, currency: 'USD', source: 'stripe' },
      { id: 'evt_3', date: '2026-07-11', amount_total: '1299', currency: 'USD', source: 'playmat' },
    ],
  ]);
  const records = await getRevenueRecords(database, 50);
  // evt_2 (null amount_total) is skipped — not fabricated into a $0 record
  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    id: 'evt_1',
    date: '2026-07-13',
    amount: 50,
    source: 'supporter',
    currency: 'USD',
  });
  assert.equal(records[1]?.amount, 12.99);
});

test('getRevenueDaily sums amounts per UTC day in dollars, filling gaps with 0', async () => {
  const { database } = fakeDatabase([
    [{ day: '2026-07-12', cents: '15000' }], // $150 on one day
  ]);
  const metrics = await getRevenueDaily(database, 2, FIXED_NOW);
  assert.equal(metrics.length, 3); // 3 UTC dates in the window
  const jul12 = metrics.find((metric) => metric.date === '2026-07-12');
  assert.ok(jul12);
  assert.equal(jul12.value, 150);
  const jul13 = metrics.find((metric) => metric.date === '2026-07-13');
  assert.ok(jul13);
  assert.equal(jul13.value, 0);
});
