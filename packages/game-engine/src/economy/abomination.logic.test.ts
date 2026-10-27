/**
 * Tests for the Abomination fight-cost terms (WP-815 / D-24747).
 *
 * Pins the ABOMINATION_KINDS drift (T21) and the family scoping of the two
 * term helpers. The resolver-level arithmetic (T2-T14) lives in
 * economy.resolve.test.ts.
 *
 * Uses node:test only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  ABOMINATION_KINDS,
  villainAbominationBonus,
  mastermindAbominationBonus,
} from './abomination.logic.js';
import type { AbominationKind } from './abomination.logic.js';

/**
 * A G with villain `v` at City index 0, a Hero of printed Attack 3 in hq[4], a
 * Mastermind base `mm-base`, and the given kinds.
 *
 * @param cardAbomination - The kind map, or undefined to omit the field.
 */
function makeG(cardAbomination?: Record<string, AbominationKind>): LegendaryGameState {
  return {
    cardStats: { 'hero-3': { attack: 3 } },
    city: ['v', null, null, null, null],
    hq: [null, null, null, null, 'hero-3'],
    mastermind: { baseCardId: 'mm-base' },
    ...(cardAbomination === undefined ? {} : { cardAbomination }),
  } as unknown as LegendaryGameState;
}

describe('ABOMINATION_KINDS (WP-815 / D-24747)', () => {
  // why: T21 — a RUNTIME drift pin (D-24372): engine test files are not type-checked,
  // so the keyset of a Record<AbominationKind, true> literal is compared at run time.
  it('equals the four AbominationKind members, in order', () => {
    const unionMembers: Record<AbominationKind, true> = {
      'abomination': true,
      'double-abomination': true,
      'ultimate-abomination': true,
      'double-highest-abomination': true,
    };
    assert.deepStrictEqual([...ABOMINATION_KINDS], Object.keys(unionMembers));
    assert.deepStrictEqual([...ABOMINATION_KINDS], [
      'abomination',
      'double-abomination',
      'ultimate-abomination',
      'double-highest-abomination',
    ]);
  });
});

describe('villainAbominationBonus (WP-815 / D-24747)', () => {
  it('reads the printed Attack under the villain for abomination, doubled for double-abomination', () => {
    assert.equal(villainAbominationBonus(makeG({ v: 'abomination' }), 'v' as CardExtId), 3);
    assert.equal(villainAbominationBonus(makeG({ v: 'double-abomination' }), 'v' as CardExtId), 6);
  });

  it('is 0 for a mastermind kind, no entry, or no cardAbomination field', () => {
    assert.equal(villainAbominationBonus(makeG({ v: 'ultimate-abomination' }), 'v' as CardExtId), 0);
    assert.equal(villainAbominationBonus(makeG({ v: 'double-highest-abomination' }), 'v' as CardExtId), 0);
    assert.equal(villainAbominationBonus(makeG({}), 'v' as CardExtId), 0);
    assert.equal(villainAbominationBonus(makeG(), 'v' as CardExtId), 0);
  });
});

describe('mastermindAbominationBonus (WP-815 / D-24747)', () => {
  it('is 0 for a villain kind, no entry, or no cardAbomination field', () => {
    assert.equal(mastermindAbominationBonus(makeG({ 'mm-base': 'abomination' })), 0);
    assert.equal(mastermindAbominationBonus(makeG({ 'mm-base': 'double-abomination' })), 0);
    assert.equal(mastermindAbominationBonus(makeG({})), 0);
    assert.equal(mastermindAbominationBonus(makeG()), 0);
  });

  it('sums the HQ for ultimate-abomination and doubles the highest for double-highest-abomination', () => {
    assert.equal(mastermindAbominationBonus(makeG({ 'mm-base': 'ultimate-abomination' })), 3);
    assert.equal(mastermindAbominationBonus(makeG({ 'mm-base': 'double-highest-abomination' })), 6);
  });
});
