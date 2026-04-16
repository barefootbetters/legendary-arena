/**
 * Tests for the WP-032 intent validation pipeline.
 *
 * Uses node:test + node:assert. No boardgame.io imports. Builds valid G
 * fixtures via buildInitialGameState + makeMockCtx. Uses plain object
 * literals for IntentValidationContext (not makeMockCtx, which returns
 * SetupContext — a different shape).
 *
 * These are contract enforcement tests — if a test fails, the
 * implementation is incorrect. Do NOT weaken assertions to make tests
 * pass.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { computeStateHash } from '../replay/replay.hash.js';
import { validateIntent } from './intent.validate.js';
import type {
  ClientTurnIntent,
  IntentValidationContext,
  IntentValidationResult,
} from './intent.types.js';

/**
 * Builds a valid MatchConfiguration for intent validation testing.
 * Mirrors the pattern used by invariants.test.ts.
 */
function buildValidConfig(): MatchConfiguration {
  return {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001', 'test-villain-group-002'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002', 'test-hero-deck-003'],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  };
}

/**
 * Empty registry — same shape as game.ts EMPTY_REGISTRY.
 */
const EMPTY_REGISTRY: CardRegistryReader = {
  listCards: () => [],
};

/**
 * Builds a fresh valid LegendaryGameState for testing.
 */
function buildValidGameState(): LegendaryGameState {
  return buildInitialGameState(
    buildValidConfig(),
    EMPTY_REGISTRY,
    makeMockCtx({ numPlayers: 2 }),
  );
}

/**
 * The 8 gameplay moves registered in game.ts for the play phase.
 * Tests inject this list — validateIntent does not import game.ts.
 */
const TEST_VALID_MOVES = [
  'drawCards',
  'playCard',
  'endTurn',
  'advanceStage',
  'revealVillainCard',
  'fightVillain',
  'recruitHero',
  'fightMastermind',
];

/**
 * Builds a valid IntentValidationContext for testing.
 * Plain object — not makeMockCtx (which returns SetupContext).
 */
function buildTestContext(): IntentValidationContext {
  return { currentPlayer: '0', turn: 1 };
}

/**
 * Builds a valid ClientTurnIntent that passes all validation checks.
 */
function buildValidIntent(): ClientTurnIntent {
  return {
    matchId: 'test-match-001',
    playerId: '0',
    turnNumber: 1,
    move: {
      name: 'drawCards',
      args: { count: 5 },
    },
  };
}

describe('intent validation (WP-032)', () => {

  it('valid intent passes validation', () => {
    const gameState = buildValidGameState();
    const context = buildTestContext();
    const intent = buildValidIntent();

    const result = validateIntent(intent, gameState, context, TEST_VALID_MOVES);

    assert.deepStrictEqual(result, { valid: true });
  });

  it('wrong player: rejected with WRONG_PLAYER', () => {
    const gameState = buildValidGameState();
    const context = buildTestContext();
    const intent = buildValidIntent();
    intent.playerId = '1';

    const result = validateIntent(intent, gameState, context, TEST_VALID_MOVES);

    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.strictEqual(result.code, 'WRONG_PLAYER');
      assert.ok(result.reason.length > 0, 'Reason must be a non-empty string.');
      assert.ok(result.reason.includes("'1'"), 'Reason must include the wrong player ID.');
      assert.ok(result.reason.includes("'0'"), 'Reason must include the current player ID.');
    }
  });

  it('wrong turn number: rejected with WRONG_TURN', () => {
    const gameState = buildValidGameState();
    const context = buildTestContext();
    const intent = buildValidIntent();
    intent.turnNumber = 99;

    const result = validateIntent(intent, gameState, context, TEST_VALID_MOVES);

    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.strictEqual(result.code, 'WRONG_TURN');
      assert.ok(result.reason.length > 0, 'Reason must be a non-empty string.');
    }
  });

  it('unregistered move name: rejected with INVALID_MOVE', () => {
    const gameState = buildValidGameState();
    const context = buildTestContext();
    const intent = buildValidIntent();
    intent.move.name = 'nonexistentMove';

    const result = validateIntent(intent, gameState, context, TEST_VALID_MOVES);

    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.strictEqual(result.code, 'INVALID_MOVE');
      assert.ok(result.reason.includes('nonexistentMove'), 'Reason must include the invalid move name.');
    }
  });

  it('malformed args (function): rejected with MALFORMED_ARGS', () => {
    const gameState = buildValidGameState();
    const context = buildTestContext();
    const intent = buildValidIntent();
    intent.move.args = () => {};

    const result = validateIntent(intent, gameState, context, TEST_VALID_MOVES);

    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.strictEqual(result.code, 'MALFORMED_ARGS');
      assert.ok(result.reason.length > 0, 'Reason must be a non-empty string.');
    }
  });

  it('matching client state hash: passes', () => {
    const gameState = buildValidGameState();
    const context = buildTestContext();
    const intent = buildValidIntent();
    intent.clientStateHash = computeStateHash(gameState);

    const result = validateIntent(intent, gameState, context, TEST_VALID_MOVES);

    assert.deepStrictEqual(result, { valid: true });
  });

  it('mismatched client state hash: rejected with DESYNC_DETECTED', () => {
    const gameState = buildValidGameState();
    const context = buildTestContext();
    const intent = buildValidIntent();
    intent.clientStateHash = 'wrong-hash-value';

    const result = validateIntent(intent, gameState, context, TEST_VALID_MOVES);

    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.strictEqual(result.code, 'DESYNC_DETECTED');
      assert.ok(result.reason.length > 0, 'Reason must be a non-empty string.');
    }
  });

  it('no client hash provided: passes (hash is optional)', () => {
    const gameState = buildValidGameState();
    const context = buildTestContext();
    const intent = buildValidIntent();
    // clientStateHash is intentionally omitted (undefined)

    const result = validateIntent(intent, gameState, context, TEST_VALID_MOVES);

    assert.deepStrictEqual(result, { valid: true });
  });

  it('validation does not mutate gameState', () => {
    const gameState = buildValidGameState();
    const context = buildTestContext();
    const intent = buildValidIntent();

    const originalSnapshot = JSON.stringify(gameState);

    validateIntent(intent, gameState, context, TEST_VALID_MOVES);

    assert.strictEqual(
      JSON.stringify(gameState),
      originalSnapshot,
      'validateIntent must not mutate gameState — deep equality check failed.',
    );
  });

});
