/**
 * Tests for the resolveRevealThreeAssign move (WP-753 / D-24580), the
 * hasPendingRevealThreeAssign block-all predicate, and the
 * selectDefaultRevealThreeAssignment bot default.
 *
 * Covers: each disposition (draw → hand, discard → discard pile, KO → KO pile); each slot is
 * usable once and the entry front-pops once its cards are all assigned; a 2-card reveal
 * completes after two assignments; a realized draw counts toward turnEconomy.cardsDrawn while a
 * draw-locked draw and a stale drop do not; a cardsDrawnThisTurnAtLeast wait-and-see grant fires
 * on the move after a resolve-draw crosses its threshold; the draw lock leaves the card on the
 * deck; a stale card is dropped with its slot; the repeat re-reveal after the last assignment
 * (with top-up, and front-pop on an empty re-reveal); illegal submissions are silent no-ops;
 * block-all; the bot default order.
 *
 * Uses node:test + node:assert only. No boardgame.io testing imports.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRevealThreeAssign,
  hasPendingRevealThreeAssign,
  selectDefaultRevealThreeAssignment,
} from './revealThreeAssign.resolve.js';
import { playCard, endTurn } from './coreMoves.impl.js';
import { executeHeroEffects, resolveDeferredHeroGrants } from '../hero/heroEffects.execute.js';
import type { LegendaryGameState, PendingRevealThreeAssign } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import {
  makeCardStatEntry,
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

const WOUND = 'pile-wound' as CardExtId;
const AGENT = 'starting-shield-agent' as CardExtId;
const CARD_A = 'core/spider-man/web-shooters#0' as CardExtId;
const CARD_B = 'core/iron-man/repulsor-rays#0' as CardExtId;
const CARD_C = 'core/hulk/unstoppable-hulk#0' as CardExtId;
const CARD_D = 'core/thor/odinson#0' as CardExtId;
const SOURCE = 'vnom/venomized-dr-strange/crystal-of-kadavus#0' as CardExtId;

/**
 * Builds a minimal single-player state for the reveal-three flow.
 *
 * @param overrides - player 0's zones, the pending queue, and the draw-lock flag.
 * @returns A minimal LegendaryGameState.
 */
function makeTestGameState(
  overrides: {
    deck?: CardExtId[];
    hand?: CardExtId[];
    discard?: CardExtId[];
    inPlay?: CardExtId[];
    pending?: PendingRevealThreeAssign[];
    drawsLocked?: boolean;
    heroAbilityHooks?: HeroAbilityHook[];
  } = {},
): LegendaryGameState {
  const turnEconomy = makeTurnEconomy();
  if (overrides.drawsLocked === true) {
    turnEconomy.drawsLocked = true;
  }
  const state = {
    currentStage: 'main',
    playerZones: {
      '0': makePlayerZones({
        deck: overrides.deck ?? [],
        hand: overrides.hand ?? [],
        discard: overrides.discard ?? [],
        inPlay: overrides.inPlay ?? [],
      }),
    },
    piles: makeGlobalPiles(),
    messages: [],
    counters: {},
    hookRegistry: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    turnEconomy,
    cardStats: {
      [CARD_A]: makeCardStatEntry({ cost: 3 }),
      [CARD_B]: makeCardStatEntry({ cost: 6 }),
      [CARD_C]: makeCardStatEntry({ cost: 6 }),
      [CARD_D]: makeCardStatEntry({ cost: 8 }),
    },
    cardKeywords: {},
    mastermind: makeMastermindState(),
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    cardDisplayData: {},
    cardTraits: {},
    heroAbilityHooks: overrides.heroAbilityHooks ?? [],
  } as unknown as LegendaryGameState;
  if (overrides.pending !== undefined) {
    state.pendingRevealThreeAssign = overrides.pending;
  }
  return state;
}

