/**
 * Tests for the resolveOptionalPutBottomHQ move (Wonder Man's Ionic Energy —
 * "You may put a card from the HQ on the bottom of the Hero Deck") and the
 * hasPendingOptionalPutBottomHQ predicate.
 *
 * The load-bearing correctness property fixed here: the chosen card goes to the
 * BOTTOM of the SHARED Hero Deck (G.heroDeck, end of array) and the vacated HQ
 * slot is refilled from the TOP of the Hero Deck — NOT to the player's personal
 * deck, and never leaving a permanent null HQ gap. Decline pops the queue with no
 * zone change. Stale / malformed / wrong-player submissions are no-ops that leave
 * the queue intact so the player can resubmit.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveOptionalPutBottomHQ,
  hasPendingOptionalPutBottomHQ,
} from './resolveOptionalPutBottomHQ.js';
import type {
  LegendaryGameState,
  PendingOptionalPutBottomHQ,
} from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/**
 * Creates a minimal LegendaryGameState for testing the put-bottom-hq flow.
 *
 * @param overrides - Selective overrides for the HQ, the shared hero deck, player
 *   "0" personal deck, and the pending queue.
 */
function makeTestGameState(
  overrides: {
    hq?: (CardExtId | null)[];
    heroDeck?: CardExtId[];
    deck?: CardExtId[];
    pendingOptionalPutBottomHQ?: PendingOptionalPutBottomHQ[];
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
    cardTraits: {},
    schemeSetupInstructions: [],
    heroAbilityHooks: [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;

  if (overrides.pendingOptionalPutBottomHQ !== undefined) {
    state.pendingOptionalPutBottomHQ = overrides.pendingOptionalPutBottomHQ;
  }

  return state;
}

/**
 * Builds a move context for the move under test.
 */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveOptionalPutBottomHQ>[0] {
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
  } as unknown as Parameters<typeof resolveOptionalPutBottomHQ>[0];
}

describe('hasPendingOptionalPutBottomHQ predicate', () => {
  it('returns false when the queue is undefined', () => {
    const state = makeTestGameState();
    assert.equal(hasPendingOptionalPutBottomHQ(state), false);
  });

  it('returns false when the queue is empty', () => {
    const state = makeTestGameState({ pendingOptionalPutBottomHQ: [] });
    assert.equal(hasPendingOptionalPutBottomHQ(state), false);
  });

  it('returns true when at least one choice is queued', () => {
    const state = makeTestGameState({
      pendingOptionalPutBottomHQ: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    assert.equal(hasPendingOptionalPutBottomHQ(state), true);
  });
});

describe('resolveOptionalPutBottomHQ — move a card', () => {
  it('moves the chosen HQ card to the BOTTOM of the Hero Deck and refills the slot from the TOP', () => {
    const state = makeTestGameState({
      hq: ['hq-a' as CardExtId, 'hq-b' as CardExtId, 'hq-c' as CardExtId, null, null],
      heroDeck: ['top' as CardExtId, 'mid' as CardExtId],
      pendingOptionalPutBottomHQ: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    const context = makeMoveContext(state);

    resolveOptionalPutBottomHQ(context, { cardId: 'hq-b' as CardExtId });

    // slot 1 refilled from the TOP of the hero deck ('top'); other slots untouched
    assert.deepEqual(state.hq, ['hq-a', 'top', 'hq-c', null, null]);
    // the chosen card is on the BOTTOM (end) of the hero deck; the old top was consumed
    assert.deepEqual(state.heroDeck, ['mid', 'hq-b']);
    // the player's PERSONAL deck must NOT be touched (the bug this fix corrects)
    assert.deepEqual(state.playerZones['0']!.deck, []);
    // queue front-popped
    assert.equal(state.pendingOptionalPutBottomHQ!.length, 0);
  });

  it('empty Hero Deck: the vacated slot refills with the just-moved card (deterministic edge)', () => {
    const state = makeTestGameState({
      hq: ['hq-a' as CardExtId, null, null, null, null],
      heroDeck: [],
      pendingOptionalPutBottomHQ: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    const context = makeMoveContext(state);

    resolveOptionalPutBottomHQ(context, { cardId: 'hq-a' as CardExtId });

    // push('hq-a') then refill pops heroDeck[0] ('hq-a') back into slot 0 → deck empties
    assert.deepEqual(state.hq, ['hq-a', null, null, null, null]);
    assert.deepEqual(state.heroDeck, []);
    assert.equal(state.pendingOptionalPutBottomHQ!.length, 0);
  });

  it('FIFO: only the front entry is consumed when two are queued', () => {
    const state = makeTestGameState({
      hq: ['hq-a' as CardExtId, null, null, null, null],
      heroDeck: ['top' as CardExtId],
      pendingOptionalPutBottomHQ: [
        { playerID: '0', sourceCardId: 'first' as CardExtId },
        { playerID: '0', sourceCardId: 'second' as CardExtId },
      ],
    });
    const context = makeMoveContext(state);

    resolveOptionalPutBottomHQ(context, { cardId: 'hq-a' as CardExtId });

    assert.equal(state.pendingOptionalPutBottomHQ!.length, 1);
    assert.equal(state.pendingOptionalPutBottomHQ![0]!.sourceCardId, 'second');
  });
});

describe('resolveOptionalPutBottomHQ — decline', () => {
  it('pops the queue with no zone change', () => {
    const state = makeTestGameState({
      hq: ['hq-a' as CardExtId, null, null, null, null],
      heroDeck: ['top' as CardExtId],
      pendingOptionalPutBottomHQ: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    const context = makeMoveContext(state);

    resolveOptionalPutBottomHQ(context, { decline: true });

    assert.deepEqual(state.hq, ['hq-a', null, null, null, null]);
    assert.deepEqual(state.heroDeck, ['top']);
    assert.equal(state.pendingOptionalPutBottomHQ!.length, 0);
  });
});

describe('resolveOptionalPutBottomHQ — no-op guards', () => {
  it('is a no-op when the chosen card is not in the HQ (queue intact for resubmit)', () => {
    const state = makeTestGameState({
      hq: ['hq-a' as CardExtId, null, null, null, null],
      heroDeck: ['top' as CardExtId],
      pendingOptionalPutBottomHQ: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    const context = makeMoveContext(state);

    resolveOptionalPutBottomHQ(context, { cardId: 'not-in-hq' as CardExtId });

    assert.deepEqual(state.hq, ['hq-a', null, null, null, null]);
    assert.deepEqual(state.heroDeck, ['top']);
    assert.equal(state.pendingOptionalPutBottomHQ!.length, 1);
  });

  it('is a no-op for a malformed arg (both decline and cardId)', () => {
    const state = makeTestGameState({
      hq: ['hq-a' as CardExtId, null, null, null, null],
      heroDeck: ['top' as CardExtId],
      pendingOptionalPutBottomHQ: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    const context = makeMoveContext(state);

    resolveOptionalPutBottomHQ(
      context,
      { decline: true, cardId: 'hq-a' } as unknown as { decline: true },
    );

    assert.deepEqual(state.hq, ['hq-a', null, null, null, null]);
    assert.equal(state.pendingOptionalPutBottomHQ!.length, 1);
  });

  it('is a no-op when a different player submits', () => {
    const state = makeTestGameState({
      hq: ['hq-a' as CardExtId, null, null, null, null],
      heroDeck: ['top' as CardExtId],
      pendingOptionalPutBottomHQ: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    const context = makeMoveContext(state, '1');

    resolveOptionalPutBottomHQ(context, { cardId: 'hq-a' as CardExtId });

    assert.deepEqual(state.hq, ['hq-a', null, null, null, null]);
    assert.equal(state.pendingOptionalPutBottomHQ!.length, 1);
  });

  it('is a no-op when the queue is undefined', () => {
    const state = makeTestGameState({
      hq: ['hq-a' as CardExtId, null, null, null, null],
      heroDeck: ['top' as CardExtId],
    });
    const context = makeMoveContext(state);

    resolveOptionalPutBottomHQ(context, { cardId: 'hq-a' as CardExtId });

    assert.deepEqual(state.hq, ['hq-a', null, null, null, null]);
    assert.deepEqual(state.heroDeck, ['top']);
  });
});
