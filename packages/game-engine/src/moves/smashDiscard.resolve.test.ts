/**
 * Tests for the resolveSmashDiscard move (WP-676 / D-24492), the hasPendingSmashDiscard
 * predicate, and the block-all guard that freezes the board while a Smash
 * discard-for-attack choice is pending.
 *
 * Covers: discard-from-hand → +N Attack + front-pop; decline → pop, no discard, no
 * Attack; invalid card (not in hand) → no-op (queue intact, never throws); invalid arg
 * shapes; wrong playerID; illegal with no parked choice; the two-entry FIFO (Hurl Trucks:
 * two "Smash 2" → +0/+2/+4); the block-all guard (drawCards no-ops while pending).
 *
 * Covers AC per WP-676 / EC-713. Uses node:test + node:assert only.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSmashDiscard,
  hasPendingSmashDiscard,
  getEligibleSmashDiscardCards,
} from './smashDiscard.resolve.js';
import { drawCards } from './coreMoves.impl.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import type { LegendaryGameState, PendingSmashDiscard } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/**
 * Creates a minimal LegendaryGameState for testing the Smash discard-for-attack flow.
 *
 * @param overrides - Selective overrides for player "0" zones, the pending Smash queue,
 *   the starting turn economy, and current stage.
 */
function makeTestGameState(
  overrides: {
    hand?: CardExtId[];
    discard?: CardExtId[];
    deck?: CardExtId[];
    attack?: number;
    pendingSmashDiscards?: PendingSmashDiscard[];
    currentStage?: LegendaryGameState['currentStage'];
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
      attack: overrides.attack ?? 0,
      recruit: 0,
      spentAttack: 0,
      spentRecruit: 0,
      piercing: 0,
      woundsDrawn: 0,
    },
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

  if (overrides.pendingSmashDiscards !== undefined) {
    state.pendingSmashDiscards = overrides.pendingSmashDiscards;
  }
  return state;
}

/** Builds a move context for the move under test (with event spies). */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveSmashDiscard>[0] {
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
  } as unknown as Parameters<typeof resolveSmashDiscard>[0];
}

/** A pending Smash choice for player "0" granting +magnitude Attack. */
const smashPending = (magnitude = 2, playerID = '0'): PendingSmashDiscard => ({
  playerID,
  magnitude,
});

describe('resolveSmashDiscard — discard arm (WP-676 / D-24492)', () => {
  it('discards the chosen hand card and grants exactly +magnitude Attack, then pops', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId, 'card-b' as CardExtId],
      attack: 3,
      pendingSmashDiscards: [smashPending(2)],
    });
    const context = makeMoveContext(gameState);

    resolveSmashDiscard(context, { cardId: 'card-a' as CardExtId });

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['card-b'], 'chosen card left the hand');
    assert.deepStrictEqual(gameState.playerZones['0']!.discard, ['card-a'], 'chosen card moved to discard');
    assert.equal(gameState.turnEconomy.attack, 5, '+2 Attack granted (3 → 5)');
    assert.equal(gameState.pendingSmashDiscards!.length, 0, 'queue front-popped');
  });

  it('grants the entry magnitude, not a fixed value (magnitude 4)', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId],
      attack: 0,
      pendingSmashDiscards: [smashPending(4)],
    });
    const context = makeMoveContext(gameState);

    resolveSmashDiscard(context, { cardId: 'card-a' as CardExtId });

    assert.equal(gameState.turnEconomy.attack, 4, '+4 Attack granted');
    assert.deepStrictEqual(gameState.playerZones['0']!.discard, ['card-a']);
  });

  it('is a no-op (queue intact) when cardId is not in the hand', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId],
      attack: 3,
      pendingSmashDiscards: [smashPending(2)],
    });
    const context = makeMoveContext(gameState);

    resolveSmashDiscard(context, { cardId: 'not-in-hand' as CardExtId });

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['card-a'], 'hand untouched');
    assert.equal(gameState.turnEconomy.attack, 3, 'no Attack granted');
    assert.equal(gameState.pendingSmashDiscards!.length, 1, 'queue intact (resubmit)');
  });
});

