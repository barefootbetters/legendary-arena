/**
 * Tests for the replay-LAGN re-execution helpers (WP-810 / EC-847 / D-24716).
 *
 * The round-trip golden manufactures a REAL short match through boardgame.io's
 * own reducer with a FIXED seed (the matchReplay.logic.test.ts harness — a fixed
 * seed makes the deck order, and so the completed-turn count, reproducible), then
 * rebuilds through `buildVerifiedReplayExecution`: it reads the artifact seed,
 * re-executes from `{ ...LegendaryGame, seed }` + the EMITTED Tier-1 setup, and
 * requires the rebuilt `computeStateHash` to equal a fresh faithful reduction of
 * the artifact. The assertion is the verify-before-emit invariant itself
 * (isVerified true + hash equality + a valid 1.7.0 document), not a brittle
 * pinned literal.
 *
 * Plus: the refusals (lossy setup, missing seed, a setup the registry rejects, a
 * log entry with no action, operator matches), the `reexecuteFromSeed`-level
 * tamper divergence, and the field shapes (`moves`, `final_blow` round-trip,
 * `engine_build` omission).
 *
 * Authority: WP-810 §Scope B; EC-847; D-24716.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import * as boardgameInternal from 'boardgame.io/dist/cjs/internal.js';
import {
  clearRegistryForSetup,
  setRegistryForSetup,
  formatEngineVersion,
  getCurrentEngineVersion,
  CURRENT_DATA_VERSION,
  LegendaryGame,
} from '@legendary-arena/game-engine';
import { validate, LAGN_VERSION, LAGN_VERSION_1_7_0, type LAGN } from '@legendary-arena/lagn';

import { buildMatchLagn, type MatchLagnComposition } from './matchLagn.logic.js';
import { reduceMatchToFinalState } from '../replay/matchReplay.logic.js';
import {
  extractExecutionMoves,
  toSetupDataFromLagnSetup,
  readArtifactSeed,
  isOperatorArtifact,
  reexecuteFromSeed,
  buildVerifiedReplayExecution,
} from './replayLagn.logic.js';

// why: the deep dist entry carries no types; cast to the shape the test uses.
const { InitializeGame, CreateGameReducer } = boardgameInternal as unknown as {
  InitializeGame(config: { game: unknown; numPlayers: number; setupData: unknown }): {
    G: unknown;
    ctx: unknown;
    plugins?: unknown;
    deltalog?: unknown[];
  };
  CreateGameReducer(config: { game: unknown; isClient: boolean }): (
    state: unknown,
    action: { type: string; payload: unknown },
  ) => { G: unknown; ctx: unknown; deltalog?: unknown[] };
};

// why: a reservoir registry deep enough that neither deck runs dry over the
// 8-turn ceiling these tests use — the matchReplay.logic.test.ts fat fixture.
const HERO_SLUGS = ['test-hero-deck-001', 'test-hero-deck-002', 'test-hero-deck-003'] as const;
const CARDS_PER_HERO = 14;

function buildFatTestSet(): Record<string, unknown> {
  return {
    abbr: 'test',
    schemes: [{ slug: 'test-scheme-001' }],
    masterminds: [{ slug: 'test-mastermind-001' }],
    henchmen: [{ slug: 'test-henchman-group-001' }],
    villains: [{ slug: 'test-villain-group-001' }, { slug: 'test-villain-group-002' }],
    heroes: HERO_SLUGS.map((slug) => ({
      slug,
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
    const cards: Array<{ key: string; cardType: string; slug: string; setAbbr: string; name: string; imageUrl: string; abilities: unknown[] }> = [];
    for (const heroSlug of HERO_SLUGS) {
      for (let index = 0; index < CARDS_PER_HERO; index += 1) {
        cards.push({
          key: `test-hero-${heroSlug}-${index + 1}`,
          cardType: 'hero',
          slug: String(index + 1),
          setAbbr: 'test',
          name: `Test Hero Card ${index + 1}`,
          imageUrl: '',
          abilities: [],
        });
      }
    }
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

// why: the composition the match is created with, in the camelCase
// MatchLagnComposition field names. Mirrors MOCK_SETUP_DATA from the matchReplay
// harness exactly, so a round trip through buildMatchLagn reproduces it.
const COMPOSITION: MatchLagnComposition = {
  schemeId: 'test/test-scheme-001',
  mastermindId: 'test/test-mastermind-001',
  villainGroupIds: ['test/test-villain-group-001', 'test/test-villain-group-002'],
  henchmanGroupIds: ['test/test-henchman-group-001'],
  heroDeckIds: ['test/test-hero-deck-001', 'test/test-hero-deck-002', 'test/test-hero-deck-003'],
  bystandersCount: 30,
  woundsCount: 30,
  officersCount: 30,
  sidekicksCount: 0,
};

const NUM_PLAYERS = 2;
const DETERMINISTIC_SEED = 'replayLagn-manufacture-seed-001';
const SEEDED_GAME = { ...LegendaryGame, seed: DETERMINISTIC_SEED };
const MAKE_MOVE = 'MAKE_MOVE';

interface ManufacturedMatch {
  initialState: { G: unknown; ctx: unknown; plugins?: unknown };
  log: unknown[];
}

/**
 * Manufacture a real match with a chosen number of completed play turns, ending
 * mid-turn, through the SAME reducer — the matchReplay harness, with an optional
 * extra setup-data key for the lossy-setup refusal test.
 */
