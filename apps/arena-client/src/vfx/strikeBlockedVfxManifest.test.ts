import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STRIKE_BLOCKED_VFX,
  BLOCKED_WORD,
  type StrikeBlockThreatKind,
} from './strikeBlockedVfxManifest';

// why: the three threatKind values the engine ships (WP-644/645/646). This
// literal is the runtime drift pin — if the engine adds a value, the exhaustive
// Record fails vue-tsc AND this keyset assertion fails, both pointing here.
const EXPECTED_THREAT_KINDS: readonly StrikeBlockThreatKind[] = [
  'masterStrike',
  'schemeTwist',
  'ambush',
];

describe('strikeBlockedVfxManifest (WP-647)', () => {
  test('maps exactly the three threatKind values, no more, no fewer', () => {
    assert.deepEqual(
      Object.keys(STRIKE_BLOCKED_VFX).sort(),
      [...EXPECTED_THREAT_KINDS].sort(),
    );
  });

  test('every threatKind maps to a non-empty colours palette', () => {
    for (const threatKind of EXPECTED_THREAT_KINDS) {
      const spec = STRIKE_BLOCKED_VFX[threatKind];
      assert.ok(spec !== undefined, `${threatKind} must be mapped`);
      assert.ok(
        Array.isArray(spec.colors) && spec.colors.length > 0,
        `${threatKind} must carry a non-empty colours array`,
      );
      for (const colour of spec.colors) {
        assert.match(colour, /^#[0-9a-fA-F]{6}$/, `${threatKind} colour ${colour} must be a hex string`);
      }
    }
  });

  test('the call-out word is the constant "BLOCKED!"', () => {
    assert.equal(BLOCKED_WORD, 'BLOCKED!');
  });
});
