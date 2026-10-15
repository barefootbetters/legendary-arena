/**
 * savedLoadoutLaunch.ts — tests (WP-303 / EC-851).
 *
 * Verifies `planSavedLoadoutLaunch` turns a stored LAGN object (the shape
 * `GET /api/me/loadouts` delivers) into the 9-field composition plus seat
 * count, adds `finalBlow` only for a literal `setup.final_blow === true`,
 * drops `hero_alternates`, prefixes reader failures with the locked copy, and
 * answers non-LAGN, `null`, and missing values with the not-LAGN copy without
 * throwing. Pure `node:test`: no DOM, no fetch.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { planSavedLoadoutLaunch } from './savedLoadoutLaunch';

const UNREADABLE_LOADOUT_PREFIX = "This saved loadout can't be played. ";
const NOT_LAGN_MESSAGE =
  "This saved loadout can't be played. It is not a LAGN document; delete it and save it again from the loadout builder.";

/** A stored LAGN document, loose enough for each case to reshape it. */
interface LagnFixture {
  lagn_version: string;
  player_count: unknown;
  setup: Record<string, unknown>;
}

/**
 * Builds a fresh, valid 1-seat LAGN document with set-qualified ext_ids, so
 * each case can mutate its own copy.
 */
function buildLagn(): LagnFixture {
  return {
    lagn_version: '1.6.0',
    player_count: 1,
    setup: {
      mastermind: { id: 'core/red-skull', name: 'Red Skull' },
      scheme: { id: 'core/midtown-bank-robbery', name: 'Midtown Bank Robbery' },
      villain_groups: [{ id: 'core/hydra', name: 'HYDRA' }],
      henchmen_groups: [{ id: 'core/hand-ninjas', name: 'Hand Ninjas' }],
      heroes: [
        { id: 'core/black-widow', name: 'Black Widow' },
        { id: 'core/captain-america', name: 'Captain America' },
        { id: 'core/cyclops', name: 'Cyclops' },
      ],
      bystanders_count: 1,
      wounds_count: 30,
      shield_officers_count: 30,
      sidekicks_count: 0,
    },
  };
}

describe('planSavedLoadoutLaunch', () => {
  test('a valid 1-seat LAGN plans the 9-field composition and one seat', () => {
    const plan = planSavedLoadoutLaunch(buildLagn());
    if (plan.ok !== true) {
      assert.fail(`expected a launch plan, got: ${plan.message}`);
    }
    assert.deepEqual(plan.config, {
      schemeId: 'core/midtown-bank-robbery',
      mastermindId: 'core/red-skull',
      villainGroupIds: ['core/hydra'],
      henchmanGroupIds: ['core/hand-ninjas'],
      heroDeckIds: ['core/black-widow', 'core/captain-america', 'core/cyclops'],
      bystandersCount: 1,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    });
    assert.equal(plan.playerCount, 1);
  });

  test('setup.final_blow true turns Final Blow on in the config', () => {
    const lagn = buildLagn();
    lagn.setup['final_blow'] = true;
    const plan = planSavedLoadoutLaunch(lagn);
    if (plan.ok !== true) {
      assert.fail(`expected a launch plan, got: ${plan.message}`);
    }
    assert.equal(plan.config.finalBlow, true);
  });

  test('a LAGN without final_blow leaves finalBlow out of the config', () => {
    const plan = planSavedLoadoutLaunch(buildLagn());
    if (plan.ok !== true) {
      assert.fail(`expected a launch plan, got: ${plan.message}`);
    }
    assert.equal('finalBlow' in plan.config, false);
  });

  test('a final_blow value that is not literally true leaves finalBlow out', () => {
    const lagn = buildLagn();
    lagn.setup['final_blow'] = 'yes';
    const plan = planSavedLoadoutLaunch(lagn);
    if (plan.ok !== true) {
      assert.fail(`expected a launch plan, got: ${plan.message}`);
    }
    assert.equal('finalBlow' in plan.config, false);
  });

  test('hero_alternates never reach heroDeckIds', () => {
    const lagn = buildLagn();
    lagn.setup['hero_alternates'] = [
      { id: 'core/hulk', name: 'Hulk' },
      { id: 'core/wolverine', name: 'Wolverine' },
    ];
    const plan = planSavedLoadoutLaunch(lagn);
    if (plan.ok !== true) {
      assert.fail(`expected a launch plan, got: ${plan.message}`);
    }
    assert.equal(plan.config.heroDeckIds.includes('core/hulk'), false);
    assert.equal(plan.config.heroDeckIds.includes('core/wolverine'), false);
    assert.deepEqual(plan.config.heroDeckIds, [
      'core/black-widow',
      'core/captain-america',
      'core/cyclops',
    ]);
  });

  test('player_count 3 plans a 3-seat launch', () => {
    const lagn = buildLagn();
    lagn.player_count = 3;
    const plan = planSavedLoadoutLaunch(lagn);
    if (plan.ok !== true) {
      assert.fail(`expected a launch plan, got: ${plan.message}`);
    }
    assert.equal(plan.playerCount, 3);
  });

  test('a LAGN missing setup.mastermind fails with the unreadable prefix', () => {
    const lagn = buildLagn();
    delete lagn.setup['mastermind'];
    const plan = planSavedLoadoutLaunch(lagn);
    if (plan.ok !== false) {
      assert.fail('expected the plan to fail for a missing mastermind');
    }
    assert.ok(plan.message.startsWith(UNREADABLE_LOADOUT_PREFIX));
    assert.ok(plan.message.includes('setup.mastermind'));
  });

  test('an unqualified hero ext_id fails with the unreadable prefix', () => {
    const lagn = buildLagn();
    lagn.setup['heroes'] = [
      { id: 'spider-man', name: 'Spider-Man' },
      { id: 'core/cyclops', name: 'Cyclops' },
    ];
    const plan = planSavedLoadoutLaunch(lagn);
    if (plan.ok !== false) {
      assert.fail('expected the plan to fail for an unqualified hero id');
    }
    assert.ok(plan.message.startsWith(UNREADABLE_LOADOUT_PREFIX));
    assert.ok(plan.message.includes('set-qualified'));
  });

  test('player_count 9 fails with the unreadable prefix and the 1..5 range', () => {
    const lagn = buildLagn();
    lagn.player_count = 9;
    const plan = planSavedLoadoutLaunch(lagn);
    if (plan.ok !== false) {
      assert.fail('expected the plan to fail for an out-of-range seat count');
    }
    assert.ok(plan.message.startsWith(UNREADABLE_LOADOUT_PREFIX));
    assert.ok(plan.message.includes('1..5'));
  });

  test('a non-LAGN object returns the not-LAGN copy', () => {
    const plan = planSavedLoadoutLaunch({ a: 1 });
    if (plan.ok !== false) {
      assert.fail('expected the plan to fail for a non-LAGN object');
    }
    assert.equal(plan.message, NOT_LAGN_MESSAGE);
  });

  test('a null lagn returns the not-LAGN copy without throwing', () => {
    const plan = planSavedLoadoutLaunch(null);
    if (plan.ok !== false) {
      assert.fail('expected the plan to fail for a null lagn');
    }
    assert.equal(plan.message, NOT_LAGN_MESSAGE);
  });

  test('an undefined (missing) lagn returns the not-LAGN copy without throwing', () => {
    const plan = planSavedLoadoutLaunch(undefined);
    if (plan.ok !== false) {
      assert.fail('expected the plan to fail for a missing lagn');
    }
    assert.equal(plan.message, NOT_LAGN_MESSAGE);
  });
});
