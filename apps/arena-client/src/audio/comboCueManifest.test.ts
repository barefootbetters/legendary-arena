import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { comboTierForCount, comboCueManifest, type ComboTier } from './comboCueManifest';

describe('comboTierForCount (WP-413) — locked tier boundaries', () => {
  test('<= 0 maps to none (silent floor)', () => {
    assert.equal(comboTierForCount(0), 'none');
    assert.equal(comboTierForCount(-1), 'none');
    assert.equal(comboTierForCount(-5), 'none');
  });

  test('1 maps to small', () => {
    assert.equal(comboTierForCount(1), 'small');
  });

  test('2 maps to medium', () => {
    assert.equal(comboTierForCount(2), 'medium');
  });

  test('3 and 4 map to big', () => {
    assert.equal(comboTierForCount(3), 'big');
    assert.equal(comboTierForCount(4), 'big');
  });

  test('5 or more maps to legendary (the apex tier — WP-425 / D-24246)', () => {
    assert.equal(comboTierForCount(5), 'legendary');
    assert.equal(comboTierForCount(12), 'legendary');
  });
});

describe('comboCueManifest (WP-413 + WP-425) — exhaustive over the audible tiers', () => {
  const AUDIBLE_TIERS: readonly Exclude<ComboTier, 'none'>[] = ['small', 'medium', 'big', 'legendary'];

  test('maps exactly the four audible tiers', () => {
    assert.deepEqual(Object.keys(comboCueManifest).sort(), [...AUDIBLE_TIERS].sort());
  });

  test('every audible tier maps to a non-empty audio/sound-effects/ URL', () => {
    for (const tier of AUDIBLE_TIERS) {
      const url = comboCueManifest[tier];
      assert.equal(typeof url, 'string', `manifest['${tier}'] must be a string`);
      assert.ok(url.length > 0, `manifest['${tier}'] must be non-empty`);
      assert.ok(
        url.includes('/audio/sound-effects/'),
        `manifest['${tier}'] must reference the audio/sound-effects/ R2 prefix (got '${url}')`,
      );
    }
  });

  test('serves clips from images.legendary-arena.com', () => {
    for (const tier of AUDIBLE_TIERS) {
      assert.ok(
        comboCueManifest[tier].startsWith('https://images.legendary-arena.com/audio/sound-effects/'),
        `manifest['${tier}'] must be hosted on images.legendary-arena.com`,
      );
    }
  });

  test("the silent 'none' tier is deliberately absent from the manifest", () => {
    assert.equal('none' in comboCueManifest, false);
  });
});
