/**
 * Contract enforcement tests for buildUIState (WP-028).
 *
 * These tests are contract enforcement tests. They are not examples,
 * not smoke tests, and not illustrative. If tests fail, the implementation
 * is incorrect by definition. Do NOT weaken assertions to make tests pass —
 * fix the implementation instead.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildUIState } from './uiState.build.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { LegendaryGameState } from '../types.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';

/**
 * Creates a valid test MatchSetupConfig. Same pattern used in
 * buildInitialGameState.shape.test.ts.
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
 * Minimal mock registry for tests. Returns empty card list since
 * UIState tests do not require card validation.
 */
function createMockRegistry(): CardRegistryReader {
  return { listCards: () => [] };
}

/**
 * Inline mock for UIBuildContext. This is NOT makeMockCtx (which returns
 * SetupContext) — it matches the local UIBuildContext structural interface
 * that buildUIState expects.
 */
const mockCtx = {
  phase: 'play' as string | null,
  turn: 1,
  currentPlayer: '0',
};

/**
 * Constructs a valid LegendaryGameState for testing.
 */
function createTestGameState(): LegendaryGameState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  return buildInitialGameState(config, registry, setupContext);
}

describe('buildUIState', () => {
  it('returns a valid UIState for a standard game state', () => {
    const gameState = createTestGameState();
    const result = buildUIState(gameState, mockCtx);

    // why: verify all top-level keys from the locked UIState shape exist
    assert.ok('game' in result, 'UIState must have game key');
    assert.ok('players' in result, 'UIState must have players key');
    assert.ok('city' in result, 'UIState must have city key');
    assert.ok('hq' in result, 'UIState must have hq key');
    assert.ok('mastermind' in result, 'UIState must have mastermind key');
    assert.ok('scheme' in result, 'UIState must have scheme key');
    assert.ok('economy' in result, 'UIState must have economy key');
    assert.ok('log' in result, 'UIState must have log key');

    assert.equal(result.game.phase, 'play');
    assert.equal(result.game.turn, 1);
    assert.equal(result.game.activePlayerId, '0');
  });

  it('UIState is JSON-serializable (roundtrip)', () => {
    const gameState = createTestGameState();
    const result = buildUIState(gameState, mockCtx);

    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);

    assert.deepStrictEqual(parsed, result);
  });

  it('UIState does NOT contain hookRegistry', () => {
    const gameState = createTestGameState();
    const result = buildUIState(gameState, mockCtx);

    assert.ok(!('hookRegistry' in result), 'hookRegistry must not appear in UIState');

    // why: also check the serialized form to catch nested leakage
    const json = JSON.stringify(result);
    assert.ok(
      !json.includes('"hookRegistry"'),
      'hookRegistry must not appear anywhere in serialized UIState',
    );
  });

  it('UIState does NOT contain villainDeckCardTypes', () => {
    const gameState = createTestGameState();
    const result = buildUIState(gameState, mockCtx);

    assert.ok(
      !('villainDeckCardTypes' in result),
      'villainDeckCardTypes must not appear in UIState',
    );
  });

  it('UIState does NOT contain cardStats', () => {
    const gameState = createTestGameState();
    const result = buildUIState(gameState, mockCtx);

    assert.ok(!('cardStats' in result), 'cardStats must not appear in UIState');
  });

  it('player zones are projected as counts (not card arrays)', () => {
    const gameState = createTestGameState();
    const result = buildUIState(gameState, mockCtx);

    assert.ok(result.players.length > 0, 'Must have at least one player');

    const firstPlayer = result.players[0]!;
    assert.equal(typeof firstPlayer.deckCount, 'number', 'deckCount must be a number');
    assert.equal(typeof firstPlayer.handCount, 'number', 'handCount must be a number');
    assert.equal(typeof firstPlayer.discardCount, 'number', 'discardCount must be a number');
    assert.equal(typeof firstPlayer.inPlayCount, 'number', 'inPlayCount must be a number');
    assert.equal(typeof firstPlayer.victoryCount, 'number', 'victoryCount must be a number');
    assert.equal(typeof firstPlayer.woundCount, 'number', 'woundCount must be a number');
    assert.ok(!Array.isArray(firstPlayer.deckCount), 'deckCount must not be an array');
  });

  it('buildUIState does not mutate input G (deep equality check)', () => {
    const gameState = createTestGameState();
    const gBefore = JSON.stringify(gameState);

    buildUIState(gameState, mockCtx);

    const gAfter = JSON.stringify(gameState);
    assert.equal(gBefore, gAfter, 'G must not be mutated by buildUIState');
  });

  it('same G + ctx produces identical UIState (deterministic)', () => {
    const gameState = createTestGameState();

    const result1 = buildUIState(gameState, mockCtx);
    const result2 = buildUIState(gameState, mockCtx);

    assert.deepStrictEqual(result1, result2, 'UIState must be deterministic');
  });

  it('game-over state is projected when endgame result exists', () => {
    const gameState = createTestGameState();

    // why: set mastermindDefeated counter to trigger heroes-win endgame
    // via evaluateEndgame. Use ENDGAME_CONDITIONS constant, not raw string.
    gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] = 1;

    const result = buildUIState(gameState, mockCtx);

    assert.ok(result.gameOver !== undefined, 'gameOver must be present when endgame triggers');
    assert.equal(result.gameOver!.outcome, 'heroes-win');
    assert.ok(result.gameOver!.scores !== undefined, 'scores must be present in gameOver');
  });
});
