/**
 * Tests for the resolveReturnZeroCostDiscard move (Black Knight's Defend the
 * Weak — "Return a 0-cost card from your discard pile to your hand"), the
 * hasPendingReturnZeroCostDiscard predicate, and the shared eligibility
 * helpers (isZeroCostCard / getEligibleZeroCostDiscardCards).
 *
 * The load-bearing correctness properties fixed here: the chosen card moves
 * from the chooser's discard pile to their HAND (exactly one occurrence);
 * only 0-cost cards are legal targets (the engine-wide cost convention
 * `cardStats[id]?.cost ?? 0` — missing entries such as Wounds count as
 * 0-cost); the choice is MANDATORY (no decline shape exists — a malformed
 * decline-style payload is a no-op). Stale / malformed / wrong-player /
 * ineligible submissions are no-ops that leave the queue intact so the
 * player can resubmit.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveReturnZeroCostDiscard,
  hasPendingReturnZeroCostDiscard,
  isZeroCostCard,
  getEligibleZeroCostDiscardCards,
} from './resolveReturnZeroCostDiscard.js';
import type {
  LegendaryGameState,
  PendingReturnZeroCostDiscard,
} from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardStatEntry } from '../economy/economy.types.js';

/**
 * Creates a minimal LegendaryGameState for testing the discard-return flow.
 *
 * @param overrides - Selective overrides for player "0" hand/discard, the
 *   pending queue, and cardStats (cost lookup source).
 */
