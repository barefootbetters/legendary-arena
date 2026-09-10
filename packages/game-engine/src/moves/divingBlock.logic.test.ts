/**
 * Tests for Captain America's Diving Block — reactive wound interception at the
 * gainWoundForPlayer chokepoint (WP-682 / EC-719 / D-24499).
 *
 * Covers: revealing prevents exactly one Wound + draws a card + KEEPS Diving Block in
 * hand; declining lands the Wound; two simultaneous Wounds need two reveals (two waves);
 * the interception fires for a NON-hero wound source (the chokepoint is uniform); the
 * one-copy-per-Wound gate; and a NON-ACTIVE seat is the addressed wound recipient.
 * node:test + node:assert only — no boardgame.io/testing import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cardCarriesDivingBlock,
  countDivingBlockCopiesInHand,
  checkDivingBlock,
  hasPendingDivingBlockWounds,
  openDivingBlockSeatChoiceIfNeeded,
  DIVING_BLOCK_SEAT_CHOICE_KIND,
} from './divingBlock.logic.js';
import { gainWoundForPlayer } from '../board/wounds.logic.js';
import { resolveSeatChoice } from './seatChoice.resolve.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import type { LegendaryGameState } from '../types.js';

const DIVING_BLOCK_ID = 'core/captain-america/diving-block#0';
const OTHER_CARD_ID = 'core/spider-man/web-shooters#0';

/** Identity Shuffle so the reveal draw is deterministic in tests. */
const IDENTITY_RANDOM = { Shuffle: <T,>(deck: T[]): T[] => [...deck] };

/**
 * Minimal G carrying just the fields the wound chokepoint + Diving Block paths touch.
 * Each named player gets a deck to draw from; the wounds supply is seeded with N wounds.
 */
function makeState(options: {
  hands: Record<string, string[]>;
  decks?: Record<string, string[]>;
  woundCount: number;
}): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  for (const seat of Object.keys(options.hands)) {
    playerZones[seat] = {
      deck: options.decks?.[seat] ?? [`${seat}-deckcard#0`],
      hand: [...options.hands[seat]!],
      discard: [],
      victory: [],
      inPlay: [],
    };
  }
  const wounds: string[] = [];
  for (let i = 0; i < options.woundCount; i++) {
    wounds.push(WOUND_EXT_ID);
  }
  return {
    playerZones,
    piles: { bystanders: [], wounds, officers: [], sidekicks: [] },
    heroAbilityHooks: [
      { cardId: DIVING_BLOCK_ID, timing: 'onPlay', keywords: ['diving-block'] },
    ],
    turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0, cardsDrawn: 0 },
    messages: [],
    cardDisplayData: {},
  } as unknown as LegendaryGameState;
}

/** A move context whose only live fields are G + playerID + random. */
function makeContext(G: LegendaryGameState, playerID: string): Parameters<typeof resolveSeatChoice>[0] {
  return { G, playerID, ctx: {}, events: {}, random: IDENTITY_RANDOM, log: {} } as unknown as Parameters<typeof resolveSeatChoice>[0];
}

describe('Diving Block — keyword detection + copy count (WP-682 / D-24499)', () => {
  it('cardCarriesDivingBlock is true only for a diving-block hook card', () => {
    const G = makeState({ hands: { '0': [DIVING_BLOCK_ID] }, woundCount: 1 });
    assert.equal(cardCarriesDivingBlock(G, DIVING_BLOCK_ID), true);
    assert.equal(cardCarriesDivingBlock(G, OTHER_CARD_ID), false);
  });

  it('countDivingBlockCopiesInHand counts only Diving Block cards in hand', () => {
    const G = makeState({ hands: { '0': [DIVING_BLOCK_ID, OTHER_CARD_ID, DIVING_BLOCK_ID] }, woundCount: 3 });
    assert.equal(countDivingBlockCopiesInHand(G, '0'), 2);
  });
});

describe('Diving Block — chokepoint parks a pending interception (WP-682 / D-24499)', () => {
  it('gainWoundForPlayer lands the Wound AND parks a pending Diving-Block interception for a holder', () => {
    const G = makeState({ hands: { '0': [DIVING_BLOCK_ID] }, woundCount: 1 });
    const woundId = gainWoundForPlayer(G, '0');
    assert.equal(woundId, WOUND_EXT_ID);
    // The Wound landed in discard first (land-then-offer-undo).
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(hasPendingDivingBlockWounds(G), true);
    assert.equal(G.pendingDivingBlockWounds!.length, 1);
    assert.equal(G.pendingDivingBlockWounds![0]!.playerID, '0');
  });

  it('does NOT park for a player who holds no Diving Block (default wound-to-discard unchanged)', () => {
    const G = makeState({ hands: { '0': [OTHER_CARD_ID] }, woundCount: 1 });
    gainWoundForPlayer(G, '0');
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(hasPendingDivingBlockWounds(G), false);
  });

  it('one-copy-per-Wound gate: one copy in hand + two Wounds parks only ONE interception', () => {
    const G = makeState({ hands: { '0': [DIVING_BLOCK_ID] }, woundCount: 2 });
    gainWoundForPlayer(G, '0');
    gainWoundForPlayer(G, '0');
    assert.equal(G.pendingDivingBlockWounds!.length, 1);
    // Both Wounds landed; only one is interceptable.
    assert.equal(G.playerZones['0']!.discard.filter((c) => c === WOUND_EXT_ID).length, 2);
  });

  it('fires for a non-hero wound source: checkDivingBlock works from any caller after a wound lands', () => {
    const G = makeState({ hands: { '0': [DIVING_BLOCK_ID] }, woundCount: 1 });
    // Simulate a villain/scheme wound landing directly, then the chokepoint reaction.
    G.piles.wounds = G.piles.wounds.slice(1);
    G.playerZones['0']!.discard = [WOUND_EXT_ID];
    checkDivingBlock(G, '0', WOUND_EXT_ID);
    assert.equal(hasPendingDivingBlockWounds(G), true);
  });
});

