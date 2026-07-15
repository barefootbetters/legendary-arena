/**
 * Drift + behavior tests for the client Wound identity (WP-380).
 *
 * The drift test imports the engine `WOUND_EXT_ID` (a test-only engine import is
 * permitted — components may not) and asserts the client-local constant matches,
 * so the mirrored literal can never drift from the engine.
 *
 * Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WOUND_EXT_ID as ENGINE_WOUND_EXT_ID } from '@legendary-arena/game-engine';
import { WOUND_EXT_ID, handHasWound } from './woundIdentity';

describe('woundIdentity', () => {
  it('the client WOUND_EXT_ID matches the engine constant (drift guard)', () => {
    assert.equal(WOUND_EXT_ID, ENGINE_WOUND_EXT_ID);
  });

  it('handHasWound detects a Wound among other cards', () => {
    assert.equal(handHasWound(['starting-shield-agent', WOUND_EXT_ID]), true);
  });

  it('handHasWound is false for a wound-free hand', () => {
    assert.equal(
      handHasWound(['starting-shield-agent', 'starting-shield-trooper']),
      false,
    );
  });

  it('handHasWound is false for an undefined (redacted / absent) hand', () => {
    assert.equal(handHasWound(undefined), false);
  });

  it('handHasWound is false for an empty hand', () => {
    assert.equal(handHasWound([]), false);
  });
});
