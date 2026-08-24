/**
 * Tests for the endgame-coach report cache persistence (WP-594 / EC-629).
 *
 * Logic-pure: a stub `query` captures SQL + params and returns canned rows, so no
 * real database is touched. Verifies the read maps a row, the read returns null on
 * a miss, and the write issues a parameterized ON CONFLICT upsert.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { readCoachReport, writeCoachReport } from './coachReport.persistence.js';
import type { DatabaseClient } from '../identity/identity.types.js';
import type { CoachReport } from './coach.types.js';

const REPORT: CoachReport = {
  headline: 'h',
  heroFit: 'f',
  purchases: 'p',
  suggestions: ['a', 'b'],
};

function stubDatabase(rows: unknown[], capture?: { sql: string; params: unknown[] }[]): DatabaseClient {
  return {
    query: async (sql: string, params: unknown[]) => {
      capture?.push({ sql, params });
      return { rows };
    },
  } as unknown as DatabaseClient;
}

describe('coach report persistence (WP-594)', () => {
  test('readCoachReport maps a cache row', async () => {
    const database = stubDatabase([
      { report: REPORT, model: 'claude-sonnet-5', generated_at: new Date('2026-08-23T00:00:00.000Z') },
    ]);
    const stored = await readCoachReport('replay-abc', database);
    assert.ok(stored);
    assert.deepEqual(stored?.report, REPORT);
    assert.equal(stored?.model, 'claude-sonnet-5');
    assert.equal(stored?.generatedAt, '2026-08-23T00:00:00.000Z');
  });

  test('readCoachReport returns null on a cache miss', async () => {
    const stored = await readCoachReport('replay-xyz', stubDatabase([]));
    assert.equal(stored, null);
  });

  test('writeCoachReport issues a parameterized ON CONFLICT upsert', async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    const database = stubDatabase(
      [{ generated_at: new Date('2026-08-23T12:00:00.000Z') }],
      captured,
    );
    const stored = await writeCoachReport('replay-abc', 'acct-jeff', 'claude-sonnet-5', REPORT, database);
    assert.equal(captured.length, 1);
    assert.match(captured[0]!.sql, /INSERT INTO legendary\.coach_reports/);
    assert.match(captured[0]!.sql, /ON CONFLICT \(replay_hash\) DO UPDATE/);
    // params: replay_hash, account_id, model, report(json)
    assert.equal(captured[0]!.params[0], 'replay-abc');
    assert.equal(captured[0]!.params[1], 'acct-jeff');
    assert.equal(captured[0]!.params[2], 'claude-sonnet-5');
    assert.equal(captured[0]!.params[3], JSON.stringify(REPORT));
    assert.equal(stored.generatedAt, '2026-08-23T12:00:00.000Z');
    assert.deepEqual(stored.report, REPORT);
  });
});
