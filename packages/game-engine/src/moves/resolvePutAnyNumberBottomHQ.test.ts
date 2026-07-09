/**
 * Tests for the resolvePutAnyNumberBottomHQ move (D-24132 — "Choose any number of
 * cards/Heroes from the HQ. Put them on the bottom of the Hero Deck. (Then you get
 * Empowered by [classes].)" — Wonder Man's 8th Wonder of the World, Sunspot's Empyreal
 * Force, Star-Lord (T'Challa)'s Colliding Dreams) and the hasPendingPutAnyNumberBottomHQ
 * predicate.
 *
 * Load-bearing properties:
 * - Each selected card goes to the BOTTOM of the SHARED Hero Deck (G.heroDeck, end of array)
 *   and its vacated HQ slot refills from the TOP of the Hero Deck — never the personal deck,
 *   never a permanent null HQ gap.
 * - "Any number" includes ZERO: an empty selection is valid (puts nothing) and still applies
 *   the trailing Empowered grant.
 * - The trailing Empowered grant applies AFTER the moves — the class count reflects the
 *   RESHAPED HQ (the strategic point of putting cards away first), NOT the pre-move HQ.
 * - Stale / duplicate / malformed / wrong-player submissions leave those selections (or the
 *   whole queue) untouched; moves never throw.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePutAnyNumberBottomHQ,
  hasPendingPutAnyNumberBottomHQ,
} from './resolvePutAnyNumberBottomHQ.js';
import type {
  LegendaryGameState,
  PendingPutAnyNumberBottomHQ,
} from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/**
 * Creates a minimal LegendaryGameState for testing the put-any-number-bottom-hq flow.
 *
 * @param overrides - Selective overrides for the HQ, the shared hero deck, player "0"
 *   personal deck, per-card hero-class traits (for the Empowered count), and the pending queue.
 */
function makeTestGameState(
  overrides: {
    hq?: (CardExtId | null)[];
    heroDeck?: CardExtId[];
    deck?: CardExtId[];
    cardTraits?: Record<string, { heroClass: string }>;
    pendingPutAnyNumberBottomHQ?: PendingPutAnyNumberBottomHQ[];
  } = {},
): LegendaryGameState {
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
        deck: overrides.deck ?? [],
        hand: [],
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
    turnEconomy: {
      attack: 0,
      recruit: 0,
      spentAttack: 0,
      spentRecruit: 0,
      piercing: 0,
      woundsDrawn: 0,
    },
    cardStats: {},
    cardKeywords: {},
    heroDeck: overrides.heroDeck ?? [],
    escapedPile: [],
    mastermind: {
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base' as CardExtId,
      tacticsDeck: ['tactic-0'] as CardExtId[],
      tacticsDefeated: [],
      strikePile: [],
      attachedBystanders: [],
    },
    scheme: { twistPile: [] },
    notableEvents: [],
    city: [null, null, null, null, null],
    hq: (overrides.hq ?? [null, null, null, null, null]) as LegendaryGameState['hq'],
    cardDisplayData: {},
    cardTraits: (overrides.cardTraits ?? {}) as LegendaryGameState['cardTraits'],
    schemeSetupInstructions: [],
    heroAbilityHooks: [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;

  if (overrides.pendingPutAnyNumberBottomHQ !== undefined) {
    state.pendingPutAnyNumberBottomHQ = overrides.pendingPutAnyNumberBottomHQ;
  }

  return state;
}

/**
 * Builds a move context for the move under test.
 */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolvePutAnyNumberBottomHQ>[0] {
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
      endTurn: mock.fn(),
      setPhase: mock.fn(),
      endPhase: mock.fn(),
      setStage: mock.fn(),
      endStage: mock.fn(),
      pass: mock.fn(),
      endGame: mock.fn(),
    },
    random: {
      Shuffle: <T>(deck: T[]): T[] => [...deck].reverse(),
      D4: mock.fn(), D6: mock.fn(), D10: mock.fn(), D12: mock.fn(), D20: mock.fn(),
      Die: mock.fn(), Number: mock.fn(),
    },
    playerID: playerId,
    log: { setMetadata: mock.fn() },
  } as unknown as Parameters<typeof resolvePutAnyNumberBottomHQ>[0];
}

