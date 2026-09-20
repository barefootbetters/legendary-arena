/**
 * Tests for the conditional-clause synergy counter writer (WP-708 / D-24531,
 * WP-709 / D-24532).
 *
 * Covers: lazy-init on a fresh G (and the mirrored hollow-channel init shape),
 * the played/assembled increment semantics, the WP-709 potentialValue/realizedValue
 * accrual, per-player keying, accumulation, and that an existing hollow channel is
 * preserved (not clobbered). node:test + node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recordConditionalClause } from './synergyCount.record.js';
import type { LegendaryGameState } from '../types.js';

/** A bare G — the writer only touches G.diagnostics; the rest is never read. */
function makeG(): LegendaryGameState {
  return {} as unknown as LegendaryGameState;
}

describe('recordConditionalClause (WP-708 / WP-709)', () => {
  it('lazy-inits G.diagnostics + conditionalClauses on first write', () => {
    const G = makeG();
    recordConditionalClause(G, '0', { assembled: true, clauseValue: 3 });
    assert.deepEqual(G.diagnostics?.conditionalClauses?.['0'], {
      played: 1,
      assembled: 1,
      potentialValue: 3,
      realizedValue: 3,
    });
    // why: the writer mirrors recordHollowEffect's init shape so a synergy-first
    // dispatch leaves the hollow channel valid (empty), not undefined.
    assert.deepEqual(G.diagnostics?.hollowEffects, []);
    assert.equal(G.diagnostics?.hollowEffectsDropped, 0);
  });

  it('assembled:false increments played + potentialValue only (not assembled/realized)', () => {
    const G = makeG();
    recordConditionalClause(G, '0', { assembled: false, clauseValue: 6 });
    assert.deepEqual(G.diagnostics?.conditionalClauses?.['0'], {
      played: 1,
      assembled: 0,
      potentialValue: 6,
      realizedValue: 0,
    });
  });

  it('assembled:true accrues clauseValue to both potentialValue and realizedValue', () => {
    const G = makeG();
    recordConditionalClause(G, '0', { assembled: true, clauseValue: 4 });
    assert.deepEqual(G.diagnostics?.conditionalClauses?.['0'], {
      played: 1,
      assembled: 1,
      potentialValue: 4,
      realizedValue: 4,
    });
  });

  it('a zero-value clause moves counts but neither value sum', () => {
    const G = makeG();
    recordConditionalClause(G, '0', { assembled: true, clauseValue: 0 });
    assert.deepEqual(G.diagnostics?.conditionalClauses?.['0'], {
      played: 1,
      assembled: 1,
      potentialValue: 0,
      realizedValue: 0,
    });
  });

  it('accumulates counts + value sums across calls and keys per player', () => {
    const G = makeG();
    recordConditionalClause(G, '0', { assembled: true, clauseValue: 2 });
    recordConditionalClause(G, '0', { assembled: false, clauseValue: 6 });
    recordConditionalClause(G, '1', { assembled: true, clauseValue: 1 });
    // seat 0: a landed +2 and a whiffed +6 → potential 8, realized 2.
    assert.deepEqual(G.diagnostics?.conditionalClauses?.['0'], {
      played: 2,
      assembled: 1,
      potentialValue: 8,
      realizedValue: 2,
    });
    assert.deepEqual(G.diagnostics?.conditionalClauses?.['1'], {
      played: 1,
      assembled: 1,
      potentialValue: 1,
      realizedValue: 1,
    });
  });

  it('preserves an existing hollow channel (does not clobber)', () => {
    const G = {
      diagnostics: { hollowEffects: [{ cardId: 'x' }], hollowEffectsDropped: 2 },
    } as unknown as LegendaryGameState;
    recordConditionalClause(G, '0', { assembled: true, clauseValue: 5 });
    assert.equal(G.diagnostics?.hollowEffects.length, 1, 'existing hollow records untouched');
    assert.equal(G.diagnostics?.hollowEffectsDropped, 2);
    assert.deepEqual(G.diagnostics?.conditionalClauses?.['0'], {
      played: 1,
      assembled: 1,
      potentialValue: 5,
      realizedValue: 5,
    });
  });
});
