/**
 * Ordering tests for the rule execution pipeline.
 *
 * Verifies that executeRuleHooks produces effects in deterministic order
 * (priority ascending, then id lexically for ties) and that missing
 * handlers are skipped gracefully without throwing.
 *
 * No boardgame.io imports. Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeRuleHooks } from './ruleRuntime.execute.js';
import type { ImplementationMap } from './ruleRuntime.execute.js';
import type { HookDefinition, RuleEffect } from './ruleHooks.types.js';
import { createHookRegistry } from './ruleHooks.registry.js';
import type { LegendaryGameState } from '../types.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

/**
 * Creates a minimal MatchSetupConfig for ordering tests.
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
 * Creates a minimal mock registry for ordering tests.
 */
function createMockRegistry() {
  return { listCards: () => [] };
}

/**
 * Builds a test game state with messages, counters, and hookRegistry.
 */
function buildTestGameState(hooks: HookDefinition[]): LegendaryGameState {
  const config = createTestConfig();
  const context = makeMockCtx({ numPlayers: 1 });
  const registry = createMockRegistry();
  const baseState = buildInitialGameState(config, registry, context);
  return { ...baseState, hookRegistry: createHookRegistry(hooks) };
}

describe('executeRuleHooks — ordering', () => {
  it('lower priority hook effects appear before higher priority hook effects', () => {
    const hookLow: HookDefinition = {
      id: 'hook-low',
      kind: 'scheme',
      sourceId: 'test-scheme-001',
      triggers: ['onTurnStart'],
      priority: 5,
    };
    const hookHigh: HookDefinition = {
      id: 'hook-high',
      kind: 'mastermind',
      sourceId: 'test-mastermind-001',
      triggers: ['onTurnStart'],
      priority: 15,
    };

    const implementationMap: ImplementationMap = {
      'hook-low': () => [{ type: 'queueMessage', message: 'low-priority' }],
      'hook-high': () => [{ type: 'queueMessage', message: 'high-priority' }],
    };

    const gameState = buildTestGameState([hookLow, hookHigh]);
    const effects = executeRuleHooks(
      gameState,
      {},
      'onTurnStart',
      { currentPlayerId: '0' },
      gameState.hookRegistry,
      implementationMap,
    );

    assert.equal(effects.length, 2, 'Must produce exactly 2 effects');
    assert.equal(
      (effects[0] as { type: 'queueMessage'; message: string }).message,
      'low-priority',
      'Lower priority hook effects must appear first',
    );
    assert.equal(
      (effects[1] as { type: 'queueMessage'; message: string }).message,
      'high-priority',
      'Higher priority hook effects must appear second',
    );
  });

  it('equal priority hooks are ordered by id lexically', () => {
    const hookAlpha: HookDefinition = {
      id: 'alpha-hook',
      kind: 'scheme',
      sourceId: 'test-scheme-001',
      triggers: ['onTurnStart'],
      priority: 10,
    };
    const hookBeta: HookDefinition = {
      id: 'beta-hook',
      kind: 'mastermind',
      sourceId: 'test-mastermind-001',
      triggers: ['onTurnStart'],
      priority: 10,
    };

    const implementationMap: ImplementationMap = {
      'alpha-hook': () => [{ type: 'queueMessage', message: 'alpha' }],
      'beta-hook': () => [{ type: 'queueMessage', message: 'beta' }],
    };

    const gameState = buildTestGameState([hookBeta, hookAlpha]);
    const effects = executeRuleHooks(
      gameState,
      {},
      'onTurnStart',
      { currentPlayerId: '0' },
      gameState.hookRegistry,
      implementationMap,
    );

    assert.equal(effects.length, 2, 'Must produce exactly 2 effects');
    assert.equal(
      (effects[0] as { type: 'queueMessage'; message: string }).message,
      'alpha',
      'Lexically earlier id must appear first when priorities are equal',
    );
    assert.equal(
      (effects[1] as { type: 'queueMessage'; message: string }).message,
      'beta',
      'Lexically later id must appear second when priorities are equal',
    );
  });

  it('hook with no matching handler is skipped gracefully', () => {
    const hookWithHandler: HookDefinition = {
      id: 'has-handler',
      kind: 'scheme',
      sourceId: 'test-scheme-001',
      triggers: ['onTurnStart'],
      priority: 10,
    };
    const hookWithoutHandler: HookDefinition = {
      id: 'no-handler',
      kind: 'mastermind',
      sourceId: 'test-mastermind-001',
      triggers: ['onTurnStart'],
      priority: 5,
    };

    const implementationMap: ImplementationMap = {
      'has-handler': () => [{ type: 'queueMessage', message: 'handled' }],
    };

    const gameState = buildTestGameState([hookWithHandler, hookWithoutHandler]);

    // Must not throw
    const effects = executeRuleHooks(
      gameState,
      {},
      'onTurnStart',
      { currentPlayerId: '0' },
      gameState.hookRegistry,
      implementationMap,
    );

    assert.equal(
      effects.length,
      1,
      'Only the hook with a handler should produce effects',
    );
    assert.equal(
      (effects[0] as { type: 'queueMessage'; message: string }).message,
      'handled',
      'The hook with a handler must still fire correctly',
    );
  });
});
