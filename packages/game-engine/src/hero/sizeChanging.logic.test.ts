/**
 * Tests for the Size-Changing recruit-cost and effective-class helpers (D-24801).
 *
 * Size-Changing is a recruit discount (rules v23 p.33: "recruit this card for 2 less if you
 * played any [class] cards this turn"), and Microscopic Size-Changing is 2 less per matching
 * card played, one per icon, possibly below 0 (rules v23 p.30). Neither gives the card a class:
 * cardHasClassWhenPlayed reads only the printed classes and a Copy Powers copy.
 *
 * The helpers are pure functions of a few G fields, so these tests build a minimal G.
 *
 * No boardgame.io imports. No registry imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cardHasClassWhenPlayed,
  getMicroscopicSizeChangingClasses,
  getSizeChangingClasses,
  hasSizeChanging,
  resolveRecruitCost,
} from './sizeChanging.logic.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/** Printed traits for one card in a test state. */
type TestTraits = { heroClass: string | null; heroClass2?: string | null; team: string | null };

/** The optional inputs a test state carries. */
interface HelperStateInput {
  cardTraits: Record<string, TestTraits>;
  cardStats?: Record<string, { cost: number }>;
  cardSizeChangingClasses?: Record<string, string[]>;
  cardMicroscopicSizeChangingClasses?: Record<string, string[]>;
  cardCopiedClasses?: Record<string, string[]>;
  inPlay?: string[];
}

/**
 * Builds a minimal LegendaryGameState carrying only the fields the helpers read.
 *
 * @param input - The traits, costs, Size-Changing maps and player 0's in-play cards.
 * @returns A game state usable by the helpers.
 */
function makeHelperState(input: HelperStateInput): LegendaryGameState {
  const partial: Record<string, unknown> = {
    cardTraits: input.cardTraits,
    cardStats: input.cardStats ?? {},
    playerZones: { '0': { deck: [], hand: [], discard: [], inPlay: input.inPlay ?? [], victory: [] } },
  };
  if (input.cardSizeChangingClasses !== undefined) {
    partial.cardSizeChangingClasses = input.cardSizeChangingClasses;
  }
  if (input.cardMicroscopicSizeChangingClasses !== undefined) {
    partial.cardMicroscopicSizeChangingClasses = input.cardMicroscopicSizeChangingClasses;
  }
  if (input.cardCopiedClasses !== undefined) {
    partial.cardCopiedClasses = input.cardCopiedClasses;
  }
  return partial as unknown as LegendaryGameState;
}

describe('getSizeChangingClasses / getMicroscopicSizeChangingClasses / hasSizeChanging (D-24801)', () => {
  it('returns empty lists and false when neither map is present', () => {
    const gameState = makeHelperState({ cardTraits: { 'hero-a': { heroClass: 'tech', team: null } } });
    assert.deepStrictEqual([...getSizeChangingClasses(gameState, 'hero-a' as CardExtId)], []);
    assert.deepStrictEqual([...getMicroscopicSizeChangingClasses(gameState, 'hero-a' as CardExtId)], []);
    assert.equal(hasSizeChanging(gameState, 'hero-a' as CardExtId), false);
  });

  it('returns the listed classes and the icons (repeats kept)', () => {
    const gameState = makeHelperState({
      cardTraits: {},
      cardSizeChangingClasses: { 'giant-ego': ['tech'] },
      cardMicroscopicSizeChangingClasses: { 'infiltrate': ['tech', 'tech', 'tech'] },
    });
    assert.deepStrictEqual([...getSizeChangingClasses(gameState, 'giant-ego' as CardExtId)], ['tech']);
    assert.deepStrictEqual(
      [...getMicroscopicSizeChangingClasses(gameState, 'infiltrate' as CardExtId)],
      ['tech', 'tech', 'tech'],
    );
  });

  it('counts Microscopic Size-Changing as Size-Changing (rules v23 p.30)', () => {
    const gameState = makeHelperState({
      cardTraits: {},
      cardSizeChangingClasses: { 'giant-ego': ['tech'] },
      cardMicroscopicSizeChangingClasses: { 'infiltrate': ['tech', 'tech', 'tech'] },
    });
    assert.equal(hasSizeChanging(gameState, 'giant-ego' as CardExtId), true);
    assert.equal(hasSizeChanging(gameState, 'infiltrate' as CardExtId), true, 'Microscopic is a type of Size-Changing');
    assert.equal(hasSizeChanging(gameState, 'other' as CardExtId), false);
  });
});

