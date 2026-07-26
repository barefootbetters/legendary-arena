/**
 * Tests for the discard-to-play cost mechanic (WP-383 / D-24184):
 * - the resolveDiscardToPlay move (moves a chosen HAND card to discard, decrements
 *   `remaining`, front-pops when it reaches 0),
 * - the hasPendingDiscardToPlay predicate + getDiscardToPlayCost / getEligibleDiscardToPlayCards
 *   helpers,
 * - the PRE-COMMIT precondition in playCard (D-24185): an unpayable play (no other card
 *   to discard) returns void with NO base power granted — the whole point of the fix.
 *
 * The load-bearing correctness properties: a payable play commits + parks a mandatory
 * choice + grants the base power; an unpayable play grants NOTHING (no power leak); the
 * choice is MANDATORY (no decline shape); stale / wrong-player / malformed submissions
 * are no-ops that leave the queue intact.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDiscardToPlay,
  hasPendingDiscardToPlay,
  getDiscardToPlayCost,
  getEligibleDiscardToPlayCards,
} from './resolveDiscardToPlay.js';
import { playCard } from './coreMoves.impl.js';
import type { LegendaryGameState, PendingDiscardToPlay } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';

/**
 * Creates a minimal LegendaryGameState for testing the discard-to-play flow.
 *
 * @param overrides - Selective overrides for player "0" zones, the pending queue,
 *   cardStats (cost/power lookup), and heroAbilityHooks (the discard-to-play hook).
 */
