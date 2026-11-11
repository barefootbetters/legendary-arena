/**
 * Tests for Zarathos's shared Haunt reads and Master Strike (WP-758 / D-24588).
 *
 * Covers the highest-cost selector (cost, lowest-index tie, class OR, dual class,
 * haunted and empty slots skipped), the double-haunt guard, the "you have a Hero of
 * class X" read (hand + still-in-play, never the discard pile), and the strike's
 * Wound-before-haunt order with its D-24780 clockwise Wound loop.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  isAnyHqHeroHaunted,
  playerHasHeroOfClasses,
  resolveZarathosStrike,
  selectHighestCostUnhauntedHqIndex,
  zarathosHauntHighestCost,
} from './zarathos.logic.js';
import { isMastermindHaunting } from '../board/haunt.logic.js';

const WOUND: CardExtId = 'pile-wound';

/**
 * Builds a minimal G for the Zarathos helpers: seats, an HQ, a Wound supply, and the
 * stats / traits / names of the test Heroes.
 *
 * @param options - The seats' hands / in-play / discard, the HQ, the haunters and the Wound count.
 * @returns A LegendaryGameState carrying only the fields the helpers read.
 */
function makeZarathosState(options: {
  seats?: Record<string, { hand?: CardExtId[]; inPlay?: CardExtId[]; discard?: CardExtId[] }>;
  hq?: (CardExtId | null)[];
  hqHaunters?: LegendaryGameState['hqHaunters'];
  wounds?: number;
} = {}): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  const seats = options.seats ?? { '0': {} };
  for (const seat of Object.keys(seats)) {
    const zones = seats[seat]!;
    playerZones[seat] = {
      deck: [],
      hand: [...(zones.hand ?? [])],
      discard: [...(zones.discard ?? [])],
      inPlay: [...(zones.inPlay ?? [])],
      victory: [],
    };
  }
  const wounds: CardExtId[] = [];
  for (let index = 0; index < (options.wounds ?? 0); index++) {
    wounds.push(WOUND);
  }
  const state = {
    messages: [],
    playerZones,
    hq: [...(options.hq ?? ['covert3', 'ranged5', 'strength5', 'tech7', 'dual6'])],
    piles: { bystanders: [], wounds },
    cardStats: {
      covert3: { attack: 2, cost: 3 },
      ranged5: { attack: 2, cost: 5 },
      strength5: { attack: 2, cost: 5 },
      tech7: { attack: 3, cost: 7 },
      dual6: { attack: 2, cost: 6 },
      instinct4: { attack: 2, cost: 4 },
    },
    cardTraits: {
      covert3: { heroClass: 'covert', team: null },
      ranged5: { heroClass: 'ranged', team: null },
      strength5: { heroClass: 'strength', team: null },
      tech7: { heroClass: 'tech', team: null },
      dual6: { heroClass: 'tech', heroClass2: 'instinct', team: null },
      instinct4: { heroClass: 'instinct', team: null },
    },
    cardDisplayData: {
      covert3: { name: 'Covert Three' },
      ranged5: { name: 'Ranged Five' },
      strength5: { name: 'Strength Five' },
      tech7: { name: 'Tech Seven' },
      dual6: { name: 'Dual Six' },
    },
    turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, cardsDrawn: 0 },
  } as unknown as LegendaryGameState;
  if (options.hqHaunters !== undefined) {
    state.hqHaunters = options.hqHaunters;
  }
  return state;
}

/** The log text lines, for exact-order assertions. */
function logTexts(G: LegendaryGameState): string[] {
  const texts: string[] = [];
  for (const entry of G.messages) {
    texts.push(typeof entry === 'string' ? entry : entry.text);
  }
  return texts;
}