function manufactureMatch(completedTurns: number, extraSetup: Record<string, unknown> = {}): ManufacturedMatch {
  const setupData = {
    schemeId: COMPOSITION.schemeId,
    mastermindId: COMPOSITION.mastermindId,
    villainGroupIds: COMPOSITION.villainGroupIds,
    henchmanGroupIds: COMPOSITION.henchmanGroupIds,
    heroDeckIds: COMPOSITION.heroDeckIds,
    bystandersCount: COMPOSITION.bystandersCount,
    woundsCount: COMPOSITION.woundsCount,
    officersCount: COMPOSITION.officersCount,
    sidekicksCount: COMPOSITION.sidekicksCount,
    ...extraSetup,
  };
  const initialState = InitializeGame({ game: SEEDED_GAME, numPlayers: NUM_PLAYERS, setupData });
  const reducer = CreateGameReducer({ game: SEEDED_GAME, isClient: false });
  const log: unknown[] = [];
  let state: { G: unknown; ctx: unknown; deltalog?: unknown[] } = initialState;
  const dispatch = (moveName: string, args: unknown[], playerID: string): void => {
    const next = reducer(state, { type: MAKE_MOVE, payload: { type: moveName, args, playerID } });
    if (Array.isArray(next.deltalog)) {
      log.push(...next.deltalog);
    }
    state = next;
  };
  const currentPlayer = (): string => String((state.ctx as { currentPlayer: unknown }).currentPlayer);

  dispatch('setPlayerReady', [{ ready: true }], '0');
  dispatch('setPlayerReady', [{ ready: true }], '1');
  dispatch('startMatchIfReady', [], '0');
  for (let turn = 0; turn < completedTurns; turn += 1) {
    dispatch('revealVillainCard', [], currentPlayer());
    dispatch('advanceStage', [], currentPlayer());
    dispatch('advanceStage', [], currentPlayer());
    dispatch('advanceStage', [], currentPlayer());
  }
  dispatch('revealVillainCard', [], currentPlayer());
  dispatch('advanceStage', [], currentPlayer());

  return { initialState, log };
}

/** The emitted Tier-1 setup block for the COMPOSITION (what gets verified/emitted). */
function baseSetup(composition: MatchLagnComposition = COMPOSITION): LAGN['setup'] {
  return buildMatchLagn('match-under-test', composition, NUM_PLAYERS, (id) => id).setup;
}

describe('replayLagn.logic — verify-before-emit round trip (AC-1)', () => {
  before(() => {
    setRegistryForSetup(FAT_TEST_REGISTRY as never);
  });
  after(() => {
    clearRegistryForSetup();
  });

  for (const turns of [0, 3, 8]) {
    test(`a ${turns}-turn match verifies, and the hash equals a fresh reduction`, () => {
      const artifact = manufactureMatch(turns);
      const result = buildVerifiedReplayExecution(artifact, baseSetup(), NUM_PLAYERS, 'build-sha-abc');
      assert.equal(result.isVerified, true);
      if (result.isVerified !== true) {
        return;
      }
      const reference = reduceMatchToFinalState({ initialState: artifact.initialState, log: artifact.log });
      assert.equal(result.execution.final_state_hash, reference.stateHash);

      // The emitted block sits inside a full LAGN 1.7.0 document and validates.
      const document = buildMatchLagn('match-under-test', COMPOSITION, NUM_PLAYERS, (id) => id) as LAGN;
      document.replay = { execution: result.execution };
      assert.equal(document.lagn_version, LAGN_VERSION_1_7_0);
      const validation = validate(document);
      assert.equal(validation.valid, true, JSON.stringify(validation.errors));

      // Block fields.
      assert.equal(result.execution.engine, 'legendary-arena');
      assert.equal(result.execution.engine_version, formatEngineVersion(getCurrentEngineVersion()));
      assert.equal(result.execution.data_version, CURRENT_DATA_VERSION.version);
      assert.equal(result.execution.engine_build, 'build-sha-abc');
      assert.equal(typeof result.execution.seed, 'string');
      assert.ok(result.execution.moves.length >= 3);
    });
  }

  test('AC-1: the round trip still holds after a JSON round trip of the artifact', () => {
    const artifact = manufactureMatch(3);
    const roundTripped = JSON.parse(JSON.stringify(artifact)) as ManufacturedMatch;
    const result = buildVerifiedReplayExecution(roundTripped, baseSetup(), NUM_PLAYERS, 'build-sha-abc');
    assert.equal(result.isVerified, true);
  });
});

