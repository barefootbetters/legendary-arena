import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { VICTORY_FINALE_VFX, VICTORY_WORD } from './victoryFinaleVfxManifest';

describe('victoryFinaleVfxManifest', () => {
  test('the banner word is the constant "VICTORY!"', () => {
    assert.equal(VICTORY_WORD, 'VICTORY!');
  });

  test('the storm fires more than one burst (a storm, not a single pop)', () => {
    assert.ok(
      VICTORY_FINALE_VFX.burstCount > 1,
      'the finale must throw multiple staggered bursts',
    );
  });

  test('each burst throws a positive count under the WP-556 200-particle ceiling', () => {
    assert.ok(VICTORY_FINALE_VFX.burstParticleCount > 0);
    assert.ok(
      VICTORY_FINALE_VFX.burstParticleCount <= 200,
      'each burst must stay within the performance budget',
    );
  });

  test('bursts are staggered by a positive interval so the storm rolls', () => {
    assert.ok(VICTORY_FINALE_VFX.burstIntervalMs > 0);
  });

  test('carries a non-empty celebration palette of hex strings', () => {
    assert.ok(
      Array.isArray(VICTORY_FINALE_VFX.colors) && VICTORY_FINALE_VFX.colors.length > 0,
      'the finale must carry a non-empty colours array',
    );
    for (const colour of VICTORY_FINALE_VFX.colors) {
      assert.match(colour, /^#[0-9a-fA-F]{6}$/, `colour ${colour} must be a hex string`);
    }
  });

  test('leads with heroic gold (distinct from the other effects)', () => {
    // why: the lead colour is the finale identity — gold, pinned so a recolour is a
    // deliberate, reviewed change.
    assert.equal(VICTORY_FINALE_VFX.colors[0], '#ffd34e');
  });
});
