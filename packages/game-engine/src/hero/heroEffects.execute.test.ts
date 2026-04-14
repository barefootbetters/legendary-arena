/**
 * Tests for hero effect execution (WP-022).
 *
 * Verifies the 4 MVP keywords ('draw', 'attack', 'recruit', 'ko'),
 * conditional skip behavior, unsupported keyword handling, magnitude
 * validation, execution order, determinism, and JSON serializability.
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
 * Creates a minimal LegendaryGameState for hero effect testing.
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

describe('executeHeroEffects', () => {
  // why: makeMockCtx provides ShuffleProvider-compatible context
  // (random.Shuffle reverses arrays for determinism)
  const mockCtx = makeMockCtx();

  // -------------------------------------------------------------------------
  // Test 1: draw keyword
  // -------------------------------------------------------------------------
  it('draw effect draws N cards from deck to hand', () => {
    const gameState = makeTestState({
      deck: ['card-a', 'card-b', 'card-c'],
      hand: [],
      inPlay: ['hero-x'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['draw'],
          effects: [{ type: 'draw', magnitude: 2 }],
        },
      ],
    });

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    assert.equal(gameState.playerZones['0'].hand.length, 2,
      'Player should have drawn 2 cards into hand.');
    assert.equal(gameState.playerZones['0'].deck.length, 1,
      'Deck should have 1 card remaining after drawing 2.');
  });

  // -------------------------------------------------------------------------
  // Test 2: attack keyword
  // -------------------------------------------------------------------------
  it('attack effect increases turnEconomy.attack by N', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          effects: [{ type: 'attack', magnitude: 3 }],
        },
      ],
    });

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    assert.equal(gameState.turnEconomy.attack, 3,
      'turnEconomy.attack should increase by 3.');
    assert.equal(gameState.turnEconomy.recruit, 0,
      'turnEconomy.recruit should remain unchanged.');
  });

  // -------------------------------------------------------------------------
  // Test 3: recruit keyword
  // -------------------------------------------------------------------------
  it('recruit effect increases turnEconomy.recruit by N', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['recruit'],
          effects: [{ type: 'recruit', magnitude: 2 }],
        },
      ],
    });

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    assert.equal(gameState.turnEconomy.recruit, 2,
      'turnEconomy.recruit should increase by 2.');
    assert.equal(gameState.turnEconomy.attack, 0,
      'turnEconomy.attack should remain unchanged.');
  });

  // -------------------------------------------------------------------------
  // Test 4: ko keyword
  // -------------------------------------------------------------------------
  it('ko effect removes the played card from inPlay and adds to G.ko', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x', 'hero-y'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['ko'],
          effects: [{ type: 'ko' }],
        },
      ],
    });

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    assert.deepEqual(gameState.playerZones['0'].inPlay, ['hero-y'],
      'hero-x should be removed from inPlay.');
    assert.deepEqual(gameState.ko, ['hero-x'],
      'hero-x should be added to the KO pile.');
  });

  // -------------------------------------------------------------------------
  // Test 5: conditional hook skipped
  // -------------------------------------------------------------------------
  it('hook with conditions is skipped — no G mutation', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          conditions: [{ type: 'heroClassMatch', value: 'strength' }],
          effects: [{ type: 'attack', magnitude: 5 }],
        },
      ],
    });

    // Snapshot relevant subtrees before execution
    const economyBefore = { ...gameState.turnEconomy };
    const inPlayBefore = [...gameState.playerZones['0'].inPlay];

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    assert.deepEqual(gameState.turnEconomy, economyBefore,
      'turnEconomy should not change when conditions are present.');
    assert.deepEqual(gameState.playerZones['0'].inPlay, inPlayBefore,
      'inPlay should not change when conditions are present.');
  });

  // -------------------------------------------------------------------------
  // Test 6: unsupported keyword skipped
  // -------------------------------------------------------------------------
  it('unsupported keyword is skipped — no G mutation', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['rescue'],
          effects: [{ type: 'rescue', magnitude: 1 }],
        },
      ],
    });

    const economyBefore = { ...gameState.turnEconomy };
    const koBefore = [...gameState.ko];

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    assert.deepEqual(gameState.turnEconomy, economyBefore,
      'turnEconomy should not change for unsupported keyword.');
    assert.deepEqual(gameState.ko, koBefore,
      'KO pile should not change for unsupported keyword.');
  });

  // -------------------------------------------------------------------------
  // Test 7: undefined/empty effects array
  // -------------------------------------------------------------------------
  it('hook with undefined or empty effects produces no mutation', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a', 'hero-b'],
      heroAbilityHooks: [
        {
          cardId: 'hero-a' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          // effects is undefined
        },
        {
          cardId: 'hero-b' as string,
          timing: 'onPlay',
          keywords: ['recruit'],
          effects: [],
        },
      ],
    });

    const economyBefore = { ...gameState.turnEconomy };

    executeHeroEffects(gameState, mockCtx, '0', 'hero-a' as string);
    executeHeroEffects(gameState, mockCtx, '0', 'hero-b' as string);

    assert.deepEqual(gameState.turnEconomy, economyBefore,
      'turnEconomy should not change for hooks with no effects.');
  });

  // -------------------------------------------------------------------------
  // Test 8: invalid magnitude skipped
  // -------------------------------------------------------------------------
  it('effect with invalid magnitude is skipped — no mutation', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          effects: [
            { type: 'attack', magnitude: undefined },
            { type: 'attack', magnitude: NaN },
            { type: 'attack', magnitude: -1 },
            { type: 'attack', magnitude: 1.5 },
            { type: 'attack', magnitude: Infinity },
          ],
        },
      ],
    });

    const economyBefore = { ...gameState.turnEconomy };

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    assert.deepEqual(gameState.turnEconomy, economyBefore,
      'turnEconomy should not change for any invalid magnitude.');
  });

  // -------------------------------------------------------------------------
  // Test 9: multiple effects execute in descriptor array order
  // -------------------------------------------------------------------------
  it('multiple effects on one card execute in descriptor array order', () => {
    const gameState = makeTestState({
      inPlay: ['hero-x'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['attack', 'recruit'],
          effects: [
            { type: 'attack', magnitude: 2 },
            { type: 'recruit', magnitude: 3 },
          ],
        },
      ],
    });

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    assert.equal(gameState.turnEconomy.attack, 2,
      'Attack should increase by 2 (first effect).');
    assert.equal(gameState.turnEconomy.recruit, 3,
      'Recruit should increase by 3 (second effect).');
  });

  // -------------------------------------------------------------------------
  // Test 10: determinism
  // -------------------------------------------------------------------------
  it('identical deep-cloned inputs produce identical G', () => {
    const makeState = () => makeTestState({
      deck: ['card-a', 'card-b', 'card-c'],
      hand: [],
      inPlay: ['hero-x'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['draw', 'attack'],
          effects: [
            { type: 'draw', magnitude: 1 },
            { type: 'attack', magnitude: 2 },
          ],
        },
      ],
    });

    const stateA = makeState();
    const stateB = makeState();

    executeHeroEffects(stateA, mockCtx, '0', 'hero-x' as string);
    executeHeroEffects(stateB, mockCtx, '0', 'hero-x' as string);

    assert.deepEqual(stateA.playerZones, stateB.playerZones,
      'Player zones should be identical after identical execution.');
    assert.deepEqual(stateA.turnEconomy, stateB.turnEconomy,
      'turnEconomy should be identical after identical execution.');
    assert.deepEqual(stateA.ko, stateB.ko,
      'KO pile should be identical after identical execution.');
  });

  // -------------------------------------------------------------------------
  // Test 11: JSON serialization
  // -------------------------------------------------------------------------
  it('JSON.stringify(G) succeeds after execution', () => {
    const gameState = makeTestState({
      deck: ['card-a'],
      hand: [],
      inPlay: ['hero-x'],
      heroAbilityHooks: [
        {
          cardId: 'hero-x' as string,
          timing: 'onPlay',
          keywords: ['draw', 'attack', 'recruit'],
          effects: [
            { type: 'draw', magnitude: 1 },
            { type: 'attack', magnitude: 2 },
            { type: 'recruit', magnitude: 1 },
          ],
        },
      ],
    });

    executeHeroEffects(gameState, mockCtx, '0', 'hero-x' as string);

    const serialized = JSON.stringify(gameState);
    assert.ok(typeof serialized === 'string' && serialized.length > 0,
      'Game state should be JSON-serializable after hero effect execution.');
  });
});
