/**
 * Tests for the server-layer faithful reducer-replay mechanism (WP-334).
 *
 * The faithfulness golden manufactures a REAL short match through boardgame.io's
 * own reducer (InitializeGame → both players ready → startMatchIfReady, which
 * transitions lobby → play and fires the play-phase onBegin start-of-turn draw
 * through the seeded PRNG), accumulates the emitted log, then asserts that
 * `reduceMatchToFinalState({ initialState, log })` reproduces the SAME final `G`
 * (equal `computeStateHash`). The assertion is the faithfulness invariant itself
 * (reduced final G === live final G) rather than a brittle pinned literal — a
 * full-match golden literal would inherit the PRE_WP080_HASH re-pin cascade that
 * D-24119 assigns to WP-4; the self-consistent equality is churn-free and
 * catches the mechanism's real failure modes (re-seed, isClient, wrong fold).
 *
 * Plus: empty-log identity, fail-closed on a null/malformed artifact, and a
 * DB-gated `readMatchForReplay` round-trip (skips without `TEST_DATABASE_URL`).
 *
 * Authority: WP-334 §B; EC-364.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import * as boardgameInternal from 'boardgame.io/dist/cjs/internal.js';
import { computeStateHash, LegendaryGame } from '@legendary-arena/game-engine';

import {
  reduceMatchToFinalState,
  readMatchForReplay,
} from './matchReplay.logic.js';
import type { DatabaseClient } from '../identity/identity.types.js';

import pg from 'pg';

const { Pool } = pg;

// why: the deep dist entry carries no types; cast to the shape the test uses.
const { InitializeGame, CreateGameReducer } = boardgameInternal as unknown as {
  InitializeGame(config: {
    game: unknown;
    numPlayers: number;
    setupData: unknown;
  }): { G: unknown; ctx: unknown; plugins?: unknown; deltalog?: unknown[] };
  CreateGameReducer(config: {
    game: unknown;
    isClient: boolean;
  }): (state: unknown, action: { type: string; payload: unknown }) => {
    G: unknown;
    deltalog?: unknown[];
  };
};

// why: a valid MatchConfiguration with set-qualified `test/` ids that satisfy the
// setup contract without a real registry (mirrors game.test.ts). Game.setup
// builds a real initial state from these; buildInitialGameState skips registry
// lookups when no registry is wired.
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

// why: boardgame.io action type constants are stable literals in the locked
// 0.50.x (`internal.js` does not re-export them). A move is dispatched as
// { type: 'MAKE_MOVE', payload: { type: <moveName>, args: [...], playerID } }.
const MAKE_MOVE = 'MAKE_MOVE';

/**
 * Manufacture a real short match: InitializeGame, then drive it through the
 * lobby ready-up to `play` via the SAME reducer, accumulating the emitted log.
 * Returns the initial state, the accumulated log, and the live final state.
 */
function manufactureMatch(): {
  initialState: { G: unknown };
  log: unknown[];
  liveFinal: { G: unknown };
} {
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
  ): { G: unknown; deltalog?: unknown[] } => {
    const next = reducer(state, {
      type: MAKE_MOVE,
      payload: { type: moveName, args, playerID },
    });
    if (Array.isArray(next.deltalog)) {
      log.push(...next.deltalog);
    }
    return next;
  };

  let state: { G: unknown; deltalog?: unknown[] } = initialState;
  // Both seats ready (lobby activePlayers: { all: 'lobbyReady' }), then start —
  // startMatchIfReady calls events.setPhase('play'), firing the play onBegin
  // seeded draw. This exercises hook-driven RNG, the faithfulness-critical path.
  state = dispatch(state, 'setPlayerReady', [{ ready: true }], '0');
  state = dispatch(state, 'setPlayerReady', [{ ready: true }], '1');
  state = dispatch(state, 'startMatchIfReady', [], '0');

  return { initialState, log, liveFinal: state };
}

