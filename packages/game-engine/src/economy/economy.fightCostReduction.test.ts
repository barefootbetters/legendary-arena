/**
 * Fight-cost reduction economy helpers and resolver terms (WP-794 / D-24663).
 *
 * Pins the lazy `TurnEconomy.fightCostReductions` list and its two read sites:
 * - addFightCostReduction appends one entry without mutating its input;
 * - getFightCostReduction sums by target and is 0 with the field absent;
 * - the field is carried by every rebuild, dropped by resetTurnEconomy, and absent
 *   (no key at all) on an economy that never received a reduction (D-24372 runtime pin);
 * - resolveFightCost subtracts the reduction for the villain's CURRENT City space,
 *   floored at 0, read at fight time (AC-5);
 * - resolveMastermindFightCost subtracts the Mastermind reduction, keeps the Dark
 *   Portal bonus, and floors at 0.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addFightCostReduction,
  addResources,
  getFightCostReduction,
  resetTurnEconomy,
  spendAttack,
  spendRecruit,
} from './economy.logic.js';
import { resolveFightCost, resolveMastermindFightCost } from './economy.resolve.js';
import type { TurnEconomy } from './economy.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { LegendaryGameState } from '../types.js';
import { DARK_PORTAL_COUNT } from '../types.js';
import { makeTurnEconomy } from '../test/fixtureBuilders.js';

const BOLT = 'core/storm/lightning-bolt#0' as CardExtId;
const STRIKE = 'cvwr/storm-and-black-panther/lightning-strike#0' as CardExtId;
const WAVE = 'core/storm/tidal-wave#0' as CardExtId;
const VILLAIN = 'core/villain/hand-ninjas#0' as CardExtId;

/**
 * Builds a minimal G for resolveFightCost: one static villain, a City and an economy.
 *
 * @param options - The villain's printed cost, its City index (or none), and the economy.
 * @returns A partial G cast to LegendaryGameState.
 */
function makeCityG(options: {
  printedCost: number;
  cityIndex: number | null;
  turnEconomy: TurnEconomy;
}): LegendaryGameState {
  const city: (CardExtId | null)[] = [null, null, null, null, null];
  if (options.cityIndex !== null) {
    city[options.cityIndex] = VILLAIN;
  }
  return {
    cardStats: { [VILLAIN]: { fightCost: options.printedCost, fightCostMode: 'static', fightCostBase: 0 } },
    villainAttachedHeroes: {},
    city,
    turnEconomy: options.turnEconomy,
  } as unknown as LegendaryGameState;
}

/**
 * Builds a minimal G for resolveMastermindFightCost.
 *
 * @param options - The base cost, the Dark Portal count (Portals scheme when set), and the economy.
 * @returns A partial G cast to LegendaryGameState.
 */
function makeMastermindG(options: {
  baseFightCost: number;
  darkPortalCount?: number;
  turnEconomy: TurnEconomy;
}): LegendaryGameState {
  const isPortals = options.darkPortalCount !== undefined;
  return {
    cardStats: { 'mm-base': { fightCost: options.baseFightCost, fightCostMode: 'static', fightCostBase: 0 } },
    mastermind: { baseCardId: 'mm-base' },
    selection: { schemeId: isPortals ? 'core/portals-to-the-dark-dimension' : 'core/midtown-bank-robbery' },
    counters: { [DARK_PORTAL_COUNT]: options.darkPortalCount ?? 0 },
    turnEconomy: options.turnEconomy,
  } as unknown as LegendaryGameState;
}

