/**
 * Tests for the AI playtesting and balance simulation framework.
 *
 * Exactly eight tests inside one describe block, per WP-036 §G + EC-036
 * §After Completing. Each test targets a binary acceptance criterion —
 * contract enforcement framing (WP-028 precedent): if a test fails, the
 * implementation is incorrect. Tests do not use boardgame.io or
 * @legendary-arena/registry; they rely on makeMockCtx and a minimal
 * in-file CardRegistryReader fixture.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { UIState } from '../ui/uiState.types.js';
import type { LegalMove, SimulationConfig } from './ai.types.js';

import { makeMockCtx } from '../test/mockCtx.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { buildUIState } from '../ui/uiState.build.js';
import { filterUIStateForAudience } from '../ui/uiState.filter.js';
import { createRandomPolicy } from './ai.random.js';
import { getLegalMoves } from './ai.legalMoves.js';
import { runSimulation } from './simulation.runner.js';

/**
 * Builds a valid 9-field MatchSetupConfig fixture for simulation tests.
 *
 * Mirrors the createTestConfig helper in
 * setup/buildInitialGameState.shape.test.ts so fixture semantics stay
 * aligned with the canonical setup-test pattern.
 */
function createTestConfig(): MatchSetupConfig {
  return {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
}

/**
 * Minimal CardRegistryReader returning an empty card list.
 *
 * buildInitialGameState handles narrow mocks gracefully — the internal
 * buildVillainDeck, buildCardStats, and buildCardKeywords all produce
 * empty records when the registry lacks listSets/getSet.
 */
function createMockRegistry(): CardRegistryReader {
  return {
    listCards: () => [],
  };
}

describe('simulation framework (WP-036)', () => {
  test('createRandomPolicy returns an AIPolicy with decideTurn function', () => {
    const policy = createRandomPolicy('seed-shape');

    assert.equal(typeof policy.name, 'string', 'AIPolicy.name must be a string');
    assert.equal(policy.name.length > 0, true, 'AIPolicy.name must be non-empty');
    assert.equal(
      typeof policy.decideTurn,
      'function',
      'AIPolicy.decideTurn must be a function',
    );
  });

  test('random policy produces valid ClientTurnIntent for legal moves', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const context = makeMockCtx({ numPlayers: 2 });
    const gameState = buildInitialGameState(config, registry, context);
    // why: advanceStage pushes from 'start' to 'main' so playCard/drawCards
    // are enumerated. The legal-move set in 'main' includes drawCards,
    // advanceStage, and (when hand is non-empty) playCard.
    gameState.currentStage = 'main';

    const uiState = buildUIState(gameState, {
      phase: 'play',
      turn: 1,
      currentPlayer: '0',
    });
    const filtered = filterUIStateForAudience(uiState, {
      kind: 'player',
      playerId: '0',
    });
    const legalMoves = getLegalMoves(gameState, {
      phase: 'play',
      turn: 1,
      currentPlayer: '0',
      numPlayers: 2,
    });

    const policy = createRandomPolicy('seed-shape-2');
    const intent = policy.decideTurn(filtered, legalMoves);

    assert.equal(typeof intent.matchId, 'string', 'intent.matchId must be a string');
    assert.equal(intent.playerId, '0', 'intent.playerId must reflect active player');
    assert.equal(intent.turnNumber, 1, 'intent.turnNumber must reflect current turn');
    assert.ok(intent.move !== null, 'intent.move must not be null');
    assert.equal(
      typeof intent.move.name,
      'string',
      'intent.move.name must be a string',
    );
    const allowedNames = new Set<string>([
      'drawCards',
      'playCard',
      'endTurn',
      'advanceStage',
      'revealVillainCard',
      'fightVillain',
      'recruitHero',
      'fightMastermind',
    ]);
    assert.ok(
      allowedNames.has(intent.move.name),
      `intent.move.name must be one of the eight simulation move names; got "${intent.move.name}"`,
    );
  });

  test('same seed produces identical decisions (deterministic)', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const context = makeMockCtx({ numPlayers: 2 });
    const gameState = buildInitialGameState(config, registry, context);
    gameState.currentStage = 'main';

    const uiState = buildUIState(gameState, {
      phase: 'play',
      turn: 1,
      currentPlayer: '0',
    });
    const filtered = filterUIStateForAudience(uiState, {
      kind: 'player',
      playerId: '0',
    });
    const legalMoves = getLegalMoves(gameState, {
      phase: 'play',
      turn: 1,
      currentPlayer: '0',
      numPlayers: 2,
    });

    const policyA = createRandomPolicy('determinism-seed');
    const policyB = createRandomPolicy('determinism-seed');

    const intentA = policyA.decideTurn(filtered, legalMoves);
    const intentB = policyB.decideTurn(filtered, legalMoves);

    assert.deepStrictEqual(
      intentA,
      intentB,
      'Two policies with identical seeds must produce identical first-call intents',
    );
  });

  test('different seed produces different decisions', () => {
    // why: construct a synthetic legal-move list of 32 entries so the
    // probability that two independent mulberry32 seeds produce the same
    // first index is 1/32 ≈ 3%. The two seeds chosen below are empirically
    // verified to diverge on the first index; if the mulberry32 hash ever
    // changes they may need to be re-chosen.
    const legalMoves: LegalMove[] = [];
    for (let index = 0; index < 32; index++) {
      legalMoves.push({ name: 'advanceStage', args: { tag: index } });
    }

    const minimalView: UIState = {
      game: { phase: 'play', turn: 1, activePlayerId: '0', currentStage: 'main' },
      players: [
        {
          playerId: '0',
          deckCount: 0,
          handCount: 0,
          discardCount: 0,
          inPlayCount: 0,
          victoryCount: 0,
          woundCount: 0,
          handCards: [],
        },
      ],
      city: { spaces: [null, null, null, null, null] },
      hq: { slots: [null, null, null, null, null] },
      mastermind: { id: 'test', tacticsRemaining: 0, tacticsDefeated: 0 },
      scheme: { id: 'test', twistCount: 0 },
      economy: { attack: 0, recruit: 0, availableAttack: 0, availableRecruit: 0 },
      log: [],
      progress: { bystandersRescued: 0, escapedVillains: 0 },
    };

    const policyA = createRandomPolicy('alpha-seed');
    const policyB = createRandomPolicy('beta-seed');

    const intentA = policyA.decideTurn(minimalView, legalMoves);
    const intentB = policyB.decideTurn(minimalView, legalMoves);

    assert.notDeepStrictEqual(
      intentA.move.args,
      intentB.move.args,
      'Two policies with different seeds must produce different first-call intents for a 32-move legal set',
    );
  });

  test('getLegalMoves returns non-empty list during active game', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const context = makeMockCtx({ numPlayers: 2 });
    const gameState = buildInitialGameState(config, registry, context);
    // why: default setup leaves currentStage === 'start'; at minimum the
    // returned list contains revealVillainCard + drawCards + advanceStage.
    const legalMoves = getLegalMoves(gameState, {
      phase: 'play',
      turn: 1,
      currentPlayer: '0',
      numPlayers: 2,
    });

    assert.ok(
      legalMoves.length > 0,
      `getLegalMoves must return at least one entry in the start stage; got ${legalMoves.length}`,
    );
  });

  test('runSimulation with 2 games produces aggregate SimulationResult', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const simConfig: SimulationConfig = {
      games: 2,
      seed: 'aggregate-seed',
      setupConfig: config,
      policies: [createRandomPolicy('p0-seed'), createRandomPolicy('p1-seed')],
    };

    const result = runSimulation(simConfig, registry);

    assert.equal(result.gamesPlayed, 2, 'gamesPlayed must equal config.games');
    assert.equal(
      Number.isFinite(result.winRate),
      true,
      'winRate must be a finite number',
    );
    assert.equal(
      Number.isFinite(result.averageTurns),
      true,
      'averageTurns must be a finite number',
    );
    assert.equal(
      Number.isFinite(result.averageScore),
      true,
      'averageScore must be a finite number',
    );
    assert.equal(
      Number.isFinite(result.escapedVillainsAverage),
      true,
      'escapedVillainsAverage must be a finite number',
    );
    assert.equal(
      Number.isFinite(result.woundsAverage),
      true,
      'woundsAverage must be a finite number',
    );
    assert.equal(result.seed, 'aggregate-seed', 'seed must echo config.seed verbatim');
  });

  test('AI does not see hidden state (filtered UIState has no hand cards for opponents)', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const context = makeMockCtx({ numPlayers: 2 });
    const gameState = buildInitialGameState(config, registry, context);

    const uiState = buildUIState(gameState, {
      phase: 'play',
      turn: 1,
      currentPlayer: '0',
    });
    const filtered = filterUIStateForAudience(uiState, {
      kind: 'player',
      playerId: '0',
    });

    const player0 = filtered.players.find((player) => player.playerId === '0')!;
    const player1 = filtered.players.find((player) => player.playerId === '1')!;

    assert.ok(
      player0.handCards !== undefined,
      'Active player must see own handCards',
    );
    assert.equal(
      player1.handCards,
      undefined,
      'Other player handCards must be undefined (redacted)',
    );
  });

  test('simulation results are JSON-serializable', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const simConfig: SimulationConfig = {
      games: 1,
      seed: 'json-seed',
      setupConfig: config,
      policies: [createRandomPolicy('p0'), createRandomPolicy('p1')],
    };

    const result = runSimulation(simConfig, registry);

    const serialized = JSON.stringify(result);
    assert.equal(
      typeof serialized,
      'string',
      'JSON.stringify must return a string for a SimulationResult',
    );
    const parsed = JSON.parse(serialized);
    assert.deepStrictEqual(
      parsed,
      result,
      'JSON round-trip must preserve every SimulationResult field verbatim',
    );
  });
});
