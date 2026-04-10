/**
 * Validator integration tests for buildInitialGameState.
 *
 * Confirms that a full setup run produces game state that passes both
 * validateGameStateShape and validatePlayerStateShape. Validators are
 * invoked for assurance only — no gating or mutation.
 *
 * Uses makeMockCtx from src/test/mockCtx.ts — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialGameState } from './buildInitialGameState.js';
import {
  validateGameStateShape,
  validatePlayerStateShape,
} from '../state/zones.validate.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';

/**
 * Creates a valid mock MatchSetupConfig for integration tests.
 */
function createTestConfig(): MatchSetupConfig {
  return {
    schemeId: 'test-scheme-int',
    mastermindId: 'test-mastermind-int',
    villainGroupIds: ['test-villain-int-001'],
    henchmanGroupIds: ['test-henchman-int-001'],
    heroDeckIds: ['test-hero-int-001', 'test-hero-int-002'],
    bystandersCount: 15,
    woundsCount: 10,
    officersCount: 8,
    sidekicksCount: 4,
  };
}

/**
 * Creates a minimal mock registry that satisfies CardRegistryReader.
 */
function createMockRegistry(): CardRegistryReader {
  return {
    listCards: () => [],
  };
}

describe('validators integration — buildInitialGameState output', () => {
  it('validateGameStateShape returns ok: true on setup output', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const context = makeMockCtx({ numPlayers: 2 });

    const gameState = buildInitialGameState(config, registry, context);
    const result = validateGameStateShape(gameState);

    assert.deepStrictEqual(
      result,
      { ok: true },
      'validateGameStateShape must return { ok: true } for a valid setup output. ' +
      'If this fails, buildInitialGameState is producing a malformed game state.',
    );
  });

  it('validatePlayerStateShape returns ok: true for every player', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const context = makeMockCtx({ numPlayers: 3 });

    const gameState = buildInitialGameState(config, registry, context);

    for (const playerId of Object.keys(gameState.playerZones)) {
      const playerState = {
        playerId,
        zones: gameState.playerZones[playerId],
      };

      const result = validatePlayerStateShape(playerState);

      assert.deepStrictEqual(
        result,
        { ok: true },
        `validatePlayerStateShape must return { ok: true } for player ${playerId}. ` +
        'If this fails, per-player zone construction is producing a malformed shape.',
      );
    }
  });

  it('JSON.stringify(G) does not throw on setup output', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const context = makeMockCtx({ numPlayers: 2 });

    const gameState = buildInitialGameState(config, registry, context);

    assert.doesNotThrow(
      () => JSON.stringify(gameState),
      'Game state must be JSON-serializable. If this throws, G contains ' +
      'non-serializable values (functions, classes, Maps, Sets, circular refs).',
    );
  });
});
