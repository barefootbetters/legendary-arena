/**
 * Tests for the one-time captured-replay ScenarioKey rekey (D-24597).
 *
 * DB-gated (non-silent skip without `TEST_DATABASE_URL`): seeds two real captured
 * artifacts — a reprint-scheme match stored under the stale bare (core) key, and
 * an all-core match — with an ownership row and a competitive score each, then
 * asserts the dry run reports only the reprint, `write` rewrites its artifact +
 * ownership but not its score, and a later `includeScores` pass still finds and
 * rewrites the score.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import * as boardgameInternal from 'boardgame.io/dist/cjs/internal.js';
import { LegendaryGame } from '@legendary-arena/game-engine';
import pg from 'pg';

import { rekeyCapturedScenarioKeys } from './scenarioKeyRekey.logic.js';
import type { DatabaseClient } from '../identity/identity.types.js';

const { Pool } = pg;
const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

const { InitializeGame } = boardgameInternal as unknown as {
  InitializeGame(config: { game: unknown; numPlayers: number; setupData: unknown }): unknown;
};

const EXT_ID = 'd24597-test-account';
const REPRINT_HASH = 'd24597-test-hash-reprint';
const CORE_HASH = 'd24597-test-hash-core';
const STALE_KEY = 'portals-to-the-dark-dimension::red-skull::hydra+masters-of-evil';
const REPRINT_KEY = 'co2e/portals-to-the-dark-dimension::red-skull::hydra+masters-of-evil';

/** A setup whose scheme comes from the given set; everything else is core. */
function setupWithScheme(schemeId: string): Record<string, unknown> {
  return {
    schemeId,
    mastermindId: 'core/red-skull',
    villainGroupIds: ['core/masters-of-evil', 'core/hydra'],
    henchmanGroupIds: ['core/doombot-legion'],
    heroDeckIds: ['core/black-widow', 'core/captain-america', 'core/hulk'],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  };
}

