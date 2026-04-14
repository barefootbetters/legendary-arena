/**
 * End-to-end integration tests for the rule execution pipeline.
 *
 * Verifies that executeRuleHooks + applyRuleEffects produce the expected
 * observable changes in G.messages and G.counters when the scheme and
 * mastermind hooks fire on onSchemeTwistRevealed and
 * onMastermindStrikeRevealed triggers.
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
  it('onSchemeTwistRevealed trigger produces scheme twist message in G.messages', () => {
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
      'onSchemeTwistRevealed',
      { cardId: 'test-twist-001' },
      gameState.hookRegistry,
      DEFAULT_IMPLEMENTATION_MAP,
    );

    applyRuleEffects(gameState, {}, effects);

    assert.ok(
      gameState.messages.includes('Scheme twist revealed — twist count incremented.'),
      'G.messages must contain scheme twist message after onSchemeTwistRevealed',
    );
  });

  it('onMastermindStrikeRevealed trigger produces mastermind strike message in G.messages', () => {
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 1 });
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, context);

    const effects = executeRuleHooks(
      gameState,
      {},
      'onMastermindStrikeRevealed',
      { cardId: 'test-strike-001' },
      gameState.hookRegistry,
      DEFAULT_IMPLEMENTATION_MAP,
    );

    applyRuleEffects(gameState, {}, effects);

    assert.ok(
      gameState.messages.includes('Mastermind strike revealed — strike count incremented.'),
      'G.messages must contain mastermind strike message after onMastermindStrikeRevealed',
    );
  });

  it('G remains JSON-serializable after all effects are applied', () => {
    const config = createTestConfig();
    const context = makeMockCtx({ numPlayers: 1 });
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, context);

    // Fire onSchemeTwistRevealed
    const twistEffects = executeRuleHooks(
      gameState,
      {},
      'onSchemeTwistRevealed',
      { cardId: 'test-twist-001' },
      gameState.hookRegistry,
      DEFAULT_IMPLEMENTATION_MAP,
    );
    applyRuleEffects(gameState, {}, twistEffects);

    // Fire onMastermindStrikeRevealed
    const strikeEffects = executeRuleHooks(
      gameState,
      {},
      'onMastermindStrikeRevealed',
      { cardId: 'test-strike-001' },
      gameState.hookRegistry,
      DEFAULT_IMPLEMENTATION_MAP,
    );
    applyRuleEffects(gameState, {}, strikeEffects);

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
      'onSchemeTwistRevealed',
      { cardId: 'test-twist-001' },
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
      'onSchemeTwistRevealed',
      { cardId: 'test-twist-001' },
      gameState.hookRegistry,
      DEFAULT_IMPLEMENTATION_MAP,
    );

    applyRuleEffects(gameState, {}, effects);

    assert.equal(
      gameState.counters.schemeTwistCount,
      1,
      'schemeTwistCount must be 1 after scheme twist handler fires with delta: 1',
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
