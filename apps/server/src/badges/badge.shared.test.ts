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

  // --- WP-615: exact-size tier badges (trio / quartet / quintet) ---

  test('WP-615: a 2-player table earns united-front but NO size tier', async () => {
    const database = makeMockDatabase([
      { player_id: 10, final_score: -3 },
      { player_id: 20, final_score: -1 },
    ]);

    await issueSharedMatchBadges('replay-2p', 2, 7, database as any);

    const insert = findInsert(database);
    assert.ok(insert);
    assert.ok(insert.params.includes('gameplay.shared.united-front'));
    for (const tier of ['gameplay.shared.trio', 'gameplay.shared.quartet', 'gameplay.shared.quintet']) {
      assert.equal(insert.params.includes(tier), false, `2-player table must not earn ${tier}.`);
    }
  });

  test('WP-615: a 3-player table earns united-front + trio (and no quartet/quintet)', async () => {
    const database = makeMockDatabase([
      { player_id: 10, final_score: -3 },
      { player_id: 20, final_score: -1 },
      { player_id: 30, final_score: -2 },
    ]);

    await issueSharedMatchBadges('replay-3p', 3, 7, database as any);

    const insert = findInsert(database);
    assert.ok(insert);
    assert.ok(insert.params.includes('gameplay.shared.united-front'));
    assert.ok(insert.params.includes('gameplay.shared.trio'), 'Expected the trio tier.');
    assert.equal(insert.params.includes('gameplay.shared.quartet'), false);
    assert.equal(insert.params.includes('gameplay.shared.quintet'), false);
  });

  test('WP-615: a 4-player table earns united-front + quartet', async () => {
    const database = makeMockDatabase([
      { player_id: 10, final_score: -3 },
      { player_id: 20, final_score: -1 },
      { player_id: 30, final_score: -2 },
      { player_id: 40, final_score: -5 },
    ]);

    await issueSharedMatchBadges('replay-4p', 4, 7, database as any);

    const insert = findInsert(database);
    assert.ok(insert);
    assert.ok(insert.params.includes('gameplay.shared.quartet'), 'Expected the quartet tier.');
    assert.equal(insert.params.includes('gameplay.shared.trio'), false);
    assert.equal(insert.params.includes('gameplay.shared.quintet'), false);
  });

  test('WP-615: a 5-player table earns united-front + quintet, awarded to every player', async () => {
    const rows = [10, 20, 30, 40, 50].map((player_id) => ({ player_id, final_score: -3 }));
    const database = makeMockDatabase(rows);

    await issueSharedMatchBadges('replay-5p', 5, 7, database as any);

    const insert = findInsert(database);
    assert.ok(insert);
    assert.ok(insert.params.includes('gameplay.shared.quintet'), 'Expected the quintet tier.');
    // why: quintet is awarded to all five players — count the key's occurrences.
    const quintetAwards = insert.params.filter((p) => p === 'gameplay.shared.quintet').length;
    assert.equal(quintetAwards, 5, 'Expected quintet awarded to all five players.');
    const unitedFrontAwards = insert.params.filter((p) => p === 'gameplay.shared.united-front').length;
    assert.equal(unitedFrontAwards, 5, 'Expected united-front awarded to all five players.');
  });
});
