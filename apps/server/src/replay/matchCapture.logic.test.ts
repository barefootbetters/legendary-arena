/**
 * Tests for the live-match capture step (WP-335).
 *
 * A logic-pure test always runs (the set-abbr strip). The end-to-end capture test
 * is DB-gated (non-silent skip without `TEST_DATABASE_URL`): it seeds a real
 * finished match (a `bgio.matches` row whose `initial_state`/`log` are produced by
 * the WP-334 manufacture pattern), two authenticated seats, then runs `captureMatch`
 * and asserts the durable artifact + the `replayHash → matchId` mapping + the
 * scenarioKey + ownership per seat + the `captured_at` stamp, and idempotency.
 *
 * Authority: WP-335 §F; EC-365.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import * as boardgameInternal from 'boardgame.io/dist/cjs/internal.js';
import {
  buildScenarioKey,
  computeStateHash,
  LegendaryGame,
} from '@legendary-arena/game-engine';

import { captureMatch, stripSetAbbreviation } from './matchCapture.logic.js';
import { reduceMatchToFinalState } from './matchReplay.logic.js';
import type { DatabaseClient } from '../identity/identity.types.js';

import pg from 'pg';

const { Pool } = pg;
const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

const { InitializeGame, CreateGameReducer } = boardgameInternal as unknown as {
  InitializeGame(config: { game: unknown; numPlayers: number; setupData: unknown }): {
    G: unknown;
  };
  CreateGameReducer(config: { game: unknown; isClient: boolean }): (
    state: unknown,
    action: { type: string; payload: unknown },
  ) => { G: unknown; deltalog?: unknown[] };
};

const MOCK_SETUP_DATA = {
  schemeId: 'test/test-scheme-001',
  mastermindId: 'test/test-mastermind-001',
  villainGroupIds: ['test/test-villain-group-001', 'test/test-villain-group-002'],
  henchmanGroupIds: ['test/test-henchman-group-001'],
  heroDeckIds: [
    'test/test-hero-deck-001',
    'test/test-hero-deck-002',
    'test/test-hero-deck-003',
  ],
  bystandersCount: 30,
  woundsCount: 30,
  officersCount: 30,
  sidekicksCount: 0,
};

const MATCH_ID = 'wp335-test-match';
const EXT_ID_0 = 'wp335-test-account-0';
const EXT_ID_1 = 'wp335-test-account-1';

/** Manufacture a real match's { initialState, log } (lobby → play). */
function manufactureArtifact(): { initialState: unknown; log: unknown[] } {
  const initialState = InitializeGame({
    game: LegendaryGame,
    numPlayers: 2,
    setupData: MOCK_SETUP_DATA,
  });
  const reducer = CreateGameReducer({ game: LegendaryGame, isClient: false });
  const log: unknown[] = [];
  const dispatch = (
    state: { deltalog?: unknown[] },
    moveName: string,
    args: unknown[],
    playerID: string,
  ) => {
    const next = reducer(state, {
      type: 'MAKE_MOVE',
      payload: { type: moveName, args, playerID },
    });
    if (Array.isArray(next.deltalog)) {
      log.push(...next.deltalog);
    }
    return next;
  };
  let state: { G: unknown; deltalog?: unknown[] } = initialState;
  state = dispatch(state, 'setPlayerReady', [{ ready: true }], '0');
  state = dispatch(state, 'setPlayerReady', [{ ready: true }], '1');
  state = dispatch(state, 'startMatchIfReady', [], '0');
  return { initialState, log };
}

describe('stripSetAbbreviation (WP-335)', () => {
  test('strips a set-abbr prefix; leaves a bare slug unchanged', () => {
    assert.equal(stripSetAbbreviation('core/dr-doom'), 'dr-doom');
    assert.equal(stripSetAbbreviation('test/test-scheme-001'), 'test-scheme-001');
    assert.equal(stripSetAbbreviation('already-bare'), 'already-bare');
  });
});

