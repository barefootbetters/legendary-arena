/**
 * Tests for the Size-Changing fight price (D-24802): resolveFightPrice and
 * resolveMastermindFightPrice.
 *
 * Rules v23 p.33: "You can fight this Villain for 2 less if you played any [Class] cards this
 * turn"; ~L3418: "A Villain's Attack can't go below 0". Rules v23 p.30: Microscopic
 * Size-Changing is 2 less per matching card, up to the icon count, and a negative value gains
 * that many Attack. resolveFightCost keeps reading the villain's Attack (Pure Fury).
 *
 * Uses node:test only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FightSizeChanging, LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  resolveFightCost,
  resolveFightPrice,
  resolveMastermindFightCost,
  resolveMastermindFightPrice,
} from './economy.resolve.js';

const VILLAIN = 'villain-a' as CardExtId;
const MASTERMIND_BASE = 'mastermind-base' as CardExtId;

/**
 * A minimal G: one static villain, one mastermind base face, player 0's in-play cards and
 * the Size-Changing discount map.
 *
 * @param options - The villain and mastermind Attack, the discounts and the in-play cards.
 * @returns The game state.
 */
function makeG(options: {
  villainAttack?: number;
  mastermindAttack?: number;
  fightSizeChanging?: Record<string, FightSizeChanging>;
  inPlay: string[];
}): LegendaryGameState {
  return {
    cardStats: {
      [VILLAIN]: { fightCost: options.villainAttack ?? 6, fightCostMode: 'static', fightCostBase: 0 },
      [MASTERMIND_BASE]: { fightCost: options.mastermindAttack ?? 20, fightCostMode: 'static', fightCostBase: 0 },
    },
    villainAttachedHeroes: {},
    mastermind: { baseCardId: MASTERMIND_BASE, attachedBystanders: [] },
    selection: { schemeId: 'core/midtown-bank-robbery', mastermindId: 'chmp/fin-fang-foom' },
    counters: {},
    cardTraits: {
      'strength-hero': { heroClass: 'strength', team: null },
      'tech-hero-1': { heroClass: 'tech', team: null },
      'tech-hero-2': { heroClass: 'tech', team: null },
      'dual-hero': { heroClass: 'covert', heroClass2: 'ranged', team: null },
    },
    playerZones: { '0': { deck: [], hand: [], discard: [], inPlay: options.inPlay, victory: [] } },
    ...(options.fightSizeChanging !== undefined ? { fightSizeChanging: options.fightSizeChanging } : {}),
  } as unknown as LegendaryGameState;
}

describe('resolveFightPrice — Size-Changing (D-24802)', () => {
  it('is the villain Attack when the villain has no discount or no fighter is named', () => {
    const noDiscount = makeG({ inPlay: ['tech-hero-1'] });
    assert.equal(resolveFightPrice(noDiscount, VILLAIN, '0'), 6);
    const discounted = makeG({ inPlay: ['tech-hero-1'], fightSizeChanging: { [VILLAIN]: { classes: ['tech'], microscopicIcons: [] } } });
    assert.equal(resolveFightPrice(discounted, VILLAIN), 6, 'no fighter, nothing to count');
  });

  it('takes 2 off for each listed class played this turn, counting either printed class', () => {
    const fightSizeChanging = { [VILLAIN]: { classes: ['strength', 'ranged', 'instinct'], microscopicIcons: [] } };
    assert.equal(resolveFightPrice(makeG({ inPlay: [], fightSizeChanging }), VILLAIN, '0'), 6);
    assert.equal(resolveFightPrice(makeG({ inPlay: ['strength-hero'], fightSizeChanging }), VILLAIN, '0'), 4);
    assert.equal(
      resolveFightPrice(makeG({ inPlay: ['strength-hero', 'dual-hero'], fightSizeChanging }), VILLAIN, '0'),
      2,
      'the dual-class card matches Ranged through heroClass2',
    );
  });

  it('a class is one step however many matching cards were played', () => {
    const fightSizeChanging = { [VILLAIN]: { classes: ['tech'], microscopicIcons: [] } };
    assert.equal(resolveFightPrice(makeG({ inPlay: ['tech-hero-1', 'tech-hero-2'], fightSizeChanging }), VILLAIN, '0'), 4);
  });

  it('regular Size-Changing floors at 0', () => {
    const fightSizeChanging = { [VILLAIN]: { classes: ['strength', 'tech'], microscopicIcons: [] } };
    const gameState = makeG({ villainAttack: 3, inPlay: ['strength-hero', 'tech-hero-1'], fightSizeChanging });
    assert.equal(resolveFightPrice(gameState, VILLAIN, '0'), 0);
  });

  it('Microscopic: 2 less per matching card up to the icon count, and it may go below 0', () => {
    const fightSizeChanging = { [VILLAIN]: { classes: [], microscopicIcons: ['tech', 'tech'] } };
    assert.equal(resolveFightPrice(makeG({ villainAttack: 3, inPlay: ['tech-hero-1'], fightSizeChanging }), VILLAIN, '0'), 1);
    assert.equal(
      resolveFightPrice(makeG({ villainAttack: 3, inPlay: ['tech-hero-1', 'tech-hero-2'], fightSizeChanging }), VILLAIN, '0'),
      -1,
    );
    assert.equal(
      resolveFightPrice(makeG({ villainAttack: 3, inPlay: ['strength-hero'], fightSizeChanging }), VILLAIN, '0'),
      3,
      'a card of another class matches no icon',
    );
  });

  it('leaves resolveFightCost as the villain Attack (effects that read Attack, like Pure Fury)', () => {
    const gameState = makeG({ inPlay: ['tech-hero-1'], fightSizeChanging: { [VILLAIN]: { classes: ['tech'], microscopicIcons: [] } } });
    assert.equal(resolveFightCost(gameState, VILLAIN, '0'), 6);
    assert.equal(resolveFightPrice(gameState, VILLAIN, '0'), 4);
  });
});

describe('resolveMastermindFightPrice — Size-Changing (D-24802)', () => {
  const finFangFoom = {
    [MASTERMIND_BASE]: { classes: ['strength', 'instinct', 'covert', 'tech', 'ranged'], microscopicIcons: [] },
  };

  it('takes 2 off per Fin Fang Foom class played (dual-class counts both)', () => {
    const gameState = makeG({ inPlay: ['strength-hero', 'tech-hero-1', 'dual-hero'], fightSizeChanging: finFangFoom });
    assert.equal(resolveMastermindFightCost(gameState, '0'), 20, 'the Attack read is unchanged');
    assert.equal(resolveMastermindFightPrice(gameState, '0'), 12, 'strength, tech, covert and ranged: 20 - 8');
  });

  it('floors at 0 and is the Attack without a discount entry', () => {
    const cheap = makeG({ mastermindAttack: 3, inPlay: ['strength-hero', 'tech-hero-1'], fightSizeChanging: finFangFoom });
    assert.equal(resolveMastermindFightPrice(cheap, '0'), 0);
    const plain = makeG({ inPlay: ['strength-hero'] });
    assert.equal(resolveMastermindFightPrice(plain, '0'), 20);
  });
});