describe('rekeyCapturedScenarioKeys (D-24597)', () => {
  let pool: InstanceType<typeof Pool> | undefined;

  /** Remove every row this suite seeds. */
  async function cleanUp(): Promise<void> {
    const hashes = [REPRINT_HASH, CORE_HASH];
    await pool!.query('DELETE FROM legendary.competitive_scores WHERE replay_hash = ANY($1)', [hashes]);
    await pool!.query('DELETE FROM legendary.replay_ownership WHERE replay_hash = ANY($1)', [hashes]);
    await pool!.query('DELETE FROM bgio.replay_artifacts WHERE replay_hash = ANY($1)', [hashes]);
  }

  /** Seed one captured artifact + an ownership row + a score row under `storedKey`. */
  async function seedCapture(replayHash: string, schemeId: string, storedKey: string): Promise<void> {
    const initialState = InitializeGame({
      game: LegendaryGame,
      numPlayers: 1,
      setupData: setupWithScheme(schemeId),
    });
    await pool!.query(
      'INSERT INTO bgio.replay_artifacts (replay_hash, match_id, scenario_key, initial_state, log) ' +
        "VALUES ($1, $1, $2, $3::jsonb, '[]'::jsonb)",
      [replayHash, storedKey, JSON.stringify(initialState)],
    );
    await pool!.query(
      'INSERT INTO legendary.replay_ownership (player_id, replay_hash, scenario_key) ' +
        'SELECT player_id, $2, $3 FROM legendary.players WHERE ext_id = $1',
      [EXT_ID, replayHash, storedKey],
    );
    await pool!.query(
      'INSERT INTO legendary.competitive_scores (player_id, replay_hash, scenario_key, raw_score, ' +
        'final_score, score_breakdown, par_version, scoring_config_version, state_hash) ' +
        "SELECT player_id, $2, $3, 100, 100, '{}'::jsonb, 'v1', 1, $2 FROM legendary.players WHERE ext_id = $1",
      [EXT_ID, replayHash, storedKey],
    );
  }

  /** Read the scenario_key of one table's row for a hash. */
  async function keyIn(table: string, replayHash: string): Promise<string> {
    const result = await pool!.query(`SELECT scenario_key FROM ${table} WHERE replay_hash = $1`, [replayHash]);
    return result.rows[0].scenario_key;
  }

  before(async () => {
    if (!hasTestDatabase) {
      return;
    }
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await pool.query(
      'INSERT INTO legendary.players (ext_id, email, display_name, auth_provider, auth_provider_id) ' +
        'VALUES ($1, $2, $3, $4, $5) ON CONFLICT (ext_id) DO NOTHING',
      [EXT_ID, `${EXT_ID}@d24597.test`, 'D24597 test', 'email', `${EXT_ID}-sub`],
    );
    await cleanUp();
    await seedCapture(REPRINT_HASH, 'co2e/portals-to-the-dark-dimension', STALE_KEY);
    await seedCapture(CORE_HASH, 'core/portals-to-the-dark-dimension', STALE_KEY);
  });

  after(async () => {
    if (pool === undefined) {
      return;
    }
    await cleanUp();
    await pool.query('DELETE FROM legendary.players WHERE ext_id = $1', [EXT_ID]);
    await pool.end();
  });

  test(
    'dry run reports only the reprint capture; write rekeys artifact + ownership; includeScores rekeys the score',
    { skip: hasTestDatabase ? false : 'requires test database' },
    async () => {
      const database = pool as unknown as DatabaseClient;

      const dryRun = await rekeyCapturedScenarioKeys(database, { write: false, includeScores: false });
      const reprint = dryRun.candidates.find((candidate) => candidate.replayHash === REPRINT_HASH);
      assert.ok(reprint, 'the reprint capture must be reported as a rekey candidate');
      assert.equal(reprint.storedScenarioKey, STALE_KEY);
      assert.equal(reprint.derivedScenarioKey, REPRINT_KEY);
      assert.equal(reprint.isArtifactStale, true);
      assert.equal(reprint.staleOwnershipRows, 1);
      assert.equal(reprint.staleScoreRows, 1);
      assert.equal(
        dryRun.candidates.some((candidate) => candidate.replayHash === CORE_HASH),
        false,
        'an all-core capture re-derives its stored key and must not be a candidate',
      );
      assert.equal(await keyIn('bgio.replay_artifacts', REPRINT_HASH), STALE_KEY);

      await rekeyCapturedScenarioKeys(database, { write: true, includeScores: false });
      assert.equal(await keyIn('bgio.replay_artifacts', REPRINT_HASH), REPRINT_KEY);
      assert.equal(await keyIn('legendary.replay_ownership', REPRINT_HASH), REPRINT_KEY);
      assert.equal(await keyIn('legendary.competitive_scores', REPRINT_HASH), STALE_KEY);
      assert.equal(await keyIn('bgio.replay_artifacts', CORE_HASH), STALE_KEY);

      // A later includeScores pass still finds the score row, although the artifact
      // and ownership were already rekeyed by the first write pass.
      const secondDryRun = await rekeyCapturedScenarioKeys(database, { write: false, includeScores: false });
      const pendingScore = secondDryRun.candidates.find((candidate) => candidate.replayHash === REPRINT_HASH);
      assert.ok(pendingScore, 'a stale score row must keep its hash a candidate');
      assert.equal(pendingScore.isArtifactStale, false);
      assert.equal(pendingScore.staleScoreRows, 1);
      await rekeyCapturedScenarioKeys(database, { write: true, includeScores: true });
      assert.equal(await keyIn('legendary.competitive_scores', REPRINT_HASH), REPRINT_KEY);
      assert.equal(await keyIn('bgio.replay_artifacts', REPRINT_HASH), REPRINT_KEY);
      assert.equal(await keyIn('legendary.competitive_scores', CORE_HASH), STALE_KEY);
      const settled = await rekeyCapturedScenarioKeys(database, { write: false, includeScores: false });
      assert.equal(settled.candidates.some((candidate) => candidate.replayHash === REPRINT_HASH), false);
    },
  );
});
