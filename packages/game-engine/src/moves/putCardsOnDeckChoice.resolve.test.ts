/**
 * Tests for the resolvePutCardsOnDeckChoice move (WP-538 / D-24347) and the
 * hasPendingPutCardsOnDeckChoice block-all predicate.
 *
 * Covers: resolve puts exactly the chosen cards on top of the deck IN SELECTION
 * ORDER (cardIds[0] ends on top) + front-pop; a wrong count, a card not in hand, a
 * wrong playerID, an empty queue, and a non-array/empty cardIds are silent no-ops
 * that leave the queue byte-identical; hasPendingPutCardsOnDeckChoice; a block-all
 * no-op on an action move while a put-cards-on-deck choice is pending.
 *
 * Uses node:test + node:assert only. No boardgame.io testing imports.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePutCardsOnDeckChoice,
  hasPendingPutCardsOnDeckChoice,
} from './putCardsOnDeckChoice.resolve.js';
import { playCard } from './coreMoves.impl.js';
import type { LegendaryGameState, PendingPutCardsOnDeckChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

const A = 'core/a#0' as CardExtId;
const B = 'core/b#0' as CardExtId;
const C = 'core/c#0' as CardExtId;
const D = 'core/d#0' as CardExtId;
const E = 'core/e#0' as CardExtId;
const F = 'core/f#0' as CardExtId;
const DECK1 = 'core/deck1#0' as CardExtId;
const DECK2 = 'core/deck2#0' as CardExtId;

/**
 * Creates a minimal LegendaryGameState for testing the put-cards-on-deck flow.
 *
 * @param overrides - Selective overrides for player "0" hand/deck, the pending
 *   put-cards-on-deck queue, and current stage.
 */