describe('selectHighestCostUnhauntedHqIndex (WP-758 / D-24588)', () => {
  it('with no class filter picks the highest-cost Hero', () => {
    assert.equal(selectHighestCostUnhauntedHqIndex(makeZarathosState()), 3, 'Tech Seven (cost 7) in slot 3');
  });

  it('a cost tie goes to the lowest HQ index', () => {
    const G = makeZarathosState({ hq: ['covert3', 'strength5', 'ranged5', null, null] });
    assert.equal(selectHighestCostUnhauntedHqIndex(G), 1, 'Strength Five (slot 1) beats Ranged Five (slot 2) on the tie');
  });

  it('a class pair is an OR, and a dual-class Hero matches on either class', () => {
    const G = makeZarathosState();
    assert.equal(selectHighestCostUnhauntedHqIndex(G, ['covert', 'ranged']), 1, 'Ranged Five is the priciest covert-or-ranged Hero');
    assert.equal(selectHighestCostUnhauntedHqIndex(G, ['strength', 'instinct']), 4, 'Dual Six (tech / instinct) matches instinct and beats Strength Five');
  });

  it('skips haunted and empty slots, and returns null with no candidate', () => {
    const G = makeZarathosState({
      hq: ['covert3', null, 'strength5', 'tech7', null],
      hqHaunters: [null, null, null, { kind: 'villain', cardId: 'villain-x' }, null],
    });
    assert.equal(selectHighestCostUnhauntedHqIndex(G), 2, 'the haunted Tech Seven is skipped');
    assert.equal(selectHighestCostUnhauntedHqIndex(G, ['ranged']), null, 'no unhaunted Ranged Hero');
  });
});

describe('zarathosHauntHighestCost (WP-758 / D-24588)', () => {
  it('records a Mastermind haunter on the selected slot and logs it', () => {
    const G = makeZarathosState();
    assert.equal(zarathosHauntHighestCost(G, 'Eruption of Hellfire', ['covert', 'ranged']), true);
    assert.deepStrictEqual(G.hqHaunters, [null, { kind: 'mastermind' }, null, null, null]);
    assert.deepStrictEqual(logTexts(G), ['Zarathos haunts Ranged Five in HQ slot 1 (Eruption of Hellfire).']);
  });

  it('is a logged no-op while Zarathos already haunts, so there is never a second Mastermind haunter', () => {
    const G = makeZarathosState({ hqHaunters: [{ kind: 'mastermind' }, null, null, null, null] });
    assert.equal(zarathosHauntHighestCost(G, 'Zarathos Master Strike'), false);
    assert.deepStrictEqual(G.hqHaunters, [{ kind: 'mastermind' }, null, null, null, null], 'unchanged');
    assert.deepStrictEqual(logTexts(G), ['Zarathos is already haunting a Hero, so he haunts no other (Zarathos Master Strike).']);
  });

  it('with no Hero of the class pair, haunts nothing and logs the no-op', () => {
    const G = makeZarathosState({ hq: ['tech7', null, null, null, null] });
    assert.equal(zarathosHauntHighestCost(G, 'Imprison in the Soul Crystal', ['strength', 'instinct']), false);
    assert.equal(G.hqHaunters, undefined, 'hqHaunters stays absent (lazy creation)');
    assert.equal(G.messages.length, 1);
    assert.equal((G.messages[0] as { outcome?: string }).outcome, 'blocked');
  });
});

describe('playerHasHeroOfClasses (WP-758 / D-24588)', () => {
  it('reads the hand and the cards still in play, never the discard pile', () => {
    const G = makeZarathosState({
      seats: {
        '0': { hand: ['covert3'] },
        '1': { inPlay: ['strength5'] },
        '2': { discard: ['ranged5'] },
      },
    });
    assert.equal(playerHasHeroOfClasses(G, '0', ['covert']), true, 'a hand Hero counts');
    assert.equal(playerHasHeroOfClasses(G, '1', ['strength', 'instinct']), true, 'a played Hero counts');
    assert.equal(playerHasHeroOfClasses(G, '2', ['ranged']), false, 'a discard-pile Hero does not count (rules v23 L3439)');
    assert.equal(playerHasHeroOfClasses(G, '0', ['ranged']), false, 'a wrong class does not count');
  });

  it('a dual-class hand Hero counts for its second class', () => {
    const G = makeZarathosState({ seats: { '0': { hand: ['dual6'] } } });
    assert.equal(playerHasHeroOfClasses(G, '0', ['instinct']), true);
  });
});