function makeTestGameState(
  overrides: {
    hand?: CardExtId[];
    discard?: CardExtId[];
    inPlay?: CardExtId[];
    pendingDiscardToPlay?: PendingDiscardToPlay[];
    cardStats?: Record<string, { attack: number; recruit: number; cost: number; fightCost: number }>;
    heroAbilityHooks?: HeroAbilityHook[];
    currentStage?: string;
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
    currentStage: (overrides.currentStage ?? 'main') as LegendaryGameState['currentStage'],
    playerZones: {
      '0': {
        deck: [],
        hand: overrides.hand ?? [],
        discard: overrides.discard ?? [],
        inPlay: overrides.inPlay ?? [],
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
    cardStats: (overrides.cardStats ?? {}) as Record<string, { attack: number; recruit: number; cost: number; fightCost: number }>,
    cardKeywords: {},
    heroDeck: [],
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
    hq: [null, null, null, null, null] as LegendaryGameState['hq'],
    cardDisplayData: {},
    cardTraits: {},
    schemeSetupInstructions: [],
    heroAbilityHooks: overrides.heroAbilityHooks ?? [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;

  if (overrides.pendingDiscardToPlay !== undefined) {
    state.pendingDiscardToPlay = overrides.pendingDiscardToPlay;
  }

  return state;
}

/** Builds a move context for the move under test. */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveDiscardToPlay>[0] {
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
  } as unknown as Parameters<typeof resolveDiscardToPlay>[0];
}

/** A hero card with the given recruit power and cost, plus a discard-to-play hook. */
function discardToPlayHook(cardId: string, count: number = 1): HeroAbilityHook {
  return {
    cardId: cardId as CardExtId,
    timing: 'onPlay',
    keywords: ['discard-to-play'],
    effects: [{ type: 'discard-to-play', magnitude: count }],
  };
}

describe('getDiscardToPlayCost', () => {
  it('returns the hook magnitude for a discard-to-play card and 0 for a plain card', () => {
    const state = makeTestGameState({ heroAbilityHooks: [discardToPlayHook('src', 1)] });
    assert.equal(getDiscardToPlayCost(state, 'src' as CardExtId), 1);
    assert.equal(getDiscardToPlayCost(state, 'plain' as CardExtId), 0);
  });

  it('defaults a magnitude-less marker to 1 and does not throw when heroAbilityHooks is undefined', () => {
    const state = makeTestGameState({
      heroAbilityHooks: [{ cardId: 'src' as CardExtId, timing: 'onPlay', keywords: ['discard-to-play'], effects: [{ type: 'discard-to-play' }] }],
    });
    assert.equal(getDiscardToPlayCost(state, 'src' as CardExtId), 1);
    delete (state as { heroAbilityHooks?: unknown }).heroAbilityHooks;
    assert.doesNotThrow(() => getDiscardToPlayCost(state, 'src' as CardExtId));
    assert.equal(getDiscardToPlayCost(state, 'src' as CardExtId), 0);
  });
});

describe('getEligibleDiscardToPlayCards', () => {
  it('lists the chooser whole hand in order, and empty for an unknown player', () => {
    const state = makeTestGameState({ hand: ['a', 'b', 'c'] as CardExtId[] });
    assert.deepStrictEqual(getEligibleDiscardToPlayCards(state, '0'), ['a', 'b', 'c']);
    assert.deepStrictEqual(getEligibleDiscardToPlayCards(state, '9'), []);
  });
});

describe('hasPendingDiscardToPlay predicate', () => {
  it('is false for undefined/empty, true when a choice is queued', () => {
    assert.equal(hasPendingDiscardToPlay(makeTestGameState()), false);
    assert.equal(hasPendingDiscardToPlay(makeTestGameState({ pendingDiscardToPlay: [] })), false);
    assert.equal(hasPendingDiscardToPlay(makeTestGameState({
      pendingDiscardToPlay: [{ playerID: '0', sourceCardId: 'src' as CardExtId, remaining: 1 }],
    })), true);
  });
});

describe('playCard precondition (D-24185) — the base-power leak fix', () => {
  it('a PAYABLE discard-to-play play commits, grants base power, and parks the mandatory choice', () => {
    const state = makeTestGameState({
      hand: ['determination', 'spare'] as CardExtId[],
      cardStats: { determination: { attack: 0, recruit: 3, cost: 2, fightCost: 0 } },
      heroAbilityHooks: [discardToPlayHook('determination', 1)],
    });
    playCard(makeMoveContext(state) as never, { cardId: 'determination' as CardExtId });

    assert.deepStrictEqual(state.playerZones['0']!.inPlay, ['determination'], 'the card commits to inPlay');
    assert.deepStrictEqual(state.playerZones['0']!.hand, ['spare'], 'only the played card leaves the hand');
    assert.equal(state.turnEconomy.recruit, 3, 'the base recruit power is granted on a payable play');
    assert.equal(state.pendingDiscardToPlay!.length, 1, 'the mandatory discard choice is parked');
    assert.equal(state.pendingDiscardToPlay![0]!.remaining, 1);
  });

  it('an UNPAYABLE play (the card is the only card in hand) is a no-op: NO power leaks', () => {
    const state = makeTestGameState({
      hand: ['optic-blast'] as CardExtId[],
      cardStats: { 'optic-blast': { attack: 3, recruit: 0, cost: 3, fightCost: 0 } },
      heroAbilityHooks: [discardToPlayHook('optic-blast', 1)],
    });
    playCard(makeMoveContext(state) as never, { cardId: 'optic-blast' as CardExtId });

    assert.deepStrictEqual(state.playerZones['0']!.hand, ['optic-blast'], 'the card stays in hand — not played');
    assert.deepStrictEqual(state.playerZones['0']!.inPlay, [], 'nothing committed to inPlay');
    assert.equal(state.turnEconomy.attack, 0, 'NO base attack is granted — the cost was unpayable');
    assert.equal(hasPendingDiscardToPlay(state), false, 'no choice is parked');
    assert.match(state.messages[state.messages.length - 1]!.text, /could not play .* discarding/,
      'the blocked play is logged for replay inspection');
  });

  it('a plain card with a spare card is unaffected by the precondition', () => {
    const state = makeTestGameState({
      hand: ['plain', 'spare'] as CardExtId[],
      cardStats: { plain: { attack: 2, recruit: 0, cost: 1, fightCost: 0 } },
    });
    playCard(makeMoveContext(state) as never, { cardId: 'plain' as CardExtId });
    assert.deepStrictEqual(state.playerZones['0']!.inPlay, ['plain']);
    assert.equal(state.turnEconomy.attack, 2);
    assert.equal(hasPendingDiscardToPlay(state), false);
  });
});

describe('resolveDiscardToPlay — pay the cost', () => {
  it('moves the chosen HAND card to discard, logs, and front-pops when remaining hits 0', () => {
    const state = makeTestGameState({
      hand: ['spare-a', 'spare-b'] as CardExtId[],
      inPlay: ['src'] as CardExtId[],
      pendingDiscardToPlay: [{ playerID: '0', sourceCardId: 'src' as CardExtId, remaining: 1 }],
    });
    resolveDiscardToPlay(makeMoveContext(state), { cardId: 'spare-a' as CardExtId });

    assert.deepStrictEqual(state.playerZones['0']!.hand, ['spare-b'], 'the chosen card leaves the hand');
    assert.deepStrictEqual(state.playerZones['0']!.discard, ['spare-a'], 'the chosen card enters discard');
    assert.equal(state.pendingDiscardToPlay!.length, 0, 'the entry is popped once remaining hits 0');
    assert.match(state.messages[state.messages.length - 1]!.text, /discarded .* to pay the cost/,
      'the discard is observable in the game log');
  });

  it('a multi-discard cost (remaining=2) stays parked, decrementing, until fully paid', () => {
    const state = makeTestGameState({
      hand: ['a', 'b', 'c'] as CardExtId[],
      pendingDiscardToPlay: [{ playerID: '0', sourceCardId: 'src' as CardExtId, remaining: 2 }],
    });
    resolveDiscardToPlay(makeMoveContext(state), { cardId: 'a' as CardExtId });
    assert.equal(state.pendingDiscardToPlay!.length, 1, 'still parked after the first discard');
    assert.equal(state.pendingDiscardToPlay![0]!.remaining, 1, 'remaining decremented');

    resolveDiscardToPlay(makeMoveContext(state), { cardId: 'b' as CardExtId });
    assert.equal(state.pendingDiscardToPlay!.length, 0, 'popped after the second discard');
    assert.deepStrictEqual(state.playerZones['0']!.discard, ['a', 'b']);
    assert.deepStrictEqual(state.playerZones['0']!.hand, ['c']);
  });

  it('removes exactly ONE occurrence when the hand holds duplicates', () => {
    const state = makeTestGameState({
      hand: ['dup', 'dup'] as CardExtId[],
      pendingDiscardToPlay: [{ playerID: '0', sourceCardId: 'src' as CardExtId, remaining: 1 }],
    });
    resolveDiscardToPlay(makeMoveContext(state), { cardId: 'dup' as CardExtId });
    assert.deepStrictEqual(state.playerZones['0']!.hand, ['dup']);
    assert.deepStrictEqual(state.playerZones['0']!.discard, ['dup']);
  });
});

describe('resolveDiscardToPlay — no-op guards (queue intact, no zone change)', () => {
  function assertUntouched(state: LegendaryGameState, handBefore: CardExtId[]): void {
    assert.deepStrictEqual(state.playerZones['0']!.hand, handBefore, 'hand unchanged');
    assert.deepStrictEqual(state.playerZones['0']!.discard, [], 'discard unchanged');
    assert.equal(state.pendingDiscardToPlay!.length, 1, 'queue intact for resubmit');
  }

  it('a card absent from the hand is a stale-target no-op', () => {
    const state = makeTestGameState({
      hand: ['a'] as CardExtId[],
      pendingDiscardToPlay: [{ playerID: '0', sourceCardId: 'src' as CardExtId, remaining: 1 }],
    });
    resolveDiscardToPlay(makeMoveContext(state), { cardId: 'ghost' as CardExtId });
    assertUntouched(state, ['a'] as CardExtId[]);
  });

  it('a wrong-player submission is a no-op', () => {
    const state = makeTestGameState({
      hand: ['a'] as CardExtId[],
      pendingDiscardToPlay: [{ playerID: '0', sourceCardId: 'src' as CardExtId, remaining: 1 }],
    });
    resolveDiscardToPlay(makeMoveContext(state, '1'), { cardId: 'a' as CardExtId });
    assertUntouched(state, ['a'] as CardExtId[]);
  });

  it('a malformed payload (no cardId — including a decline-style shape) is a no-op: the cost is MANDATORY', () => {
    const state = makeTestGameState({
      hand: ['a'] as CardExtId[],
      pendingDiscardToPlay: [{ playerID: '0', sourceCardId: 'src' as CardExtId, remaining: 1 }],
    });
    resolveDiscardToPlay(makeMoveContext(state), { decline: true } as never);
    resolveDiscardToPlay(makeMoveContext(state), {} as never);
    resolveDiscardToPlay(makeMoveContext(state), { cardId: '' } as never);
    assertUntouched(state, ['a'] as CardExtId[]);
  });

  it('an empty / undefined queue is a no-op', () => {
    const state = makeTestGameState({ hand: ['a'] as CardExtId[] });
    resolveDiscardToPlay(makeMoveContext(state), { cardId: 'a' as CardExtId });
    assert.deepStrictEqual(state.playerZones['0']!.hand, ['a']);
    assert.deepStrictEqual(state.playerZones['0']!.discard, []);
  });

  it('JSON.stringify(G) succeeds after a resolve (no functions leak into G)', () => {
    const state = makeTestGameState({
      hand: ['a'] as CardExtId[],
      pendingDiscardToPlay: [{ playerID: '0', sourceCardId: 'src' as CardExtId, remaining: 1 }],
    });
    resolveDiscardToPlay(makeMoveContext(state), { cardId: 'a' as CardExtId });
    assert.doesNotThrow(() => JSON.stringify(state));
  });
});
