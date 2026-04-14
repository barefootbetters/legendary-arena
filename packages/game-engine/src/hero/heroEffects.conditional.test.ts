/**
 * Integration tests for conditional hero effect execution (WP-023).
 *
 * Verifies that executeHeroEffects correctly integrates condition evaluation:
 * effects with met conditions execute, effects with unmet conditions are
 * skipped, G is not mutated by condition evaluation, and serialization
 * remains valid.
 *
 * No boardgame.io imports. Uses makeMockCtx for ShuffleProvider.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeHeroEffects } from './heroEffects.execute.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/**
 * Creates a minimal LegendaryGameState for conditional execution testing.
 *
 * @param overrides - Partial overrides for player zones and hooks.
 * @returns A minimal LegendaryGameState.
 */
function makeTestState(overrides?: {
  deck?: string[];
  hand?: string[];
  discard?: string[];
  inPlay?: string[];
  heroAbilityHooks?: HeroAbilityHook[];
  turnEconomyAttack?: number;
  turnEconomyRecruit?: number;
  ko?: string[];
}): LegendaryGameState {
  return {
    matchConfiguration: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
      bystandersCount: 0,
      woundsCount: 0,
      officersCount: 0,
      sidekicksCount: 0,
    },
    selection: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    },
    currentStage: 'main' as LegendaryGameState['currentStage'],
    playerZones: {
      '0': {
        deck: overrides?.deck ?? [],
        hand: overrides?.hand ?? [],
        discard: overrides?.discard ?? [],
        inPlay: overrides?.inPlay ?? [],
        victory: [],
      },
    },
    piles: {
      bystanders: [],
      wounds: [],
      officers: [],
      sidekicks: [],
    },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: overrides?.ko ?? [],
    attachedBystanders: {},
    turnEconomy: {
      attack: overrides?.turnEconomyAttack ?? 0,
      recruit: overrides?.turnEconomyRecruit ?? 0,
      spentAttack: 0,
      spentRecruit: 0,
    },
    cardStats: {},
    mastermind: {
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: [],
      tacticsDefeated: [],
    },
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
    heroAbilityHooks: overrides?.heroAbilityHooks ?? [],
  };
}

describe('executeHeroEffects — conditional execution (WP-023)', () => {
  // why: makeMockCtx provides ShuffleProvider-compatible context
  // (random.Shuffle reverses arrays for determinism)
  const mockCtx = makeMockCtx();

  // -------------------------------------------------------------------------
  // Test 1: conditional effect with met conditions executes
  // -------------------------------------------------------------------------
  it('conditional effect with met conditions: effect executes', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x', 'hero-y'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          // why: playedThisTurn value '1' — player has 2 cards in play,
          // so condition is met (2 >= 1)
          conditions: [{ type: 'playedThisTurn', value: '1' }],
          effects: [{ type: 'attack', magnitude: 3 }],
        },
      ],
    });

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    assert.equal(gameState.turnEconomy.attack, 3,
      'Attack should increase by 3 when playedThisTurn condition is met.');
  });

  // -------------------------------------------------------------------------
  // Test 2: conditional effect with unmet conditions skipped
  // -------------------------------------------------------------------------
  it('conditional effect with unmet conditions: effect skipped, no G mutation', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          // why: heroClassMatch is a placeholder that always returns false
          conditions: [{ type: 'heroClassMatch', value: 'tech' }],
          effects: [{ type: 'attack', magnitude: 5 }],
        },
      ],
    });

    const economyBefore = { ...gameState.turnEconomy };
    const inPlayBefore = [...gameState.playerZones['0'].inPlay];

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    assert.deepEqual(gameState.turnEconomy, economyBefore,
      'turnEconomy should not change when conditions are not met.');
    assert.deepEqual(gameState.playerZones['0'].inPlay, inPlayBefore,
      'inPlay should not change when conditions are not met.');
  });

  // -------------------------------------------------------------------------
  // Test 3: multiple hooks, some conditional — only met ones execute
  // -------------------------------------------------------------------------
  it('multiple hooks on one card, some conditional: only met ones execute', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x'],
      heroAbilityHooks: [
        {
          // Hook 1: unconditional — should execute
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['recruit'],
          effects: [{ type: 'recruit', magnitude: 2 }],
        },
        {
          // Hook 2: conditional (heroClassMatch = always false) — should skip
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          conditions: [{ type: 'heroClassMatch', value: 'tech' }],
          effects: [{ type: 'attack', magnitude: 4 }],
        },
      ],
    });

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    assert.equal(gameState.turnEconomy.recruit, 2,
      'Unconditional recruit effect should execute.');
    assert.equal(gameState.turnEconomy.attack, 0,
      'Conditional attack effect should be skipped (condition not met).');
  });

  // -------------------------------------------------------------------------
  // Test 4: condition evaluation does not mutate G
  // -------------------------------------------------------------------------
  it('condition evaluation does not mutate G (deep equality check)', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          conditions: [{ type: 'heroClassMatch', value: 'tech' }],
          effects: [{ type: 'attack', magnitude: 5 }],
        },
      ],
    });

    const snapshot = JSON.parse(JSON.stringify(gameState));

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    // why: condition fails so no effects execute — G should be identical
    assert.deepEqual(gameState, snapshot,
      'G must not be mutated when all conditions fail.');
  });

  // -------------------------------------------------------------------------
  // Test 5: JSON.stringify(G) succeeds after conditional execution
  // -------------------------------------------------------------------------
  it('JSON.stringify(G) succeeds after conditional execution', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x', 'hero-y'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          conditions: [{ type: 'playedThisTurn', value: '1' }],
          effects: [{ type: 'attack', magnitude: 3 }],
        },
        {
          cardId: 'hero-y' as string,
          timing: 'onPlay',
          keywords: ['recruit'],
          conditions: [{ type: 'heroClassMatch', value: 'strength' }],
          effects: [{ type: 'recruit', magnitude: 2 }],
        },
      ],
    });

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    const serialized = JSON.stringify(gameState);
    assert.ok(serialized.length > 0,
      'JSON.stringify(G) should succeed after conditional execution.');
  });
});
