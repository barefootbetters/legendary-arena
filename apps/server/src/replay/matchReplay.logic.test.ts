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
import {
  clearRegistryForSetup,
  computeStateHash,
  LegendaryGame,
  setRegistryForSetup,
} from '@legendary-arena/game-engine';

import {
  reduceMatchToFinalState,
  readMatchForReplay,
  readReplayArtifactByHash,
  readReplayHashByMatchId,
  isMatchFinished,
  reduceReplayByHash,
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

// why: a valid MatchConfiguration with set-qualified `test/` ids. A registry IS
// wired for this file (see FAT_TEST_REGISTRY below) — without one,
// buildHeroDeck finds no `heroes` entry and G.heroDeck comes back EMPTY, which
// WP-367's deck-exhaustion rule correctly reads as an immediate final turn.
// That ended the manufactured match after one turn and broke the WP-336
// turnCount reconciliation, so the fixture must supply a real reservoir.
// why: WP-367 ends the match the moment the Hero Deck OR Villain Deck empties.
// The manufactured matches below drive up to 12 play turns, so the fixture has
// to hold a reservoir deep enough that neither deck runs dry for reasons that
// have nothing to do with what these tests assert. buildHeroDeck resolves
// heroDeckIds through registry.getSet(setAbbr).heroes[].cards, so a registry
// without a `heroes` array yields heroDeck.length === 0.
const HERO_SLUGS = [
  'test-hero-deck-001',
  'test-hero-deck-002',
  'test-hero-deck-003',
] as const;

// why: 14 printed cards per hero x 3 heroes = 42 instances; 5 fill the HQ, so
// heroDeck starts at 37 — comfortably past the 12-turn ceiling these tests use.
const CARDS_PER_HERO = 14;

function buildFatTestSet(): Record<string, unknown> {
  return {
    abbr: 'test',
    schemes: [{ slug: 'test-scheme-001' }],
    masterminds: [{ slug: 'test-mastermind-001' }],
    henchmen: [{ slug: 'test-henchman-group-001' }],
    villains: [
      { slug: 'test-villain-group-001' },
      { slug: 'test-villain-group-002' },
    ],
    heroes: HERO_SLUGS.map((slug) => ({
      slug,
      // why: buildHeroDeck resolves copies through RARITY_COPY_COUNT keyed on
      // rarityLabel — an unrecognised or missing label yields null and the card
      // is SKIPPED, which is how the deck stayed empty. 'Common 1' = 5 copies.
      cards: Array.from({ length: CARDS_PER_HERO }, (_unused, index) => ({
        slug: String(index + 1),
        name: `Test Card ${index + 1}`,
        rarityLabel: 'Common 1',
        cost: 1,
        abilities: [],
      })),
    })),
  };
}

const FAT_TEST_REGISTRY = {
  listCards() {
    const cards: Array<{ key: string; cardType: string; slug: string; setAbbr: string }> = [];
    for (const heroSlug of HERO_SLUGS) {
      for (let index = 0; index < CARDS_PER_HERO; index += 1) {
        // why: extractHeroSlug (economy.logic) parses `{setAbbr}-hero-{heroSlug}-{slot}`
        // and takes everything before the LAST dash as the hero slug. The slot
        // must therefore be a bare trailing segment — a `-card-01` suffix would
        // resolve the hero as "test-hero-deck-001-card" and fail validation.
        cards.push({
          key: `test-hero-${heroSlug}-${index + 1}`,
          cardType: 'hero',
          slug: String(index + 1),
          setAbbr: 'test',
          // why: buildCardDisplayData copies name/imageUrl straight off the flat
          // card. Omit either and the entry lands as undefined, which fails the
          // setup-time G JSON round-trip invariant.
          name: `Test Hero Card ${index + 1}`,
          imageUrl: '',
          // why: the setup invariant checks JSON round-trip identity on G, so
          // every field the builders copy through must be defined — an omitted
          // `abilities` lands as undefined and JSON.stringify drops the key.
          abilities: [],
        });
      }
    }
    // why: the villain deck is the other exhaustion trigger. 12 turns reveal at
    // most one villain card each, so 24 keeps it clear of the ceiling too.
    for (const groupSlug of ['test-villain-group-001', 'test-villain-group-002']) {
      for (let index = 0; index < 12; index += 1) {
        cards.push({
          key: `test-villain-${groupSlug}-card-${String(index + 1).padStart(2, '0')}`,
          cardType: 'villain',
          slug: `card-${String(index + 1).padStart(2, '0')}`,
          setAbbr: 'test',
          name: `Test Villain ${index + 1}`,
          imageUrl: '',
          abilities: [],
        });
      }
    }
    return cards;
  },
  listSets() {
    return [{ abbr: 'test' }];
  },
  getSet(abbr: string) {
    return abbr === 'test' ? buildFatTestSet() : undefined;
  },
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

/**
 * Manufacture a real match with a chosen number of COMPLETED play turns, ending
 * mid-turn (a logged move in the final turn, no trailing endTurn) — the shape a
 * real match has when `endIf` fires on a move. Each completed turn is three
 * `advanceStage` moves (start → main → cleanup → the third fires endTurn), then
 * one more `advanceStage` opens the in-progress final turn. Drives the SAME
 * reducer, accumulating the emitted log; the per-entry live `turn` stamps are
 * what `reduceMatchToFinalState` counts as `turnCount` (WP-336 / D-24123).
 *
 * @param completedTurns The number of play turns to fully complete before the
 *   in-progress final turn.
 * @returns The initial state and the accumulated log.
 */
function manufactureMatchWithTurns(completedTurns: number): {
  initialState: { G: unknown; ctx: unknown };
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

  let state: { G: unknown; ctx: unknown; deltalog?: unknown[] } = initialState;
  const dispatch = (moveName: string, args: unknown[], playerID: string): void => {
    const next = reducer(state, {
      type: MAKE_MOVE,
      payload: { type: moveName, args, playerID },
    });
    if (Array.isArray(next.deltalog)) {
      log.push(...next.deltalog);
    }
    state = next;
  };
  // why: read the CURRENT current-player fresh each dispatch — startMatchIfReady
  // begins play with boardgame.io's own turn order, and each endTurn rotates it;
  // an advanceStage must come from whoever holds the active 'playTurn' stage.
  const currentPlayer = (): string => String((state.ctx as { currentPlayer: unknown }).currentPlayer);

  dispatch('setPlayerReady', [{ ready: true }], '0');
  dispatch('setPlayerReady', [{ ready: true }], '1');
  dispatch('startMatchIfReady', [], '0');
  for (let turn = 0; turn < completedTurns; turn += 1) {
    dispatch('advanceStage', [], currentPlayer()); // start → main
    dispatch('advanceStage', [], currentPlayer()); // main → cleanup
    dispatch('advanceStage', [], currentPlayer()); // cleanup → endTurn (turn++)
  }
  dispatch('advanceStage', [], currentPlayer()); // open the in-progress final turn

  return { initialState, log, liveFinal: state };
}

describe('reduceMatchToFinalState (WP-334)', () => {
  // why: wire the reservoir registry for every manufacture in this suite, and
  // clear it afterwards — setRegistryForSetup is module-global, so leaving it
  // set would silently change setup for every later test in the same process.
  before(() => {
    setRegistryForSetup(FAT_TEST_REGISTRY as never);
  });
  after(() => {
    clearRegistryForSetup();
  });

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

  test('faithfully reproduces the live final G for a MULTI-TURN match (WP-336 / D-24124)', () => {
    // why: WP-334's only faithfulness golden was a 0-turn lobby game. Play-phase
    // endTurn GAME_EVENTs are logged `automatic: false`, so the original
    // skip-`automatic` reduction double-advanced every turn past the first and
    // diverged for real multi-turn matches (the score would have been computed
    // off a wrong final G). The reduction now re-dispatches only player MAKE_MOVEs;
    // this asserts the reduced final G equals the live final G across turn counts.
    for (const completedTurns of [1, 3, 7]) {
      const { initialState, log, liveFinal } = manufactureMatchWithTurns(completedTurns);
      const result = reduceMatchToFinalState({ initialState, log });
      assert.equal(
        result.stateHash,
        computeStateHash(liveFinal.G as never),
        `reduced final G hash must equal the live final G hash for ${completedTurns} completed turns`,
      );
      assert.deepEqual(result.finalState, liveFinal.G);
    }
  });

  test('turnCount reconciles to the completed play-turn count (WP-336 / D-24123)', () => {
    // why: the competitive `rounds` input must be on the PAR-calibrated TURN
    // scale (par.aggregator's `turnsElapsed`), not the move scale. A match that
    // completes N play turns and ends mid-next-turn has `turnCount === N` (floored
    // at 1) — scaffold-verified across 0/1/2/5/12 against the reducer's own turn
    // stamps. The count is read from the log's live per-entry `turn`, not the
    // reduced `ctx.turn` (which drifts once AUTOMATIC entries are skipped).
    for (const completedTurns of [0, 1, 2, 5, 12]) {
      const { initialState, log } = manufactureMatchWithTurns(completedTurns);
      const result = reduceMatchToFinalState({ initialState, log });
      const expected = completedTurns < 1 ? 1 : completedTurns;
      assert.equal(
        result.turnCount,
        expected,
        `a match with ${completedTurns} completed play turns must have turnCount ${expected}`,
      );
    }
  });

  test('turnCount floors at 1 for a match that never left the lobby-entry turn', () => {
    // The plain lobby→play manufacture completes zero play turns; the floor keeps
    // `rounds` >= 1 (mirrors par.aggregator's `turnsElapsed === 0 ? 1 : turnsElapsed`).
    const { initialState, log } = manufactureMatch();
    const result = reduceMatchToFinalState({ initialState, log });
    assert.equal(result.turnCount, 1);
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

describe('readReplayArtifactByHash / reduceReplayByHash (WP-336)', () => {
  const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;
  const TEST_HASH = 'wp336-test-replay-hash';

  let pool: InstanceType<typeof Pool> | undefined;
  let artifact: { initialState: unknown; log: unknown[] };
  let expectedHash: string;

  before(async () => {
    // A real short match's { initialState, log } — the durable artifact shape.
    const manufactured = manufactureMatchWithTurns(3);
    artifact = { initialState: manufactured.initialState, log: manufactured.log };
    expectedHash = reduceMatchToFinalState(artifact).stateHash;

    if (!hasTestDatabase) {
      return;
    }
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await pool.query('DELETE FROM bgio.replay_artifacts WHERE replay_hash = $1', [TEST_HASH]);
    await pool.query(
      'INSERT INTO bgio.replay_artifacts (replay_hash, match_id, scenario_key, initial_state, log) ' +
        'VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)',
      [
        TEST_HASH,
        'wp336-test-match',
        'test-scenario-key',
        JSON.stringify(artifact.initialState),
        JSON.stringify(artifact.log),
      ],
    );
  });

  after(async () => {
    if (pool === undefined) {
      return;
    }
    await pool.query('DELETE FROM bgio.replay_artifacts WHERE replay_hash = $1', [TEST_HASH]);
    await pool.end();
  });

  test(
    'reads the durable artifact by replayHash and reduces it faithfully; null for an unknown hash',
    { skip: hasTestDatabase ? false : 'requires test database' },
    async () => {
      const database = pool as unknown as DatabaseClient;

      // Unknown hash → null (verifier maps this to a verification failure, no throw).
      assert.equal(await readReplayArtifactByHash('wp336-absent', database), null);
      assert.equal(await reduceReplayByHash('wp336-absent', database), null);

      // Known hash → the stored { initialState, log }.
      const read = await readReplayArtifactByHash(TEST_HASH, database);
      assert.notEqual(read, null);
      assert.deepEqual(read!.initialState, artifact.initialState);
      assert.equal(read!.log.length, artifact.log.length);

      // reduceReplayByHash composes read + reduce → the same hash + turnCount the
      // capture step stored (3 completed play turns), proving the verifier reduces
      // the SAME state the capture step hashed (the step-9 anti-tamper invariant).
      const reduced = await reduceReplayByHash(TEST_HASH, database);
      assert.notEqual(reduced, null);
      assert.equal(reduced!.stateHash, expectedHash);
      assert.equal(reduced!.turnCount, 3);
    },
  );
});

describe('readReplayHashByMatchId / isMatchFinished (WP-338)', () => {
  const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;
  const MATCH_ID = 'wp338-helper-match';
  const HASH = 'wp338-helper-hash';

  let pool: InstanceType<typeof Pool> | undefined;

  before(async () => {
    if (!hasTestDatabase) {
      return;
    }
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await pool.query('DELETE FROM bgio.replay_artifacts WHERE match_id = $1', [MATCH_ID]);
    await pool.query('DELETE FROM bgio.matches WHERE match_id = $1', [MATCH_ID]);
  });

  after(async () => {
    if (pool === undefined) {
      return;
    }
    await pool.query('DELETE FROM bgio.replay_artifacts WHERE match_id = $1', [MATCH_ID]);
    await pool.query('DELETE FROM bgio.matches WHERE match_id = $1', [MATCH_ID]);
    await pool.end();
  });

  test(
    'readReplayHashByMatchId returns the captured hash; null for an uncaptured match',
    { skip: hasTestDatabase ? false : 'requires test database' },
    async () => {
      const database = pool as unknown as DatabaseClient;
      assert.equal(await readReplayHashByMatchId(MATCH_ID, database), null);
      await pool!.query(
        'INSERT INTO bgio.replay_artifacts (replay_hash, match_id, scenario_key, initial_state, log) ' +
          "VALUES ($1, $2, 'k', '{}'::jsonb, '[]'::jsonb)",
        [HASH, MATCH_ID],
      );
      assert.equal(await readReplayHashByMatchId(MATCH_ID, database), HASH);
    },
  );

  test(
    'isMatchFinished is true only when the match metadata carries a gameover',
    { skip: hasTestDatabase ? false : 'requires test database' },
    async () => {
      const database = pool as unknown as DatabaseClient;
      // Absent match → false.
      assert.equal(await isMatchFinished('wp338-absent', database), false);
      // In-progress (no gameover) → false.
      await pool!.query(
        "INSERT INTO bgio.matches (match_id, state, initial_state, metadata, log) " +
          "VALUES ($1, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb)",
        [MATCH_ID],
      );
      assert.equal(await isMatchFinished(MATCH_ID, database), false);
      // Gameover present → true.
      await pool!.query(
        "UPDATE bgio.matches SET metadata = '{\"gameover\":{\"winner\":\"0\"}}'::jsonb WHERE match_id = $1",
        [MATCH_ID],
      );
      assert.equal(await isMatchFinished(MATCH_ID, database), true);
    },
  );
});
