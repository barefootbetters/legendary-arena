/**
 * Tests for the each-player seat-order helper (WP-846 / D-24780).
 *
 * No boardgame.io imports. Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seatsInTurnOrderFrom } from './seatOrder.logic.js';

describe('seatsInTurnOrderFrom (WP-846 / D-24780)', () => {
  it('AC-1: starts with the current player and goes clockwise', () => {
    assert.deepStrictEqual(seatsInTurnOrderFrom(['0', '1', '2'], '1'), ['1', '2', '0']);
  });

  it('AC-1: sorts unsorted input before rotating', () => {
    assert.deepStrictEqual(seatsInTurnOrderFrom(['2', '0', '1'], '0'), ['0', '1', '2']);
  });

  it('AC-1: a null, undefined or unknown current player returns the sorted order', () => {
    assert.deepStrictEqual(seatsInTurnOrderFrom(['0', '1'], undefined), ['0', '1']);
    assert.deepStrictEqual(seatsInTurnOrderFrom(['0', '1'], null), ['0', '1']);
    assert.deepStrictEqual(seatsInTurnOrderFrom(['0', '1'], '7'), ['0', '1']);
  });

  it('AC-1: wraps from the last seat of a five-player game', () => {
    assert.deepStrictEqual(seatsInTurnOrderFrom(['0', '1', '2', '3', '4'], '4'), ['4', '0', '1', '2', '3']);
  });

  it('AC-1: never mutates its input', () => {
    const seatIds = ['2', '0', '1'];
    const result = seatsInTurnOrderFrom(seatIds, '1');
    assert.deepStrictEqual(seatIds, ['2', '0', '1']);
    assert.notStrictEqual(result, seatIds);
  });

  it('rotate-then-filter keeps the clockwise order for each-other loops', () => {
    const otherSeats = seatsInTurnOrderFrom(['0', '1', '2'], '1').filter((seat) => seat !== '1');
    assert.deepStrictEqual(otherSeats, ['2', '0']);
  });

  it('a solo seat list is unchanged', () => {
    assert.deepStrictEqual(seatsInTurnOrderFrom(['0'], '0'), ['0']);
  });
});
