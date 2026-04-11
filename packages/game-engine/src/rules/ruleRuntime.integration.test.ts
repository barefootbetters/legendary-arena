/**
 * End-to-end integration tests for the rule execution pipeline.
 *
 * Verifies that executeRuleHooks + applyRuleEffects produce the expected
 * observable changes in G.messages when the default scheme and mastermind
 * hooks fire on onTurnStart and onTurnEnd triggers.
 *
 * No boardgame.io imports. Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeRuleHooks } from './ruleRuntime.execute.js';
import { applyRuleEffects } from './ruleRuntime.effects.js';
import {
  DEFAULT_IMPLEMENTATION_MAP,
  buildDefaultHookDefinitions,
} from './ruleRuntime.impl.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

/**
 * Creates a valid mock MatchSetupConfig for integration tests.
 */
function createTestConfig(): MatchSetupConfig {
  return {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 1,
  };
}

/**
 * Creates a minimal mock registry for integration tests.
 */
function createMockRegistry() {
  return { listCards: () => [] };
}

describe('rule execution pipeline — integration', () => {
  it('onTurnStart trigger produces "Scheme: turn started." in G.messages', () => {
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 1 });
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, context);

    assert.deepStrictEqual(
      gameState.messages,
      [],
      'G.messages must start empty',
    );

    const effects = executeRuleHooks(
      gameState,
      {},
      'onTurnStart',
      { currentPlayerId: '0' },
      gameState.hookRegistry,
      DEFAULT_IMPLEMENTATION_MAP,
    );

    applyRuleEffects(gameState, {}, effects);

    assert.ok(
      gameState.messages.includes('Scheme: turn started.'),
      'G.messages must contain "Scheme: turn started." after onTurnStart',
    );
  });

  it('onTurnEnd trigger produces "Mastermind: turn ended." in G.messages', () => {
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 1 });
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, context);

    const effects = executeRuleHooks(
      gameState,
      {},
      'onTurnEnd',
      { currentPlayerId: '0' },
      gameState.hookRegistry,
      DEFAULT_IMPLEMENTATION_MAP,
    );

    applyRuleEffects(gameState, {}, effects);

    assert.ok(
      gameState.messages.includes('Mastermind: turn ended.'),
      'G.messages must contain "Mastermind: turn ended." after onTurnEnd',
    );
  });

  it('G remains JSON-serializable after all effects are applied', () => {
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 1 });
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, context);

    // Fire onTurnStart
    const startEffects = executeRuleHooks(
      gameState,
      {},
      'onTurnStart',
      { currentPlayerId: '0' },
      gameState.hookRegistry,
      DEFAULT_IMPLEMENTATION_MAP,
    );
    applyRuleEffects(gameState, {}, startEffects);

    // Fire onTurnEnd
    const endEffects = executeRuleHooks(
      gameState,
      {},
      'onTurnEnd',
      { currentPlayerId: '0' },
      gameState.hookRegistry,
      DEFAULT_IMPLEMENTATION_MAP,
    );
    applyRuleEffects(gameState, {}, endEffects);

    const serialized = JSON.stringify(gameState);
    assert.ok(
      serialized,
      'JSON.stringify(G) must produce a non-empty string after all effects',
    );

    const deserialized = JSON.parse(serialized);
    assert.deepStrictEqual(
      deserialized.messages,
      gameState.messages,
      'Messages must survive JSON round-trip',
    );
  });

  it('executeRuleHooks does not modify G — calling twice produces the same G', () => {
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 1 });
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, context);

    const snapshotBefore = JSON.stringify(gameState);

    executeRuleHooks(
      gameState,
      {},
      'onTurnStart',
      { currentPlayerId: '0' },
      gameState.hookRegistry,
      DEFAULT_IMPLEMENTATION_MAP,
    );

    const snapshotAfter = JSON.stringify(gameState);

    assert.equal(
      snapshotBefore,
      snapshotAfter,
      'executeRuleHooks must not modify G — snapshots must be identical',
    );
  });

  it('modifyCounter effects update G.counters correctly', () => {
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 1 });
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, context);

    const effects = executeRuleHooks(
      gameState,
      {},
      'onTurnStart',
      { currentPlayerId: '0' },
      gameState.hookRegistry,
      DEFAULT_IMPLEMENTATION_MAP,
    );

    applyRuleEffects(gameState, {}, effects);

    // Default scheme implementation includes modifyCounter with delta: 0
    assert.equal(
      gameState.counters.schemeTwistCount,
      0,
      'schemeTwistCount must be 0 after default scheme fires with delta: 0',
    );
  });

  it('unknown effect types push a warning to G.messages without throwing', () => {
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 1 });
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, context);

    const unknownEffects = [
      { type: 'futureEffectType', data: 'something' } as unknown as import('./ruleHooks.types.js').RuleEffect,
    ];

    // Must not throw
    applyRuleEffects(gameState, {}, unknownEffects);

    assert.ok(
      gameState.messages.some((message) => message.includes('Unknown rule effect type')),
      'G.messages must contain a warning about the unknown effect type',
    );
  });
});
