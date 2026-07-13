/**
 * playerCountRequirements.test.ts — WP-371.
 *
 * Covers the pure pre-submit composition check + warning formatter.
 * node:test + node:assert only.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  computePlayerCountMismatches,
  formatMismatchWarning,
  type SetupRequirements,
} from './playerCountRequirements';

const REQUIREMENTS: SetupRequirements = {
  1: { villainGroupCount: 1, henchmenGroupCount: 1, villainDeckBystanderCount: 1, heroCount: 3 },
  2: { villainGroupCount: 2, henchmenGroupCount: 1, villainDeckBystanderCount: 2, heroCount: 5 },
  3: { villainGroupCount: 3, henchmenGroupCount: 1, villainDeckBystanderCount: 8, heroCount: 5 },
  4: { villainGroupCount: 3, henchmenGroupCount: 2, villainDeckBystanderCount: 8, heroCount: 5 },
  5: { villainGroupCount: 4, henchmenGroupCount: 2, villainDeckBystanderCount: 12, heroCount: 6 },
};

describe('computePlayerCountMismatches', () => {
  test('returns no mismatches when the composition matches the player count', () => {
    const mismatches = computePlayerCountMismatches(REQUIREMENTS, 2, {
      villainGroups: 2,
      henchmanGroups: 1,
      heroes: 5,
    });
    assert.deepEqual(mismatches, []);
  });

  test('reports each wrong count with required and actual', () => {
    const mismatches = computePlayerCountMismatches(REQUIREMENTS, 4, {
      villainGroups: 1, // requires 3
      henchmanGroups: 2, // requires 2 — ok
      heroes: 6, // requires 5
    });
    assert.equal(mismatches.length, 2);
    const byLabel = Object.fromEntries(mismatches.map((each) => [each.label, each]));
    assert.deepEqual(byLabel['villain groups'], { label: 'villain groups', required: 3, actual: 1 });
    assert.deepEqual(byLabel['heroes'], { label: 'heroes', required: 5, actual: 6 });
    assert.equal(byLabel['henchmen groups'], undefined);
  });

  test('stays silent (no mismatches) when requirements are unavailable', () => {
    const mismatches = computePlayerCountMismatches(null, 2, {
      villainGroups: 0,
      henchmanGroups: 0,
      heroes: 0,
    });
    assert.deepEqual(mismatches, []);
  });

  test('stays silent when the player count is out of range', () => {
    const mismatches = computePlayerCountMismatches(REQUIREMENTS, 9, {
      villainGroups: 0,
      henchmanGroups: 0,
      heroes: 0,
    });
    assert.deepEqual(mismatches, []);
  });
});

describe('formatMismatchWarning', () => {
  test('builds a full-sentence warning naming the player count, required, and actual', () => {
    const warning = formatMismatchWarning(4, { label: 'villain groups', required: 3, actual: 1 });
    assert.equal(warning, 'A 4-player match needs 3 villain groups — this loadout has 1.');
  });
});
