/**
 * dashboardBilling integration tests (WP-373 / EC-402).
 *
 * DB-gated: runs only when `TEST_DATABASE_URL` is set (skipped in the no-DB CI
 * suite). Seeds `legendary.stripe_events` + `legendary.stripe_checkout_sessions`,
 * runs the four logic queries against real Postgres (verifying the jsonb
 * extraction, `FILTER` counts, and day grouping), and cleans up in `after()`.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import pg from 'pg';

import { createPlayerAccount } from '../identity/identity.logic.js';
import {
  getBillingHealth,
  getBillingHealthSparklines,
  getRevenueDaily,
  getRevenueRecords,
} from './dashboardBilling.logic.js';
import type { DatabaseClient } from './dashboardBilling.types.js';

const { Pool } = pg;
const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

const SESSION_PREFIX = 'cs_wp373_';
const EVENT_PREFIX = 'evt_wp373_';

/** Build a stored `checkout.session.completed` webhook envelope. */
function completedPayload(sessionId: string, amountTotal: number | null): string {
  return JSON.stringify({
    id: sessionId.replace('cs_', 'evt_'),
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        amount_total: amountTotal,
        currency: 'usd',
      },
    },
  });
}

describe('dashboardBilling integration (DB-gated)', { skip: !hasTestDatabase }, () => {
  let pool: InstanceType<typeof Pool>;
  let database: DatabaseClient;
  let playerExtId: string;

  before(async () => {
    if (!hasTestDatabase) {
      return;
    }
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    database = pool as unknown as DatabaseClient;

    const account = await createPlayerAccount(
      {
        email: `wp373-${randomUUID()}@example.com`,
        displayName: 'WP373 Dashboard Billing',
        authProvider: 'email',
        authProviderId: `wp373-${randomUUID()}`,
      },
      pool as never,
    );
    assert.ok(account.ok === true, 'seed player created');
    // why: PlayerAccount.accountId IS the `ext_id` (the AccountId brand); it is
    // what `stripe_checkout_sessions.account_id` references.
    playerExtId = account.value.accountId;

    // checkout sessions: 4 total, 2 abandoned (expired + canceled)
    const sessions: ReadonlyArray<readonly [string, string, string]> = [
      [`${SESSION_PREFIX}1`, 'completed', 'supporter'],
      [`${SESSION_PREFIX}2`, 'expired', 'supporter'],
      [`${SESSION_PREFIX}3`, 'canceled', 'supporter'],
      [`${SESSION_PREFIX}4`, 'open', 'supporter'],
    ];
    for (const [sessionId, intentStatus, entitlementKey] of sessions) {
      await pool.query(
        `INSERT INTO legendary.stripe_checkout_sessions
           (session_id, account_id, price_id, entitlement_key, intent_status)
         VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, playerExtId, 'price_wp373', entitlementKey, intentStatus],
      );
    }

    // stripe events: 3 total, 1 failed webhook; 2 completed-checkout with amounts
    await pool.query(
      `INSERT INTO legendary.stripe_events (event_id, event_type, payload)
       VALUES ($1, 'checkout.session.completed', $2::jsonb)`,
      [`${EVENT_PREFIX}ok1`, completedPayload(`${SESSION_PREFIX}1`, 5000)],
    );
    await pool.query(
      `INSERT INTO legendary.stripe_events (event_id, event_type, payload)
       VALUES ($1, 'checkout.session.completed', $2::jsonb)`,
      [`${EVENT_PREFIX}ok2`, completedPayload(`${SESSION_PREFIX}_nojoin`, 1500)],
    );
    await pool.query(
      `INSERT INTO legendary.stripe_events (event_id, event_type, payload, process_error)
       VALUES ($1, 'checkout.session.completed', $2::jsonb, 'seed webhook failure')`,
      [`${EVENT_PREFIX}fail`, completedPayload(`${SESSION_PREFIX}fail`, null)],
    );
  });

  after(async () => {
    if (!hasTestDatabase || pool === undefined) {
      return;
    }
    await pool.query(`DELETE FROM legendary.stripe_events WHERE event_id LIKE $1`, [
      `${EVENT_PREFIX}%`,
    ]);
    await pool.query(
      `DELETE FROM legendary.stripe_checkout_sessions WHERE session_id LIKE $1`,
      [`${SESSION_PREFIX}%`],
    );
    if (playerExtId !== undefined) {
      await pool.query('DELETE FROM legendary.players WHERE ext_id = $1', [playerExtId]);
    }
    await pool.end();
  });

  test('getBillingHealth reads real failure + abandonment rates', async () => {
    const health = await getBillingHealth(database, 30);
    assert.ok(health.webhookTotalCount >= 3);
    assert.ok(health.webhookFailureCount >= 1);
    assert.ok(health.intentTotalCount >= 4);
    assert.ok(health.intentAbandonedCount >= 2);
    assert.ok(health.intentAbandonmentRate > 0 && health.intentAbandonmentRate <= 1);
    assert.ok(!Number.isNaN(health.webhookFailureRate));
  });

  test('getRevenueRecords extracts amount_total (dollars) + source, skipping the null', async () => {
    const records = await getRevenueRecords(database, 50);
    const ok1 = records.find((record) => record.date !== undefined && record.amount === 50);
    assert.ok(ok1, 'the $50 (5000c) completed purchase is present');
    assert.equal(ok1.currency, 'USD');
    assert.equal(ok1.source, 'supporter'); // joined to its checkout session's entitlement
    const nojoin = records.find((record) => record.amount === 15);
    assert.ok(nojoin, 'the $15 purchase with no matching session is present');
    assert.equal(nojoin.source, 'stripe'); // fallback when no session join
    // the failed-webhook event has null amount_total → skipped
    assert.ok(records.every((record) => Number.isFinite(record.amount)));
  });

  test('getRevenueDaily + sparklines return one point per UTC day', async () => {
    const daily = await getRevenueDaily(database, 7);
    assert.equal(daily.length, 8); // 7d window spans 8 UTC dates inclusive
    const total = daily.reduce((sum, metric) => sum + metric.value, 0);
    assert.ok(total >= 65, 'today includes the $50 + $15 completed purchases');
    const sparklines = await getBillingHealthSparklines(database, 7);
    assert.equal(sparklines.webhook.length, 8);
    assert.equal(sparklines.intent.length, 8);
  });
});
