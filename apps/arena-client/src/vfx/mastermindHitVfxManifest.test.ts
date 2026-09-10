import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MASTERMIND_HIT_VFX,
  MASTERMIND_HIT_BURST_COLORS,
  mastermindHitTierForCount,
  type MastermindHitTier,
} from './mastermindHitVfxManifest';

const ALL_TIERS: readonly MastermindHitTier[] = ['hit1', 'hit2', 'hit3', 'hit4'];

describe('mastermindHitVfxManifest — mastermindHitTierForCount', () => {
  test('a count of 0 or below maps to null (nothing landed)', () => {
    assert.equal(mastermindHitTierForCount(0), null);
    assert.equal(mastermindHitTierForCount(-1), null);
  });

  test('counts 1..4 map to hit1..hit4', () => {
    assert.equal(mastermindHitTierForCount(1), 'hit1');
    assert.equal(mastermindHitTierForCount(2), 'hit2');
    assert.equal(mastermindHitTierForCount(3), 'hit3');
    assert.equal(mastermindHitTierForCount(4), 'hit4');
  });

  test('a defensive over-count (>= 5) still maps to the top beat hit4', () => {
    // why: there is no fifth Tactic, so the ladder is bounded at hit4; a stray
    // higher count must never fall through to undefined.
    assert.equal(mastermindHitTierForCount(5), 'hit4');
    assert.equal(mastermindHitTierForCount(99), 'hit4');
  });
});

describe('mastermindHitVfxManifest — MASTERMIND_HIT_VFX', () => {
  test('defines exactly the four hit tiers', () => {
    assert.deepEqual(Object.keys(MASTERMIND_HIT_VFX).sort(), [...ALL_TIERS].sort());
  });

  test('every tier carries a positive particle count', () => {
    for (const tier of ALL_TIERS) {
      assert.ok(
        MASTERMIND_HIT_VFX[tier].particleCount > 0,
        `${tier} must throw a positive particle count`,
      );
    }
  });

  test('particle counts ascend across the ladder (a later hit reads bigger)', () => {
    assert.ok(MASTERMIND_HIT_VFX.hit1.particleCount < MASTERMIND_HIT_VFX.hit2.particleCount);
    assert.ok(MASTERMIND_HIT_VFX.hit2.particleCount < MASTERMIND_HIT_VFX.hit3.particleCount);
    assert.ok(MASTERMIND_HIT_VFX.hit3.particleCount < MASTERMIND_HIT_VFX.hit4.particleCount);
  });

  test('every burst stays under the WP-556 200-particle ceiling', () => {
    for (const tier of ALL_TIERS) {
      assert.ok(
        MASTERMIND_HIT_VFX[tier].particleCount <= 200,
        `${tier} must stay within the performance budget`,
      );
    }
  });

  test('shake is reserved for the heavier hits (hit3, hit4) only', () => {
    // why: the shake discipline mirrors the combo beat (shake at big+ only) — the
    // first blows spark without a screen-shake so the reward escalates.
    assert.equal(MASTERMIND_HIT_VFX.hit1.shake, false);
    assert.equal(MASTERMIND_HIT_VFX.hit2.shake, false);
    assert.equal(MASTERMIND_HIT_VFX.hit3.shake, true);
    assert.equal(MASTERMIND_HIT_VFX.hit4.shake, true);
  });

  test('hit1 and hit4 are wordless; the middle hits carry a word', () => {
    // why: hit1 is a wordless spark (contrast-through-restraint), and hit4 cedes its
    // word to the victory finale banner when it is the vanquish (normal rules).
    assert.equal(MASTERMIND_HIT_VFX.hit1.word, null);
    assert.equal(MASTERMIND_HIT_VFX.hit2.word, 'STAGGERED!');
    assert.equal(MASTERMIND_HIT_VFX.hit3.word, 'RECKONING!');
    assert.equal(MASTERMIND_HIT_VFX.hit4.word, null);
  });
});

describe('mastermindHitVfxManifest — MASTERMIND_HIT_BURST_COLORS', () => {
  test('carries a non-empty ember palette of hex strings', () => {
    assert.ok(
      Array.isArray(MASTERMIND_HIT_BURST_COLORS) && MASTERMIND_HIT_BURST_COLORS.length > 0,
      'the mastermind-hit burst must carry a non-empty colours array',
    );
    for (const colour of MASTERMIND_HIT_BURST_COLORS) {
      assert.match(colour, /^#[0-9a-fA-F]{6}$/, `colour ${colour} must be a hex string`);
    }
  });

  test('leads with the molten amber (distinct from other effects)', () => {
    // why: the lead colour is the mastermind-hit identity — an amber ember not used
    // by the Master Strike red / transform green / shield threat colours. Pins it so
    // a recolour is a deliberate, reviewed change.
    assert.equal(MASTERMIND_HIT_BURST_COLORS[0], '#ff9d2e');
  });
});
