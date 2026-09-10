/**
 * Tests for Red Skull "Ruthless Dictator" (WP-695 / D-24512): the resolver
 * (rules/tacticHandlers.resolveRuthlessDictator — park with 3 / 2 / 1 / 0 cards) and the
 * resolveRuthlessDictatorChoice move + hasPendingRuthlessDictatorChoice predicate.
 *
 * Covers: park snapshots the top min(3, deck.length) with the locked KO→discard→top
 * priority sliced to the revealed count; KO removes to G.ko; discard moves the deck-top
 * card to the discard pile (NOT the hand); top leaves it on the deck; sequential
 * resolution front-pops only when every card is dispositioned; the <3 edge; invalid /
 * stale states are silent no-ops leaving the queue intact; block-all no-op on an action
 * move while pending.
 *
 * Uses node:test + node:assert only. No boardgame.io testing imports.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRuthlessDictatorChoice,
  hasPendingRuthlessDictatorChoice,
} from './ruthlessDictatorChoice.resolve.js';
import { resolveRuthlessDictator } from '../rules/tacticHandlers.js';
import { playCard } from './coreMoves.impl.js';
import type { LegendaryGameState, PendingRuthlessDictatorChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

const CARD_A = 'core/spider-man/spider-man#0' as CardExtId;
const CARD_B = 'core/iron-man/iron-man#0' as CardExtId;
const CARD_C = 'core/hulk/hulk#0' as CardExtId;

/** Minimal single-player LegendaryGameState for the Ruthless Dictator flow. */
function makeTestGameState(
  overrides: {
    deck?: CardExtId[];
    discard?: CardExtId[];
    pendingRuthlessDictatorChoices?: PendingRuthlessDictatorChoice[];
    currentStage?: LegendaryGameState['currentStage'];
  } = {},
): LegendaryGameState {
  const state = {
    currentStage: overrides.currentStage ?? 'main',
    playerZones: {
      '0': {
        deck: overrides.deck ?? [],
        hand: [],
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
    turnEconomy: { attack: 10, recruit: 10, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
    cardStats: {},
    cardKeywords: {},
    heroDeck: [],
    escapedPile: [],
    mastermind: {
      id: 'test-mastermind', baseCardId: 'test-mastermind-base',
      tacticsDeck: [], tacticsDefeated: [], strikePile: [], attachedBystanders: [],
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
  if (overrides.pendingRuthlessDictatorChoices !== undefined) {
    state.pendingRuthlessDictatorChoices = overrides.pendingRuthlessDictatorChoices;
  }
  return state;
}

/** Builds a move context for the resolve move under test. */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveRuthlessDictatorChoice>[0] {
  return {
    G: gameState,
    ctx: {
      numPlayers: 1, currentPlayer: playerId, phase: 'play', turn: 1,
      playOrder: ['0'], playOrderPos: 0, activePlayers: null,
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
  } as unknown as Parameters<typeof resolveRuthlessDictatorChoice>[0];
}

describe('resolveRuthlessDictator resolver (park) (WP-695 / D-24512)', () => {
  it('parks a scry-3 choice snapshotting the top three with one-of-each dispositions', () => {
    const G = makeTestGameState({ deck: [CARD_A, CARD_B, CARD_C, CARD_A] });
    resolveRuthlessDictator(G, '0');
    assert.equal(G.pendingRuthlessDictatorChoices?.length, 1, 'one entry parked');
    const front = G.pendingRuthlessDictatorChoices![0]!;
    assert.deepStrictEqual(front.revealedCardIds, [CARD_A, CARD_B, CARD_C], 'top three snapshotted');
    assert.deepStrictEqual(front.availableDispositions, ['ko', 'discard', 'top'], 'one of each');
    assert.equal(front.playerID, '0');
  });

  it('parks with KO+discard slots only when exactly two cards remain (<3 rule)', () => {
    const G = makeTestGameState({ deck: [CARD_A, CARD_B] });
    resolveRuthlessDictator(G, '0');
    const front = G.pendingRuthlessDictatorChoices![0]!;
    assert.deepStrictEqual(front.revealedCardIds, [CARD_A, CARD_B]);
    assert.deepStrictEqual(front.availableDispositions, ['ko', 'discard'], 'KO→discard priority, no top');
  });

  it('parks with a KO-only slot when a single card remains (<3 rule)', () => {
    const G = makeTestGameState({ deck: [CARD_A] });
    resolveRuthlessDictator(G, '0');
    const front = G.pendingRuthlessDictatorChoices![0]!;
    assert.deepStrictEqual(front.availableDispositions, ['ko'], 'only KO applies to one card');
  });

  it('is a logged no-op with an empty deck (no park, no reshuffle)', () => {
    const G = makeTestGameState({ deck: [] });
    resolveRuthlessDictator(G, '0');
    assert.equal(G.pendingRuthlessDictatorChoices, undefined, 'no queue created');
    assert.ok(G.messages.length > 0, 'logged the no-op');
  });

  it('does not alias the deck array (snapshot is a copy)', () => {
    const deck = [CARD_A, CARD_B, CARD_C];
    const G = makeTestGameState({ deck });
    resolveRuthlessDictator(G, '0');
    G.pendingRuthlessDictatorChoices![0]!.revealedCardIds.pop();
    assert.deepStrictEqual(G.playerZones['0']!.deck, [CARD_A, CARD_B, CARD_C], 'deck untouched by snapshot mutation');
  });
});

describe('resolveRuthlessDictatorChoice move (WP-695 / D-24512)', () => {
  function threeCardChoice(): PendingRuthlessDictatorChoice {
    return {
      choiceType: 'ruthless-dictator', playerID: '0',
      revealedCardIds: [CARD_A, CARD_B, CARD_C],
      availableDispositions: ['ko', 'discard', 'top'],
    };
  }

  it('KOs a chosen card from the deck top to G.ko', () => {
    const G = makeTestGameState({ deck: [CARD_A, CARD_B, CARD_C], pendingRuthlessDictatorChoices: [threeCardChoice()] });
    resolveRuthlessDictatorChoice(makeMoveContext(G), { cardId: CARD_A, disposition: 'ko' });
    assert.deepStrictEqual(G.ko, [CARD_A], 'KO’d card moved to G.ko');
    assert.deepStrictEqual(G.playerZones['0']!.deck, [CARD_B, CARD_C], 'removed from deck top');
    const front = G.pendingRuthlessDictatorChoices![0]!;
    assert.deepStrictEqual(front.revealedCardIds, [CARD_B, CARD_C], 'resolved card dropped');
    assert.deepStrictEqual(front.availableDispositions, ['discard', 'top'], 'used slot dropped');
  });

  it('discards a chosen deck-top card to the discard pile (not the hand)', () => {
    const G = makeTestGameState({ deck: [CARD_A, CARD_B, CARD_C], pendingRuthlessDictatorChoices: [threeCardChoice()] });
    resolveRuthlessDictatorChoice(makeMoveContext(G), { cardId: CARD_B, disposition: 'discard' });
    assert.deepStrictEqual(G.playerZones['0']!.discard, [CARD_B], 'moved to discard');
    assert.deepStrictEqual(G.playerZones['0']!.hand, [], 'NOT to the hand');
    assert.deepStrictEqual(G.playerZones['0']!.deck, [CARD_A, CARD_C], 'removed from deck');
  });

  it('leaves a "top" card on the deck (no mutation) and front-pops when all three resolved', () => {
    const G = makeTestGameState({ deck: [CARD_A, CARD_B, CARD_C], pendingRuthlessDictatorChoices: [threeCardChoice()] });
    const ctx = makeMoveContext(G);
    resolveRuthlessDictatorChoice(ctx, { cardId: CARD_A, disposition: 'ko' });
    resolveRuthlessDictatorChoice(ctx, { cardId: CARD_B, disposition: 'discard' });
    resolveRuthlessDictatorChoice(ctx, { cardId: CARD_C, disposition: 'top' });
    assert.deepStrictEqual(G.ko, [CARD_A]);
    assert.deepStrictEqual(G.playerZones['0']!.discard, [CARD_B]);
    assert.deepStrictEqual(G.playerZones['0']!.deck, [CARD_C], 'top card left on deck');
    assert.equal(G.pendingRuthlessDictatorChoices?.length, 0, 'queue front-popped after the last card');
  });

  it('is a silent no-op on an unavailable disposition (queue intact)', () => {
    const choice: PendingRuthlessDictatorChoice = {
      choiceType: 'ruthless-dictator', playerID: '0',
      revealedCardIds: [CARD_A, CARD_B], availableDispositions: ['ko', 'discard'],
    };
    const G = makeTestGameState({ deck: [CARD_A, CARD_B], pendingRuthlessDictatorChoices: [choice] });
    resolveRuthlessDictatorChoice(makeMoveContext(G), { cardId: CARD_A, disposition: 'top' });
    assert.deepStrictEqual(G.ko, [], 'nothing KO’d');
    assert.equal(G.pendingRuthlessDictatorChoices![0]!.revealedCardIds.length, 2, 'queue untouched');
  });

  it('is a silent no-op on a non-revealed cardId, wrong playerID, and empty queue', () => {
    const G1 = makeTestGameState({ deck: [CARD_A, CARD_B, CARD_C], pendingRuthlessDictatorChoices: [threeCardChoice()] });
    resolveRuthlessDictatorChoice(makeMoveContext(G1), { cardId: 'not-revealed' as CardExtId, disposition: 'ko' });
    assert.deepStrictEqual(G1.ko, [], 'non-revealed cardId ignored');

    const G2 = makeTestGameState({ deck: [CARD_A, CARD_B, CARD_C], pendingRuthlessDictatorChoices: [threeCardChoice()] });
    resolveRuthlessDictatorChoice(makeMoveContext(G2, '1'), { cardId: CARD_A, disposition: 'ko' });
    assert.deepStrictEqual(G2.ko, [], 'wrong player ignored');

    const G3 = makeTestGameState({ deck: [CARD_A] });
    resolveRuthlessDictatorChoice(makeMoveContext(G3), { cardId: CARD_A, disposition: 'ko' });
    assert.deepStrictEqual(G3.ko, [], 'empty queue ignored');
  });
});

describe('hasPendingRuthlessDictatorChoice + block-all (WP-695 / D-24512)', () => {
  it('reports true only when the queue is non-empty', () => {
    assert.equal(hasPendingRuthlessDictatorChoice(makeTestGameState()), false);
    const G = makeTestGameState({ pendingRuthlessDictatorChoices: [{
      choiceType: 'ruthless-dictator', playerID: '0', revealedCardIds: [CARD_A], availableDispositions: ['ko'],
    }] });
    assert.equal(hasPendingRuthlessDictatorChoice(G), true);
  });

  it('freezes an action move (playCard) while pending', () => {
    const G = makeTestGameState({ pendingRuthlessDictatorChoices: [{
      choiceType: 'ruthless-dictator', playerID: '0', revealedCardIds: [CARD_A], availableDispositions: ['ko'],
    }] });
    G.playerZones['0']!.hand = [CARD_B];
    playCard(makeMoveContext(G) as never, { cardId: CARD_B } as never);
    assert.deepStrictEqual(G.playerZones['0']!.hand, [CARD_B], 'playCard was a no-op while the choice is pending');
  });
});
