import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TRANSFORM_VFX, TRANSFORM_WORD } from './transformVfxManifest';

describe('transformVfxManifest (WP-672)', () => {
  test('carries a non-empty gamma-green colours palette of hex strings', () => {
    assert.ok(
      Array.isArray(TRANSFORM_VFX.colors) && TRANSFORM_VFX.colors.length > 0,
      'the transform burst must carry a non-empty colours array',
    );
    for (const colour of TRANSFORM_VFX.colors) {
      assert.match(colour, /^#[0-9a-fA-F]{6}$/, `colour ${colour} must be a hex string`);
    }
  });

  test('the call-out word is the constant "TRANSFORMED!"', () => {
    assert.equal(TRANSFORM_WORD, 'TRANSFORMED!');
  });

  test('the palette leads with the radioactive gamma green (distinct from other effects)', () => {
    // why: the lead colour is the transform's identity — a gamma green not used by
    // any other effect (Master Strike red #e23046, wound dull-red, shield threat
    // colours). Pins it so a future recolour is a deliberate, reviewed change.
    assert.equal(TRANSFORM_VFX.colors[0], '#5ee66b');
  });
});
