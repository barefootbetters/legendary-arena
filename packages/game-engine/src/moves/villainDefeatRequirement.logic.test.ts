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
  getFightRestriction,
  matchHasFightRestrictionKind,
  isFightRestrictionBlocking,
  getFightRestrictionBlockReason,
  FIGHT_RESTRICTION_REASONS,
  findFightableFortifier,
} from './villainDefeatRequirement.logic.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { VillainDefeatRequirement, VillainFightRestriction } from '../rules/villainAbility.types.js';

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

// ---------------------------------------------------------------------------
// WP-871 / D-24816 — fight restriction helpers
// ---------------------------------------------------------------------------

describe('WP-871 fight restriction helpers (D-24816)', () => {
  const ORRGO = 'chmp-villain-monsters-unleashed-orrgo-00';
  const SQUIRREL_GIRL = 'cvwr-villain-great-lakes-avengers-squirrel-girl-00';
  const DOOP = 'ssw2-villain-deadpools-secret-secret-wars-doop-00';
  const PLAIN = 'core-villain-hydra-hydra-kidnappers-00';
  const DEFEATED_FIRST: VillainFightRestriction = { kind: 'requires-villain-defeated-this-turn' };
  const ONE_CARD: VillainFightRestriction = { kind: 'at-most-one-card-played' };
  const NO_NEIGHBOUR: VillainFightRestriction = { kind: 'no-adjacent-villain' };

  /**
   * Builds a minimal state for the restriction helpers: one player's inPlay, the
   * City, a turn economy and an optional restriction table. Cast through unknown
   * because only the fields the helpers read are populated.
   */
  function makeRestrictionState(options: {
    city?: (CardExtId | null)[];
    inPlay?: CardExtId[];
    turnEconomy?: Record<string, unknown>;
    restrictions?: Record<string, VillainFightRestriction>;
  }): LegendaryGameState {
    const state = {
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: options.inPlay ?? [], victory: [] },
      },
      city: options.city ?? [null, null, null, null, null],
      turnEconomy: options.turnEconomy ?? {},
      ...(options.restrictions ? { villainFightRestrictions: options.restrictions } : {}),
    };
    return state as unknown as LegendaryGameState;
  }

  it('T6: requires-villain-defeated-this-turn blocks until the flag is true', () => {
    assert.equal(isFightRestrictionBlocking(makeRestrictionState({}), '0', 0, DEFEATED_FIRST), true);
    const afterDefeat = makeRestrictionState({ turnEconomy: { hasDefeatedVillainThisTurn: true } });
    assert.equal(isFightRestrictionBlocking(afterDefeat, '0', 0, DEFEATED_FIRST), false);
  });

  it('T7: at-most-one-card-played blocks only past one played card, counting a returned Sidekick', () => {
    assert.equal(isFightRestrictionBlocking(makeRestrictionState({ inPlay: [] }), '0', 0, ONE_CARD), false);
    assert.equal(isFightRestrictionBlocking(makeRestrictionState({ inPlay: ['hero-a'] }), '0', 0, ONE_CARD), false);
    assert.equal(
      isFightRestrictionBlocking(makeRestrictionState({ inPlay: ['hero-a', 'hero-b'] }), '0', 0, ONE_CARD),
      true,
    );
    const sidekickReturned = makeRestrictionState({
      inPlay: ['hero-a'],
      turnEconomy: { sidekicksReturnedThisTurn: 1 },
    });
    assert.equal(
      isFightRestrictionBlocking(sidekickReturned, '0', 0, ONE_CARD),
      true,
      'the returned Sidekick still counts as played (playedCardIdsThisTurn)',
    );
  });

  it('T8: no-adjacent-villain blocks exactly when a neighbour inside the City is occupied', () => {
    for (const cityIndex of [0, 2, 4]) {
      const city: (CardExtId | null)[] = [null, null, null, null, null];
      city[cityIndex] = DOOP;
      assert.equal(
        isFightRestrictionBlocking(makeRestrictionState({ city }), '0', cityIndex, NO_NEIGHBOUR),
        false,
        `index ${cityIndex} with empty neighbours`,
      );
    }
    const leftFilled: (CardExtId | null)[] = [null, PLAIN, DOOP, null, null];
    assert.equal(isFightRestrictionBlocking(makeRestrictionState({ city: leftFilled }), '0', 2, NO_NEIGHBOUR), true);
    const rightFilled: (CardExtId | null)[] = [null, null, DOOP, PLAIN, null];
    assert.equal(isFightRestrictionBlocking(makeRestrictionState({ city: rightFilled }), '0', 2, NO_NEIGHBOUR), true);
    const edgeLeftNeighbour: (CardExtId | null)[] = [DOOP, PLAIN, null, null, null];
    assert.equal(
      isFightRestrictionBlocking(makeRestrictionState({ city: edgeLeftNeighbour }), '0', 0, NO_NEIGHBOUR),
      true,
    );
    const edgeRightNeighbour: (CardExtId | null)[] = [null, null, null, PLAIN, DOOP];
    assert.equal(
      isFightRestrictionBlocking(makeRestrictionState({ city: edgeRightNeighbour }), '0', 4, NO_NEIGHBOUR),
      true,
    );
    const farEnd: (CardExtId | null)[] = [DOOP, null, null, null, PLAIN];
    assert.equal(
      isFightRestrictionBlocking(makeRestrictionState({ city: farEnd }), '0', 0, NO_NEIGHBOUR),
      false,
      'the City never wraps: index 4 is not a neighbour of index 0',
    );
    const sixSpaces: (CardExtId | null)[] = [null, null, null, null, PLAIN, DOOP];
    assert.equal(
      isFightRestrictionBlocking(makeRestrictionState({ city: sixSpaces }), '0', 5, NO_NEIGHBOUR),
      true,
      'a resized City (D-24764): index 5 has index 4 as a neighbour',
    );
    const sixSpacesEmpty: (CardExtId | null)[] = [null, null, null, null, null, DOOP];
    assert.equal(
      isFightRestrictionBlocking(makeRestrictionState({ city: sixSpacesEmpty }), '0', 5, NO_NEIGHBOUR),
      false,
      'no read past the end of the City counts',
    );
  });

  it('T9: getFightRestrictionBlockReason returns the locked reason only while blocking', () => {
    assert.deepEqual(FIGHT_RESTRICTION_REASONS, {
      'requires-villain-defeated-this-turn': 'Defeat another Villain first this turn',
      'at-most-one-card-played': 'You played more than one card this turn',
      'no-adjacent-villain': 'A Villain is in an adjacent city space',
    });
    const restrictions = { [ORRGO]: DEFEATED_FIRST, [SQUIRREL_GIRL]: ONE_CARD, [DOOP]: NO_NEIGHBOUR };
    const blocked = makeRestrictionState({
      city: [ORRGO, null, SQUIRREL_GIRL, DOOP, PLAIN],
      inPlay: ['hero-a', 'hero-b'],
      restrictions,
    });
    assert.equal(getFightRestrictionBlockReason(blocked, '0', 0), 'Defeat another Villain first this turn');
    assert.equal(getFightRestrictionBlockReason(blocked, '0', 2), 'You played more than one card this turn');
    assert.equal(getFightRestrictionBlockReason(blocked, '0', 3), 'A Villain is in an adjacent city space');
    assert.equal(getFightRestrictionBlockReason(blocked, '0', 1), null, 'an empty space');
    assert.equal(getFightRestrictionBlockReason(blocked, '0', 4), null, 'an unrestricted villain');
    const satisfied = makeRestrictionState({
      city: [ORRGO, null, SQUIRREL_GIRL, null, DOOP],
      inPlay: ['hero-a'],
      turnEconomy: { hasDefeatedVillainThisTurn: true },
      restrictions,
    });
    assert.equal(getFightRestrictionBlockReason(satisfied, '0', 0), null);
    assert.equal(getFightRestrictionBlockReason(satisfied, '0', 2), null);
    assert.equal(getFightRestrictionBlockReason(satisfied, '0', 4), null);
    assert.equal(getFightRestriction(satisfied, PLAIN), null);
    assert.deepEqual(getFightRestriction(satisfied, DOOP), NO_NEIGHBOUR);
  });

  it('T10: matchHasFightRestrictionKind finds a kind only when an entry has it', () => {
    const withOrrgo = makeRestrictionState({ restrictions: { [ORRGO]: DEFEATED_FIRST, [DOOP]: NO_NEIGHBOUR } });
    assert.equal(matchHasFightRestrictionKind(withOrrgo, 'requires-villain-defeated-this-turn'), true);
    const doopOnly = makeRestrictionState({ restrictions: { [DOOP]: NO_NEIGHBOUR } });
    assert.equal(matchHasFightRestrictionKind(doopOnly, 'requires-villain-defeated-this-turn'), false);
    assert.equal(matchHasFightRestrictionKind(makeRestrictionState({}), 'requires-villain-defeated-this-turn'), false);
  });
});

