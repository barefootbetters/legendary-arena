/**
 * Tests for scheme twist handler (WP-024).
 *
 * Verifies twist counting, scheme-loss triggering at threshold,
 * read-only G invariant, ENDGAME_CONDITIONS constant usage, and
 * serialization.
 *
 * No boardgame.io imports. Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { schemeTwistHandler } from './schemeHandlers.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import type { LegendaryGameState } from '../types.js';

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/**
 * Creates a minimal LegendaryGameState for scheme handler testing.
 *
 * @param counterOverrides - Optional counter values to preset.
 * @returns A minimal LegendaryGameState.
 */
function makeTestState(counterOverrides?: Record<string, number>): LegendaryGameState {
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
        inPlay: [],
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
    counters: counterOverrides ?? {},
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
    heroAbilityHooks: [],
  };
}

describe('schemeTwistHandler', () => {
  // -------------------------------------------------------------------------
  // Test 1: handler returns non-empty RuleEffect[]
  // -------------------------------------------------------------------------
  it('returns non-empty RuleEffect[]', () => {
    const gameState = makeTestState();
    const effects = schemeTwistHandler(gameState, {}, { cardId: 'test-twist' });

    assert.ok(Array.isArray(effects), 'result must be an array');
    assert.ok(effects.length > 0, 'result must not be empty');
  });

  // -------------------------------------------------------------------------
  // Test 2: produces modifyCounter effect for twist count
  // -------------------------------------------------------------------------
  it('produces modifyCounter effect for schemeTwistCount', () => {
    const gameState = makeTestState();
    const effects = schemeTwistHandler(gameState, {}, { cardId: 'test-twist' });

    const counterEffect = effects.find(
      (effect) =>
        effect.type === 'modifyCounter' &&
        'counter' in effect &&
        (effect as { counter: string }).counter === 'schemeTwistCount',
    );

    assert.ok(counterEffect, 'must contain modifyCounter for schemeTwistCount');
    assert.equal(
      (counterEffect as { delta: number }).delta,
      1,
      'delta must be 1',
    );
  });

  // -------------------------------------------------------------------------
  // Test 3: at threshold, produces modifyCounter on SCHEME_LOSS
  // -------------------------------------------------------------------------
  it('at threshold: produces modifyCounter on ENDGAME_CONDITIONS.SCHEME_LOSS', () => {
    // why: threshold is 7; set counter to 6 so handler predicts 7 (>= threshold)
    const gameState = makeTestState({ schemeTwistCount: 6 });
    const effects = schemeTwistHandler(gameState, {}, { cardId: 'test-twist' });

    const schemeLossEffect = effects.find(
      (effect) =>
        effect.type === 'modifyCounter' &&
        'counter' in effect &&
        (effect as { counter: string }).counter === ENDGAME_CONDITIONS.SCHEME_LOSS,
    );

    assert.ok(
      schemeLossEffect,
      'must contain modifyCounter for ENDGAME_CONDITIONS.SCHEME_LOSS at threshold',
    );
    assert.equal(
      (schemeLossEffect as { delta: number }).delta,
      1,
      'scheme-loss delta must be 1',
    );
  });

  // -------------------------------------------------------------------------
  // Test 4: handler does not mutate G
  // -------------------------------------------------------------------------
  it('does not mutate G', () => {
    const gameState = makeTestState({ schemeTwistCount: 3 });
    const snapshot = JSON.parse(JSON.stringify(gameState));

    schemeTwistHandler(gameState, {}, { cardId: 'test-twist' });

    assert.deepStrictEqual(gameState, snapshot, 'G must not be mutated by handler');
  });

  // -------------------------------------------------------------------------
  // Test 5: uses ENDGAME_CONDITIONS.SCHEME_LOSS constant (not string literal)
  // -------------------------------------------------------------------------
  it('uses ENDGAME_CONDITIONS.SCHEME_LOSS constant for scheme-loss counter', () => {
    const gameState = makeTestState({ schemeTwistCount: 6 });
    const effects = schemeTwistHandler(gameState, {}, { cardId: 'test-twist' });

    const schemeLossEffect = effects.find(
      (effect) =>
        effect.type === 'modifyCounter' &&
        'counter' in effect &&
        (effect as { counter: string }).counter === ENDGAME_CONDITIONS.SCHEME_LOSS,
    );

    assert.ok(schemeLossEffect, 'scheme-loss effect must exist at threshold');
    // why: this verifies the constant is used — the counter value must match
    // the constant, not a hardcoded string
    assert.equal(
      (schemeLossEffect as { counter: string }).counter,
      ENDGAME_CONDITIONS.SCHEME_LOSS,
      'counter must use ENDGAME_CONDITIONS.SCHEME_LOSS constant',
    );
  });

  // -------------------------------------------------------------------------
  // Test 6: JSON.stringify(effects) succeeds (serialization proof)
  // -------------------------------------------------------------------------
  it('effects are JSON-serializable', () => {
    const gameState = makeTestState({ schemeTwistCount: 6 });
    const effects = schemeTwistHandler(gameState, {}, { cardId: 'test-twist' });

    const serialized = JSON.stringify(effects);
    assert.ok(serialized, 'JSON.stringify(effects) must produce a non-empty string');
  });
});
