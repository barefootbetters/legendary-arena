/**
 * Tests for the lookAtUndercover helper (WP-282 / EC-313).
 *
 * Verifies that lookAtUndercover returns the correct CardExtId for a
 * face-down card without mutating G (test-only helper).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lookAtUndercover } from '../lookAtUndercover.js';
import type { LegendaryGameState } from '../../types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../../test/fixtureBuilders.js';

/** Minimal game state for lookAtUndercover tests. */
function createTestState(): LegendaryGameState {
  return {
    matchConfiguration: {
      schemeId: 'test',
      mastermindId: 'test',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
      bystandersCount: 0,
      woundsCount: 0,
      officersCount: 0,
      sidekicksCount: 0,
    },
    selection: {
      schemeId: 'test',
      mastermindId: 'test',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    },
    currentStage: 'main',
    playerZones: {
      '0': { ...makePlayerZones(),
        deck: [],
        hand: [],
        discard: [],
        inPlay: [],
        victory: [],
        faceDownCards: [{ instanceId: 'hero-1', cardId: 'hero-1', ownerPlayerId: '0' }],
      },
    },
    piles: { ...makeGlobalPiles(), bystanders: [], wounds: [], officers: [], sidekicks: [] },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    turnEconomy: { ...makeTurnEconomy(), attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    cardStats: {},
    cardTraits: {},
    cardKeywords: {},
    cardDisplayData: {},
    schemeSetupInstructions: [],
    mastermind: { ...makeMastermindState(), id: 'test', baseCardId: 'test', tacticsDeck: [], tacticsDefeated: [] },
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    heroDeck: [],
    scheme: { nextTwistLevel: 0, twistPile: [] },
    escapedPile: [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
    heroAbilityHooks: [],
    villainAbilityHooks: [],
    notableEvents: [],
  };
}

describe('lookAtUndercover helper', () => {
  it('returns the cardId of a face-down card by instanceId', () => {
    const G = createTestState();

    const cardId = lookAtUndercover(G, '0', 'hero-1');

    assert.equal(cardId, 'hero-1', 'returns correct cardId');
  });

  it('returns empty string if card not found', () => {
    const G = createTestState();

    const cardId = lookAtUndercover(G, '0', 'nonexistent');

    assert.equal(cardId, '', 'returns empty string on not found');
  });

  it('returns empty string if player has no face-down cards', () => {
    const G = createTestState();
    G.playerZones['1'] = { ...makePlayerZones(),
      deck: [],
      hand: [],
      discard: [],
      inPlay: [],
      victory: [],
      faceDownCards: [],
    };

    const cardId = lookAtUndercover(G, '1', 'hero-1');

    assert.equal(cardId, '', 'returns empty string for player with no face-down cards');
  });

  it('does not mutate G', () => {
    const G = createTestState();
    const before = JSON.parse(JSON.stringify(G));

    lookAtUndercover(G, '0', 'hero-1');

    assert.deepStrictEqual(JSON.parse(JSON.stringify(G)), before, 'G unchanged after call');
  });
});
