/**
 * Unit tests for economy logic helpers.
 *
 * Tests parseCardStatValue, addResources, and resetTurnEconomy.
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCardStatValue,
  addResources,
  resetTurnEconomy,
} from './economy.logic.js';

describe('parseCardStatValue', () => {
  it('"2+" returns 2', () => {
    assert.strictEqual(parseCardStatValue('2+'), 2);
  });

  it('"0+" returns 0', () => {
    assert.strictEqual(parseCardStatValue('0+'), 0);
  });

  it('null returns 0', () => {
    assert.strictEqual(parseCardStatValue(null), 0);
  });

  it('"2*" returns 2', () => {
    assert.strictEqual(parseCardStatValue('2*'), 2);
  });

  it('integer 3 returns 3', () => {
    assert.strictEqual(parseCardStatValue(3), 3);
  });

  it('"garbage" returns 0', () => {
    assert.strictEqual(parseCardStatValue('garbage'), 0);
  });
});

describe('addResources', () => {
  it('returns new object with correct totals', () => {
    const before = { attack: 1, recruit: 2, spentAttack: 0, spentRecruit: 0 };
    const after = addResources(before, 3, 4);

    assert.strictEqual(after.attack, 4);
    assert.strictEqual(after.recruit, 6);
    assert.strictEqual(after.spentAttack, 0);
    assert.strictEqual(after.spentRecruit, 0);

    // Verify new object returned (input not mutated)
    assert.notStrictEqual(after, before);
    assert.strictEqual(before.attack, 1);
    assert.strictEqual(before.recruit, 2);
  });
});

describe('resetTurnEconomy', () => {
  it('returns all zeros', () => {
    const economy = resetTurnEconomy();

    assert.strictEqual(economy.attack, 0);
    assert.strictEqual(economy.recruit, 0);
    assert.strictEqual(economy.spentAttack, 0);
    assert.strictEqual(economy.spentRecruit, 0);
  });
});