function makeTestGameState(
  overrides: {
    hand?: CardExtId[];
    deck?: CardExtId[];
    pendingPutCardsOnDeckChoices?: PendingPutCardsOnDeckChoice[];
    currentStage?: LegendaryGameState['currentStage'];
  } = {},
): LegendaryGameState {
  const state = {
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
    currentStage: overrides.currentStage ?? 'start',
    playerZones: {
      '0': {
        deck: overrides.deck ?? [],
        hand: overrides.hand ?? [],
        discard: [],
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
    turnEconomy: { attack: 10, recruit: 10, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
    cardStats: {},
    cardKeywords: {},
    heroDeck: [],
    escapedPile: [],
    mastermind: {
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: ['tactic-0'] as CardExtId[],
      tacticsDefeated: [],
      strikePile: [],
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

  if (overrides.pendingPutCardsOnDeckChoices !== undefined) {
    state.pendingPutCardsOnDeckChoices = overrides.pendingPutCardsOnDeckChoices;
  }
  return state;
}

/** Builds a move context for the move under test. */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolvePutCardsOnDeckChoice>[0] {
  return {
    G: gameState,
    ctx: {
      numPlayers: 1,
      currentPlayer: playerId,
      phase: 'play',
      turn: 1,
      playOrder: [playerId],
      playOrderPos: 0,
      activePlayers: null,
    },
    events: {
      endTurn: mock.fn(), setPhase: mock.fn(), endPhase: mock.fn(),
      setStage: mock.fn(), endStage: mock.fn(), pass: mock.fn(), endGame: mock.fn(),
    },
    random: {
      Shuffle: <T>(deck: T[]): T[] => [...deck].reverse(),
      D4: mock.fn(), D6: mock.fn(), D10: mock.fn(), D12: mock.fn(), D20: mock.fn(),
      Die: mock.fn(), Number: mock.fn(),
    },
    playerID: playerId,
    log: { setMetadata: mock.fn() },
  } as unknown as Parameters<typeof resolvePutCardsOnDeckChoice>[0];
}

function putChoice(count: number = 2, playerID: string = '0'): PendingPutCardsOnDeckChoice {
  return { choiceType: 'put-cards-on-deck', playerID, count };
}

describe('hasPendingPutCardsOnDeckChoice (WP-538 / D-24347)', () => {
  it('is false for undefined and empty queues, true for a non-empty queue', () => {
    assert.equal(hasPendingPutCardsOnDeckChoice(makeTestGameState()), false);
    assert.equal(hasPendingPutCardsOnDeckChoice(makeTestGameState({ pendingPutCardsOnDeckChoices: [] })), false);
    assert.equal(
      hasPendingPutCardsOnDeckChoice(makeTestGameState({ pendingPutCardsOnDeckChoices: [putChoice()] })),
      true,
    );
  });
});

describe('resolvePutCardsOnDeckChoice (WP-538 / D-24347)', () => {
  it('puts exactly the chosen cards on top of the deck in selection order and front-pops the queue', () => {
    const G = makeTestGameState({
      hand: [A, B, C, D, E, F],
      deck: [DECK1, DECK2],
      pendingPutCardsOnDeckChoices: [putChoice(2)],
    });
    // Pick B first, then D: B ends up on top (drawn first), D under it.
    resolvePutCardsOnDeckChoice(makeMoveContext(G), { cardIds: [B, D] });
    assert.deepStrictEqual(G.playerZones['0']!.hand, [A, C, E, F], 'the chosen cards left the hand');
    assert.deepStrictEqual(
      G.playerZones['0']!.deck,
      [B, D, DECK1, DECK2],
      'chosen cards are on top in selection order (B on top), old deck beneath',
    );
    assert.equal(G.pendingPutCardsOnDeckChoices?.length, 0, 'the queue was front-popped');
  });

  it('honors pick order — reversing the selection reverses the deck-top order', () => {
    const G = makeTestGameState({
      hand: [A, B, C, D, E, F],
      deck: [DECK1],
      pendingPutCardsOnDeckChoices: [putChoice(2)],
    });
    resolvePutCardsOnDeckChoice(makeMoveContext(G), { cardIds: [D, B] });
    assert.deepStrictEqual(G.playerZones['0']!.deck, [D, B, DECK1], 'D picked first is on top');
  });

  it('no-ops on a wrong count (not exactly `count`), leaving hand/deck/queue intact', () => {
    const G = makeTestGameState({
      hand: [A, B, C, D, E, F],
      deck: [DECK1],
      pendingPutCardsOnDeckChoices: [putChoice(2)],
    });
    resolvePutCardsOnDeckChoice(makeMoveContext(G), { cardIds: [B] });
    assert.deepStrictEqual(G.playerZones['0']!.hand, [A, B, C, D, E, F], 'hand unchanged');
    assert.deepStrictEqual(G.playerZones['0']!.deck, [DECK1], 'deck unchanged');
    assert.equal(G.pendingPutCardsOnDeckChoices?.length, 1, 'queue intact — resubmit');
  });

  it('no-ops when a chosen card is not in hand, leaving everything intact', () => {
    const G = makeTestGameState({
      hand: [A, B, C, D, E, F],
      deck: [DECK1],
      pendingPutCardsOnDeckChoices: [putChoice(2)],
    });
    const notInHand = 'core/z#0' as CardExtId;
    resolvePutCardsOnDeckChoice(makeMoveContext(G), { cardIds: [B, notInHand] });
    assert.deepStrictEqual(G.playerZones['0']!.hand, [A, B, C, D, E, F], 'hand unchanged (B not consumed)');
    assert.deepStrictEqual(G.playerZones['0']!.deck, [DECK1], 'deck unchanged');
    assert.equal(G.pendingPutCardsOnDeckChoices?.length, 1, 'queue intact');
  });

  it('no-ops on a wrong playerID (front entry belongs to another player)', () => {
    const G = makeTestGameState({
      hand: [A, B, C, D, E, F],
      deck: [DECK1],
      pendingPutCardsOnDeckChoices: [putChoice(2, '1')],
    });
    resolvePutCardsOnDeckChoice(makeMoveContext(G, '0'), { cardIds: [B, D] });
    assert.deepStrictEqual(G.playerZones['0']!.hand, [A, B, C, D, E, F], 'hand unchanged');
    assert.equal(G.pendingPutCardsOnDeckChoices?.length, 1, 'queue intact');
  });

  it('no-ops on an empty queue', () => {
    const G = makeTestGameState({ hand: [A, B], deck: [DECK1], pendingPutCardsOnDeckChoices: [] });
    resolvePutCardsOnDeckChoice(makeMoveContext(G), { cardIds: [A, B] });
    assert.deepStrictEqual(G.playerZones['0']!.hand, [A, B], 'hand unchanged');
    assert.deepStrictEqual(G.playerZones['0']!.deck, [DECK1], 'deck unchanged');
  });

  it('no-ops on non-array / empty cardIds', () => {
    const G = makeTestGameState({ hand: [A, B, C], deck: [DECK1], pendingPutCardsOnDeckChoices: [putChoice(2)] });
    resolvePutCardsOnDeckChoice(makeMoveContext(G), { cardIds: [] });
    assert.equal(G.pendingPutCardsOnDeckChoices?.length, 1, 'empty cardIds is a no-op');
    resolvePutCardsOnDeckChoice(makeMoveContext(G), { cardIds: undefined as unknown as CardExtId[] });
    assert.equal(G.pendingPutCardsOnDeckChoices?.length, 1, 'non-array cardIds is a no-op');
  });
});

describe('block-all guard — put-cards-on-deck pending (WP-538 / D-24347)', () => {
  it('playCard is a no-op while a put-cards-on-deck choice is pending', () => {
    const G = makeTestGameState({
      hand: [A, B, C, D, E, F],
      deck: [DECK1],
      currentStage: 'main',
      pendingPutCardsOnDeckChoices: [putChoice(2)],
    });
    const handBefore = [...G.playerZones['0']!.hand];
    playCard(makeMoveContext(G) as never, { cardId: A } as never);
    assert.deepStrictEqual(G.playerZones['0']!.hand, handBefore, 'playCard did not mutate — blocked by the pending choice');
    assert.equal(G.pendingPutCardsOnDeckChoices?.length, 1, 'the pending choice is still parked');
  });
});
