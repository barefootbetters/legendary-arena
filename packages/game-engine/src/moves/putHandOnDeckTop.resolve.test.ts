/**
 * Tests for the resolvePutHandOnDeckTop move (WP-700 / D-24519), the
 * hasPendingPutHandOnDeckTop predicate, getEligiblePutHandOnDeckTopCards, and the
 * block-all guard that freezes the board while a put-a-hand-card-on-deck-top choice is
 * pending.
 *
 * Covers: place the chosen hand card on the deck TOP (deck[0]) + front-pop; invalid card
 * (not in hand) → no-op (queue intact, never throws); invalid arg shapes; wrong playerID;
 * illegal with no parked choice; MANDATORY (no decline arm); the FIFO queue; the block-all
 * guard (drawCards no-ops while pending).
 *
 * Covers AC per WP-700 / EC-737. Uses node:test + node:assert only.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePutHandOnDeckTop,
  hasPendingPutHandOnDeckTop,
  getEligiblePutHandOnDeckTopCards,
} from './putHandOnDeckTop.resolve.js';
import { drawCards } from './coreMoves.impl.js';
import type { LegendaryGameState, PendingPutHandOnDeckTop } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/**
 * Creates a minimal LegendaryGameState for testing the put-on-deck-top flow.
 *
 * @param overrides - Selective overrides for player "0" zones, the pending queue, and stage.
 */
function makeTestGameState(
  overrides: {
    hand?: CardExtId[];
    discard?: CardExtId[];
    deck?: CardExtId[];
    pendingPutHandOnDeckTop?: PendingPutHandOnDeckTop[];
    currentStage?: LegendaryGameState['currentStage'];
  } = {},
): LegendaryGameState {
  const state: LegendaryGameState = {
    matchConfiguration: {
      schemeId: 'test-scheme', mastermindId: 'test-mastermind', villainGroupIds: [],
      henchmanGroupIds: [], heroDeckIds: [], bystandersCount: 0, woundsCount: 0,
      officersCount: 0, sidekicksCount: 0,
    },
    selection: {
      schemeId: 'test-scheme', mastermindId: 'test-mastermind', villainGroupIds: [],
      henchmanGroupIds: [], heroDeckIds: [],
    },
    currentStage: overrides.currentStage ?? 'main',
    playerZones: {
      '0': {
        deck: overrides.deck ?? [],
        hand: overrides.hand ?? [],
        discard: overrides.discard ?? [],
        inPlay: [],
        victory: [],
      },
    },
    piles: { bystanders: [], wounds: [], officers: [], sidekicks: [], horrors: [] },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainAbilityHooks: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    turnEconomy: {
      attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0,
    },
    cardStats: {},
    cardKeywords: {},
    heroDeck: [],
    escapedPile: [],
    mastermind: {
      id: 'test-mastermind', baseCardId: 'test-mastermind-base',
      tacticsDeck: ['tactic-0'] as CardExtId[], tacticsDefeated: [], strikePile: [],
      attachedBystanders: [],
    },
    scheme: { twistPile: [] },
    notableEvents: [],
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    cardDisplayData: {},
    cardTraits: {},
    schemeSetupInstructions: [],
    heroAbilityHooks: [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;

  if (overrides.pendingPutHandOnDeckTop !== undefined) {
    state.pendingPutHandOnDeckTop = overrides.pendingPutHandOnDeckTop;
  }
  return state;
}

/** Builds a move context for the move under test. */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolvePutHandOnDeckTop>[0] {
  return {
    G: gameState,
    ctx: {
      numPlayers: 1, currentPlayer: playerId, phase: 'play', turn: 1,
      playOrder: [playerId], playOrderPos: 0, activePlayers: null,
    },
    events: {
      endTurn: mock.fn(), setPhase: mock.fn(), endPhase: mock.fn(), setStage: mock.fn(),
      endStage: mock.fn(), pass: mock.fn(), endGame: mock.fn(),
    },
    random: {
      Shuffle: <T>(deck: T[]): T[] => [...deck].reverse(),
      D4: mock.fn(), D6: mock.fn(), D10: mock.fn(), D12: mock.fn(), D20: mock.fn(),
      Die: mock.fn(), Number: mock.fn(),
    },
    playerID: playerId,
    log: { setMetadata: mock.fn() },
  } as unknown as Parameters<typeof resolvePutHandOnDeckTop>[0];
}

/** A pending put-on-top choice for player "0". */
const putPending = (playerID = '0'): PendingPutHandOnDeckTop => ({ playerID });

describe('resolvePutHandOnDeckTop — placement (WP-700 / D-24519)', () => {
  it('moves the chosen hand card to the TOP (deck[0]) of the deck and pops', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId, 'card-b' as CardExtId],
      deck: ['deck-x' as CardExtId, 'deck-y' as CardExtId],
      pendingPutHandOnDeckTop: [putPending()],
    });
    const context = makeMoveContext(gameState);

    resolvePutHandOnDeckTop(context, { cardId: 'card-a' as CardExtId });

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['card-b'], 'chosen card left the hand');
    assert.deepStrictEqual(
      gameState.playerZones['0']!.deck,
      ['card-a', 'deck-x', 'deck-y'],
      'chosen card is on TOP (deck[0]) — drawn first next',
    );
    assert.equal(gameState.pendingPutHandOnDeckTop!.length, 0, 'queue front-popped');
  });

  it('places on top even when the deck is empty', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId],
      deck: [],
      pendingPutHandOnDeckTop: [putPending()],
    });
    const context = makeMoveContext(gameState);

    resolvePutHandOnDeckTop(context, { cardId: 'card-a' as CardExtId });

    assert.deepStrictEqual(gameState.playerZones['0']!.deck, ['card-a']);
    assert.deepStrictEqual(gameState.playerZones['0']!.hand, []);
  });

  it('is a no-op (queue intact) when cardId is not in the hand', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId],
      deck: ['deck-x' as CardExtId],
      pendingPutHandOnDeckTop: [putPending()],
    });
    const context = makeMoveContext(gameState);

    resolvePutHandOnDeckTop(context, { cardId: 'not-in-hand' as CardExtId });

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['card-a'], 'hand untouched');
    assert.deepStrictEqual(gameState.playerZones['0']!.deck, ['deck-x'], 'deck untouched');
    assert.equal(gameState.pendingPutHandOnDeckTop!.length, 1, 'queue intact (resubmit)');
  });
});

