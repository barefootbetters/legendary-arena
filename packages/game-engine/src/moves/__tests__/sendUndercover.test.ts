/**
 * Tests for the sendUndercover move (WP-282 / EC-313).
 *
 * Tests the face-down zone architecture, atomic zone transfers,
 * double-send guard, and Move Validation Contract compliance.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sendUndercover } from '../sendUndercover.js';
import type { LegendaryGameState } from '../../types.js';
import { makeMockMoveContext } from '../../test/mockMoveContext.js';
import type { MockMoveContext } from '../../test/mockMoveContext.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../../test/fixtureBuilders.js';

interface SendUndercoverStateOptions {
  hand?: string[];
  faceDownCards?: Array<{ instanceId: string; cardId: string; ownerPlayerId: string }>;
}

/** Builds a minimal LegendaryGameState for sendUndercover tests. */
function createSendUndercoverState(options?: SendUndercoverStateOptions): LegendaryGameState {
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
      '0': { ...makePlayerZones(),
        deck: [],
        hand: options?.hand ?? [],
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
    cardStats: {},
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

/** Builds a sendUndercover move context bound to player 0. */
function createMoveContext(gameState: LegendaryGameState): MockMoveContext {
  // why: delegates to the shared builder so this mock carries the COMPLETE
  // boardgame.io plugin-API surface. The local literal it replaced implemented
  // only the members the engine calls, which is a structurally invalid mock
  // rather than a smaller one (WP-569 / D-24378).
  return makeMockMoveContext(gameState);
}

describe('sendUndercover move', () => {
  it('sends a card from hand to faceDownCards (IC-282-01)', () => {
    const gameState = createSendUndercoverState({ hand: ['hero-1'] });
    sendUndercover(createMoveContext(gameState), { instanceId: 'hero-1', sourceZone: 'hand' });

    const zones = gameState.playerZones['0']!;
    assert.deepStrictEqual(zones.hand, [], 'card removed from hand');
    assert.equal(zones.faceDownCards.length, 1, 'one card in faceDownCards');
    // why: the `!` on these index accesses is a type-level narrowing, not a
    // suppression: the expression is dereferenced either way, so an undefined
    // value would already throw here. `!` is erased at compile time and carries
    // no runtime semantics. See D-24379 for the idiom and why it is permitted
    // where the suppression pragmas that decision bans are not.
    assert.equal(zones.faceDownCards[0]!.instanceId, 'hero-1', 'instanceId matches');
    assert.equal(zones.faceDownCards[0]!.cardId, 'hero-1', 'cardId matches instanceId');
    assert.equal(zones.faceDownCards[0]!.ownerPlayerId, '0', 'ownerPlayerId set correctly');
  });

  it('returns silently if card not in hand (Move Validation Contract)', () => {
    const gameState = createSendUndercoverState({ hand: ['hero-1'] });
    const before = JSON.parse(JSON.stringify(gameState));

    sendUndercover(createMoveContext(gameState), { instanceId: 'nonexistent', sourceZone: 'hand' });

    assert.deepStrictEqual(JSON.parse(JSON.stringify(gameState)), before, 'state unchanged on invalid card');
  });

  it('returns silently if instanceId is empty', () => {
    const gameState = createSendUndercoverState({ hand: ['hero-1'] });
    const before = JSON.parse(JSON.stringify(gameState));

    sendUndercover(createMoveContext(gameState), { instanceId: '', sourceZone: 'hand' });

    assert.deepStrictEqual(JSON.parse(JSON.stringify(gameState)), before, 'state unchanged on empty instanceId');
  });

  it('enforces double-send guard (IC-282-05: no duplicate instanceIds)', () => {
    const gameState = createSendUndercoverState({
      hand: ['hero-1'],
      faceDownCards: [{ instanceId: 'hero-1', cardId: 'hero-1', ownerPlayerId: '0' }],
    });

    sendUndercover(createMoveContext(gameState), { instanceId: 'hero-1', sourceZone: 'hand' });

    // Card should still be in hand (send failed)
    // why: the `!` on these index accesses is a type-level narrowing, not a
    // suppression: the expression is dereferenced either way, so an undefined
    // value would already throw here. `!` is erased at compile time and carries
    // no runtime semantics. See D-24379 for the idiom and why it is permitted
    // where the suppression pragmas that decision bans are not.
    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['hero-1'], 'card remains in hand on double-send');
    // faceDownCards should still have only 1
    assert.equal(gameState.playerZones['0']!.faceDownCards.length, 1, 'no duplicate added');
  });

  it('maintains deterministic ordering (IC-282-08)', () => {
    const gameState = createSendUndercoverState({ hand: ['a', 'b', 'c'] });

    sendUndercover(createMoveContext(gameState), { instanceId: 'a', sourceZone: 'hand' });
    sendUndercover(createMoveContext(gameState), { instanceId: 'b', sourceZone: 'hand' });
    sendUndercover(createMoveContext(gameState), { instanceId: 'c', sourceZone: 'hand' });

    const instanceIds = gameState.playerZones['0']!.faceDownCards.map((c) => c.instanceId);
    assert.deepStrictEqual(instanceIds, ['a', 'b', 'c'], 'insertion order preserved');
  });

  it('returns silently on invalid sourceZone', () => {
    const gameState = createSendUndercoverState({ hand: ['hero-1'] });
    const before = JSON.parse(JSON.stringify(gameState));

    sendUndercover(createMoveContext(gameState), { instanceId: 'hero-1', sourceZone: 'hq' });

    assert.deepStrictEqual(JSON.parse(JSON.stringify(gameState)), before, 'state unchanged on invalid sourceZone');
  });
});