describe('resolveSmashDiscard — decline arm (WP-676 / D-24492)', () => {
  it('pops the front entry with no discard and no Attack', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId],
      attack: 3,
      pendingSmashDiscards: [smashPending(2)],
    });
    const context = makeMoveContext(gameState);

    resolveSmashDiscard(context, { decline: true });

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['card-a'], 'hand untouched');
    assert.deepStrictEqual(gameState.playerZones['0']!.discard, [], 'nothing discarded');
    assert.equal(gameState.turnEconomy.attack, 3, 'no Attack granted (the rule is "you MAY discard")');
    assert.equal(gameState.pendingSmashDiscards!.length, 0, 'queue front-popped');
    assert.ok(
      gameState.messages.some((line) => /declined Smash/.test(line.text)),
      'the voluntary decline is logged (parity with the empty-hand "could not Smash" no-op)',
    );
  });
});

describe('resolveSmashDiscard — guards (WP-676 / D-24492)', () => {
  it('is a no-op when no Smash choice is parked', () => {
    const gameState = makeTestGameState({ hand: ['card-a' as CardExtId], attack: 3 });
    const context = makeMoveContext(gameState);

    resolveSmashDiscard(context, { cardId: 'card-a' as CardExtId });

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['card-a'], 'hand untouched');
    assert.equal(gameState.turnEconomy.attack, 3, 'no Attack granted');
  });

  it('is a no-op for a malformed payload (both decline and cardId)', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId],
      attack: 3,
      pendingSmashDiscards: [smashPending(2)],
    });
    const context = makeMoveContext(gameState);

    resolveSmashDiscard(
      context,
      { decline: true, cardId: 'card-a' } as unknown as { decline: true },
    );

    assert.equal(gameState.pendingSmashDiscards!.length, 1, 'queue intact');
    assert.equal(gameState.turnEconomy.attack, 3, 'no Attack granted');
  });

  it('is a no-op when the front entry belongs to another player', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId],
      attack: 3,
      pendingSmashDiscards: [smashPending(2, '1')],
    });
    const context = makeMoveContext(gameState, '0');

    resolveSmashDiscard(context, { cardId: 'card-a' as CardExtId });

    assert.equal(gameState.pendingSmashDiscards!.length, 1, 'queue intact — wrong chooser');
    assert.equal(gameState.turnEconomy.attack, 3, 'no Attack granted');
  });
});

describe('resolveSmashDiscard — two-entry FIFO (Hurl Trucks, +0/+2/+4)', () => {
  it('resolves two Smash-2 entries independently, granting +4 total when both discard', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId, 'card-b' as CardExtId],
      attack: 0,
      pendingSmashDiscards: [smashPending(2), smashPending(2)],
    });
    const context = makeMoveContext(gameState);

    resolveSmashDiscard(context, { cardId: 'card-a' as CardExtId });
    assert.equal(gameState.pendingSmashDiscards!.length, 1, 'first entry popped, one remains');
    assert.equal(gameState.turnEconomy.attack, 2, '+2 from the first discard');

    resolveSmashDiscard(context, { cardId: 'card-b' as CardExtId });
    assert.equal(gameState.pendingSmashDiscards!.length, 0, 'second entry popped');
    assert.equal(gameState.turnEconomy.attack, 4, '+4 total from both discards');
    assert.deepStrictEqual(gameState.playerZones['0']!.discard.sort(), ['card-a', 'card-b']);
  });

  it('grants +0 when both are declined', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId, 'card-b' as CardExtId],
      attack: 0,
      pendingSmashDiscards: [smashPending(2), smashPending(2)],
    });
    const context = makeMoveContext(gameState);

    resolveSmashDiscard(context, { decline: true });
    resolveSmashDiscard(context, { decline: true });

    assert.equal(gameState.pendingSmashDiscards!.length, 0, 'both entries popped');
    assert.equal(gameState.turnEconomy.attack, 0, '+0 total');
    assert.deepStrictEqual(gameState.playerZones['0']!.hand.sort(), ['card-a', 'card-b'], 'hand intact');
  });
});

describe('hasPendingSmashDiscard predicate + getEligibleSmashDiscardCards', () => {
  it('is true with a parked entry, false for [] / absent', () => {
    assert.equal(hasPendingSmashDiscard(makeTestGameState({ pendingSmashDiscards: [smashPending()] })), true);
    assert.equal(hasPendingSmashDiscard(makeTestGameState({ pendingSmashDiscards: [] })), false);
    assert.equal(hasPendingSmashDiscard(makeTestGameState({})), false);
  });

  it('getEligibleSmashDiscardCards returns the whole hand in order', () => {
    const gameState = makeTestGameState({ hand: ['card-a' as CardExtId, 'card-b' as CardExtId] });
    assert.deepStrictEqual(getEligibleSmashDiscardCards(gameState, '0'), ['card-a', 'card-b']);
    assert.deepStrictEqual(getEligibleSmashDiscardCards(gameState, '1'), [], 'unknown player → empty');
  });
});

