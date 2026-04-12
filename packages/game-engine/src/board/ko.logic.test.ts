/**
 * Tests for koCard helper.
 *
 * Verifies destination-only append behavior, immutability, and
 * JSON serializability.
 *
 * Uses node:test and node:assert only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { koCard } from './ko.logic.js';

describe('koCard', () => {
  it('appends card to KO pile', () => {
    const koPile = ['card-a', 'card-b'];
    const result = koCard(koPile, 'card-c');

    assert.deepStrictEqual(result, ['card-a', 'card-b', 'card-c']);
  });

  it('returns a new array (input not mutated)', () => {
    const koPile = ['card-a'];
    const result = koCard(koPile, 'card-b');

    assert.notStrictEqual(result, koPile);
    assert.deepStrictEqual(koPile, ['card-a']);
  });

  it('JSON.stringify of result succeeds', () => {
    const result = koCard([], 'card-x');

    const serialized = JSON.stringify(result);
    assert.ok(serialized.length > 0, 'Serialized result must be non-empty');
  });
});