describe('Diving Block — reveal / decline resolution (WP-682 / D-24499)', () => {
  it('reveal prevents the Wound (returned to supply), draws a card, and KEEPS Diving Block in hand', () => {
    const G = makeState({ hands: { '0': [DIVING_BLOCK_ID] }, decks: { '0': ['draw-card#0'] }, woundCount: 1 });
    gainWoundForPlayer(G, '0');
    openDivingBlockSeatChoiceIfNeeded(G, undefined);
    assert.equal(G.pendingSeatChoice!.kind, DIVING_BLOCK_SEAT_CHOICE_KIND);
    assert.deepEqual(G.pendingSeatChoice!.addressedSeats, ['0']);

    // Option 0 = reveal.
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 0 });

    // Wound returned to the supply; discard no longer holds it.
    assert.equal(G.playerZones['0']!.discard.includes(WOUND_EXT_ID), false);
    assert.equal(G.piles.wounds.length, 1);
    // Drew a card (the deck card moved to hand).
    assert.equal(G.playerZones['0']!.hand.includes('draw-card#0'), true);
    // Diving Block STAYS in hand — never played or discarded.
    assert.equal(G.playerZones['0']!.hand.includes(DIVING_BLOCK_ID), true);
    // FIFO drained; choice cleared.
    assert.equal(hasPendingDivingBlockWounds(G), false);
    assert.equal(G.pendingSeatChoice, undefined);
  });

  it('decline lands the Wound (stays in discard), draws nothing, keeps Diving Block in hand', () => {
    const G = makeState({ hands: { '0': [DIVING_BLOCK_ID] }, decks: { '0': ['draw-card#0'] }, woundCount: 1 });
    gainWoundForPlayer(G, '0');
    openDivingBlockSeatChoiceIfNeeded(G, undefined);

    // Option 1 = decline.
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 1 });

    assert.deepEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID]);
    assert.equal(G.playerZones['0']!.hand.includes('draw-card#0'), false);
    assert.equal(G.playerZones['0']!.hand.includes(DIVING_BLOCK_ID), true);
    assert.equal(hasPendingDivingBlockWounds(G), false);
  });

  it('two simultaneous Wounds need two reveals: two copies → two waves → both prevented', () => {
    const G = makeState({
      hands: { '0': [DIVING_BLOCK_ID, DIVING_BLOCK_ID] },
      decks: { '0': ['draw-a#0', 'draw-b#0'] },
      woundCount: 2,
    });
    gainWoundForPlayer(G, '0');
    gainWoundForPlayer(G, '0');
    // Two copies + two Wounds → two pending interceptions.
    assert.equal(G.pendingDivingBlockWounds!.length, 2);

    // Wave 1.
    openDivingBlockSeatChoiceIfNeeded(G, undefined);
    assert.equal(G.pendingSeatChoice!.kind, DIVING_BLOCK_SEAT_CHOICE_KIND);
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 0 });
    assert.equal(G.pendingSeatChoice, undefined);
    assert.equal(G.pendingDivingBlockWounds!.length, 1);

    // Wave 2 (re-opened as onMove would).
    openDivingBlockSeatChoiceIfNeeded(G, undefined);
    assert.equal(G.pendingSeatChoice!.kind, DIVING_BLOCK_SEAT_CHOICE_KIND);
    resolveSeatChoice(makeContext(G, '0'), { optionIndex: 0 });

    // Both Wounds prevented (returned to supply), both cards drawn.
    assert.equal(G.playerZones['0']!.discard.filter((c) => c === WOUND_EXT_ID).length, 0);
    assert.equal(G.piles.wounds.length, 2);
    assert.equal(hasPendingDivingBlockWounds(G), false);
  });

  it('addresses a NON-ACTIVE seat: a Master-Strike-style wound to seat 1 while seat 0 is active', () => {
    const G = makeState({
      hands: { '0': [], '1': [DIVING_BLOCK_ID] },
      decks: { '1': ['draw-1#0'] },
      woundCount: 1,
    });
    // Seat 1 (non-active) gains the Wound and holds Diving Block.
    gainWoundForPlayer(G, '1');
    openDivingBlockSeatChoiceIfNeeded(G, undefined);
    assert.deepEqual(G.pendingSeatChoice!.addressedSeats, ['1']);

    // Seat 1 reveals and is served even though seat 0 is the active player.
    resolveSeatChoice(makeContext(G, '1'), { optionIndex: 0 });
    assert.equal(G.playerZones['1']!.hand.includes('draw-1#0'), true);
    assert.equal(G.playerZones['1']!.discard.includes(WOUND_EXT_ID), false);
  });
});
