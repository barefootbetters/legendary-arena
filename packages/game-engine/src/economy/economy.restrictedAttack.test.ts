/**
 * Restricted ("usable only against …") attack economy helpers (WP-790 / D-24652).
 *
 * Pins the lazy `TurnEconomy.restrictedAttack` sub-ledger and the helpers around it:
 * - addRestrictedAttack adds to `attack` and records a grant;
 * - getSpendableAttack excludes the unspent restricted remainder (clamped at 0);
 * - getSpendableAttackForTarget / sumRestrictedAttackForTarget add back eligible grants only;
 * - spendFightCostForTarget pays eligible grants narrowest-first (ties by grant order),
 *   then plain attack, then recruit under the WP-580 conversion — never an ineligible grant;
 * - the invariant `attack - spentAttack >= getRestrictedAttackRemaining(economy)` holds;
 * - the field is carried by every rebuild, dropped by resetTurnEconomy, and absent
 *   (no key at all) on an economy that never received a grant (D-24372 runtime pin).
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addResources,
  addRestrictedAttack,
  enableRecruitSpendableAsAttack,
  formatAttackTargets,
  getRestrictedAttackRemaining,
  getSpendableAttack,
  getSpendableAttackForTarget,
  resetTurnEconomy,
  spendAttack,
  spendFightCost,
  spendFightCostForTarget,
  spendRecruit,
  sumRestrictedAttackForTarget,
} from './economy.logic.js';
import type { TurnEconomy } from './economy.types.js';
import type { CardExtId } from '../state/zones.types.js';
import { makeTurnEconomy } from '../test/fixtureBuilders.js';

const BOLT = 'co2e/storm/lightning-bolt#0' as CardExtId;
const WAVE = 'co2e/storm/tidal-wave#0' as CardExtId;

/**
 * Asserts the restricted-attack invariant on an economy.
 *
 * @param economy - The economy to check.
 * @param step - A label for the failure message.
 */
function assertInvariant(economy: TurnEconomy, step: string): void {
  assert.ok(
    economy.attack - economy.spentAttack >= getRestrictedAttackRemaining(economy),
    `invariant attack - spentAttack >= remaining must hold after: ${step}`,
  );
}

describe('restricted attack — grant and spendable figures (WP-790)', () => {
  it('addRestrictedAttack adds to attack and records one grant', () => {
    const economy = addRestrictedAttack(makeTurnEconomy({ attack: 1 }), 2, ['rooftops'], BOLT);
    assert.equal(economy.attack, 3, 'the grant still counts toward attack made');
    assert.deepEqual(economy.restrictedAttack, [{ remaining: 2, targets: ['rooftops'], sourceCardId: BOLT }]);
    assert.equal(getRestrictedAttackRemaining(economy), 2);
  });

  it('getSpendableAttack excludes the restricted remainder', () => {
    const economy = addRestrictedAttack(makeTurnEconomy({ attack: 1 }), 2, ['rooftops'], BOLT);
    assert.equal(getSpendableAttack(economy), 1);
  });

  it('getSpendableAttack clamps at 0', () => {
    const economy = makeTurnEconomy({
      attack: 2,
      spentAttack: 1,
      restrictedAttack: [{ remaining: 2, targets: ['rooftops'], sourceCardId: BOLT }],
    });
    assert.equal(getSpendableAttack(economy), 0);
  });

  it('getSpendableAttackForTarget adds back only the grants eligible for the target', () => {
    let economy = addRestrictedAttack(makeTurnEconomy({ attack: 1 }), 2, ['rooftops'], BOLT);
    economy = addRestrictedAttack(economy, 3, ['sewers', 'bridge', 'mastermind'], WAVE);
    assert.equal(getSpendableAttackForTarget(economy, 'rooftops'), 3);
    assert.equal(getSpendableAttackForTarget(economy, 'bridge'), 4);
    assert.equal(getSpendableAttackForTarget(economy, 'mastermind'), 4);
    assert.equal(getSpendableAttackForTarget(economy, 'bank'), 1);
  });

  it('sumRestrictedAttackForTarget sums eligible remaining and is 0 with no target', () => {
    const grants = [
      { remaining: 2, targets: ['rooftops' as const] },
      { remaining: 3, targets: ['rooftops' as const, 'mastermind' as const] },
    ];
    assert.equal(sumRestrictedAttackForTarget(grants, 'rooftops'), 5);
    assert.equal(sumRestrictedAttackForTarget(grants, 'mastermind'), 3);
    assert.equal(sumRestrictedAttackForTarget(grants, 'sewers'), 0);
    assert.equal(sumRestrictedAttackForTarget(grants, undefined), 0);
  });
});

