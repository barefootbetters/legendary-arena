/**
 * Tests for the bot-ally cross-instance ownership lease helpers
 * (WP-437 / EC-472 / D-24256).
 *
 * The lease SEMANTICS (claim / renew / peer-yield / TTL expiry) are evaluated by
 * Postgres inside the atomic UPDATE, so these unit tests (no live DB) pin the two
 * things a fake `database` can prove without one: (1) the SQL carries exactly the
 * claimable conditions + the TTL window + the right params, and (2) the returned
 * boolean tracks `rowCount` (claimed/renewed ⇒ owned; a fresh peer lease matched
 * no row ⇒ not owned). The driver-level drive-or-yield arbitration is covered by
 * the injected-fake cases in `botAllyDriver.test.ts`. A live-DB claim/expiry
 * assertion is the operator-pending D-24026 step (deploy-overlap is not
 * unit-reproducible).
 *
 * Run by the server test runner: `node --import tsx --test src/**\/*.test.ts`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SERVER_INSTANCE_ID,
  BOT_ALLY_LEASE_TTL_MS,
  acquireOrRenewBotAllyLease,
  releaseBotAllyLeasesForOwner,
} from './botAllyOwnership.mjs';

/**
 * A fake pg pool that records every query + params and returns a canned rowCount.
 */
function makeFakeDatabase(rowCount: number) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const database = {
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return { rowCount, rows: [] };
    },
  };
  return { database, calls };
}

test('the instance id + TTL are the locked shapes', () => {
  assert.equal(typeof SERVER_INSTANCE_ID, 'string');
  assert.ok(SERVER_INSTANCE_ID.length >= 16, 'the instance id is a real unique id');
  assert.equal(BOT_ALLY_LEASE_TTL_MS, 15000, 'the lease TTL is locked at 15s');
});

test('acquireOrRenewBotAllyLease returns true when a row was claimed/renewed', async () => {
  const { database, calls } = makeFakeDatabase(1);

  const owned = await acquireOrRenewBotAllyLease(database, 'm-1', SERVER_INSTANCE_ID, BOT_ALLY_LEASE_TTL_MS);

  assert.equal(owned, true, 'rowCount 1 ⇒ this instance holds the lease');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.params, ['m-1', SERVER_INSTANCE_ID, BOT_ALLY_LEASE_TTL_MS]);
  const { sql } = calls[0]!;
  assert.ok(sql.includes('UPDATE legendary.match_bot_ally'), 'updates the side-table');
  assert.ok(sql.includes('SET driver_owner = $2') && sql.includes('heartbeat_at = now()'), 'stamps owner + heartbeat');
  assert.ok(sql.includes('driver_owner IS NULL'), 'claimable when unowned');
  assert.ok(sql.includes('driver_owner = $2'), 'renewable when already mine');
  assert.ok(sql.includes('heartbeat_at IS NULL'), 'claimable when a legacy row never heartbeated');
  assert.ok(
    sql.includes("heartbeat_at < now() - ($3 * interval '1 millisecond')"),
    'claimable when the owner heartbeat is older than the TTL',
  );
});

test('acquireOrRenewBotAllyLease returns false when a fresh peer lease matched no row', async () => {
  // why: a different owner that heartbeated within the TTL fails the WHERE, so
  // Postgres updates no row and rowCount is 0 — this instance yields.
  const { database } = makeFakeDatabase(0);

  const owned = await acquireOrRenewBotAllyLease(database, 'm-2', SERVER_INSTANCE_ID, BOT_ALLY_LEASE_TTL_MS);

  assert.equal(owned, false, 'rowCount 0 ⇒ a live peer owns the lease; defer');
});

test('releaseBotAllyLeasesForOwner clears every lease held by this instance', async () => {
  const { database, calls } = makeFakeDatabase(2);

  await releaseBotAllyLeasesForOwner(database, SERVER_INSTANCE_ID);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.params, [SERVER_INSTANCE_ID]);
  const { sql } = calls[0]!;
  assert.ok(sql.includes('SET driver_owner = NULL'), 'clears ownership so a survivor can claim');
  assert.ok(sql.includes('WHERE driver_owner = $1'), 'scoped to THIS instance only (never a peer)');
});
