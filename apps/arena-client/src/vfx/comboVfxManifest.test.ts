import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  comboVfxManifest,
  comboTierForCount,
  type ComboTier,
} from './comboVfxManifest';
import { comboTierForCount as audioComboTierForCount } from '../audio/comboCueManifest';

const AUDIBLE_TIERS: readonly Exclude<ComboTier, 'none'>[] = [
  'small',
  'medium',
  'big',
  'legendary',
];

describe('comboVfxManifest (WP-556) — shared tier source', () => {
  test('re-exports the SINGLE shared comboTierForCount (no re-derived mapping)', () => {
    // why: the flash and the sting must consume the identical tier boundaries
    // (Combo Tier Contract). The manifest re-exports the audio manifest's
    // helper — this pins they are the same function, not a copy that could drift.
    assert.equal(comboTierForCount, audioComboTierForCount);
    assert.equal(comboTierForCount(0), 'none');
    assert.equal(comboTierForCount(1), 'small');
    assert.equal(comboTierForCount(2), 'medium');
    assert.equal(comboTierForCount(4), 'big');
    assert.equal(comboTierForCount(5), 'legendary');
  });
});

describe('comboVfxManifest (WP-556) — exhaustiveness + budget', () => {
  test('maps all four audible tiers to a spec', () => {
    for (const tier of AUDIBLE_TIERS) {
      assert.ok(comboVfxManifest[tier], `tier ${tier} must be mapped`);
    }
  });

  test('particle counts ascend with the tier and stay within the 200 budget', () => {
    const counts = AUDIBLE_TIERS.map((tier) => comboVfxManifest[tier].particleCount);
    counts.forEach((count, index) => {
      assert.ok(count > 0 && count <= 200, 'particle count within (0, 200]');
      if (index > 0) {
        const previous = counts[index - 1] ?? 0;
        assert.ok(count > previous, 'particle count must ascend by tier');
      }
    });
  });
});

describe('comboVfxManifest (WP-556) — call-out ladder', () => {
  test('the flash starts at small but the WORD starts at medium (contrast-through-restraint)', () => {
    assert.equal(comboVfxManifest.small.word, null);
  });

  test('the call-out words match the locked ladder', () => {
    assert.equal(comboVfxManifest.medium.word, 'Team-Up!');
    assert.equal(comboVfxManifest.big.word, 'Unstoppable!');
    assert.equal(comboVfxManifest.legendary.word, 'LEGENDARY!');
  });

  test('only the peaks (big / legendary) earn a shake', () => {
    assert.equal(comboVfxManifest.small.shake, false);
    assert.equal(comboVfxManifest.medium.shake, false);
    assert.equal(comboVfxManifest.big.shake, true);
    assert.equal(comboVfxManifest.legendary.shake, true);
  });
});
