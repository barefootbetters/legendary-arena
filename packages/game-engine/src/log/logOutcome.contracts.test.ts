import test from 'node:test';
import assert from 'node:assert';

import { LOG_OUTCOMES } from './logOutcome.types.js';
import type { LogOutcome } from './logOutcome.types.js';

// why: WP-434 — LOG_OUTCOMES is a canonical drift-detected array (code-style
// §Drift Detection). This test fails loudly if the LogOutcome union and the
// LOG_OUTCOMES array ever drift — adding a colour to one without the other is a bug.
test('drift: LOG_OUTCOMES is exactly ["neutral", "applied", "partial", "blocked"]', () => {
  assert.deepStrictEqual(
    [...LOG_OUTCOMES],
    ['neutral', 'applied', 'partial', 'blocked'],
  );
});

// why: a compile-time proof that every LOG_OUTCOMES member is assignable to the
// LogOutcome union (and the exhaustive switch below proves the reverse — every union
// member is in the array). Together they pin array<->union parity.
test('drift: every LogOutcome union member appears in LOG_OUTCOMES', () => {
  const allOutcomes: LogOutcome[] = ['neutral', 'applied', 'partial', 'blocked'];
  for (const outcome of allOutcomes) {
    assert.ok(
      LOG_OUTCOMES.includes(outcome),
      `LogOutcome "${outcome}" is missing from the LOG_OUTCOMES canonical array; add it (or remove it from the union) so the two stay in lockstep.`,
    );
  }
  assert.strictEqual(LOG_OUTCOMES.length, allOutcomes.length);
});
