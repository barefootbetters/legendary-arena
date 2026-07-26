import test from 'node:test';
import assert from 'node:assert/strict';

import { LOG_OUTCOMES } from '@legendary-arena/game-engine';
import type { LogOutcome } from '@legendary-arena/game-engine';
import { logOutcomeDisplay } from './logOutcomeDisplay';
import type { LogOutcomeDisplay } from './logOutcomeDisplay';

// why: WP-435 — a LITERAL expected-triple map keyed per LogOutcome (not a
// `toBeDefined()` iterate). If a new outcome is added to LOG_OUTCOMES, this map has no
// row for it → the drift assertion below fails, forcing the render mapping to be
// updated in lockstep. A tautological "every outcome returns something" test would miss
// exactly that.
const EXPECTED: Record<LogOutcome, LogOutcomeDisplay> = {
  neutral: { className: '', glyph: '', label: '' },
  applied: { className: 'game-log__line--applied', glyph: '✓', label: 'applied' },
  partial: { className: 'game-log__line--partial', glyph: '⚠', label: 'partial' },
  blocked: { className: 'game-log__line--blocked', glyph: '✕', label: 'blocked' },
};

test('logOutcomeDisplay returns the exact render triple for every outcome', () => {
  for (const outcome of LOG_OUTCOMES) {
    assert.deepEqual(
      logOutcomeDisplay(outcome),
      EXPECTED[outcome],
      `logOutcomeDisplay("${outcome}") did not match the expected render triple; update the DISPLAY map in logOutcomeDisplay.ts (and this EXPECTED map) so the two stay in lockstep.`,
    );
  }
});

test('drift: LOG_OUTCOMES and the EXPECTED render map cover the same outcomes', () => {
  // why: guards the reverse direction — a value present in LOG_OUTCOMES but missing an
  // EXPECTED row (or vice versa) is a drift bug. Object.keys of a Record<LogOutcome,…>
  // enumerates exactly the union members, so the counts and membership must match.
  const expectedKeys = Object.keys(EXPECTED).sort();
  const outcomeKeys = [...LOG_OUTCOMES].sort();
  assert.deepEqual(expectedKeys, outcomeKeys);
});

test('neutral is the unstyled, no-glyph, no-label case', () => {
  assert.deepEqual(logOutcomeDisplay('neutral'), { className: '', glyph: '', label: '' });
});
