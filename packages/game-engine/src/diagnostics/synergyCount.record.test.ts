/**
 * Tests for the conditional-clause synergy counter writer (WP-708 / D-24531).
 *
 * Covers: lazy-init on a fresh G (and the mirrored hollow-channel init shape),
 * the played/assembled increment semantics, per-player keying, accumulation, and
 * that an existing hollow channel is preserved (not clobbered). node:test +
 * node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recordConditionalClause } from './synergyCount.record.js';
import type { LegendaryGameState } from '../types.js';

/** A bare G — the writer only touches G.diagnostics; the rest is never read. */
function makeG(): LegendaryGameState {
  return {} as unknown as LegendaryGameState;
}

describe('recordConditionalClause (WP-708)', () => {
  it('lazy-inits G.diagnostics + conditionalClauses on first write', () => {
    const G = makeG();
    recordConditionalClause(G, '0', { assembled: true });
    assert.deepEqual(G.diagnostics?.conditionalClauses?.['0'], { played: 1, assembled: 1 });
    // why: the writer mirrors recordHollowEffect's init shape so a synergy-first
    // dispatch leaves the hollow channel valid (empty), not undefined.
    assert.deepEqual(G.diagnostics?.hollowEffects, []);
    assert.equal(G.diagnostics?.hollowEffectsDropped, 0);
  });

  it('assembled:false increments played only', () => {
    const G = makeG();
    recordConditionalClause(G, '0', { assembled: false });
    assert.deepEqual(G.diagnostics?.conditionalClauses?.['0'], { played: 1, assembled: 0 });
  });

  it('accumulates across calls and keys per player', () => {
    const G = makeG();
    recordConditionalClause(G, '0', { assembled: true });
    recordConditionalClause(G, '0', { assembled: false });
    recordConditionalClause(G, '1', { assembled: true });
    assert.deepEqual(G.diagnostics?.conditionalClauses?.['0'], { played: 2, assembled: 1 });
    assert.deepEqual(G.diagnostics?.conditionalClauses?.['1'], { played: 1, assembled: 1 });
  });

  it('preserves an existing hollow channel (does not clobber)', () => {
    const G = {
      diagnostics: { hollowEffects: [{ cardId: 'x' }], hollowEffectsDropped: 2 },
    } as unknown as LegendaryGameState;
    recordConditionalClause(G, '0', { assembled: true });
    assert.equal(G.diagnostics?.hollowEffects.length, 1, 'existing hollow records untouched');
    assert.equal(G.diagnostics?.hollowEffectsDropped, 2);
    assert.deepEqual(G.diagnostics?.conditionalClauses?.['0'], { played: 1, assembled: 1 });
  });
});
