import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { computeHandArc } from './handArc';

describe('computeHandArc (WP-699) — shallow hand arc geometry', () => {
  test('a single card sits flat and centred (no arc)', () => {
    assert.deepEqual(computeHandArc(1, 0), { rotationDegrees: 0, offsetPx: 0 });
  });

  test('an empty hand / out-of-range index is flat and centred', () => {
    assert.deepEqual(computeHandArc(0, 0), { rotationDegrees: 0, offsetPx: 0 });
    assert.deepEqual(computeHandArc(5, -1), { rotationDegrees: 0, offsetPx: 0 });
    assert.deepEqual(computeHandArc(5, 5), { rotationDegrees: 0, offsetPx: 0 });
  });

  test('a symmetric hand produces rotations symmetric about 0°', () => {
    const size = 5;
    const first = computeHandArc(size, 0);
    const last = computeHandArc(size, size - 1);
    // First and last are mirror images around centre.
    assert.equal(first.rotationDegrees, -last.rotationDegrees);
    // The end cards dip by the same amount (arc is symmetric).
    assert.equal(first.offsetPx, last.offsetPx);
    // The middle card is upright and highest.
    const middle = computeHandArc(size, 2);
    assert.equal(middle.rotationDegrees, 0);
    assert.equal(middle.offsetPx, 0);
  });

  test('the fan never exceeds the total spread end to end', () => {
    // why: the whole point of the shallow cap — a large hand tilts gently, not
    // wildly. |first| + |last| must equal the locked total spread (24°).
    for (const size of [2, 4, 7, 12]) {
      const first = computeHandArc(size, 0);
      const last = computeHandArc(size, size - 1);
      const spread = Math.abs(first.rotationDegrees) + Math.abs(last.rotationDegrees);
      assert.ok(
        Math.abs(spread - 24) < 1e-9,
        `hand of ${size} spans ${spread}°, expected 24°`,
      );
    }
  });

  test('rotation increases monotonically left → right across the hand', () => {
    const size = 7;
    let previous = computeHandArc(size, 0).rotationDegrees;
    for (let index = 1; index < size; index += 1) {
      const current = computeHandArc(size, index).rotationDegrees;
      assert.ok(current > previous, `index ${index} should tilt further right`);
      previous = current;
    }
  });

  test('a larger hand compresses the per-card angular step', () => {
    // why: as the hand grows the same 24° spread is shared across more cards, so
    // each neighbour-to-neighbour step shrinks — the compression the WP requires.
    const stepSmall =
      computeHandArc(4, 1).rotationDegrees - computeHandArc(4, 0).rotationDegrees;
    const stepLarge =
      computeHandArc(12, 1).rotationDegrees - computeHandArc(12, 0).rotationDegrees;
    assert.ok(stepLarge < stepSmall, 'a 12-card hand should step less per card than a 4-card hand');
  });
});
