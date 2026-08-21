/**
 * Unit tests for the WP-580 / D-24389 recruit-as-attack conversion helpers
 * (God of Thunder: "You can use Recruit as Attack this turn.").
 *
 * Covers: the turn-scoped flag, the combined spendable-attack figure, the
 * attack-first-then-recruit spend order, the carry-forward across every
 * TurnEconomy rebuild, and the lazy-materialization / hash-stability guarantee.
 *
 * node:test + node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAvailableAttack,
  getSpendableAttack,
  enableRecruitSpendableAsAttack,
  spendFightCost,
  addResources,
  spendAttack,
  spendRecruit,
  resetTurnEconomy,
} from './economy.logic.js';
import type { TurnEconomy } from './economy.types.js';

/** A turn economy with 3 attack and 5 recruit available, nothing spent. */
function baseEconomy(): TurnEconomy {
  return { attack: 3, recruit: 5, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 };
}

describe('recruit-as-attack conversion — the turn flag (WP-580 / D-24389)', () => {
  it('enableRecruitSpendableAsAttack sets the flag and leaves every other field unchanged', () => {
    const before = baseEconomy();
    const after = enableRecruitSpendableAsAttack(before);
    assert.equal(after.recruitSpendableAsAttack, true);
    assert.equal(after.attack, 3);
    assert.equal(after.recruit, 5);
    assert.equal(after.spentAttack, 0);
    assert.equal(after.spentRecruit, 0);
    assert.equal(after.piercing, 0);
    assert.equal(after.woundsDrawn, 0);
  });

  it('resetTurnEconomy drops the flag (lazy: absent at every turn boundary)', () => {
    const reset = resetTurnEconomy();
    // why: the field must be ABSENT (not present-and-false) so JSON.stringify omits it.
    assert.ok(!('recruitSpendableAsAttack' in reset));
  });

  it('a fresh economy serializes byte-identically to the pre-WP-580 six-field shape', () => {
    // why: the state-hash oracles JSON.stringify G.turnEconomy; an absent flag is
    // omitted, so a turn that never triggers the conversion is hash-stable.
    assert.equal(
      JSON.stringify(resetTurnEconomy()),
      '{"attack":0,"recruit":0,"spentAttack":0,"spentRecruit":0,"piercing":0,"woundsDrawn":0}',
    );
  });
});

describe('recruit-as-attack conversion — getSpendableAttack', () => {
  it('equals getAvailableAttack when the flag is unset', () => {
    const economy = baseEconomy();
    assert.equal(getSpendableAttack(economy), getAvailableAttack(economy));
    assert.equal(getSpendableAttack(economy), 3);
  });

  it('folds in unspent recruit when the flag is set', () => {
    const economy = enableRecruitSpendableAsAttack(baseEconomy());
    // 3 available attack + 5 unspent recruit
    assert.equal(getSpendableAttack(economy), 8);
  });

  it('counts only UNSPENT recruit when the flag is set', () => {
    const economy = spendRecruit(enableRecruitSpendableAsAttack(baseEconomy()), 2);
    // 3 attack + (5 - 2) unspent recruit
    assert.equal(getSpendableAttack(economy), 6);
  });
});

describe('recruit-as-attack conversion — spendFightCost (attack first, then recruit)', () => {
  it('funds entirely from attack when attack covers the cost', () => {
    const economy = enableRecruitSpendableAsAttack(baseEconomy());
    const after = spendFightCost(economy, 2);
    assert.equal(after.spentAttack, 2);
    assert.equal(after.spentRecruit, 0);
  });

  it('exhausts attack first, then funds the remainder from recruit', () => {
    const economy = enableRecruitSpendableAsAttack(baseEconomy());
    const after = spendFightCost(economy, 6); // 3 from attack, 3 from recruit
    assert.equal(after.spentAttack, 3);
    assert.equal(after.spentRecruit, 3);
  });

  it('is byte-identical to spendAttack when the flag is unset (remainder always 0)', () => {
    const economy = baseEconomy();
    assert.deepEqual(spendFightCost(economy, 3), spendAttack(economy, 3));
  });
});

describe('recruit-as-attack conversion — flag survives every TurnEconomy rebuild', () => {
  it('addResources carries the flag forward', () => {
    const economy = enableRecruitSpendableAsAttack(baseEconomy());
    assert.equal(addResources(economy, 2, 1).recruitSpendableAsAttack, true);
  });

  it('spendAttack carries the flag forward', () => {
    const economy = enableRecruitSpendableAsAttack(baseEconomy());
    assert.equal(spendAttack(economy, 1).recruitSpendableAsAttack, true);
  });

  it('spendRecruit carries the flag forward', () => {
    const economy = enableRecruitSpendableAsAttack(baseEconomy());
    assert.equal(spendRecruit(economy, 1).recruitSpendableAsAttack, true);
  });

  it('rebuilds keep the flag ABSENT when it was never set (no undefined key)', () => {
    const economy = baseEconomy();
    for (const rebuilt of [addResources(economy, 1, 1), spendAttack(economy, 1), spendRecruit(economy, 1)]) {
      assert.ok(!('recruitSpendableAsAttack' in rebuilt));
    }
  });
});
