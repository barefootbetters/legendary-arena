/**
 * Tests for the variable-Attack villain passives (WP-841 / D-24774).
 *
 * Pins the VILLAIN_VARIABLE_ATTACK_SOURCES drift (T1), the HYDRA Villain reading
 * (T2) and the two counters. The resolver-level arithmetic (T3-T11) lives in
 * economy.resolve.test.ts.
 *
 * Uses node:test only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  VILLAIN_VARIABLE_ATTACK_SOURCES,
  isHydraVillainCard,
  countOtherHydraVillains,
  countHqHeroClasses,
  villainVariableAttackBonus,
} from './villainVariableAttack.logic.js';
import type { VillainVariableAttackSource } from './villainVariableAttack.logic.js';

const VIPER_00 = 'co2e-villain-hydra-viper-00';
const VIPER_01 = 'co2e-villain-hydra-viper-01';
const HYDRA_SPIES_00 = 'henchman-hydra-spies-00';
const HYDRO_MAN_00 = 'co2e-villain-sinister-syndicate-hydro-man-00';
const HYDRA_BYSTANDER = 'bystander-hydra-hostage-00';

describe('VILLAIN_VARIABLE_ATTACK_SOURCES (WP-841 / D-24774)', () => {
  // why: T1 — a RUNTIME drift pin (D-24372): engine test files are not type-checked,
  // so the keyset of a Record<VillainVariableAttackSource, true> literal is compared
  // at run time.
  it('T1: equals the three sources in order and the union keyset', () => {
    const sourceKeyset: Record<VillainVariableAttackSource, true> = {
      flat: true,
      'per-other-hydra-villain': true,
      'per-hq-hero-class': true,
    };
    assert.deepStrictEqual(
      [...VILLAIN_VARIABLE_ATTACK_SOURCES],
      ['flat', 'per-other-hydra-villain', 'per-hq-hero-class'],
    );
    assert.deepStrictEqual([...VILLAIN_VARIABLE_ATTACK_SOURCES].sort(), Object.keys(sourceKeyset).sort());
  });
});

describe('isHydraVillainCard (WP-841, Operator fork F1)', () => {
  /** A G typing the given ids, with an optional converted-villain overlay. */
  function makeG(
    villainDeckCardTypes: Record<string, string>,
    convertedVillainOrigins?: Record<string, string>,
  ): LegendaryGameState {
    return {
      villainDeckCardTypes,
      ...(convertedVillainOrigins === undefined ? {} : { convertedVillainOrigins }),
    } as unknown as LegendaryGameState;
  }

  it('T2: a HYDRA Villain or Henchman counts; Hydro-Man, untyped, converted and Bystander ids do not', () => {
    const G = makeG({
      [VIPER_00]: 'villain',
      [HYDRA_SPIES_00]: 'henchman',
      [HYDRO_MAN_00]: 'villain',
      [HYDRA_BYSTANDER]: 'bystander',
    });
    assert.equal(isHydraVillainCard(G, VIPER_00 as CardExtId), true);
    assert.equal(isHydraVillainCard(G, HYDRA_SPIES_00 as CardExtId), true);
    assert.equal(isHydraVillainCard(G, HYDRO_MAN_00 as CardExtId), false, '"hydro" is not "hydra"');
    assert.equal(isHydraVillainCard(G, VIPER_01 as CardExtId), false, 'no type entry');
    const converted = makeG({ [VIPER_00]: 'villain' }, { [VIPER_00]: 'skrull' });
    assert.equal(isHydraVillainCard(converted, VIPER_00 as CardExtId), false, 'converted cards have no Villain Group');
    assert.equal(isHydraVillainCard(G, HYDRA_BYSTANDER as CardExtId), false, 'a Bystander is not a Villain');
  });
});

describe('countOtherHydraVillains / countHqHeroClasses (WP-841)', () => {
  it('counts City then Escape Pile, excluding only the fought copy, and tolerates missing zones', () => {
    const G = {
      villainDeckCardTypes: { [VIPER_00]: 'villain', [VIPER_01]: 'villain' },
      city: [VIPER_00, null, VIPER_01, null, null],
      escapedPile: [VIPER_01],
    } as unknown as LegendaryGameState;
    // why: VIPER_01 appears in both zones only in this synthetic G; each id counts once.
    assert.equal(countOtherHydraVillains(G, VIPER_00 as CardExtId), 1);
    const partial = { villainDeckCardTypes: {} } as unknown as LegendaryGameState;
    assert.equal(countOtherHydraVillains(partial, VIPER_00 as CardExtId), 0);
  });

  it('counts distinct HERO_CLASSES members only; a missing HQ or cardTraits reads as empty', () => {
    const G = {
      hq: ['a', 'b', 'c', null, 'd'],
      cardTraits: {
        a: { heroClass: 'tech', team: null },
        b: { heroClass: 'tech', heroClass2: 'ranged', team: null },
        c: { heroClass: 'grey', team: null },
        d: { heroClass: null, team: null },
      },
    } as unknown as LegendaryGameState;
    assert.equal(countHqHeroClasses(G), 2);
    assert.equal(countHqHeroClasses({} as unknown as LegendaryGameState), 0);
  });

  it('a villain with no entry, or a G with no table, gets 0', () => {
    const G = { city: [VIPER_00, null, null, null, null] } as unknown as LegendaryGameState;
    assert.equal(villainVariableAttackBonus(G, VIPER_00 as CardExtId), 0);
  });
});