describe('fight-cost reduction — economy helpers (WP-794)', () => {
  it('addFightCostReduction appends one entry and does not mutate its input', () => {
    const first = addFightCostReduction(makeTurnEconomy({ attack: 3 }), 'rooftops', 2, BOLT);
    const second = addFightCostReduction(first, 'bridge', 2, WAVE);
    assert.deepEqual(first.fightCostReductions, [{ target: 'rooftops', amount: 2, sourceCardId: BOLT }]);
    assert.deepEqual(second.fightCostReductions, [
      { target: 'rooftops', amount: 2, sourceCardId: BOLT },
      { target: 'bridge', amount: 2, sourceCardId: WAVE },
    ]);
    assert.equal(first.fightCostReductions?.length, 1, 'the input list is unchanged');
    assert.notEqual(second.fightCostReductions, first.fightCostReductions);
    assert.equal(second.attack, 3, 'every other field is carried');
  });

  it('getFightCostReduction sums the entries for the target', () => {
    let economy = addFightCostReduction(makeTurnEconomy(), 'rooftops', 2, BOLT);
    economy = addFightCostReduction(economy, 'rooftops', 1, STRIKE);
    economy = addFightCostReduction(economy, 'mastermind', 2, WAVE);
    assert.equal(getFightCostReduction(economy, 'rooftops'), 3);
    assert.equal(getFightCostReduction(economy, 'mastermind'), 2);
    assert.equal(getFightCostReduction(economy, 'sewers'), 0);
  });

  it('getFightCostReduction is 0 when the field is absent', () => {
    assert.equal(getFightCostReduction(makeTurnEconomy(), 'rooftops'), 0);
  });

  it('is carried through addResources / spendAttack / spendRecruit as a copy', () => {
    const economy = addFightCostReduction(makeTurnEconomy({ attack: 4, recruit: 2 }), 'sewers', 2, BOLT);
    const rebuilt = spendRecruit(spendAttack(addResources(economy, 1, 1), 2), 1);
    assert.deepEqual(rebuilt.fightCostReductions, economy.fightCostReductions);
    assert.notEqual(rebuilt.fightCostReductions, economy.fightCostReductions, 'carried as a copy');
  });

  it('is dropped by resetTurnEconomy', () => {
    assert.equal('fightCostReductions' in resetTurnEconomy(), false);
  });

  it('an economy with no reduction has no fightCostReductions key after any rebuild (D-24372 runtime pin)', () => {
    const economy = spendRecruit(spendAttack(addResources(makeTurnEconomy(), 3, 2), 1), 1);
    assert.equal(Object.keys(economy).includes('fightCostReductions'), false);
    assert.equal(JSON.stringify(economy).includes('fightCostReductions'), false);
  });
});

describe('fight-cost reduction — resolveFightCost (WP-794)', () => {
  const rooftopsTwo = addFightCostReduction(makeTurnEconomy(), 'rooftops', 2, BOLT);

  it('a Rooftops villain printed 5 with a rooftops 2 reduction resolves to 3', () => {
    assert.equal(resolveFightCost(makeCityG({ printedCost: 5, cityIndex: 2, turnEconomy: rooftopsTwo }), VILLAIN), 3);
  });

  it('the same villain on the Streets resolves to 5', () => {
    assert.equal(resolveFightCost(makeCityG({ printedCost: 5, cityIndex: 3, turnEconomy: rooftopsTwo }), VILLAIN), 5);
  });

  it('two rooftops entries (2 + 1) stack to a reduction of 3: printed 5 resolves to 2', () => {
    const stacked = addFightCostReduction(rooftopsTwo, 'rooftops', 1, STRIKE);
    assert.equal(resolveFightCost(makeCityG({ printedCost: 5, cityIndex: 2, turnEconomy: stacked }), VILLAIN), 2);
  });

  it('a printed 1 with a reduction of 2 floors at 0', () => {
    assert.equal(resolveFightCost(makeCityG({ printedCost: 1, cityIndex: 2, turnEconomy: rooftopsTwo }), VILLAIN), 0);
  });

  it('a villain not in the City gets no reduction', () => {
    assert.equal(resolveFightCost(makeCityG({ printedCost: 5, cityIndex: null, turnEconomy: rooftopsTwo }), VILLAIN), 5);
  });

  it('AC-5: a villain placed on the Rooftops after the reduction was added resolves reduced; on the Streets, full', () => {
    const G = makeCityG({ printedCost: 5, cityIndex: null, turnEconomy: rooftopsTwo });
    assert.equal(resolveFightCost(G, VILLAIN), 5, 'not in the City yet');
    G.city[2] = VILLAIN;
    assert.equal(resolveFightCost(G, VILLAIN), 3, 'entered the Rooftops later this turn');
    G.city[2] = null;
    G.city[3] = VILLAIN;
    assert.equal(resolveFightCost(G, VILLAIN), 5, 'moved on to the Streets');
  });
});

describe('fight-cost reduction — resolveMastermindFightCost (WP-794)', () => {
  const mastermindTwo = addFightCostReduction(makeTurnEconomy(), 'mastermind', 2, WAVE);

  it('a mastermind 2 reduction lowers the cost by 2', () => {
    assert.equal(resolveMastermindFightCost(makeMastermindG({ baseFightCost: 7, turnEconomy: mastermindTwo })), 5);
  });

  it('still includes the Dark Portal bonus', () => {
    assert.equal(
      resolveMastermindFightCost(makeMastermindG({ baseFightCost: 7, darkPortalCount: 1, turnEconomy: mastermindTwo })),
      6,
    );
  });

  it('floors at 0', () => {
    assert.equal(resolveMastermindFightCost(makeMastermindG({ baseFightCost: 1, turnEconomy: mastermindTwo })), 0);
  });

  it('a City reduction does not lower the Mastermind', () => {
    const rooftopsTwo = addFightCostReduction(makeTurnEconomy(), 'rooftops', 2, BOLT);
    assert.equal(resolveMastermindFightCost(makeMastermindG({ baseFightCost: 7, turnEconomy: rooftopsTwo })), 7);
  });
});