describe('captureMatch (WP-335)', () => {
  let pool: InstanceType<typeof Pool> | undefined;
  let artifact: { initialState: unknown; log: unknown[] };
  let expectedHash: string;
  let expectedScenarioKey: string;

  before(async () => {
    artifact = manufactureArtifact();
    const reduced = reduceMatchToFinalState(artifact);
    expectedHash = reduced.stateHash;
    // why: independent recompute of the expected scenarioKey from the mock setup —
    // the capture step must derive the same via strip + buildScenarioKey.
    expectedScenarioKey = buildScenarioKey(
      'test-scheme-001',
      'test-mastermind-001',
      ['test-villain-group-001', 'test-villain-group-002'],
    );
    void computeStateHash; // referenced for parity with the mechanism's hashing

    if (!hasTestDatabase) {
      return;
    }
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    // Seed two authenticated accounts + seats, and the finished bgio match.
    for (const extId of [EXT_ID_0, EXT_ID_1]) {
      await pool.query(
        'INSERT INTO legendary.players (ext_id, email, display_name, auth_provider, auth_provider_id) ' +
          'VALUES ($1, $2, $3, $4, $5) ON CONFLICT (ext_id) DO NOTHING',
        [extId, `${extId}@wp335.test`, `WP335 ${extId}`, 'email', `${extId}-sub`],
      );
    }
    await pool.query('DELETE FROM legendary.match_seat_accounts WHERE match_id = $1', [MATCH_ID]);
    await pool.query('DELETE FROM legendary.replay_ownership WHERE replay_hash = $1', [expectedHash]);
    await pool.query('DELETE FROM bgio.replay_artifacts WHERE match_id = $1', [MATCH_ID]);
    await pool.query('DELETE FROM bgio.matches WHERE match_id = $1', [MATCH_ID]);
    await pool.query(
      'INSERT INTO legendary.match_seat_accounts (match_id, player_id, account_id) VALUES ($1,$2,$3),($1,$4,$5)',
      [MATCH_ID, '0', EXT_ID_0, '1', EXT_ID_1],
    );
    await pool.query(
      "INSERT INTO bgio.matches (match_id, state, initial_state, metadata, log) " +
        "VALUES ($1, '{}'::jsonb, $2::jsonb, '{\"gameover\":{\"winner\":\"0\"}}'::jsonb, $3::jsonb)",
      [MATCH_ID, JSON.stringify(artifact.initialState), JSON.stringify(artifact.log)],
    );
  });

  after(async () => {
    if (pool === undefined) {
      return;
    }
    await pool.query('DELETE FROM legendary.match_seat_accounts WHERE match_id = $1', [MATCH_ID]);
    await pool.query('DELETE FROM legendary.replay_ownership WHERE replay_hash = $1', [expectedHash]);
    await pool.query('DELETE FROM bgio.replay_artifacts WHERE match_id = $1', [MATCH_ID]);
    await pool.query('DELETE FROM bgio.matches WHERE match_id = $1', [MATCH_ID]);
    await pool.query('DELETE FROM legendary.players WHERE ext_id = ANY($1)', [[EXT_ID_0, EXT_ID_1]]);
    await pool.end();
  });

  test(
    'captures a finished match: artifact + mapping + scenarioKey + ownership + captured_at (idempotent)',
    { skip: hasTestDatabase ? false : 'requires test database' },
    async () => {
      const database = pool as unknown as DatabaseClient;

      const result = await captureMatch(MATCH_ID, database);
      assert.equal(result.skipped, null);
      assert.equal(result.replayHash, expectedHash);
      assert.equal(result.scenarioKey, expectedScenarioKey);
      assert.equal(result.seatsOwned, 2);

      // Durable artifact row: hash PK + match_id mapping + scenario_key + copy.
      const artifactRow = await pool!.query(
        'SELECT match_id, scenario_key FROM bgio.replay_artifacts WHERE replay_hash = $1',
        [expectedHash],
      );
      assert.equal(artifactRow.rows.length, 1);
      assert.equal(artifactRow.rows[0]!.match_id, MATCH_ID);
      assert.equal(artifactRow.rows[0]!.scenario_key, expectedScenarioKey);

      // Ownership per authenticated seat.
      const ownership = await pool!.query(
        'SELECT cs.replay_hash FROM legendary.replay_ownership cs ' +
          'JOIN legendary.players p ON cs.player_id = p.player_id ' +
          'WHERE cs.replay_hash = $1 AND p.ext_id = ANY($2)',
        [expectedHash, [EXT_ID_0, EXT_ID_1]],
      );
      assert.equal(ownership.rows.length, 2);

      // captured_at stamped.
      const stamp = await pool!.query(
        'SELECT captured_at FROM bgio.matches WHERE match_id = $1',
        [MATCH_ID],
      );
      assert.notEqual(stamp.rows[0]!.captured_at, null);

      // Idempotent re-run: no duplicate artifact / ownership.
      const rerun = await captureMatch(MATCH_ID, database);
      assert.equal(rerun.replayHash, expectedHash);
      const artifactCount = await pool!.query(
        'SELECT count(*)::int AS n FROM bgio.replay_artifacts WHERE match_id = $1',
        [MATCH_ID],
      );
      assert.equal(artifactCount.rows[0]!.n, 1);
    },
  );

  test(
    'skips a match with no persisted initial_state (not replayable)',
    { skip: hasTestDatabase ? false : 'requires test database' },
    async () => {
      const database = pool as unknown as DatabaseClient;
      await pool!.query(
        "INSERT INTO bgio.matches (match_id, state, initial_state, metadata, log) " +
          "VALUES ('wp335-null-init', '{}'::jsonb, NULL, '{\"gameover\":{}}'::jsonb, '[]'::jsonb) " +
          'ON CONFLICT (match_id) DO NOTHING',
      );
      const result = await captureMatch('wp335-null-init', database);
      assert.equal(result.skipped, 'not_replayable');
      assert.equal(result.replayHash, null);
      await pool!.query("DELETE FROM bgio.matches WHERE match_id = 'wp335-null-init'");
    },
  );
});