/** Builds a move context for the move under test (Shuffle reverses — proves it ran). */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveRevealThreeAssign>[0] {
  return {
    G: gameState,
    ctx: {
      numPlayers: 1,
      currentPlayer: playerId,
      phase: 'play',
      turn: 1,
      playOrder: ['0'],
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
  } as unknown as Parameters<typeof resolveRevealThreeAssign>[0];
}

/**
 * Builds a fresh pending entry for player 0 with all three slots open.
 *
 * @param revealedCardIds - The revealed snapshot.
 * @param remainingRepeats - Repeats owed after this reveal.
 * @returns The entry.
 */
function makeEntry(revealedCardIds: CardExtId[], remainingRepeats: number = 0): PendingRevealThreeAssign {
  return {
    choiceType: 'reveal-three-assign',
    playerID: '0',
    sourceCardId: SOURCE,
    revealedCardIds: [...revealedCardIds],
    availableDispositions: ['draw', 'discard', 'ko'],
    remainingRepeats,
  };
}

describe('resolveRevealThreeAssign (WP-753 / D-24580)', () => {
  it("'draw' moves the card deck → hand and counts one realized draw", () => {
    const G = makeTestGameState({ deck: [CARD_A, CARD_B, CARD_C, CARD_D], pending: [makeEntry([CARD_A, CARD_B, CARD_C])] });
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_B, disposition: 'draw' });
    assert.deepEqual(G.playerZones['0']!.hand, [CARD_B]);
    assert.deepEqual(G.playerZones['0']!.deck, [CARD_A, CARD_C, CARD_D]);
    assert.equal(G.turnEconomy.cardsDrawn, 1, 'a printed draw counts');
    assert.deepEqual(G.pendingRevealThreeAssign![0]!.revealedCardIds, [CARD_A, CARD_C]);
    assert.deepEqual(G.pendingRevealThreeAssign![0]!.availableDispositions, ['discard', 'ko'], 'the draw slot is spent');
  });

  it("'discard' moves the card deck → discard; 'ko' moves it to the KO pile; the entry front-pops after three", () => {
    const G = makeTestGameState({ deck: [CARD_A, CARD_B, CARD_C, CARD_D], pending: [makeEntry([CARD_A, CARD_B, CARD_C])] });
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_A, disposition: 'discard' });
    assert.deepEqual(G.playerZones['0']!.discard, [CARD_A]);
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_C, disposition: 'ko' });
    assert.deepEqual(G.ko, [CARD_C]);
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_B, disposition: 'draw' });
    assert.deepEqual(G.playerZones['0']!.hand, [CARD_B]);
    assert.deepEqual(G.playerZones['0']!.deck, [CARD_D], 'only the unrevealed card remains');
    assert.deepEqual(G.pendingRevealThreeAssign, [], 'the entry front-popped');
    assert.equal(hasPendingRevealThreeAssign(G), false);
  });

  it('a spent disposition is a silent no-op (each disposition usable once)', () => {
    const G = makeTestGameState({ deck: [CARD_A, CARD_B, CARD_C], pending: [makeEntry([CARD_A, CARD_B, CARD_C])] });
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_A, disposition: 'ko' });
    const before = JSON.stringify(G.pendingRevealThreeAssign);
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_B, disposition: 'ko' });
    assert.equal(JSON.stringify(G.pendingRevealThreeAssign), before, 'queue byte-identical');
    assert.deepEqual(G.ko, [CARD_A], 'nothing else KOd');
  });

  it('a 2-card reveal completes after any two assignments (the unused slot is discarded)', () => {
    const G = makeTestGameState({ deck: [CARD_A, CARD_B], pending: [makeEntry([CARD_A, CARD_B])] });
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_A, disposition: 'ko' });
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_B, disposition: 'discard' });
    assert.deepEqual(G.pendingRevealThreeAssign, [], 'complete — no draw forced');
    assert.deepEqual(G.playerZones['0']!.hand, []);
  });

  it('the draw lock leaves the card on the deck, logs [blocked], consumes the slot and counts nothing (D-24552)', () => {
    const G = makeTestGameState({ deck: [CARD_A, CARD_B, CARD_C], pending: [makeEntry([CARD_A, CARD_B, CARD_C])], drawsLocked: true });
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_A, disposition: 'draw' });
    assert.deepEqual(G.playerZones['0']!.hand, [], 'no card drawn');
    assert.deepEqual(G.playerZones['0']!.deck, [CARD_A, CARD_B, CARD_C], 'the card stays on the deck');
    assert.equal(G.turnEconomy.cardsDrawn, 0, 'a blocked draw is not counted');
    assert.deepEqual(G.pendingRevealThreeAssign![0]!.availableDispositions, ['discard', 'ko'], 'the draw slot is consumed');
    assert.deepEqual(G.pendingRevealThreeAssign![0]!.revealedCardIds, [CARD_B, CARD_C]);
    const lastLine = G.messages[G.messages.length - 1]!;
    assert.equal(lastLine.outcome, 'blocked');
    assert.match(lastLine.text, /can't draw/);
  });

  it('a stale card (already moved off the deck top) is dropped with the submitted slot, never looped', () => {
    const G = makeTestGameState({ deck: [CARD_B, CARD_C, CARD_D], discard: [CARD_A], pending: [makeEntry([CARD_A, CARD_B, CARD_C])] });
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_A, disposition: 'draw' });
    assert.deepEqual(G.playerZones['0']!.hand, [], 'nothing drawn');
    assert.deepEqual(G.playerZones['0']!.discard, [CARD_A], 'the moved card stays where the co-effect put it');
    assert.equal(G.turnEconomy.cardsDrawn, 0, 'a stale drop is not counted');
    assert.deepEqual(G.pendingRevealThreeAssign![0]!.revealedCardIds, [CARD_B, CARD_C]);
    assert.deepEqual(G.pendingRevealThreeAssign![0]!.availableDispositions, ['discard', 'ko']);
  });

  it('a stale drop that empties the entry completes it (the empty check runs after a stale step too)', () => {
    const G = makeTestGameState({ deck: [CARD_D], pending: [makeEntry([CARD_A])] });
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_A, disposition: 'ko' });
    assert.deepEqual(G.pendingRevealThreeAssign, [], 'front-popped');
    assert.deepEqual(G.ko, [], 'nothing KOd');
  });

  it('after the last assignment a repeat re-reveals a FRESH top three (remainingRepeats − 1)', () => {
    const G = makeTestGameState({
      deck: [CARD_A, CARD_B, CARD_C, CARD_D],
      discard: [WOUND, AGENT],
      pending: [makeEntry([CARD_A, CARD_B, CARD_C], 1)],
    });
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_A, disposition: 'draw' });
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_B, disposition: 'discard' });
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_C, disposition: 'ko' });

    // why: only CARD_D remained, so the top-up shuffled the discard ([WOUND, AGENT, CARD_B],
    // reversed by the mock Shuffle) beneath it before the fresh snapshot.
    assert.deepEqual(G.playerZones['0']!.deck, [CARD_D, CARD_B, AGENT, WOUND], 'topped up beneath the remaining card');
    assert.equal(G.pendingRevealThreeAssign?.length, 1, 'the front was replaced, not appended');
    assert.deepEqual(G.pendingRevealThreeAssign![0], {
      choiceType: 'reveal-three-assign',
      playerID: '0',
      sourceCardId: SOURCE,
      revealedCardIds: [CARD_D, CARD_B, AGENT],
      availableDispositions: ['draw', 'discard', 'ko'],
      remainingRepeats: 0,
    });
  });

  it('an empty repeat re-reveal (deck + discard exhausted) front-pops', () => {
    const G = makeTestGameState({ deck: [CARD_A], pending: [makeEntry([CARD_A], 1)] });
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_A, disposition: 'draw' });
    assert.deepEqual(G.playerZones['0']!.hand, [CARD_A]);
    assert.deepEqual(G.pendingRevealThreeAssign, [], 'nothing left to reveal — front-popped');
  });

  it('a cardsDrawnThisTurnAtLeast wait-and-see grant fires on the move after a resolve-draw crosses it', () => {
    const gatedHook = {
      cardId: 'gated-hero',
      timing: 'onPlay',
      keywords: ['attack'],
      conditions: [{ type: 'cardsDrawnThisTurnAtLeast', value: '1' }],
      effects: [{ type: 'attack', magnitude: 2 }],
    } as unknown as HeroAbilityHook;
    const G = makeTestGameState({
      deck: [CARD_A, CARD_B, CARD_C],
      inPlay: ['gated-hero' as CardExtId],
      heroAbilityHooks: [gatedHook],
      pending: [makeEntry([CARD_A, CARD_B, CARD_C])],
    });
    const context = makeMoveContext(G);
    executeHeroEffects(G, context, '0', 'gated-hero');
    assert.equal(G.turnEconomy.attack, 0, 'below threshold at play — the grant waits');

    resolveRevealThreeAssign(context, { cardId: CARD_A, disposition: 'draw' });
    // why: the play-phase onMove runs resolveDeferredHeroGrants after every move.
    resolveDeferredHeroGrants(G, context);
    assert.equal(G.turnEconomy.attack, 2, 'the resolve-draw crossed the threshold and the grant fired');
  });

  it('illegal submissions are silent no-ops that leave the queue byte-identical', () => {
    const G = makeTestGameState({ deck: [CARD_A, CARD_B, CARD_C], pending: [makeEntry([CARD_A, CARD_B, CARD_C])] });
    const before = JSON.stringify(G);
    resolveRevealThreeAssign(makeMoveContext(G, '1'), { cardId: CARD_A, disposition: 'draw' });
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_D, disposition: 'draw' });
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: CARD_A, disposition: 'top' as never });
    resolveRevealThreeAssign(makeMoveContext(G), { cardId: '' as CardExtId, disposition: 'draw' });
    assert.equal(JSON.stringify(G), before, 'wrong player / unrevealed card / invalid disposition / empty id → no-op');

    const emptyQueue = makeTestGameState({ deck: [CARD_A] });
    resolveRevealThreeAssign(makeMoveContext(emptyQueue), { cardId: CARD_A, disposition: 'draw' });
    assert.equal(emptyQueue.pendingRevealThreeAssign, undefined, 'no parked choice → no-op');
    assert.deepEqual(emptyQueue.playerZones['0']!.hand, []);
  });

  it('hasPendingRevealThreeAssign reflects the queue state', () => {
    assert.equal(hasPendingRevealThreeAssign(makeTestGameState()), false, 'undefined → false');
    assert.equal(hasPendingRevealThreeAssign(makeTestGameState({ pending: [] })), false, 'empty → false');
    assert.equal(hasPendingRevealThreeAssign(makeTestGameState({ pending: [makeEntry([CARD_A])] })), true);
  });

  it('block-all: playCard and endTurn are no-ops while an assignment is pending', () => {
    const G = makeTestGameState({ deck: [CARD_A], hand: [CARD_B], pending: [makeEntry([CARD_A])] });
    const context = makeMoveContext(G);
    playCard(context as never, { cardId: CARD_B } as never);
    assert.deepEqual(G.playerZones['0']!.hand, [CARD_B], 'playCard was blocked');
    endTurn(context as never);
    assert.equal((context.events.endTurn as unknown as { mock: { callCount: () => number } }).mock.callCount(), 0, 'endTurn was blocked');
    assert.equal(G.pendingRevealThreeAssign?.length, 1, 'the pending choice is untouched');
  });
});

