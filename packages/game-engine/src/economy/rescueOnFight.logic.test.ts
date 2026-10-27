/**
 * Unit tests for Baron Zemo's rescue-on-fight helpers (WP-819 / D-24753).
 *
 * Covers: the Zemo offer test, affordability against a simulated fight debit
 * (with and without the WP-580 recruit-as-attack conversion), and the
 * active-player economy cue.
 *
 * node:test + node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BARON_ZEMO_MASTERMIND_ID,
  RESCUE_ON_FIGHT_RECRUIT_COST,
  canPayRescueOnFight,
  isRescueOnFightCueOn,
  isRescueOnFightOffered,
} from './rescueOnFight.logic.js';
import type { TurnEconomy } from './economy.types.js';
import type { LegendaryGameState } from '../types.js';

/**
 * Builds a turn economy with the given attack and recruit, nothing spent.
 *
 * @param attack - Attack points available.
 * @param recruit - Recruit points available.
 * @param isConversionOn - Whether the WP-580 recruit-as-attack conversion is active.
 * @returns A fresh TurnEconomy.
 */
function makeEconomy(attack: number, recruit: number, isConversionOn: boolean): TurnEconomy {
  const economy: TurnEconomy = {
    attack,
    recruit,
    spentAttack: 0,
    spentRecruit: 0,
    piercing: 0,
    woundsDrawn: 0,
    cardsDrawn: 0,
  };
  if (isConversionOn) {
    economy.recruitSpendableAsAttack = true;
  }
  return economy;
}

/**
 * Builds the narrow G slice the offer and cue helpers read.
 *
 * @param mastermindId - The selected Mastermind id, or undefined for no selection.
 * @param supplyCount - How many Bystanders the supply holds.
 * @param recruit - The active player's unspent Recruit.
 * @returns A partial game state cast to LegendaryGameState.
 */
function makeState(
  mastermindId: string | undefined,
  supplyCount: number,
  recruit: number,
): LegendaryGameState {
  const bystanders: string[] = [];
  for (let i = 0; i < supplyCount; i++) {
    bystanders.push('pile-bystander');
  }
  const partial: Record<string, unknown> = {
    piles: { bystanders },
    turnEconomy: makeEconomy(0, recruit, false),
  };
  if (mastermindId !== undefined) {
    partial.selection = { mastermindId };
  }
  return partial as unknown as LegendaryGameState;
}

describe('WP-819 rescue-on-fight helpers (D-24753)', () => {
  it('the locked values hold', () => {
    assert.equal(RESCUE_ON_FIGHT_RECRUIT_COST, 2);
    assert.equal(BARON_ZEMO_MASTERMIND_ID, 'ca75/baron-heinrich-zemo');
  });

  it('T1: isRescueOnFightOffered is true only when Baron Zemo is the Mastermind', () => {
    assert.equal(isRescueOnFightOffered(makeState('ca75/baron-heinrich-zemo', 1, 2)), true);
    assert.equal(isRescueOnFightOffered(makeState('core/red-skull', 1, 2)), false);
    assert.equal(isRescueOnFightOffered(makeState(undefined, 1, 2)), false);
  });

  it('T2: canPayRescueOnFight judges the rescue against the simulated fight debit', () => {
    const plainPayable = makeEconomy(5, 2, false);
    const plainShort = makeEconomy(5, 1, false);
    const conversionPayable = makeEconomy(3, 4, true);
    const conversionShort = makeEconomy(3, 3, true);
    const snapshots = [plainPayable, plainShort, conversionPayable, conversionShort].map(
      (economy) => JSON.stringify(economy),
    );

    assert.equal(canPayRescueOnFight(plainPayable, 5, 'sewers'), true);
    assert.equal(canPayRescueOnFight(plainShort, 5, 'sewers'), false);
    // why: the fight takes 3 attack + 2 Recruit, so 2 Recruit remain for the rescue.
    assert.equal(canPayRescueOnFight(conversionPayable, 5, 'sewers'), true);
    // why: the fight takes 3 attack + 2 Recruit, so only 1 Recruit remains.
    assert.equal(canPayRescueOnFight(conversionShort, 5, 'sewers'), false);

    // the simulation never mutates the caller's economy
    const after = [plainPayable, plainShort, conversionPayable, conversionShort].map(
      (economy) => JSON.stringify(economy),
    );
    assert.deepEqual(after, snapshots);
  });

  it('T3: isRescueOnFightCueOn needs Zemo, a non-empty supply and 2 unspent Recruit', () => {
    assert.equal(isRescueOnFightCueOn(makeState('ca75/baron-heinrich-zemo', 1, 2)), true);
    assert.equal(isRescueOnFightCueOn(makeState('ca75/baron-heinrich-zemo', 0, 2)), false);
    assert.equal(isRescueOnFightCueOn(makeState('ca75/baron-heinrich-zemo', 1, 1)), false);
    assert.equal(isRescueOnFightCueOn(makeState('core/red-skull', 1, 2)), false);
  });
});