describe('reduceMatchToFinalState (WP-334)', () => {
  test('faithfully reproduces the live final G from initialState + log', () => {
    const { initialState, log, liveFinal } = manufactureMatch();

    // Sanity: the forward run actually produced a log (moves were applied).
    assert.ok(log.length > 0, 'the manufactured match should emit log entries');

    const result = reduceMatchToFinalState({ initialState, log });

    // The faithfulness invariant: replaying the log from the initial state
    // reproduces the exact live final G.
    assert.equal(
      result.stateHash,
      computeStateHash(liveFinal.G as never),
      'reduced final G hash must equal the live final G hash',
    );
    assert.deepEqual(
      result.finalState,
      liveFinal.G,
      'reduced final G must deep-equal the live final G',
    );
  });

  test('an empty log returns the initial state unchanged (fold identity)', () => {
    const initialState = InitializeGame({
      game: LegendaryGame,
      numPlayers: 2,
      setupData: MOCK_SETUP_DATA,
    });
    const result = reduceMatchToFinalState({ initialState, log: [] });
    // why: catches the re-seed landmine — if the mechanism re-ran InitializeGame
    // instead of folding from the passed initialState, the seeded deck shuffle
    // would differ and this equality would fail.
    assert.equal(result.stateHash, computeStateHash(initialState.G as never));
    assert.deepEqual(result.finalState, initialState.G);
  });

  test('fails closed on a null initial state', () => {
    assert.throws(
      () => reduceMatchToFinalState({ initialState: null, log: [] }),
      /no persisted initial state/,
    );
  });

  test('fails closed on a malformed log entry (no action)', () => {
    const initialState = InitializeGame({
      game: LegendaryGame,
      numPlayers: 2,
      setupData: MOCK_SETUP_DATA,
    });
    assert.throws(
      () =>
        reduceMatchToFinalState({
          initialState,
          log: [{ _stateID: 0, turn: 1, phase: 'lobby' }],
        }),
      /missing its `action`/,
    );
  });
});

describe('readMatchForReplay (WP-334)', () => {
  const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;
  const TEST_MATCH_ID = 'wp334-test-match';

  let pool: InstanceType<typeof Pool> | undefined;

  before(async () => {
    if (!hasTestDatabase) {
      return;
    }
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await pool.query('DELETE FROM bgio.matches WHERE match_id = $1', [
      TEST_MATCH_ID,
    ]);
  });

  after(async () => {
    if (pool === undefined) {
      return;
    }
    await pool.query('DELETE FROM bgio.matches WHERE match_id = $1', [
      TEST_MATCH_ID,
    ]);
    await pool.end();
  });

  test(
    'returns { initialState, log, metadata } for a stored match; null for absent / null initial_state',
    { skip: hasTestDatabase ? false : 'requires test database' },
    async () => {
      const database = pool as unknown as DatabaseClient;

      // Absent row → null.
      assert.equal(await readMatchForReplay('wp334-absent', database), null);

      // Row with a null initial_state → null (not replayable).
      await pool!.query(
        "INSERT INTO bgio.matches (match_id, state, initial_state, metadata, log) " +
          "VALUES ($1, '{}'::jsonb, NULL, '{}'::jsonb, '[]'::jsonb)",
        [TEST_MATCH_ID],
      );
      assert.equal(await readMatchForReplay(TEST_MATCH_ID, database), null);

      // Row with a real initial_state → the artifact.
      await pool!.query(
        "UPDATE bgio.matches SET initial_state = '{\"G\":{\"x\":1}}'::jsonb, " +
          "log = '[{\"action\":{\"type\":\"GAME_EVENT\"}}]'::jsonb WHERE match_id = $1",
        [TEST_MATCH_ID],
      );
      const artifact = await readMatchForReplay(TEST_MATCH_ID, database);
      assert.notEqual(artifact, null);
      assert.deepEqual(artifact!.initialState, { G: { x: 1 } });
      assert.equal(artifact!.log.length, 1);
    },
  );
});