describe('block-all guard — a parked Smash choice freezes other moves (WP-676 / D-24492)', () => {
  it('drawCards is a no-op while a Smash discard choice is pending', () => {
    const gameState = makeTestGameState({
      hand: ['card-a' as CardExtId],
      deck: ['deck-top' as CardExtId],
      pendingSmashDiscards: [smashPending(2)],
    });
    const context = makeMoveContext(gameState);

    drawCards(context as unknown as Parameters<typeof drawCards>[0]);

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['card-a'], 'no card drawn — board frozen');
    assert.deepStrictEqual(gameState.playerZones['0']!.deck, ['deck-top'], 'deck untouched');
  });
});

// ---------------------------------------------------------------------------
// WP-754 / D-24581 — optional-discard-draw entries ride the Smash queue
// ---------------------------------------------------------------------------

/** A pending "discard a card to draw N" choice for player "0" (reward: 'draw'). */
const discardDrawPending = (magnitude = 1, playerID = '0'): PendingSmashDiscard => ({
  playerID,
  magnitude,
  reward: 'draw',
});

/**
 * Builds a Smash-queue game state with a live cardsDrawn counter (the minimal fixture omits it,
 * a real match seeds it at turn start).
 */
function makeDiscardDrawState(overrides: Parameters<typeof makeTestGameState>[0]): LegendaryGameState {
  const gameState = makeTestGameState(overrides);
  gameState.turnEconomy.cardsDrawn = 0;
  return gameState;
}