describe('resolveZarathosStrike (WP-758 / D-24588)', () => {
  it('first strike: nothing is haunted, so no Wounds, then Zarathos haunts the highest-cost Hero', () => {
    const G = makeZarathosState({ seats: { '0': {}, '1': {} }, wounds: 5 });
    resolveZarathosStrike(G, '0');
    assert.equal(G.piles.wounds.length, 5, 'no Wound dealt');
    assert.deepStrictEqual(G.hqHaunters, [null, null, null, { kind: 'mastermind' }, null], 'Tech Seven is haunted');
    assert.equal(isMastermindHaunting(G), true);
  });

  it('second strike: everyone gains a Wound (current player first, clockwise) and no re-haunt', () => {
    const G = makeZarathosState({ seats: { '0': {}, '1': {}, '2': {} }, wounds: 5 });
    resolveZarathosStrike(G, '1');
    G.messages = [];
    resolveZarathosStrike(G, '1');
    assert.equal(G.piles.wounds.length, 2, 'three Wounds dealt');
    for (const seat of ['0', '1', '2']) {
      assert.deepStrictEqual(G.playerZones[seat]!.discard, [WOUND], `seat ${seat} gained a Wound`);
    }
    assert.deepStrictEqual(logTexts(G), [
      '[Zarathos Master Strike] Player 1 gained a Wound.',
      '[Zarathos Master Strike] Player 2 gained a Wound.',
      '[Zarathos Master Strike] Player 0 gained a Wound.',
      'Zarathos is already haunting a Hero, so he haunts no other (Zarathos Master Strike).',
    ]);
    assert.deepStrictEqual(G.hqHaunters, [null, null, null, { kind: 'mastermind' }, null], 'still one Mastermind haunter');
  });

  it('with one Wound left the current player takes it and the next seat gets none (D-24780)', () => {
    const G = makeZarathosState({
      seats: { '0': {}, '1': {} },
      wounds: 1,
      hqHaunters: [{ kind: 'mastermind' }, null, null, null, null],
    });
    resolveZarathosStrike(G, '1');
    assert.deepStrictEqual(G.playerZones['1']!.discard, [WOUND]);
    assert.deepStrictEqual(G.playerZones['0']!.discard, []);
    assert.ok(logTexts(G).includes('[Zarathos Master Strike] Player 0 gained no Wound — the Wound supply is empty.'));
  });

  it('while only a Villain haunts, Wounds are dealt and Zarathos haunts a different, unhaunted Hero', () => {
    const G = makeZarathosState({
      seats: { '0': {} },
      wounds: 3,
      hqHaunters: [null, null, null, { kind: 'villain', cardId: 'villain-x' }, null],
    });
    resolveZarathosStrike(G, '0');
    assert.equal(G.playerZones['0']!.discard.length, 1, 'the Villain haunter triggers the Wound');
    assert.deepStrictEqual(
      G.hqHaunters,
      [null, null, null, { kind: 'villain', cardId: 'villain-x' }, { kind: 'mastermind' }],
      'Dual Six (cost 6) is haunted; the Villain-haunted Tech Seven is skipped',
    );
  });

  it('a haunter left on an empty slot is not a haunted Hero', () => {
    const G = makeZarathosState({
      hq: [null, 'covert3', null, null, null],
      hqHaunters: [{ kind: 'villain', cardId: 'villain-x' }, null, null, null, null],
    });
    assert.equal(isAnyHqHeroHaunted(G), false);
  });
});
