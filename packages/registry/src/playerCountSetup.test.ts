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
  resolveEffectiveHeroCount,
} from './playerCountSetup.js';

/** The scheme whose printed setup requires 6 heroes (D-24337). */
const SECRET_INVASION = 'core/secret-invasion-of-the-skrull-shapeshifters';

/** The scheme whose printed setup requires only 4 heroes at 2 players (D-24385). */
const CIVIL_WAR = 'core/super-hero-civil-war';

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

  it('requires 6 heroes for Secret Invasion — a 5-hero loadout is a mismatch', () => {
    // why: D-24337 — the scheme's "6 Heroes" clause. A standard 5-hero 2p loadout
    // is correct for every OTHER scheme but wrong for Secret Invasion.
    const mismatches = checkPlayerCountComposition({
      playerCount: 2,
      schemeId: SECRET_INVASION,
      villainGroupIds: ['a', 'b'],
      henchmanGroupIds: ['h'],
      heroDeckIds: ['1', '2', '3', '4', '5'], // requires 6 for this scheme
    });
    const byField = Object.fromEntries(mismatches.map((each) => [each.field, each]));
    assert.deepEqual(
      { required: byField.heroDeckIds.required, actual: byField.heroDeckIds.actual },
      { required: 6, actual: 5 },
    );
  });

  it('passes a 6-hero Secret Invasion loadout', () => {
    const mismatches = checkPlayerCountComposition({
      playerCount: 2,
      schemeId: SECRET_INVASION,
      villainGroupIds: ['a', 'b'],
      henchmanGroupIds: ['h'],
      heroDeckIds: ['1', '2', '3', '4', '5', '6'],
    });
    assert.deepEqual(mismatches, []);
  });

  it('requires only 4 heroes for Super Hero Civil War at 2p — a 5-hero loadout is a mismatch', () => {
    // why: D-24385 — the scheme's "4 Heroes at 2p" clause lowers the base 5 to 4. A
    // standard 5-hero 2p loadout is correct for every OTHER scheme but wrong here.
    const mismatchAt5 = checkPlayerCountComposition({
      playerCount: 2,
      schemeId: CIVIL_WAR,
      villainGroupIds: ['a', 'b'],
      henchmanGroupIds: ['h'],
      heroDeckIds: ['1', '2', '3', '4', '5'], // requires 4 for this scheme at 2p
    });
    const byField = Object.fromEntries(mismatchAt5.map((each) => [each.field, each]));
    assert.deepEqual(
      { required: byField.heroDeckIds.required, actual: byField.heroDeckIds.actual },
      { required: 4, actual: 5 },
    );
    // A 4-hero 2p Civil War loadout has no mismatch.
    const cleanAt4 = checkPlayerCountComposition({
      playerCount: 2,
      schemeId: CIVIL_WAR,
      villainGroupIds: ['a', 'b'],
      henchmanGroupIds: ['h'],
      heroDeckIds: ['1', '2', '3', '4'],
    });
    assert.deepEqual(cleanAt4, []);
  });

  it('leaves the 5-hero requirement intact for a non-Secret-Invasion scheme (and when no schemeId is given)', () => {
    const withOtherScheme = checkPlayerCountComposition({
      playerCount: 2,
      schemeId: 'core/some-other-scheme',
      villainGroupIds: ['a', 'b'],
      henchmanGroupIds: ['h'],
      heroDeckIds: ['1', '2', '3', '4', '5'],
    });
    assert.deepEqual(withOtherScheme, []);
    const withoutScheme = checkPlayerCountComposition({
      playerCount: 2,
      villainGroupIds: ['a', 'b'],
      henchmanGroupIds: ['h'],
      heroDeckIds: ['1', '2', '3', '4', '5'],
    });
    assert.deepEqual(withoutScheme, []);
  });
});

describe('resolveEffectiveHeroCount', () => {
  it('returns 6 for Secret Invasion at every player count (flat "6 Heroes")', () => {
    // why: 2/3/4p base 5 → 6; 5p base 6 → 6 (unchanged); solo-1p base 3 → 6.
    assert.equal(resolveEffectiveHeroCount(SECRET_INVASION, 1, 3), 6);
    assert.equal(resolveEffectiveHeroCount(SECRET_INVASION, 2, 5), 6);
    assert.equal(resolveEffectiveHeroCount(SECRET_INVASION, 3, 5), 6);
    assert.equal(resolveEffectiveHeroCount(SECRET_INVASION, 4, 5), 6);
    assert.equal(resolveEffectiveHeroCount(SECRET_INVASION, 5, 6), 6);
  });

  it('returns 4 for Super Hero Civil War at exactly 2 players only (its "4 Heroes at 2p")', () => {
    // why: D-24385 — the printed "If only 2 players, use only 4 Heroes". A per-count
    // override: exactly 4 at 2p (base 5 → 4), but the base is unchanged at every other
    // count (1p 3; 3p/4p 5; 5p 6). Exactly 4, not a range — a 5-hero 2p loadout is invalid.
    assert.equal(resolveEffectiveHeroCount(CIVIL_WAR, 2, 5), 4);
    assert.equal(resolveEffectiveHeroCount(CIVIL_WAR, 1, 3), 3);
    assert.equal(resolveEffectiveHeroCount(CIVIL_WAR, 3, 5), 5);
    assert.equal(resolveEffectiveHeroCount(CIVIL_WAR, 4, 5), 5);
    assert.equal(resolveEffectiveHeroCount(CIVIL_WAR, 5, 6), 6);
  });

  it('returns the base count unchanged for any other scheme', () => {
    assert.equal(resolveEffectiveHeroCount('core/some-other-scheme', 2, 5), 5);
    assert.equal(resolveEffectiveHeroCount('', 1, 3), 3);
    assert.equal(resolveEffectiveHeroCount('core/legacy-virus-the', 5, 6), 6);
  });

  it('never mutates the base PLAYER_COUNT_SETUP table', () => {
    resolveEffectiveHeroCount(SECRET_INVASION, 2, PLAYER_COUNT_SETUP[2].heroCount);
    assert.equal(PLAYER_COUNT_SETUP[2].heroCount, 5);
  });
});