describe('resolveSmashDiscard — draw reward (WP-754 / D-24581)', () => {
  it('discards the chosen card, draws one, counts it, and grants no Attack', () => {
    const gameState = makeDiscardDrawState({
      hand: ['card-a' as CardExtId, 'card-b' as CardExtId],
      deck: ['deck-top' as CardExtId, 'deck-second' as CardExtId],
      attack: 3,
      pendingSmashDiscards: [discardDrawPending(1)],
    });

    resolveSmashDiscard(makeMoveContext(gameState), { cardId: 'card-a' as CardExtId });

    const zones = gameState.playerZones['0']!;
    assert.deepStrictEqual(zones.discard, ['card-a'], 'the chosen card was discarded');
    assert.deepStrictEqual(zones.hand, ['card-b', 'deck-top'], 'the deck top was drawn');
    assert.deepStrictEqual(zones.deck, ['deck-second']);
    assert.equal(gameState.turnEconomy.cardsDrawn, 1, 'the realized draw counts toward cardsDrawn');
    assert.equal(gameState.turnEconomy.attack, 3, 'no Attack is granted for a draw reward');
    assert.equal(gameState.pendingSmashDiscards!.length, 0, 'queue front-popped');
    assert.ok(
      gameState.messages.some((line) => line.text.includes('discarded') && line.text.includes('drew 1 card(s)')),
      'the discard-and-draw is logged',
    );
  });

  it('reshuffles the discard (including the just-discarded card) into an empty deck to draw', () => {
    const gameState = makeDiscardDrawState({
      hand: ['card-a' as CardExtId],
      deck: [],
      discard: ['old-discard' as CardExtId],
      pendingSmashDiscards: [discardDrawPending(1)],
    });

    resolveSmashDiscard(makeMoveContext(gameState), { cardId: 'card-a' as CardExtId });

    const zones = gameState.playerZones['0']!;
    // why: the mock Shuffle reverses — the discard ['old-discard', 'card-a'] becomes the deck
    // ['card-a', 'old-discard'], so the draw takes card-a back.
    assert.deepStrictEqual(zones.hand, ['card-a'], 'drew from the reshuffled discard');
    assert.deepStrictEqual(zones.deck, ['old-discard']);
    assert.deepStrictEqual(zones.discard, []);
    assert.equal(gameState.turnEconomy.cardsDrawn, 1);
    assert.equal(gameState.pendingSmashDiscards!.length, 0);
  });

  it('under the draw lock, the discard stands but the draw is blocked and not counted', () => {
    const gameState = makeDiscardDrawState({
      hand: ['card-a' as CardExtId],
      deck: ['deck-top' as CardExtId],
      pendingSmashDiscards: [discardDrawPending(1)],
    });
    gameState.turnEconomy.drawsLocked = true;

    resolveSmashDiscard(makeMoveContext(gameState), { cardId: 'card-a' as CardExtId });

    const zones = gameState.playerZones['0']!;
    assert.deepStrictEqual(zones.discard, ['card-a'], 'the discard still applied');
    assert.deepStrictEqual(zones.hand, [], 'nothing drawn');
    assert.deepStrictEqual(zones.deck, ['deck-top'], 'deck untouched');
    assert.equal(gameState.turnEconomy.cardsDrawn, 0, 'a blocked draw is not counted');
    assert.equal(gameState.pendingSmashDiscards!.length, 0, 'the choice still resolves');
    assert.ok(gameState.messages.some((line) => line.text.includes("can't draw")), 'the block is logged');
  });

  it('decline pops the entry with no discard and no draw', () => {
    const gameState = makeDiscardDrawState({
      hand: ['card-a' as CardExtId],
      deck: ['deck-top' as CardExtId],
      pendingSmashDiscards: [discardDrawPending(1)],
    });

    resolveSmashDiscard(makeMoveContext(gameState), { decline: true });

    const zones = gameState.playerZones['0']!;
    assert.deepStrictEqual(zones.hand, ['card-a']);
    assert.deepStrictEqual(zones.deck, ['deck-top']);
    assert.deepStrictEqual(zones.discard, []);
    assert.equal(gameState.turnEconomy.cardsDrawn, 0);
    assert.equal(gameState.pendingSmashDiscards!.length, 0);
    assert.ok(
      gameState.messages.some((line) => line.text.includes('declined to discard a card, so no card was drawn')),
      'the decline is logged in draw terms, not Smash terms',
    );
  });

  it('a Smash entry behind a draw entry still grants Attack and draws nothing', () => {
    const gameState = makeDiscardDrawState({
      hand: ['card-a' as CardExtId, 'card-b' as CardExtId],
      deck: ['deck-top' as CardExtId, 'deck-second' as CardExtId],
      pendingSmashDiscards: [discardDrawPending(1), smashPending(2)],
    });

    resolveSmashDiscard(makeMoveContext(gameState), { cardId: 'card-a' as CardExtId });
    resolveSmashDiscard(makeMoveContext(gameState), { cardId: 'card-b' as CardExtId });

    const zones = gameState.playerZones['0']!;
    assert.deepStrictEqual(zones.hand, ['deck-top'], 'only the draw entry drew');
    assert.equal(gameState.turnEconomy.attack, 2, 'the Smash entry granted +2 Attack');
    assert.equal(gameState.turnEconomy.cardsDrawn, 1);
    assert.equal(gameState.pendingSmashDiscards!.length, 0);
  });
});

describe('bot default for a draw-reward entry (WP-754 / D-24581)', () => {
  const lifecycle = { phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 1 };

  it('declines under the draw lock (a discard with no draw is pure loss)', () => {
    const gameState = makeDiscardDrawState({ hand: ['card-a' as CardExtId], pendingSmashDiscards: [discardDrawPending(1)] });
    gameState.turnEconomy.drawsLocked = true;
    assert.deepStrictEqual(getLegalMoves(gameState, lifecycle), [{ name: 'resolveSmashDiscard', args: { decline: true } }]);
  });

  it('discards the default target when draws are not locked', () => {
    const gameState = makeDiscardDrawState({ hand: ['card-a' as CardExtId], pendingSmashDiscards: [discardDrawPending(1)] });
    assert.deepStrictEqual(getLegalMoves(gameState, lifecycle), [{ name: 'resolveSmashDiscard', args: { cardId: 'card-a' } }]);
  });

  it('a Smash entry under the draw lock still discards for Attack (the lock only blocks draws)', () => {
    const gameState = makeDiscardDrawState({ hand: ['card-a' as CardExtId], pendingSmashDiscards: [smashPending(2)] });
    gameState.turnEconomy.drawsLocked = true;
    assert.deepStrictEqual(getLegalMoves(gameState, lifecycle), [{ name: 'resolveSmashDiscard', args: { cardId: 'card-a' } }]);
  });
});