describe('cardHasClassWhenPlayed (D-24801: no Size-Changing class grant)', () => {
  it('returns true for the printed class and for both printed classes of a dual-class card', () => {
    const gameState = makeHelperState({
      cardTraits: {
        'hero-a': { heroClass: 'covert', team: null },
        'heir-to-legends': { heroClass: 'strength', heroClass2: 'ranged', team: 'x-men' },
      },
    });
    assert.equal(cardHasClassWhenPlayed(gameState, 'hero-a' as CardExtId, 'covert'), true);
    assert.equal(cardHasClassWhenPlayed(gameState, 'heir-to-legends' as CardExtId, 'strength'), true);
    assert.equal(cardHasClassWhenPlayed(gameState, 'heir-to-legends' as CardExtId, 'ranged'), true);
    assert.equal(cardHasClassWhenPlayed(gameState, 'heir-to-legends' as CardExtId, 'tech'), false);
  });

  it('does NOT give a Size-Changing card its listed class (Giant Ego: Strength, Size-Changing Tech)', () => {
    const gameState = makeHelperState({
      cardTraits: { 'giant-ego': { heroClass: 'strength', team: null } },
      cardSizeChangingClasses: { 'giant-ego': ['tech'] },
    });
    assert.equal(cardHasClassWhenPlayed(gameState, 'giant-ego' as CardExtId, 'strength'), true);
    assert.equal(
      cardHasClassWhenPlayed(gameState, 'giant-ego' as CardExtId, 'tech'),
      false,
      'the Size-Changing class discounts the recruit cost; the card is not Tech',
    );
  });

  it('returns true for a class Copy Powers copied this play (D-24730)', () => {
    const gameState = makeHelperState({
      cardTraits: { 'copy-powers': { heroClass: 'covert', team: null } },
      cardCopiedClasses: { 'copy-powers': ['strength'] },
    });
    assert.equal(cardHasClassWhenPlayed(gameState, 'copy-powers' as CardExtId, 'strength'), true);
  });

  it('returns false for an unknown card', () => {
    const gameState = makeHelperState({ cardTraits: {} });
    assert.equal(cardHasClassWhenPlayed(gameState, 'unknown' as CardExtId, 'tech'), false);
  });
});

