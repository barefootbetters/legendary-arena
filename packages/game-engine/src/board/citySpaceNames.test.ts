/**
 * Tests for the named City spaces constant (WP-489 / D-24295).
 *
 * Pins the CONFIRMED & LOCKED index→name binding (Sewers(0) … Bridge(4)) and
 * the citySpaceNameForIndex fail-soft behavior (out-of-range / undefined →
 * undefined). A reversed binding fires the Tier-B location-gated abilities on
 * the wrong spaces, so this is the load-bearing unit boundary for the lock.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CITY_SPACE_NAMES, citySpaceNameForIndex, hqSlotIndexUnderCitySpace } from './citySpaceNames.js';

describe('CITY_SPACE_NAMES (WP-489 / D-24295)', () => {
  // why: the operator-confirmed binding — Streets MUST be index 3 and Bridge
  // index 4 or Abomination rescues on the wrong spaces; Sewers MUST be index 0
  // or the Lizard wounds on the wrong space. This pins the exact locked order.
  it('is the locked five-space order, entry(0)=sewers … escape(4)=bridge', () => {
    assert.deepStrictEqual(
      [...CITY_SPACE_NAMES],
      ['sewers', 'bank', 'rooftops', 'streets', 'bridge'],
      'CITY_SPACE_NAMES must match the DESIGN-BOARD-LAYOUT.md binding in order',
    );
    assert.equal(CITY_SPACE_NAMES.length, 5, 'the City has exactly five spaces');
    assert.equal(new Set(CITY_SPACE_NAMES).size, 5, 'no duplicate space names');
  });
});

describe('citySpaceNameForIndex (WP-489 / D-24295)', () => {
  it('maps each in-range index to its canonical space name', () => {
    assert.equal(citySpaceNameForIndex(0), 'sewers');
    assert.equal(citySpaceNameForIndex(1), 'bank');
    assert.equal(citySpaceNameForIndex(2), 'rooftops');
    assert.equal(citySpaceNameForIndex(3), 'streets');
    assert.equal(citySpaceNameForIndex(4), 'bridge');
  });

  // why: the gate consumes undefined as "not on a listed space" and fails
  // closed; an out-of-range or absent index must therefore return undefined,
  // never a wrapped or phantom name.
  it('returns undefined for an out-of-range or absent index (fail soft)', () => {
    assert.equal(citySpaceNameForIndex(-1), undefined);
    assert.equal(citySpaceNameForIndex(5), undefined);
    assert.equal(citySpaceNameForIndex(undefined), undefined);
    assert.equal(citySpaceNameForIndex(2.5), undefined, 'a non-integer index has no space');
    assert.equal(citySpaceNameForIndex(Number.NaN), undefined);
  });
});

describe('hqSlotIndexUnderCitySpace (WP-815 / D-24747)', () => {
  // why: T1 — the HQ space under City index i is hq[4 - i] by ordinal (Sewers ↔ the
  // 5th HQ slot, Bridge ↔ the 1st). A mirrored binding makes Abomination read the
  // wrong Hero, so every index is pinned.
  it('maps City index i to HQ index 4 - i (Sewers ↔ 5th slot, Bridge ↔ 1st)', () => {
    assert.equal(hqSlotIndexUnderCitySpace(0), 4);
    assert.equal(hqSlotIndexUnderCitySpace(1), 3);
    assert.equal(hqSlotIndexUnderCitySpace(2), 2);
    assert.equal(hqSlotIndexUnderCitySpace(3), 1);
    assert.equal(hqSlotIndexUnderCitySpace(4), 0);
  });

  it('returns undefined for an out-of-range or non-integer index (never throws)', () => {
    assert.equal(hqSlotIndexUnderCitySpace(-1), undefined);
    assert.equal(hqSlotIndexUnderCitySpace(5), undefined);
    assert.equal(hqSlotIndexUnderCitySpace(1.5), undefined);
  });
});