describe('replayLagn.logic — move extraction (AC-2)', () => {
  before(() => setRegistryForSetup(FAT_TEST_REGISTRY as never));
  after(() => clearRegistryForSetup());

  test('seq runs 0..n-1, only MAKE_MOVE kept, args deep-equal but not reference-equal', () => {
    const artifact = manufactureMatch(3);
    const moves = extractExecutionMoves(artifact.log);
    assert.ok(moves.length > 0);
    moves.forEach((move, index) => {
      assert.equal(move.seq, index);
      assert.ok(Number.isInteger(move.seat));
      assert.equal(typeof move.move_name, 'string');
      assert.ok(Array.isArray(move.args));
    });
    // every kept entry corresponds to a MAKE_MOVE in the log
    const makeMoveCount = artifact.log.filter(
      (entry) =>
        entry !== null &&
        typeof entry === 'object' &&
        (entry as { action?: { type?: unknown } }).action?.type === MAKE_MOVE,
    ).length;
    assert.equal(moves.length, makeMoveCount);

    // args is deep-copied, never aliasing the artifact's payload array
    const firstMakeMove = artifact.log.find(
      (entry) =>
        entry !== null &&
        typeof entry === 'object' &&
        (entry as { action?: { type?: unknown } }).action?.type === MAKE_MOVE,
    ) as { action: { payload: { args: unknown[] } } };
    assert.deepEqual(moves[0].args, firstMakeMove.action.payload.args);
    assert.notStrictEqual(moves[0].args, firstMakeMove.action.payload.args);
  });
});

describe('replayLagn.logic — refusals (AC-3)', () => {
  before(() => setRegistryForSetup(FAT_TEST_REGISTRY as never));
  after(() => clearRegistryForSetup());

  test('an extra setup-data key makes the rebuild diverge → not_reexecutable', () => {
    // why: the artifact's stored matchConfiguration carries an extra key, so its
    // G (and hash) differ from the rebuild, whose emitted setup carries only the
    // nine canonical fields. The lossy case the WP-810 scaffold measured.
    const artifact = manufactureMatch(3, { extraCallerKey: 'surprise' });
    const result = buildVerifiedReplayExecution(artifact, baseSetup(), NUM_PLAYERS, 'build-sha-abc');
    assert.equal(result.isVerified, false);
    if (result.isVerified === false) {
      assert.equal(result.reason, 'not_reexecutable');
    }
  });

  test('a missing seed → not_reexecutable', () => {
    const artifact = manufactureMatch(0);
    const noSeed = JSON.parse(JSON.stringify(artifact)) as ManufacturedMatch;
    delete (noSeed.initialState as { plugins?: { random?: { data?: { seed?: unknown } } } }).plugins?.random?.data?.seed;
    assert.equal(readArtifactSeed(noSeed.initialState), null);
    const result = buildVerifiedReplayExecution(noSeed, baseSetup(), NUM_PLAYERS, 'build-sha-abc');
    assert.equal(result.isVerified, false);
    if (result.isVerified === false) {
      assert.equal(result.reason, 'not_reexecutable');
    }
  });

  test('a setup naming an ext_id the registry lacks → not_reexecutable', () => {
    const artifact = manufactureMatch(0);
    const badSetup = baseSetup({ ...COMPOSITION, heroDeckIds: ['test/no-such-hero', 'test/also-missing', 'test/gone'] });
    const result = buildVerifiedReplayExecution(artifact, badSetup, NUM_PLAYERS, 'build-sha-abc');
    assert.equal(result.isVerified, false);
    if (result.isVerified === false) {
      assert.equal(result.reason, 'not_reexecutable');
    }
  });

  test('a log entry with no action → not_reexecutable', () => {
    const artifact = manufactureMatch(3);
    const corrupted: ManufacturedMatch = {
      initialState: artifact.initialState,
      log: [...artifact.log, { _stateID: 999, turn: 2, phase: 'play' }],
    };
    const result = buildVerifiedReplayExecution(corrupted, baseSetup(), NUM_PLAYERS, 'build-sha-abc');
    assert.equal(result.isVerified, false);
    if (result.isVerified === false) {
      assert.equal(result.reason, 'not_reexecutable');
    }
  });

  test('reexecuteFromSeed: a tampered move list hashes differently from the untampered reference', () => {
    const artifact = manufactureMatch(8);
    const seed = readArtifactSeed(artifact.initialState);
    assert.ok(seed !== null);
    const setupData = toSetupDataFromLagnSetup(baseSetup());
    const moves = extractExecutionMoves(artifact.log);
    const reference = reduceMatchToFinalState({ initialState: artifact.initialState, log: artifact.log });

    const tampered = reexecuteFromSeed({ seed: seed as string, numPlayers: NUM_PLAYERS, setupData, moves: moves.slice(0, -1) });
    assert.notEqual(tampered.stateHash, reference.stateHash);

    // the untampered rebuild matches
    const faithful = reexecuteFromSeed({ seed: seed as string, numPlayers: NUM_PLAYERS, setupData, moves });
    assert.equal(faithful.stateHash, reference.stateHash);
  });
});