describe('resolveRecruitCost (D-24801)', () => {
  const traits: Record<string, TestTraits> = {
    'follow-my-lead': { heroClass: 'ranged', team: 'avengers' },
    'rising-hope': { heroClass: 'strength', team: null },
    'infiltrate': { heroClass: 'tech', team: 'avengers' },
    'storm-ranged': { heroClass: 'ranged', team: 'x-men' },
    'iron-man-tech-1': { heroClass: 'tech', team: 'avengers' },
    'iron-man-tech-2': { heroClass: 'tech', team: 'avengers' },
    'iron-man-tech-3': { heroClass: 'tech', team: 'avengers' },
    'iron-man-tech-4': { heroClass: 'tech', team: 'avengers' },
    'hulk-strength': { heroClass: 'strength', team: 'avengers' },
    'elektra-covert': { heroClass: 'covert', team: null },
    'shield-agent': { heroClass: null, team: 'shield' },
  };
  const stats = {
    'follow-my-lead': { cost: 2 },
    'rising-hope': { cost: 9 },
    'infiltrate': { cost: 6 },
    'plain-hero': { cost: 5 },
  };

  it('returns the printed cost for a card without Size-Changing', () => {
    const gameState = makeHelperState({ cardTraits: traits, cardStats: stats, inPlay: ['storm-ranged'] });
    assert.equal(resolveRecruitCost(gameState, '0', 'plain-hero' as CardExtId), 5);
  });

  it('Size-Changing Ranged: 2 less once a Ranged card was played, full price otherwise', () => {
    const notYet = makeHelperState({
      cardTraits: traits,
      cardStats: stats,
      cardSizeChangingClasses: { 'follow-my-lead': ['ranged'] },
      inPlay: ['shield-agent', 'elektra-covert'],
    });
    assert.equal(resolveRecruitCost(notYet, '0', 'follow-my-lead' as CardExtId), 2, 'no Ranged card played');
    const played = makeHelperState({
      cardTraits: traits,
      cardStats: stats,
      cardSizeChangingClasses: { 'follow-my-lead': ['ranged'] },
      inPlay: ['shield-agent', 'storm-ranged'],
    });
    assert.equal(resolveRecruitCost(played, '0', 'follow-my-lead' as CardExtId), 0, 'a Ranged card was played');
  });

  it('Size-Changing gives one 2-less step per class, not per card, and never goes below 0', () => {
    const gameState = makeHelperState({
      cardTraits: traits,
      cardStats: { 'follow-my-lead': { cost: 2 } },
      cardSizeChangingClasses: { 'follow-my-lead': ['ranged'] },
      inPlay: ['storm-ranged', 'storm-ranged'],
    });
    assert.equal(resolveRecruitCost(gameState, '0', 'follow-my-lead' as CardExtId), 0, 'two Ranged cards still take 2 off, floored at 0');
  });

  it('Size-Changing with two classes: each class played takes its own 2 off (Rising Hope: Strength, Covert)', () => {
    const base = {
      cardTraits: traits,
      cardStats: stats,
      cardSizeChangingClasses: { 'rising-hope': ['strength', 'covert'] },
    };
    assert.equal(resolveRecruitCost(makeHelperState({ ...base, inPlay: [] }), '0', 'rising-hope' as CardExtId), 9);
    assert.equal(resolveRecruitCost(makeHelperState({ ...base, inPlay: ['hulk-strength'] }), '0', 'rising-hope' as CardExtId), 7);
    assert.equal(
      resolveRecruitCost(makeHelperState({ ...base, inPlay: ['hulk-strength', 'elektra-covert'] }), '0', 'rising-hope' as CardExtId),
      5,
    );
  });

  it('Microscopic: 2 less per matching card played, capped at the icon count, and can go below 0', () => {
    const base = {
      cardTraits: traits,
      cardStats: stats,
      cardMicroscopicSizeChangingClasses: { 'infiltrate': ['tech', 'tech', 'tech'] },
    };
    assert.equal(resolveRecruitCost(makeHelperState({ ...base, inPlay: ['storm-ranged'] }), '0', 'infiltrate' as CardExtId), 6, 'no Tech card played');
    assert.equal(resolveRecruitCost(makeHelperState({ ...base, inPlay: ['iron-man-tech-1'] }), '0', 'infiltrate' as CardExtId), 4);
    assert.equal(
      resolveRecruitCost(makeHelperState({ ...base, inPlay: ['iron-man-tech-1', 'iron-man-tech-2', 'iron-man-tech-3'] }), '0', 'infiltrate' as CardExtId),
      0,
    );
    assert.equal(
      resolveRecruitCost(
        makeHelperState({ ...base, inPlay: ['iron-man-tech-1', 'iron-man-tech-2', 'iron-man-tech-3', 'iron-man-tech-4'] }),
        '0',
        'infiltrate' as CardExtId,
      ),
      0,
      'a fourth Tech card takes nothing more off: only three icons',
    );
    const cheap = makeHelperState({
      ...base,
      cardStats: { 'infiltrate': { cost: 2 } },
      inPlay: ['iron-man-tech-1', 'iron-man-tech-2'],
    });
    assert.equal(resolveRecruitCost(cheap, '0', 'infiltrate' as CardExtId), -2, 'the price may go below 0');
  });

  it('a Copy Powers copied class counts as a played card of that class (D-24730)', () => {
    const gameState = makeHelperState({
      cardTraits: { ...traits, 'copy-powers': { heroClass: 'covert', team: null } },
      cardStats: stats,
      cardSizeChangingClasses: { 'follow-my-lead': ['ranged'] },
      cardCopiedClasses: { 'copy-powers': ['ranged'] },
      inPlay: ['copy-powers'],
    });
    assert.equal(resolveRecruitCost(gameState, '0', 'follow-my-lead' as CardExtId), 0);
  });
});
