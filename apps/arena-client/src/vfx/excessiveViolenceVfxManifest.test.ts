import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXCESSIVE_VIOLENCE_VFX,
  EXCESSIVE_VIOLENCE_WORD,
} from './excessiveViolenceVfxManifest';

describe('excessiveViolenceVfxManifest (WP-746)', () => {
  test('carries a non-empty crimson/steel colours palette of hex strings', () => {
    assert.ok(
      Array.isArray(EXCESSIVE_VIOLENCE_VFX.colors) && EXCESSIVE_VIOLENCE_VFX.colors.length > 0,
      'the Excessive Violence burst must carry a non-empty colours array',
    );
    for (const colour of EXCESSIVE_VIOLENCE_VFX.colors) {
      assert.match(colour, /^#[0-9a-fA-F]{6}$/, `colour ${colour} must be a hex string`);
    }
  });

  test('the call-out word is the constant "EXCESSIVE VIOLENCE!"', () => {
    assert.equal(EXCESSIVE_VIOLENCE_WORD, 'EXCESSIVE VIOLENCE!');
  });

  test('the particle count is positive and within the WP-556 200-particle ceiling', () => {
    assert.ok(
      Number.isInteger(EXCESSIVE_VIOLENCE_VFX.particleCount) && EXCESSIVE_VIOLENCE_VFX.particleCount > 0,
      'the particle count must be a positive integer',
    );
    assert.ok(
      EXCESSIVE_VIOLENCE_VFX.particleCount <= 200,
      `the particle count (${EXCESSIVE_VIOLENCE_VFX.particleCount}) must not exceed the WP-556 200-particle ceiling`,
    );
  });

  test('carries a non-empty sword shape path and a legible blade scalar', () => {
    // why: the fix-forward that turns the round confetti into blade particles —
    // the overlay feeds shapePath to canvas-confetti's shapeFromPath. Assert it is
    // a non-empty SVG path (starts with a move command) and the scalar is above
    // the round-confetti default so the sword is legible, not a speck.
    assert.ok(
      typeof EXCESSIVE_VIOLENCE_VFX.shapePath === 'string' && EXCESSIVE_VIOLENCE_VFX.shapePath.length > 0,
      'the Excessive Violence burst must carry a non-empty sword shape path',
    );
    assert.match(
      EXCESSIVE_VIOLENCE_VFX.shapePath,
      /^M/,
      'the sword shape path must begin with a move command',
    );
    assert.ok(
      EXCESSIVE_VIOLENCE_VFX.scalar > 1,
      `the blade scalar (${EXCESSIVE_VIOLENCE_VFX.scalar}) must exceed the round-confetti default so the sword is legible`,
    );
  });

  test('the palette leads with the crimson lead colour, distinct from every other effect', () => {
    // why: the lead colour is the Excessive Violence beat's identity — a crimson
    // used by no other effect. Pins it so a future recolour is a deliberate,
    // reviewed change, and asserts it does not collide with any sibling effect's
    // lead colour (Master Strike red, mastermind-hit amber, transform gamma-green,
    // wound dull-red).
    const lead = EXCESSIVE_VIOLENCE_VFX.colors[0];
    assert.equal(lead, '#b3122b');
    const otherEffectLeads = ['#e23046', '#ff9d2e', '#5ee66b', '#960c0c'];
    assert.ok(
      !otherEffectLeads.includes(lead),
      `the lead colour ${lead} must be distinct from every other effect's lead`,
    );
  });
});
