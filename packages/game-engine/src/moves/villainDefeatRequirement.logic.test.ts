/**
 * Tests for the villain defeat-requirement gate logic (WP-292 / D-24076).
 *
 * Verifies getDefeatRequirement lookup and playerMeetsDefeatRequirement scope:
 * hand-hit, in-play-hit, discard/deck miss, no-hero miss, and team-vs-class
 * matching.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefeatRequirement,
  playerMeetsDefeatRequirement,
  getFightDiscardCost,
  isHandCardCostOneOf,
  listEligibleHandCardsByCost,
  listEligibleHandCardsByTrait,
  selectDefaultCostDiscardCard,
  formatEligibleCostList,
} from './villainDefeatRequirement.logic.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { VillainDefeatRequirement } from '../rules/villainAbility.types.js';

/**
 * Builds a minimal game state for the gate helpers: one player's zones, a card
 * trait table, and an optional defeat-requirement table. Cast through unknown
 * because only the fields the helpers read are populated.
 */
function makeState(options: {
  hand?: CardExtId[];
  inPlay?: CardExtId[];
  discard?: CardExtId[];
  deck?: CardExtId[];
  traits?: Record<string, { heroClass: string | null; team: string | null }>;
  requirements?: Record<string, VillainDefeatRequirement>;
}): LegendaryGameState {
  const state = {
    playerZones: {
      '0': {
        deck: options.deck ?? [],
        hand: options.hand ?? [],
        discard: options.discard ?? [],
        inPlay: options.inPlay ?? [],
        victory: [],
      },
    },
    cardTraits: options.traits ?? {},
    ...(options.requirements ? { villainDefeatRequirements: options.requirements } : {}),
  };
  return state as unknown as LegendaryGameState;
}

// A small trait corpus: an X-Men strength hero card, a non-X-Men covert card,
// and an unaffiliated card matching neither requirement.
const TRAITS = {
  'core/cyclops/optic-blast#0': { heroClass: 'ranged', team: 'x-men' },
  'antm/black-knight/flying-steed#0': { heroClass: 'covert', team: 'avengers' },
  'starting-shield-agent': { heroClass: null, team: null },
};

const TEAM_REQ: VillainDefeatRequirement = { kind: 'team', value: 'x-men' };
const CLASS_REQ: VillainDefeatRequirement = { kind: 'hero-class', value: 'covert' };

describe('getDefeatRequirement', () => {
  it('returns the requirement for a marked villain', () => {
    const state = makeState({
      requirements: { 'core-villain-brotherhood-blob-01': TEAM_REQ },
    });
    assert.deepStrictEqual(
      getDefeatRequirement(state, 'core-villain-brotherhood-blob-01' as CardExtId),
      TEAM_REQ,
    );
  });

  it('returns null for an unmarked villain', () => {
    const state = makeState({
      requirements: { 'core-villain-brotherhood-blob-01': TEAM_REQ },
    });
    assert.equal(
      getDefeatRequirement(state, 'core-villain-skrulls-super-skrull-00' as CardExtId),
      null,
    );
  });

  it('returns null when the requirements table is absent', () => {
    const state = makeState({});
    assert.equal(
      getDefeatRequirement(state, 'core-villain-brotherhood-blob-01' as CardExtId),
      null,
    );
  });
});

