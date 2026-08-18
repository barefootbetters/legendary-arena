/**
 * Tests for the playFromUndercover move (WP-282 / EC-313).
 *
 * Tests that face-down cards can be played through the identical pathway
 * as hand play: removed from faceDownCards, moved to inPlay, stats added,
 * effects executed (IC-282-02).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { playFromUndercover } from '../playFromUndercover.js';
import type { LegendaryGameState } from '../../types.js';
import { makeMockMoveContext } from '../../test/mockMoveContext.js';
import type { MockMoveContext } from '../../test/mockMoveContext.js';
import { makeGlobalPiles, makeMastermindState, makeTurnEconomy } from '../../test/fixtureBuilders.js';

interface PlayFromUndercoverStateOptions {
  faceDownCards?: Array<{ instanceId: string; cardId: string; ownerPlayerId: string }>;
  cardStats?: Record<string, { attack: number; recruit: number }>;
}

/** Builds a minimal LegendaryGameState for playFromUndercover tests. */
function createPlayFromUndercoverState(options?: PlayFromUndercoverStateOptions): LegendaryGameState {
  const state: LegendaryGameState = {
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
    currentStage: 'main',
    playerZones: {
      '0': {
        deck: [],
        hand: [],
        discard: [],
        inPlay: [],
        victory: [],
        faceDownCards: options?.faceDownCards ?? [],
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
    cardStats: options?.cardStats ?? {},
    cardTraits: {},
    cardKeywords: {},
    cardDisplayData: {},
    schemeSetupInstructions: [],
    mastermind: { ...makeMastermindState(), id: 'test-mastermind', baseCardId: 'test-mastermind-base', tacticsDeck: [], tacticsDefeated: [] },
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
  return state;
}

/** Builds a playFromUndercover move context bound to player 0. */
function createMoveContext(gameState: LegendaryGameState): MockMoveContext {
  // why: delegates to the shared builder so this mock carries the COMPLETE
  // boardgame.io plugin-API surface. The local literal it replaced implemented
  // only the members the engine calls, which is a structurally invalid mock
  // rather than a smaller one (WP-569 / D-24378).
  return makeMockMoveContext(gameState);
}

describe('playFromUndercover move', () => {
  it('removes card from faceDownCards and moves to inPlay (IC-282-02)', () => {
    const gameState = createPlayFromUndercoverState({
      faceDownCards: [{ instanceId: 'hero-1', cardId: 'hero-1', ownerPlayerId: '0' }],
      cardStats: { 'hero-1': { attack: 2, recruit: 1 } },
    });

    playFromUndercover(createMoveContext(gameState), { instanceId: 'hero-1' });

    const zones = gameState.playerZones['0']!;
    assert.deepStrictEqual(zones.faceDownCards, [], 'card removed from faceDownCards');
    assert.ok(zones.inPlay.includes('hero-1'), 'card moved to inPlay');
  });

  it('returns silently if card not in faceDownCards (Move Validation Contract)', () => {
    const gameState = createPlayFromUndercoverState({
      faceDownCards: [{ instanceId: 'hero-1', cardId: 'hero-1', ownerPlayerId: '0' }],
    });
    const before = JSON.parse(JSON.stringify(gameState));

    playFromUndercover(createMoveContext(gameState), { instanceId: 'nonexistent' });

    assert.deepStrictEqual(JSON.parse(JSON.stringify(gameState)), before, 'state unchanged on invalid card');
  });

  it('returns silently on empty instanceId', () => {
    const gameState = createPlayFromUndercoverState({
      faceDownCards: [{ instanceId: 'hero-1', cardId: 'hero-1', ownerPlayerId: '0' }],
    });
    const before = JSON.parse(JSON.stringify(gameState));

    playFromUndercover(createMoveContext(gameState), { instanceId: '' });

    assert.deepStrictEqual(JSON.parse(JSON.stringify(gameState)), before, 'state unchanged on empty instanceId');
  });

  it('adds card stats to turn economy (IC-282-02)', () => {
    const gameState = createPlayFromUndercoverState({
      faceDownCards: [{ instanceId: 'hero-1', cardId: 'hero-1', ownerPlayerId: '0' }],
      cardStats: { 'hero-1': { attack: 3, recruit: 2 } },
    });

    playFromUndercover(createMoveContext(gameState), { instanceId: 'hero-1' });

    assert.equal(gameState.turnEconomy.attack, 3, 'attack added to economy');
    assert.equal(gameState.turnEconomy.recruit, 2, 'recruit added to economy');
  });
});
