/**
 * playerCountSetup.test.ts — WP-370 / D-24165.
 *
 * Drift-locks the canonical per-player-count setup table against the Marvel
 * Legendary rules and covers the pure lookup + composition-check helpers.
 * node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAYER_COUNT_SETUP,
  getPlayerCountSetup,
  checkPlayerCountComposition,
} from './playerCountSetup.js';

describe('PLAYER_COUNT_SETUP table', () => {
  it('locks the exact rules values for player counts 1–5', () => {
    // why: literal drift-lock — the numbers here ARE the rules table. If the
    // constant drifts, this test fails loudly rather than shipping a wrong
    // board. villain groups / henchmen groups / villain-deck bystanders / heroes.
    assert.deepEqual(PLAYER_COUNT_SETUP, {
      1: { villainGroupCount: 1, henchmenGroupCount: 1, villainDeckBystanderCount: 1, heroCount: 3 },
      2: { villainGroupCount: 2, henchmenGroupCount: 1, villainDeckBystanderCount: 2, heroCount: 5 },
      3: { villainGroupCount: 3, henchmenGroupCount: 1, villainDeckBystanderCount: 8, heroCount: 5 },
      4: { villainGroupCount: 3, henchmenGroupCount: 2, villainDeckBystanderCount: 8, heroCount: 5 },
      5: { villainGroupCount: 4, henchmenGroupCount: 2, villainDeckBystanderCount: 12, heroCount: 6 },
    });
  });

  it('has exactly the player counts 1 through 5', () => {
    assert.deepEqual(Object.keys(PLAYER_COUNT_SETUP), ['1', '2', '3', '4', '5']);
  });
});

describe('getPlayerCountSetup', () => {
  it('returns the row for each supported player count', () => {
    assert.equal(getPlayerCountSetup(3)?.villainDeckBystanderCount, 8);
    assert.equal(getPlayerCountSetup(5)?.heroCount, 6);
    assert.equal(getPlayerCountSetup(1)?.villainGroupCount, 1);
  });

  it('returns undefined for a player count outside 1–5', () => {
    assert.equal(getPlayerCountSetup(0), undefined);
    assert.equal(getPlayerCountSetup(6), undefined);
    assert.equal(getPlayerCountSetup(2.5), undefined);
  });
});

describe('checkPlayerCountComposition', () => {
  it('returns no mismatches when the composition matches the player count', () => {
    const mismatches = checkPlayerCountComposition({
      playerCount: 2,
      villainGroupIds: ['a', 'b'],
      henchmanGroupIds: ['h'],
      heroDeckIds: ['1', '2', '3', '4', '5'],
    });
    assert.deepEqual(mismatches, []);
  });

  it('reports each wrong count with required and actual values', () => {
    const mismatches = checkPlayerCountComposition({
      playerCount: 3,
      villainGroupIds: ['a', 'b'],          // requires 3
      henchmanGroupIds: ['h'],              // requires 1 — ok
      heroDeckIds: ['1', '2', '3'],         // requires 5
    });
    const byField = Object.fromEntries(mismatches.map((each) => [each.field, each]));
    assert.equal(mismatches.length, 2);
    assert.deepEqual(
      { required: byField.villainGroupIds.required, actual: byField.villainGroupIds.actual },
      { required: 3, actual: 2 },
    );
    assert.deepEqual(
      { required: byField.heroDeckIds.required, actual: byField.heroDeckIds.actual },
      { required: 5, actual: 3 },
    );
    assert.equal(byField.henchmanGroupIds, undefined);
  });

  it('returns no mismatches when the player count is out of range (cannot be judged)', () => {
    const mismatches = checkPlayerCountComposition({
      playerCount: 9,
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    });
    assert.deepEqual(mismatches, []);
  });
});
