/**
 * Tests for hero condition evaluation (WP-023).
 *
 * Verifies the 4 MVP condition types (heroClassMatch, requiresTeam,
 * requiresKeyword, playedThisTurn), unsupported condition handling,
 * AND logic, empty conditions, and G immutability during evaluation.
 *
 * No boardgame.io imports. No modifications to shared test helpers.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCondition, evaluateAllConditions } from './heroConditions.evaluate.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/**
 * Creates a minimal LegendaryGameState for condition evaluation testing.
 *
 * @param overrides - Partial overrides for player zones and hooks.
 * @returns A minimal LegendaryGameState.
 */
function makeTestState(overrides?: {
  inPlay?: string[];
  heroAbilityHooks?: HeroAbilityHook[];
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
        deck: [],
        hand: [],
        discard: [],
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
    ko: [],
    attachedBystanders: {},
    turnEconomy: {
      attack: 0,
      recruit: 0,
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

describe('evaluateCondition', () => {
  // -------------------------------------------------------------------------
  // Test 1: heroClassMatch returns false (placeholder)
  // -------------------------------------------------------------------------
  it('heroClassMatch returns false — no class data in G yet', () => {
    // why: heroClassMatch is a placeholder until class data is resolved into G
    const gameState = makeTestState({
      inPlay: ['hero-a'],
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'heroClassMatch',
      value: 'tech',
    });

    assert.equal(result, false,
      'heroClassMatch should return false until class data is in G.');
  });

  // -------------------------------------------------------------------------
  // Test 2: requiresTeam returns false (placeholder)
  // -------------------------------------------------------------------------
  it('requiresTeam returns false — no team data in G yet', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a'],
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'requiresTeam',
      value: 'avengers',
    });

    assert.equal(result, false,
      'requiresTeam should return false until team data is in G.');
  });

  // -------------------------------------------------------------------------
  // Test 3: requiresKeyword passes with matching keyword
  // -------------------------------------------------------------------------
  it('requiresKeyword passes when matching keyword on played card', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a'],
      heroAbilityHooks: [
        {
          cardId: 'hero-a' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          effects: [{ type: 'attack', magnitude: 2 }],
        },
      ],
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'requiresKeyword',
      value: 'attack',
    });

    assert.equal(result, true,
      'requiresKeyword should pass when a played card has the keyword.');
  });

  // -------------------------------------------------------------------------
  // Test 4: requiresKeyword fails with no matching keyword
  // -------------------------------------------------------------------------
  it('requiresKeyword fails when no matching keyword on played cards', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a'],
      heroAbilityHooks: [
        {
          cardId: 'hero-a' as string,
          timing: 'onPlay',
          keywords: ['recruit'],
          effects: [{ type: 'recruit', magnitude: 1 }],
        },
      ],
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'requiresKeyword',
      value: 'draw',
    });

    assert.equal(result, false,
      'requiresKeyword should fail when no played card has the keyword.');
  });

  // -------------------------------------------------------------------------
  // Test 5: playedThisTurn passes with enough cards
  // -------------------------------------------------------------------------
  it('playedThisTurn passes when enough cards played', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a', 'hero-b', 'hero-c'],
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'playedThisTurn',
      value: '2',
    });

    assert.equal(result, true,
      'playedThisTurn should pass when inPlay.length >= threshold.');
  });

  // -------------------------------------------------------------------------
  // Test 6: playedThisTurn fails with too few cards
  // -------------------------------------------------------------------------
  it('playedThisTurn fails when too few cards played', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a'],
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'playedThisTurn',
      value: '3',
    });

    assert.equal(result, false,
      'playedThisTurn should fail when inPlay.length < threshold.');
  });

  // -------------------------------------------------------------------------
  // Test 7: unsupported condition type returns false
  // -------------------------------------------------------------------------
  it('unsupported condition type returns false (safe skip)', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a'],
    });

    const result = evaluateCondition(gameState, '0', {
      type: 'unknownFutureCondition',
      value: 'anything',
    });

    assert.equal(result, false,
      'Unsupported condition types should return false.');
  });
});

describe('evaluateAllConditions', () => {
  // -------------------------------------------------------------------------
  // Test 8: empty conditions returns true
  // -------------------------------------------------------------------------
  it('empty conditions array returns true (unconditional)', () => {
    const gameState = makeTestState();

    const resultEmpty = evaluateAllConditions(gameState, '0', []);
    assert.equal(resultEmpty, true,
      'Empty conditions array should return true.');

    const resultUndefined = evaluateAllConditions(gameState, '0', undefined);
    assert.equal(resultUndefined, true,
      'Undefined conditions should return true.');
  });

  // -------------------------------------------------------------------------
  // Test 9: mixed pass/fail returns false (AND logic)
  // -------------------------------------------------------------------------
  it('mixed pass/fail returns false — AND logic enforced', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a', 'hero-b', 'hero-c'],
    });

    // First condition passes (3 >= 2), second fails (placeholder)
    const result = evaluateAllConditions(gameState, '0', [
      { type: 'playedThisTurn', value: '2' },
      { type: 'heroClassMatch', value: 'tech' },
    ]);

    assert.equal(result, false,
      'AND logic: one failing condition should make the result false.');
  });

  // -------------------------------------------------------------------------
  // Test 10: condition evaluation does not mutate G
  // -------------------------------------------------------------------------
  it('condition evaluation does not mutate G (deep equality check)', () => {
    const gameState = makeTestState({
      inPlay: ['hero-a', 'hero-b'],
      heroAbilityHooks: [
        {
          cardId: 'hero-a' as string,
          timing: 'onPlay',
          keywords: ['attack'],
          effects: [{ type: 'attack', magnitude: 2 }],
        },
      ],
    });

    const snapshot = JSON.parse(JSON.stringify(gameState));

    evaluateCondition(gameState, '0', {
      type: 'requiresKeyword',
      value: 'attack',
    });

    evaluateCondition(gameState, '0', {
      type: 'playedThisTurn',
      value: '1',
    });

    evaluateAllConditions(gameState, '0', [
      { type: 'playedThisTurn', value: '1' },
      { type: 'heroClassMatch', value: 'tech' },
    ]);

    assert.deepEqual(gameState, snapshot,
      'G must not be mutated by condition evaluation.');
  });
});