describe('WP-873 fortifier helpers (D-24818)', () => {
  const SQUIRREL_GIRL = 'cvwr-villain-great-lakes-avengers-squirrel-girl-00' as CardExtId;
  const NEIGHBOUR_A = 'test-villain-neighbour-a-00' as CardExtId;
  const NEIGHBOUR_B = 'test-villain-neighbour-b-00' as CardExtId;

  /**
   * Builds a state with Squirrel Girl fortifying the Sidekick Stack, her restriction, a
   * printed fight cost of 3 and the given attack and cards in play. Cast through unknown
   * because only the fields the helpers read are populated.
   */
  function makeFortifiedState(options: {
    attack: number;
    inPlay?: CardExtId[];
    hand?: CardExtId[];
    requirements?: Record<string, VillainDefeatRequirement>;
    discardCosts?: Record<string, { eligibleCosts: number[] }>;
    withTable?: boolean;
  }): LegendaryGameState {
    const state = {
      playerZones: {
        '0': { deck: [], hand: options.hand ?? [], discard: [], inPlay: options.inPlay ?? [], victory: [] },
      },
      city: [NEIGHBOUR_A, NEIGHBOUR_B, null, null, null],
      hq: [null, null, null, null, null],
      cardTraits: {},
      cardStats: {
        [SQUIRREL_GIRL]: { attack: 0, recruit: 0, cost: 0, fightCost: 3, fightCostMode: 'static', fightCostBase: 0 },
      },
      villainAttachedHeroes: {},
      escapedPile: [],
      turnEconomy: { attack: options.attack, recruit: 0, spentAttack: 0, spentRecruit: 0 },
      villainFightRestrictions: { [SQUIRREL_GIRL]: { kind: 'at-most-one-card-played' } },
      ...(options.requirements ? { villainDefeatRequirements: options.requirements } : {}),
      ...(options.discardCosts ? { villainFightDiscardCosts: options.discardCosts } : {}),
      ...(options.withTable === false
        ? {}
        : { fortifications: { 'sidekick-stack': { villainCardId: SQUIRREL_GIRL, lock: 'no-recruit-or-gain' } } }),
    };
    return state as unknown as LegendaryGameState;
  }

  it('T18: isFightRestrictionBlocking with a null City index never blocks on adjacency', () => {
    const state = makeFortifiedState({ attack: 0 });
    assert.equal(isFightRestrictionBlocking(state, '0', null, { kind: 'no-adjacent-villain' }), false);
    assert.equal(isFightRestrictionBlocking(state, '0', 0, { kind: 'no-adjacent-villain' }), true, 'index 0 still sees index 1');
    assert.equal(isFightRestrictionBlocking(state, '0', null, { kind: 'requires-villain-defeated-this-turn' }), true);
    const twoPlayed = makeFortifiedState({ attack: 0, inPlay: ['hero-a', 'hero-b'] as CardExtId[] });
    assert.equal(isFightRestrictionBlocking(twoPlayed, '0', null, { kind: 'at-most-one-card-played' }), true);
  });

  it('T33: findFightableFortifier refuses each of its six checks and returns the fightable one', () => {
    assert.equal(findFightableFortifier(makeFortifiedState({ attack: 3 }), '0', 'wound-stack'), null, 'not a place');
    assert.equal(findFightableFortifier(makeFortifiedState({ attack: 3, withTable: false }), '0', 'sidekick-stack'), null, 'no entry');
    assert.equal(findFightableFortifier(makeFortifiedState({ attack: 2 }), '0', 'sidekick-stack'), null, 'short attack');
    const requirement = makeFortifiedState({ attack: 3, requirements: { [SQUIRREL_GIRL]: { kind: 'team', value: 'x-men' } } });
    assert.equal(findFightableFortifier(requirement, '0', 'sidekick-stack'), null, 'defeat requirement unmet');
    const restricted = makeFortifiedState({ attack: 3, inPlay: ['hero-a', 'hero-b'] as CardExtId[] });
    assert.equal(findFightableFortifier(restricted, '0', 'sidekick-stack'), null, 'fight restriction blocks');
    const discardCost = makeFortifiedState({ attack: 3, discardCosts: { [SQUIRREL_GIRL]: { eligibleCosts: [2] } } });
    assert.equal(findFightableFortifier(discardCost, '0', 'sidekick-stack'), null, 'a discard cost fails closed');
    assert.deepStrictEqual(findFightableFortifier(makeFortifiedState({ attack: 3 }), '0', 'sidekick-stack'), {
      cardId: SQUIRREL_GIRL,
      price: 3,
      required: 3,
    });
  });
});
