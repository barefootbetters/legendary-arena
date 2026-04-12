/**
 * Tests for gainWound helper.
 *
 * Verifies wound transfer from supply pile to player discard,
 * empty pile handling, immutability, and JSON serializability.
 *
 * Uses node:test and node:assert only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gainWound } from './wounds.logic.js';

describe('gainWound', () => {
  it('moves one wound from pile[0] to discard', () => {
    const woundsPile = ['wound-1', 'wound-2', 'wound-3'];
    const playerDiscard = ['card-a'];

    const result = gainWound(woundsPile, playerDiscard);

    assert.deepStrictEqual(result.woundsPile, ['wound-2', 'wound-3']);
    assert.deepStrictEqual(result.playerDiscard, ['card-a', 'wound-1']);
  });

  it('empty wounds pile: both arrays returned unchanged', () => {
    const woundsPile: string[] = [];
    const playerDiscard = ['card-a'];

    const result = gainWound(woundsPile, playerDiscard);

    assert.deepStrictEqual(result.woundsPile, []);
    assert.deepStrictEqual(result.playerDiscard, ['card-a']);
  });

  it('returns new arrays (inputs not mutated)', () => {
    const woundsPile = ['wound-1', 'wound-2'];
    const playerDiscard = ['card-a'];

    const result = gainWound(woundsPile, playerDiscard);

    assert.notStrictEqual(result.woundsPile, woundsPile);
    assert.notStrictEqual(result.playerDiscard, playerDiscard);
    assert.deepStrictEqual(woundsPile, ['wound-1', 'wound-2']);
    assert.deepStrictEqual(playerDiscard, ['card-a']);
  });

  it('JSON.stringify of results succeeds', () => {
    const result = gainWound(['wound-1'], []);

    const serialized = JSON.stringify(result);
    assert.ok(serialized.length > 0, 'Serialized result must be non-empty');
  });
});