describe('selectDefaultRevealThreeAssignment (WP-753 / D-24580)', () => {
  it('KOs a revealed Wound / basic starter first while the KO slot is open', () => {
    const G = makeTestGameState();
    assert.deepEqual(
      selectDefaultRevealThreeAssignment(G, makeEntry([CARD_A, AGENT, WOUND])),
      { cardId: AGENT, disposition: 'ko' },
    );
  });

  it('otherwise draws the highest-cost revealed card (ties keep revealed order)', () => {
    const G = makeTestGameState();
    assert.deepEqual(
      selectDefaultRevealThreeAssignment(G, makeEntry([CARD_A, CARD_B, CARD_C])),
      { cardId: CARD_B, disposition: 'draw' },
      'CARD_B and CARD_C tie at cost 6 — the earlier one wins',
    );
  });

  it('with draw spent, discards the first remaining card; with only KO left, KOs it', () => {
    const G = makeTestGameState();
    const entry = makeEntry([CARD_A, CARD_C]);
    entry.availableDispositions = ['discard', 'ko'];
    assert.deepEqual(selectDefaultRevealThreeAssignment(G, entry), { cardId: CARD_A, disposition: 'discard' });
    entry.availableDispositions = ['ko'];
    assert.deepEqual(selectDefaultRevealThreeAssignment(G, entry), { cardId: CARD_A, disposition: 'ko' });
  });

  it('returns null for an empty entry', () => {
    assert.equal(selectDefaultRevealThreeAssignment(makeTestGameState(), makeEntry([])), null);
  });
});
