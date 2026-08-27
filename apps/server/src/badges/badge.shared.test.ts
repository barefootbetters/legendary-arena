/**
 * Tests for shared cooperative badge issuance (WP-614).
 *
 * Uses a mock DatabaseClient to verify group evaluation, the multi-player
 * award, and SQL/param binding without a live PostgreSQL connection. The badge
 * groups per-player `competitive_scores` rows by `replay_hash` and awards the
 * whole table when it is complete, `playerCount >= 2`, and every player is
 * sub-PAR.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { issueSharedMatchBadges } from './badge.shared.js';

interface MockQueryCall {
  sql: string;
  params: unknown[];
}

/**
 * Minimal mock DatabaseClient recording queries. The group SELECT
 * (`WHERE replay_hash = $1`) returns the supplied rows; the INSERT records
 * its params for assertion.
 */
function makeMockDatabase(groupRows: Array<{ player_id: number; final_score: number }>) {
  const calls: MockQueryCall[] = [];
  return {
    calls,
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params: params ?? [] });
      if (sql.includes('SELECT player_id, final_score')) {
        return { rows: groupRows };
      }
      return { rows: [] };
    },
  };
}

/** Finds the INSERT INTO legendary.player_badges call, if any. */
function findInsert(database: ReturnType<typeof makeMockDatabase>) {
  return database.calls.find((c) => c.sql.includes('INSERT INTO legendary.player_badges'));
}

describe('badge.shared — issueSharedMatchBadges (WP-614)', () => {
  test('awards united-front to EVERY player of a complete, all-sub-PAR co-op table', async () => {
    const database = makeMockDatabase([
      { player_id: 10, final_score: -3 },
      { player_id: 20, final_score: -1 },
    ]);

    await issueSharedMatchBadges('replay-abc', 2, 7, database as any);

    const insert = findInsert(database);
    assert.ok(insert, 'Expected an INSERT for the whole table.');
    assert.ok(insert.sql.includes('ON CONFLICT DO NOTHING'));
    // why: awarded to BOTH players, source_kind competitive_history, source_ref null
    assert.ok(insert.params.includes(10), 'Expected player 10 in the award.');
    assert.ok(insert.params.includes(20), 'Expected player 20 in the award.');
    assert.ok(insert.params.includes('gameplay.shared.united-front'));
    assert.ok(insert.params.includes('competitive_history'));
    assert.ok(insert.params.includes(null), 'Expected null source_ref for the shared badge.');
    assert.equal(
      insert.params.includes('competitive_score'),
      false,
      'Shared badge must not use the per-run source_kind.',
    );
  });

  test('does NOT award when the group is incomplete (fewer rows than playerCount)', async () => {
    // Only one of two players has submitted so far — an earlier submitter's hook.
    const database = makeMockDatabase([{ player_id: 10, final_score: -3 }]);

    await issueSharedMatchBadges('replay-abc', 2, 7, database as any);

    assert.equal(findInsert(database), undefined, 'No award until the group is complete.');
  });

  test('does NOT award when any player finished at or above PAR', async () => {
    const database = makeMockDatabase([
      { player_id: 10, final_score: -3 },
      { player_id: 20, final_score: 4 },
    ]);

    await issueSharedMatchBadges('replay-abc', 2, 7, database as any);

    assert.equal(findInsert(database), undefined, 'One non-sub-PAR player disqualifies the table.');
  });

  test('does NOT award for a solo match (playerCount 1)', async () => {
    const database = makeMockDatabase([{ player_id: 10, final_score: -3 }]);

    await issueSharedMatchBadges('replay-abc', 1, 7, database as any);

    // why: short-circuits before the group query — a solo run is not a table.
    assert.equal(database.calls.length, 0, 'A solo match must not even query the group.');
    assert.equal(findInsert(database), undefined);
  });

  test('does NOT award when playerCount is null (unknown seat count)', async () => {
    const database = makeMockDatabase([{ player_id: 10, final_score: -3 }]);

    await issueSharedMatchBadges('replay-abc', null, 7, database as any);

    assert.equal(database.calls.length, 0, 'A null-count match must not query or award.');
  });

  test('awards to all three players of a complete 3-player sub-PAR table', async () => {
    const database = makeMockDatabase([
      { player_id: 10, final_score: -3 },
      { player_id: 20, final_score: -1 },
      { player_id: 30, final_score: -50 },
    ]);

    await issueSharedMatchBadges('replay-xyz', 3, 7, database as any);

    const insert = findInsert(database);
    assert.ok(insert, 'Expected an INSERT for the 3-player table.');
    for (const playerId of [10, 20, 30]) {
      assert.ok(insert.params.includes(playerId), `Expected player ${playerId} in the award.`);
    }
  });
});