describe('restricted attack — spendFightCostForTarget order (WP-790)', () => {
  it('pays the narrowest eligible grant first, then the wider one', () => {
    let economy = addRestrictedAttack(makeTurnEconomy(), 3, ['rooftops', 'streets', 'mastermind'], WAVE);
    economy = addRestrictedAttack(economy, 2, ['rooftops'], BOLT);
    const after = spendFightCostForTarget(economy, 3, 'rooftops');
    assert.deepEqual(
      after.restrictedAttack?.map((grant) => grant.remaining),
      [2, 0],
      'the 1-target grant pays first (2), the 3-target grant pays the rest (1)',
    );
    assert.equal(after.spentAttack, 3);
    assertInvariant(after, 'narrowest-first spend');
  });

  it('breaks a width tie by grant order', () => {
    let economy = addRestrictedAttack(makeTurnEconomy(), 2, ['rooftops'], BOLT);
    economy = addRestrictedAttack(economy, 2, ['rooftops'], WAVE);
    const after = spendFightCostForTarget(economy, 1, 'rooftops');
    assert.deepEqual(after.restrictedAttack?.map((grant) => grant.remaining), [1, 2]);
  });

  it('pays eligible restricted, then plain attack, then recruit under the WP-580 flag', () => {
    let economy = makeTurnEconomy({ attack: 1, recruit: 3 });
    economy = enableRecruitSpendableAsAttack(addRestrictedAttack(economy, 2, ['rooftops'], BOLT));
    const after = spendFightCostForTarget(economy, 5, 'rooftops');
    assert.equal(after.restrictedAttack?.[0]?.remaining, 0, 'the grant pays 2');
    assert.equal(after.spentAttack, 3, 'grant 2 + plain 1');
    assert.equal(after.spentRecruit, 2, 'recruit pays the last 2');
    assertInvariant(after, 'restricted → plain → recruit');
  });

  it('an ineligible grant is never spent: recruit pays the shortfall under the WP-580 flag', () => {
    let economy = makeTurnEconomy({ attack: 1, recruit: 4 });
    economy = enableRecruitSpendableAsAttack(addRestrictedAttack(economy, 2, ['rooftops'], BOLT));
    const after = spendFightCostForTarget(economy, 4, 'sewers');
    assert.equal(after.restrictedAttack?.[0]?.remaining, 2, 'the Rooftops grant is untouched');
    assert.equal(after.spentAttack, 1, 'only the plain 1 attack is spent');
    assert.equal(after.spentRecruit, 3, 'recruit pays the remaining 3');
    assertInvariant(after, 'ineligible spend with conversion');
  });

  it('keeps zero-remaining grants in the array and does not mutate the input', () => {
    const economy = addRestrictedAttack(makeTurnEconomy(), 2, ['rooftops'], BOLT);
    const after = spendFightCostForTarget(economy, 2, 'rooftops');
    assert.equal(after.restrictedAttack?.length, 1);
    assert.equal(after.restrictedAttack?.[0]?.remaining, 0);
    assert.equal(economy.restrictedAttack?.[0]?.remaining, 2, 'input ledger unchanged');
    assert.notEqual(after.restrictedAttack, economy.restrictedAttack);
  });

  it('equals spendFightCost for an economy with no grant', () => {
    const economy = makeTurnEconomy({ attack: 2, recruit: 4 });
    assert.deepEqual(spendFightCostForTarget(economy, 2, 'bank'), spendFightCost(economy, 2));
    const converted = enableRecruitSpendableAsAttack(economy);
    assert.deepEqual(
      spendFightCostForTarget(converted, 5, 'mastermind'),
      spendFightCost(converted, 5),
    );
  });

  it('invariant walk: add → eligible spend → ineligible spend with conversion → addResources', () => {
    let economy = makeTurnEconomy({ attack: 2, recruit: 5 });
    economy = addRestrictedAttack(economy, 3, ['sewers', 'bridge'], WAVE);
    assertInvariant(economy, 'add');
    economy = spendFightCostForTarget(economy, 4, 'bridge');
    assertInvariant(economy, 'eligible spend');
    economy = addRestrictedAttack(economy, 2, ['rooftops'], BOLT);
    economy = enableRecruitSpendableAsAttack(economy);
    economy = spendFightCostForTarget(economy, 3, 'bank');
    assertInvariant(economy, 'ineligible spend with conversion');
    assert.equal(economy.restrictedAttack?.[1]?.remaining, 2, 'the Rooftops grant survives a Bank fight');
    economy = addResources(economy, 1, 0);
    assertInvariant(economy, 'addResources');
  });
});

describe('restricted attack — lazy field (WP-790)', () => {
  it('is carried through addResources / spendAttack / spendRecruit', () => {
    const economy = addRestrictedAttack(makeTurnEconomy(), 2, ['rooftops'], BOLT);
    const rebuilt = spendRecruit(spendAttack(addResources(economy, 1, 1), 0), 0);
    assert.deepEqual(rebuilt.restrictedAttack, economy.restrictedAttack);
    assert.notEqual(rebuilt.restrictedAttack, economy.restrictedAttack, 'carried as a copy');
  });

  it('is dropped by resetTurnEconomy', () => {
    assert.equal('restrictedAttack' in resetTurnEconomy(), false);
  });

  it('an economy with no grant has no restrictedAttack key after any rebuild (D-24372 runtime pin)', () => {
    const economy = spendFightCostForTarget(addResources(makeTurnEconomy(), 3, 0), 2, 'rooftops');
    assert.equal(Object.keys(economy).includes('restrictedAttack'), false);
    assert.equal(JSON.stringify(economy).includes('restrictedAttack'), false);
  });

  it('formatAttackTargets joins the display names with " or "', () => {
    assert.equal(formatAttackTargets(['rooftops']), 'Rooftops');
    assert.equal(formatAttackTargets(['sewers', 'bridge', 'mastermind']), 'Sewers or Bridge or Mastermind');
    assert.equal(formatAttackTargets(['bank', 'streets']), 'Bank or Streets');
  });
});