describe('resolvePutHandOnDeckTop — guards (WP-700 / D-24519)', () => {
  it('is a no-op when no choice is parked', () => {
    const gameState = makeTestGameState({ hand: ['card-a' as CardExtId], deck: ['deck-x' as CardExtId] });
    const context = makeMoveContext(gameState);

    resolvePutHandOnDeckTop(context, { cardId: 'card-a' as CardExtId });

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['card-a'], 'hand untouched');
    assert.deepStrictEqual(gameState.playerZones['0']!.deck, ['deck-x'], 'deck untouched');
  });

  it('is a no-op for a malformed payload (missing / empty cardId)', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId],
      pendingPutHandOnDeckTop: [putPending()],
    });
    const context = makeMoveContext(gameState);

    resolvePutHandOnDeckTop(context, { cardId: '' as CardExtId });
    assert.equal(gameState.pendingPutHandOnDeckTop!.length, 1, 'queue intact');
    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['card-a'], 'hand untouched');
  });

  it('is a no-op when the front entry belongs to another player', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId],
      pendingPutHandOnDeckTop: [putPending('1')],
    });
    const context = makeMoveContext(gameState, '0');

    resolvePutHandOnDeckTop(context, { cardId: 'card-a' as CardExtId });

    assert.equal(gameState.pendingPutHandOnDeckTop!.length, 1, 'queue intact — wrong chooser');
    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['card-a'], 'hand untouched');
  });
});

describe('resolvePutHandOnDeckTop — FIFO queue', () => {
  it('resolves two parked entries independently, each placing on top', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId, 'card-b' as CardExtId],
      deck: ['deck-x' as CardExtId],
      pendingPutHandOnDeckTop: [putPending(), putPending()],
    });
    const context = makeMoveContext(gameState);

    resolvePutHandOnDeckTop(context, { cardId: 'card-a' as CardExtId });
    assert.equal(gameState.pendingPutHandOnDeckTop!.length, 1, 'first entry popped');
    assert.deepStrictEqual(gameState.playerZones['0']!.deck, ['card-a', 'deck-x']);

    resolvePutHandOnDeckTop(context, { cardId: 'card-b' as CardExtId });
    assert.equal(gameState.pendingPutHandOnDeckTop!.length, 0, 'second entry popped');
    assert.deepStrictEqual(
      gameState.playerZones['0']!.deck,
      ['card-b', 'card-a', 'deck-x'],
      'the second placement sits on top of the first',
    );
  });
});

describe('hasPendingPutHandOnDeckTop predicate + getEligiblePutHandOnDeckTopCards', () => {
  it('is true with a parked entry, false for [] / absent', () => {
    assert.equal(hasPendingPutHandOnDeckTop(makeTestGameState({ pendingPutHandOnDeckTop: [putPending()] })), true);
    assert.equal(hasPendingPutHandOnDeckTop(makeTestGameState({ pendingPutHandOnDeckTop: [] })), false);
    assert.equal(hasPendingPutHandOnDeckTop(makeTestGameState({})), false);
  });

  it('getEligiblePutHandOnDeckTopCards returns the whole hand in order', () => {
    const gameState = makeTestGameState({ hand: ['card-a' as CardExtId, 'card-b' as CardExtId] });
    assert.deepStrictEqual(getEligiblePutHandOnDeckTopCards(gameState, '0'), ['card-a', 'card-b']);
    assert.deepStrictEqual(getEligiblePutHandOnDeckTopCards(gameState, '1'), [], 'unknown player → empty');
  });
});

describe('block-all guard — a parked put-on-top choice freezes other moves (WP-700 / D-24519)', () => {
  it('drawCards is a no-op while a put-a-hand-card-on-deck-top choice is pending', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId],
      deck: ['deck-top' as CardExtId],
      pendingPutHandOnDeckTop: [putPending()],
    });
    const context = makeMoveContext(gameState);

    drawCards(context as unknown as Parameters<typeof drawCards>[0]);

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['card-a'], 'no card drawn — board frozen');
    assert.deepStrictEqual(gameState.playerZones['0']!.deck, ['deck-top'], 'deck untouched');
  });
});