describe('hasPendingPutAnyNumberBottomHQ predicate', () => {
  it('returns false when the queue is undefined', () => {
    assert.equal(hasPendingPutAnyNumberBottomHQ(makeTestGameState()), false);
  });

  it('returns false when the queue is empty', () => {
    assert.equal(
      hasPendingPutAnyNumberBottomHQ(makeTestGameState({ pendingPutAnyNumberBottomHQ: [] })),
      false,
    );
  });

  it('returns true when at least one choice is queued', () => {
    const state = makeTestGameState({
      pendingPutAnyNumberBottomHQ: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    assert.equal(hasPendingPutAnyNumberBottomHQ(state), true);
  });
});

describe('resolvePutAnyNumberBottomHQ — move multiple cards', () => {
  it('moves each selected HQ card to the BOTTOM of the Hero Deck (in submitted order) and refills each slot from the TOP', () => {
    const state = makeTestGameState({
      hq: ['hq-a' as CardExtId, 'hq-b' as CardExtId, 'hq-c' as CardExtId, null, null],
      heroDeck: ['top-1' as CardExtId, 'top-2' as CardExtId, 'mid' as CardExtId],
      pendingPutAnyNumberBottomHQ: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    const context = makeMoveContext(state);

    // Submit hq-a then hq-c (skip hq-b). Order of processing = submitted order.
    resolvePutAnyNumberBottomHQ(context, { cardIds: ['hq-a' as CardExtId, 'hq-c' as CardExtId] });

    // slot 0 refilled from top-1, slot 2 refilled from top-2; slot 1 (hq-b) untouched.
    assert.deepEqual(state.hq, ['top-1', 'hq-b', 'top-2', null, null]);
    // both chosen cards pushed to the BOTTOM (end) in submitted order; the two tops were consumed.
    assert.deepEqual(state.heroDeck, ['mid', 'hq-a', 'hq-c']);
    // the player's PERSONAL deck is never touched.
    assert.deepEqual(state.playerZones['0']!.deck, []);
    // queue front-popped.
    assert.equal(state.pendingPutAnyNumberBottomHQ!.length, 0);
  });

  it('empty selection (any number includes zero): puts nothing, pops the queue, leaves zones unchanged', () => {
    const state = makeTestGameState({
      hq: ['hq-a' as CardExtId, null, null, null, null],
      heroDeck: ['top' as CardExtId],
      pendingPutAnyNumberBottomHQ: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    const context = makeMoveContext(state);

    resolvePutAnyNumberBottomHQ(context, { cardIds: [] });

    assert.deepEqual(state.hq, ['hq-a', null, null, null, null]);
    assert.deepEqual(state.heroDeck, ['top']);
    assert.equal(state.pendingPutAnyNumberBottomHQ!.length, 0);
  });

  it('FIFO: only the front entry is consumed when two are queued', () => {
    const state = makeTestGameState({
      hq: ['hq-a' as CardExtId, null, null, null, null],
      heroDeck: ['top' as CardExtId],
      pendingPutAnyNumberBottomHQ: [
        { playerID: '0', sourceCardId: 'first' as CardExtId },
        { playerID: '0', sourceCardId: 'second' as CardExtId },
      ],
    });
    const context = makeMoveContext(state);

    resolvePutAnyNumberBottomHQ(context, { cardIds: ['hq-a' as CardExtId] });

    assert.equal(state.pendingPutAnyNumberBottomHQ!.length, 1);
    assert.equal(state.pendingPutAnyNumberBottomHQ![0]!.sourceCardId, 'second');
  });
});

describe('resolvePutAnyNumberBottomHQ — trailing Empowered grant (applied AFTER the moves)', () => {
  it('single class: grants +Attack for the POST-move HQ class count, not the pre-move count', () => {
    // HQ starts with THREE ranged cards; the refill card is Strength. Moving one ranged card
    // away and refilling with Strength leaves TWO ranged in the HQ → +2 attack (NOT +3).
    const state = makeTestGameState({
      hq: ['ra-1' as CardExtId, 'ra-2' as CardExtId, 'ra-3' as CardExtId, null, null],
      heroDeck: ['refill-str' as CardExtId],
      cardTraits: {
        'ra-1': { heroClass: 'ranged' },
        'ra-2': { heroClass: 'ranged' },
        'ra-3': { heroClass: 'ranged' },
        'refill-str': { heroClass: 'strength' },
      },
      pendingPutAnyNumberBottomHQ: [
        { playerID: '0', sourceCardId: 'src' as CardExtId, empoweredClasses: ['ranged'] },
      ],
    });
    const context = makeMoveContext(state);

    resolvePutAnyNumberBottomHQ(context, { cardIds: ['ra-1' as CardExtId] });

    // post-move HQ: [refill-str(strength), ra-2(ranged), ra-3(ranged), null, null] → 2 ranged.
    assert.deepEqual(state.hq, ['refill-str', 'ra-2', 'ra-3', null, null]);
    assert.equal(state.turnEconomy!.attack, 2);
    assert.equal(state.pendingPutAnyNumberBottomHQ!.length, 0);
  });

  it('multi class: grants the SUM of each class count in the post-move HQ', () => {
    const state = makeTestGameState({
      hq: ['ra-1' as CardExtId, 'st-1' as CardExtId, 'st-2' as CardExtId, null, null],
      heroDeck: ['refill-ra' as CardExtId],
      cardTraits: {
        'ra-1': { heroClass: 'ranged' },
        'st-1': { heroClass: 'strength' },
        'st-2': { heroClass: 'strength' },
        'refill-ra': { heroClass: 'ranged' },
      },
      pendingPutAnyNumberBottomHQ: [
        { playerID: '0', sourceCardId: 'src' as CardExtId, empoweredClasses: ['ranged', 'strength'] },
      ],
    });
    const context = makeMoveContext(state);

    // Move st-1 away; slot 1 refills with refill-ra (ranged).
    resolvePutAnyNumberBottomHQ(context, { cardIds: ['st-1' as CardExtId] });

    // post-move HQ: [ra-1(ranged), refill-ra(ranged), st-2(strength), null, null]
    // → ranged=2, strength=1 → +3 attack.
    assert.deepEqual(state.hq, ['ra-1', 'refill-ra', 'st-2', null, null]);
    assert.equal(state.turnEconomy!.attack, 3);
  });

  it('empty selection still applies the trailing Empowered grant (over the unchanged HQ)', () => {
    const state = makeTestGameState({
      hq: ['ra-1' as CardExtId, 'ra-2' as CardExtId, null, null, null],
      heroDeck: [],
      cardTraits: {
        'ra-1': { heroClass: 'ranged' },
        'ra-2': { heroClass: 'ranged' },
      },
      pendingPutAnyNumberBottomHQ: [
        { playerID: '0', sourceCardId: 'src' as CardExtId, empoweredClasses: ['ranged'] },
      ],
    });
    const context = makeMoveContext(state);

    resolvePutAnyNumberBottomHQ(context, { cardIds: [] });

    assert.deepEqual(state.hq, ['ra-1', 'ra-2', null, null, null]);
    assert.equal(state.turnEconomy!.attack, 2);
    assert.equal(state.pendingPutAnyNumberBottomHQ!.length, 0);
  });
});

describe('resolvePutAnyNumberBottomHQ — no-op / skip guards', () => {
  it('skips stale/absent ids but still moves the valid ones (queue popped)', () => {
    const state = makeTestGameState({
      hq: ['hq-a' as CardExtId, null, null, null, null],
      heroDeck: ['top' as CardExtId],
      pendingPutAnyNumberBottomHQ: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    const context = makeMoveContext(state);

    resolvePutAnyNumberBottomHQ(context, {
      cardIds: ['not-in-hq' as CardExtId, 'hq-a' as CardExtId, 'hq-a' as CardExtId],
    });

    // hq-a moved once (the duplicate is a stale skip after the first move); not-in-hq skipped.
    assert.deepEqual(state.hq, ['top', null, null, null, null]);
    assert.deepEqual(state.heroDeck, ['hq-a']);
    assert.equal(state.pendingPutAnyNumberBottomHQ!.length, 0);
  });

  it('is a no-op for a non-array args payload (queue intact for resubmit)', () => {
    const state = makeTestGameState({
      hq: ['hq-a' as CardExtId, null, null, null, null],
      heroDeck: ['top' as CardExtId],
      pendingPutAnyNumberBottomHQ: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    const context = makeMoveContext(state);

    resolvePutAnyNumberBottomHQ(
      context,
      { cardIds: 'hq-a' } as unknown as { cardIds: CardExtId[] },
    );

    assert.deepEqual(state.hq, ['hq-a', null, null, null, null]);
    assert.equal(state.pendingPutAnyNumberBottomHQ!.length, 1);
  });

  it('is a no-op when a different player submits', () => {
    const state = makeTestGameState({
      hq: ['hq-a' as CardExtId, null, null, null, null],
      heroDeck: ['top' as CardExtId],
      pendingPutAnyNumberBottomHQ: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    const context = makeMoveContext(state, '1');

    resolvePutAnyNumberBottomHQ(context, { cardIds: ['hq-a' as CardExtId] });

    assert.deepEqual(state.hq, ['hq-a', null, null, null, null]);
    assert.equal(state.pendingPutAnyNumberBottomHQ!.length, 1);
  });

  it('is a no-op when the queue is undefined', () => {
    const state = makeTestGameState({
      hq: ['hq-a' as CardExtId, null, null, null, null],
      heroDeck: ['top' as CardExtId],
    });
    const context = makeMoveContext(state);

    resolvePutAnyNumberBottomHQ(context, { cardIds: ['hq-a' as CardExtId] });

    assert.deepEqual(state.hq, ['hq-a', null, null, null, null]);
    assert.deepEqual(state.heroDeck, ['top']);
  });
});