describe('playerMeetsDefeatRequirement — zone scope (hand or in play only)', () => {
  it('is satisfied by a qualifying Hero in hand', () => {
    const state = makeState({
      hand: ['core/cyclops/optic-blast#0' as CardExtId],
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', TEAM_REQ), true);
  });

  it('is satisfied by a qualifying Hero in play', () => {
    const state = makeState({
      inPlay: ['core/cyclops/optic-blast#0' as CardExtId],
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', TEAM_REQ), true);
  });

  it('is NOT satisfied when the only qualifying Hero is in discard', () => {
    const state = makeState({
      discard: ['core/cyclops/optic-blast#0' as CardExtId],
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', TEAM_REQ), false);
  });

  it('is NOT satisfied when the only qualifying Hero is in the deck', () => {
    const state = makeState({
      deck: ['core/cyclops/optic-blast#0' as CardExtId],
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', TEAM_REQ), false);
  });

  it('is NOT satisfied when the player holds no qualifying Hero', () => {
    const state = makeState({
      hand: ['starting-shield-agent' as CardExtId],
      inPlay: ['antm/black-knight/flying-steed#0' as CardExtId],
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', TEAM_REQ), false);
  });

  it('returns false for an unknown player id', () => {
    const state = makeState({ traits: TRAITS });
    assert.equal(playerMeetsDefeatRequirement(state, '7', TEAM_REQ), false);
  });
});

describe('playerMeetsDefeatRequirement — team vs hero-class matching', () => {
  it("a 'team' requirement matches by team regardless of class", () => {
    const state = makeState({
      hand: ['core/cyclops/optic-blast#0' as CardExtId], // ranged class, x-men team
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', TEAM_REQ), true);
  });

  it("a 'hero-class' requirement matches by class regardless of team", () => {
    const state = makeState({
      inPlay: ['antm/black-knight/flying-steed#0' as CardExtId], // covert class, avengers team
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', CLASS_REQ), true);
  });

  it("a 'hero-class:covert' requirement is NOT met by an X-Men non-covert Hero", () => {
    const state = makeState({
      hand: ['core/cyclops/optic-blast#0' as CardExtId], // ranged, x-men → not covert
      traits: TRAITS,
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', CLASS_REQ), false);
  });
});

describe('playerMeetsDefeatRequirement — a split card Penumbra played both-sides (WP-780 / D-24619)', () => {
  it('a marked in-play split card satisfies the requirement through its face b', () => {
    const faceA = 'cvwr/duo/tech-half#0' as CardExtId;
    const faceB = 'cvwr/duo/covert-half#0' as CardExtId;
    const state = makeState({
      inPlay: [faceA],
      traits: {
        [faceA]: { heroClass: 'tech', team: null },
        [faceB]: { heroClass: 'covert', team: null },
      },
    });
    state.splitFaces = { 'cvwr/duo/tech-half': 'cvwr/duo/covert-half' } as LegendaryGameState['splitFaces'];
    assert.equal(playerMeetsDefeatRequirement(state, '0', CLASS_REQ), false, 'unmarked: face a only');
    state.turnEconomy = { bothSidesPlayedCardIds: [faceA] } as unknown as LegendaryGameState['turnEconomy'];
    assert.equal(playerMeetsDefeatRequirement(state, '0', CLASS_REQ), true, 'marked: face b is covert');
  });
});

describe('playerMeetsDefeatRequirement — a class granted on play (D-24724)', () => {
  const COPY_POWERS = 'core/rogue/copy-powers#0' as CardExtId;
  const TECH_ONLY = { [COPY_POWERS]: { heroClass: 'tech', team: 'x-men' } };

  it('an in-play card meets a hero-class requirement through its granted class', () => {
    const state = makeState({ inPlay: [COPY_POWERS], traits: TECH_ONLY });
    assert.equal(playerMeetsDefeatRequirement(state, '0', CLASS_REQ), false, 'printed tech only');
    state.cardCopiedClasses = { [COPY_POWERS]: ['covert'] };
    assert.equal(playerMeetsDefeatRequirement(state, '0', CLASS_REQ), true, 'granted covert counts in play');
  });

  it('D-24726 an in-play card meets a team requirement through its copied team', () => {
    const avengersCopy = 'core/rogue/copy-powers#1' as CardExtId;
    const state = makeState({
      inPlay: [avengersCopy],
      traits: { [avengersCopy]: { heroClass: 'covert', team: 'avengers' } },
    });
    assert.equal(playerMeetsDefeatRequirement(state, '0', TEAM_REQ), false, 'printed avengers only');
    state.cardCopiedTeams = { [avengersCopy]: ['x-men'] };
    assert.equal(playerMeetsDefeatRequirement(state, '0', TEAM_REQ), true, 'copied x-men team counts in play');
  });

  it('a granted class does not count for a card in hand (the grant applies only in play)', () => {
    const state = makeState({ hand: [COPY_POWERS], traits: TECH_ONLY });
    state.cardCopiedClasses = { [COPY_POWERS]: ['covert'] };
    assert.equal(playerMeetsDefeatRequirement(state, '0', CLASS_REQ), false);
  });
});

describe('WP-817 fight discard cost helpers (D-24750)', () => {
  const PRIMUS_COSTS = [2, 3, 5, 7];

  /** Builds a minimal state with the costed-hand stats and the given hand for player 0. */
  function makeCostedState(hand: CardExtId[]): LegendaryGameState {
    const state = makeState({ hand });
    (state as unknown as { cardStats: Record<string, { cost: number }> }).cardStats = {
      'hero-cost2': { cost: 2 },
      'hero-cost3': { cost: 3 },
      'hero-cost4': { cost: 4 },
      'hero-cost5': { cost: 5 },
      'hero-cost7': { cost: 7 },
      'pile-shield-officer': { cost: 3 },
    };
    return state;
  }

  it('getFightDiscardCost reads the table and treats a missing table or entry as none', () => {
    const state = makeCostedState([]);
    assert.equal(getFightDiscardCost(state, 'primus-01' as CardExtId), null);
    state.villainFightDiscardCosts = { 'primus-01': { eligibleCosts: PRIMUS_COSTS } };
    assert.deepStrictEqual(getFightDiscardCost(state, 'primus-01' as CardExtId), { eligibleCosts: PRIMUS_COSTS });
    assert.equal(getFightDiscardCost(state, 'doughboy-01' as CardExtId), null);
  });

  it('T8: isHandCardCostOneOf reads the off-play cost; Officer qualifies, cost 4 and a Wound do not', () => {
    const state = makeCostedState([]);
    const expectations: Array<[string, boolean]> = [
      ['hero-cost2', true],
      ['hero-cost3', true],
      ['hero-cost4', false],
      ['hero-cost5', true],
      ['hero-cost7', true],
      ['pile-shield-officer', true],
      ['pile-wound', false],
    ];
    for (const [cardId, expected] of expectations) {
      assert.equal(isHandCardCostOneOf(state, cardId as CardExtId, PRIMUS_COSTS), expected, cardId);
    }
  });

  it('T8: a split card in hand qualifies on its face a cost', () => {
    const faceA = 'cvwr/duo/tech-half#0' as CardExtId;
    const faceB = 'cvwr/duo/covert-half#0' as CardExtId;
    const state = makeCostedState([faceB]);
    state.splitFaces = { 'cvwr/duo/tech-half': 'cvwr/duo/covert-half' } as LegendaryGameState['splitFaces'];
    const cardStats = (state as unknown as { cardStats: Record<string, { cost: number }> }).cardStats;
    cardStats[faceA] = { cost: 5 };
    // why: face b's own entry deliberately differs, so a pass proves the off-play (face a) read.
    cardStats[faceB] = { cost: 4 };
    assert.equal(isHandCardCostOneOf(state, faceB, PRIMUS_COSTS), true);
  });

  it('T9: lists eligible cards in hand order and picks the cheapest without mutating the hand', () => {
    const hand = ['hero-cost7', 'hero-cost4', 'pile-wound', 'hero-cost2'] as CardExtId[];
    const state = makeCostedState(hand);
    assert.deepStrictEqual(listEligibleHandCardsByCost(state, '0', PRIMUS_COSTS), ['hero-cost7', 'hero-cost2']);
    assert.equal(selectDefaultCostDiscardCard(state, '0', PRIMUS_COSTS), 'hero-cost2');
    assert.deepStrictEqual(state.playerZones['0']!.hand, ['hero-cost7', 'hero-cost4', 'pile-wound', 'hero-cost2']);

    const noEligible = makeCostedState(['hero-cost4'] as CardExtId[]);
    assert.deepStrictEqual(listEligibleHandCardsByCost(noEligible, '0', PRIMUS_COSTS), []);
    assert.equal(selectDefaultCostDiscardCard(noEligible, '0', PRIMUS_COSTS), null);
    assert.deepStrictEqual(listEligibleHandCardsByCost(noEligible, '9', PRIMUS_COSTS), [], 'missing zones → []');
  });

  it('T9: a cost tie keeps the earliest card in hand order', () => {
    const state = makeCostedState(['hero-cost5', 'pile-shield-officer', 'hero-cost3'] as CardExtId[]);
    assert.equal(selectDefaultCostDiscardCard(state, '0', PRIMUS_COSTS), 'pile-shield-officer');
  });

  it('T10: formats one, two and many costs', () => {
    assert.equal(formatEligibleCostList([2]), '2');
    assert.equal(formatEligibleCostList([2, 3]), '2 or 3');
    assert.equal(formatEligibleCostList([2, 3, 5, 7]), '2, 3, 5, or 7');
  });
});

describe('WP-837 listEligibleHandCardsByTrait (D-24770)', () => {
  it('T6: lists matching hand cards in hand order through the off-play trait view', () => {
    const xmenCard = 'core/cyclops/optic-blast#0' as CardExtId;
    const woundCard = 'pile-wound-00' as CardExtId;
    const avengersCard = 'antm/black-knight/flying-steed#0' as CardExtId;
    const splitFaceA = 'test/duo/team-half#0' as CardExtId;
    const splitFaceB = 'test/duo/ranged-half#0' as CardExtId;
    const dualClassCard = 'test/dual/strength-ranged#0' as CardExtId;
    const hand = [xmenCard, woundCard, avengersCard, splitFaceA, dualClassCard];
    const state = makeState({
      hand: [...hand],
      traits: {
        [xmenCard]: { heroClass: 'ranged', team: 'x-men' },
        [avengersCard]: { heroClass: 'covert', team: 'avengers' },
        [splitFaceA]: { heroClass: 'tech', team: 'x-men' },
        [splitFaceB]: { heroClass: 'ranged', team: 'x-men' },
        [dualClassCard]: { heroClass: 'strength', team: 'avengers' },
      },
    });
    (state.cardTraits as Record<string, { heroClass2?: string }>)[dualClassCard]!.heroClass2 = 'ranged';
    state.splitFaces = { 'test/duo/team-half': 'test/duo/ranged-half' } as LegendaryGameState['splitFaces'];

    assert.deepStrictEqual(
      listEligibleHandCardsByTrait(state, '0', { kind: 'team', value: 'x-men' }),
      [xmenCard, splitFaceA],
    );
    // why: the split card's face b is Ranged; off play it counts as both faces' classes.
    assert.deepStrictEqual(
      listEligibleHandCardsByTrait(state, '0', { kind: 'hero-class', value: 'ranged' }),
      [xmenCard, splitFaceA, dualClassCard],
    );
    assert.deepStrictEqual(listEligibleHandCardsByTrait(state, '9', { kind: 'team', value: 'x-men' }), []);
    assert.deepStrictEqual(state.playerZones['0']!.hand, hand, 'the hand is not mutated');
  });
});