function makeTestGameState(
  overrides: {
    hand?: CardExtId[];
    discard?: CardExtId[];
    pendingReturnZeroCostDiscard?: PendingReturnZeroCostDiscard[];
    cardStats?: Record<string, { attack: number; recruit: number; cost: number; fightCost: number }>;
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
        deck: [],
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
    heroAbilityHooks: [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;

  if (overrides.pendingReturnZeroCostDiscard !== undefined) {
    state.pendingReturnZeroCostDiscard = overrides.pendingReturnZeroCostDiscard;
  }

  return state;
}

/**
 * Builds a move context for the move under test.
 */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveReturnZeroCostDiscard>[0] {
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
  } as unknown as Parameters<typeof resolveReturnZeroCostDiscard>[0];
}

/** Stat entry helper: a hero card with the given recruit cost. */
function statEntry(cost: number): { attack: number; recruit: number; cost: number; fightCost: number } {
  return { attack: 0, recruit: 0, cost, fightCost: 0 };
}

describe('isZeroCostCard predicate', () => {
  it('returns true for an explicit cost-0 entry and for a MISSING entry (the Wound case)', () => {
    const cardStats = { 'zero-hero': statEntry(0) } as unknown as Record<CardExtId, CardStatEntry>;
    assert.equal(isZeroCostCard(cardStats, 'zero-hero' as CardExtId), true);
    assert.equal(isZeroCostCard(cardStats, 'pile-wound' as CardExtId), true,
      'a card with no cardStats entry resolves to cost 0 (the engine-wide convention — Wounds are 0-cost cards)');
  });

  it('returns false for a card with a positive cost', () => {
    const cardStats = { 'costly-hero': statEntry(3) } as unknown as Record<CardExtId, CardStatEntry>;
    assert.equal(isZeroCostCard(cardStats, 'costly-hero' as CardExtId), false);
  });
});

describe('getEligibleZeroCostDiscardCards', () => {
  it('lists only the 0-cost discard cards, preserving discard order', () => {
    const state = makeTestGameState({
      discard: ['costly-a', 'zero-a', 'pile-wound', 'costly-b', 'zero-b'] as CardExtId[],
      cardStats: {
        'costly-a': statEntry(3),
        'zero-a': statEntry(0),
        'costly-b': statEntry(5),
        'zero-b': statEntry(0),
      },
    });
    assert.deepStrictEqual(
      getEligibleZeroCostDiscardCards(state, '0'),
      ['zero-a', 'pile-wound', 'zero-b'],
      'eligible list must hold exactly the 0-cost cards in discard order (missing-entry Wound included)',
    );
  });

  it('returns empty for an unknown player and for an all-positive-cost discard', () => {
    const state = makeTestGameState({
      discard: ['costly-a'] as CardExtId[],
      cardStats: { 'costly-a': statEntry(3) },
    });
    assert.deepStrictEqual(getEligibleZeroCostDiscardCards(state, '9'), []);
    assert.deepStrictEqual(getEligibleZeroCostDiscardCards(state, '0'), []);
  });
});

describe('hasPendingReturnZeroCostDiscard predicate', () => {
  it('returns false when the queue is undefined', () => {
    const state = makeTestGameState();
    assert.equal(hasPendingReturnZeroCostDiscard(state), false);
  });

  it('returns false when the queue is empty', () => {
    const state = makeTestGameState({ pendingReturnZeroCostDiscard: [] });
    assert.equal(hasPendingReturnZeroCostDiscard(state), false);
  });

  it('returns true when at least one choice is queued', () => {
    const state = makeTestGameState({
      pendingReturnZeroCostDiscard: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    assert.equal(hasPendingReturnZeroCostDiscard(state), true);
  });
});

describe('resolveReturnZeroCostDiscard — return a card', () => {
  it('moves the chosen 0-cost card from discard to hand, logs, and front-pops the queue', () => {
    const state = makeTestGameState({
      hand: ['already-in-hand'] as CardExtId[],
      discard: ['costly-a', 'zero-a', 'zero-b'] as CardExtId[],
      cardStats: {
        'costly-a': statEntry(3),
        'zero-a': statEntry(0),
        'zero-b': statEntry(0),
      },
      pendingReturnZeroCostDiscard: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    resolveReturnZeroCostDiscard(makeMoveContext(state), { cardId: 'zero-a' as CardExtId });

    assert.deepStrictEqual(state.playerZones['0']!.discard, ['costly-a', 'zero-b'],
      'exactly the chosen occurrence leaves the discard pile');
    assert.deepStrictEqual(state.playerZones['0']!.hand, ['already-in-hand', 'zero-a'],
      'the chosen card is appended to the hand');
    assert.equal(state.pendingReturnZeroCostDiscard!.length, 0, 'the front entry is popped');
    assert.match(state.messages[state.messages.length - 1]!, /returned .*zero-a.* from their discard pile to their hand/,
      'the return must be observable in the game log');
  });

  it('removes exactly ONE occurrence when the discard holds duplicates', () => {
    const state = makeTestGameState({
      discard: ['starting-shield-agent', 'starting-shield-agent'] as CardExtId[],
      cardStats: { 'starting-shield-agent': statEntry(0) },
      pendingReturnZeroCostDiscard: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    resolveReturnZeroCostDiscard(makeMoveContext(state), { cardId: 'starting-shield-agent' as CardExtId });

    assert.deepStrictEqual(state.playerZones['0']!.discard, ['starting-shield-agent'],
      'only the first occurrence is removed');
    assert.deepStrictEqual(state.playerZones['0']!.hand, ['starting-shield-agent']);
    assert.equal(state.pendingReturnZeroCostDiscard!.length, 0);
  });

  it('returns a MISSING-cardStats card (the Wound case) — 0-cost by the engine-wide convention', () => {
    const state = makeTestGameState({
      discard: ['pile-wound'] as CardExtId[],
      pendingReturnZeroCostDiscard: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    resolveReturnZeroCostDiscard(makeMoveContext(state), { cardId: 'pile-wound' as CardExtId });

    assert.deepStrictEqual(state.playerZones['0']!.hand, ['pile-wound']);
    assert.equal(state.pendingReturnZeroCostDiscard!.length, 0);
  });
});

describe('resolveReturnZeroCostDiscard — no-op guards (queue intact, no zone change)', () => {
  /** Asserts state is unchanged except that nothing moved and the queue still holds one entry. */
  function assertUntouched(state: LegendaryGameState, discardBefore: CardExtId[], handBefore: CardExtId[]): void {
    assert.deepStrictEqual(state.playerZones['0']!.discard, discardBefore, 'discard unchanged');
    assert.deepStrictEqual(state.playerZones['0']!.hand, handBefore, 'hand unchanged');
    assert.equal(state.pendingReturnZeroCostDiscard!.length, 1, 'queue intact for resubmit');
  }

  it('a NON-0-cost target is rejected (never a legal target for this ability)', () => {
    const state = makeTestGameState({
      discard: ['costly-a', 'zero-a'] as CardExtId[],
      cardStats: { 'costly-a': statEntry(3), 'zero-a': statEntry(0) },
      pendingReturnZeroCostDiscard: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    resolveReturnZeroCostDiscard(makeMoveContext(state), { cardId: 'costly-a' as CardExtId });
    assertUntouched(state, ['costly-a', 'zero-a'] as CardExtId[], []);
  });

  it('a card absent from the discard pile is a stale-target no-op', () => {
    const state = makeTestGameState({
      discard: ['zero-a'] as CardExtId[],
      cardStats: { 'zero-a': statEntry(0), 'zero-ghost': statEntry(0) },
      pendingReturnZeroCostDiscard: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    resolveReturnZeroCostDiscard(makeMoveContext(state), { cardId: 'zero-ghost' as CardExtId });
    assertUntouched(state, ['zero-a'] as CardExtId[], []);
  });

  it('a wrong-player submission is a no-op', () => {
    const state = makeTestGameState({
      discard: ['zero-a'] as CardExtId[],
      cardStats: { 'zero-a': statEntry(0) },
      pendingReturnZeroCostDiscard: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    // why: player '1' has no zones in this fixture, but the front.playerID
    // mismatch rejects the move before any zone access.
    resolveReturnZeroCostDiscard(makeMoveContext(state, '1'), { cardId: 'zero-a' as CardExtId });
    assertUntouched(state, ['zero-a'] as CardExtId[], []);
  });

  it('a malformed payload (no cardId — including a decline-style shape) is a no-op: the choice is MANDATORY', () => {
    const state = makeTestGameState({
      discard: ['zero-a'] as CardExtId[],
      cardStats: { 'zero-a': statEntry(0) },
      pendingReturnZeroCostDiscard: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    resolveReturnZeroCostDiscard(makeMoveContext(state), { decline: true } as never);
    resolveReturnZeroCostDiscard(makeMoveContext(state), {} as never);
    resolveReturnZeroCostDiscard(makeMoveContext(state), { cardId: '' } as never);
    assertUntouched(state, ['zero-a'] as CardExtId[], []);
  });

  it('an empty / undefined queue is a no-op', () => {
    const state = makeTestGameState({
      discard: ['zero-a'] as CardExtId[],
      cardStats: { 'zero-a': statEntry(0) },
    });
    resolveReturnZeroCostDiscard(makeMoveContext(state), { cardId: 'zero-a' as CardExtId });
    assert.deepStrictEqual(state.playerZones['0']!.discard, ['zero-a']);
    assert.deepStrictEqual(state.playerZones['0']!.hand, []);
  });

  it('JSON.stringify(G) succeeds after a resolve (no functions leak into G)', () => {
    const state = makeTestGameState({
      discard: ['zero-a'] as CardExtId[],
      cardStats: { 'zero-a': statEntry(0) },
      pendingReturnZeroCostDiscard: [{ playerID: '0', sourceCardId: 'src' as CardExtId }],
    });
    resolveReturnZeroCostDiscard(makeMoveContext(state), { cardId: 'zero-a' as CardExtId });
    assert.doesNotThrow(() => JSON.stringify(state));
  });
});