describe('replayLagn.logic — operator matches (AC-4)', () => {
  before(() => setRegistryForSetup(FAT_TEST_REGISTRY as never));
  after(() => clearRegistryForSetup());

  test('G.isDebugMatch === true → operator_match before any re-execution', () => {
    const artifact = manufactureMatch(0);
    const operator = JSON.parse(JSON.stringify(artifact)) as ManufacturedMatch;
    (operator.initialState as { G: { isDebugMatch?: boolean } }).G.isDebugMatch = true;
    assert.equal(isOperatorArtifact(operator.initialState), true);
    const result = buildVerifiedReplayExecution(operator, baseSetup(), NUM_PLAYERS, 'build-sha-abc');
    assert.equal(result.isVerified, false);
    if (result.isVerified === false) {
      assert.equal(result.reason, 'operator_match');
    }
  });

  test('an own isDebugMatch key on matchConfiguration (any value) → operator_match', () => {
    const artifact = manufactureMatch(0);
    const operator = JSON.parse(JSON.stringify(artifact)) as ManufacturedMatch;
    (operator.initialState as { G: { matchConfiguration: Record<string, unknown> } }).G.matchConfiguration.isDebugMatch = false;
    assert.equal(isOperatorArtifact(operator.initialState), true);
    const result = buildVerifiedReplayExecution(operator, baseSetup(), NUM_PLAYERS, 'build-sha-abc');
    assert.equal(result.isVerified, false);
    if (result.isVerified === false) {
      assert.equal(result.reason, 'operator_match');
    }
  });
});

describe('replayLagn.logic — field shapes (AC-5)', () => {
  before(() => setRegistryForSetup(FAT_TEST_REGISTRY as never));
  after(() => clearRegistryForSetup());

  test('toSetupDataFromLagnSetup round-trips the nine fields and final_blow → finalBlow', () => {
    const setup = baseSetup();
    const withFlag = { ...setup, final_blow: true } as LAGN['setup'];
    const setupData = toSetupDataFromLagnSetup(withFlag);
    assert.equal(setupData.schemeId, COMPOSITION.schemeId);
    assert.equal(setupData.mastermindId, COMPOSITION.mastermindId);
    assert.deepEqual(setupData.villainGroupIds, COMPOSITION.villainGroupIds);
    assert.deepEqual(setupData.henchmanGroupIds, COMPOSITION.henchmanGroupIds);
    assert.deepEqual(setupData.heroDeckIds, COMPOSITION.heroDeckIds);
    assert.equal(setupData.bystandersCount, COMPOSITION.bystandersCount);
    assert.equal(setupData.woundsCount, COMPOSITION.woundsCount);
    // the only non-1:1 rename
    assert.equal(setupData.officersCount, COMPOSITION.officersCount);
    assert.equal(setupData.sidekicksCount, COMPOSITION.sidekicksCount);
    assert.equal(setupData.finalBlow, true);

    // a setup without the flag omits finalBlow entirely
    const plain = toSetupDataFromLagnSetup(setup);
    assert.equal('finalBlow' in plain, false);
  });

  test('engine_build is present for a real sha and omitted for "unknown"', () => {
    const artifact = manufactureMatch(0);
    const withBuild = buildVerifiedReplayExecution(artifact, baseSetup(), NUM_PLAYERS, 'real-sha-1234');
    assert.equal(withBuild.isVerified, true);
    if (withBuild.isVerified === true) {
      assert.equal(withBuild.execution.engine_build, 'real-sha-1234');
    }
    const withoutBuild = buildVerifiedReplayExecution(artifact, baseSetup(), NUM_PLAYERS, 'unknown');
    assert.equal(withoutBuild.isVerified, true);
    if (withoutBuild.isVerified === true) {
      assert.equal('engine_build' in withoutBuild.execution, false);
    }
  });

  test('LAGN_VERSION is 1.7.0 — the writer flipped', () => {
    assert.equal(LAGN_VERSION, LAGN_VERSION_1_7_0);
  });
});
