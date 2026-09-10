import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFitScale, MIN_SCALE, MAX_SCALE } from './useScaleToFit';

// why: computeFitScale is the load-bearing, DOM-free half of the WP-688
// scale-to-fit mechanism — the clamp math that guarantees the board fits the
// viewport with no page scroll while staying inside the D-24502 scale band.
// The DOM-observing wrapper (useScaleToFit) is verified live (D-24026); the
// math is pinned here.
describe('computeFitScale (WP-688 / D-24502 lock 1)', () => {
  test('height-bound content at the 1280 floor scales down to fit (< 1×)', () => {
    // A ~900px-tall authored board in ~700px of available height must scale
    // down so the whole board fits with no page scroll.
    const scale = computeFitScale(1240, 900, 1240, 700);
    assert.ok(scale < 1, `expected downscale, got ${scale}`);
    assert.ok(scale > MIN_SCALE, `expected above the floor, got ${scale}`);
    // 700 / 900 ≈ 0.778 — the height fit binds (width fit is 1.0).
    assert.ok(Math.abs(scale - 700 / 900) < 1e-9);
  });

  test('the smaller of width-fit and height-fit wins (whole board always fits)', () => {
    // Width-constrained: a wide board in a narrow-but-tall box scales by width.
    const widthBound = computeFitScale(1600, 800, 1200, 1000);
    assert.ok(Math.abs(widthBound - 1200 / 1600) < 1e-9);
    // Height-constrained: a tall board in a wide-but-short box scales by height.
    const heightBound = computeFitScale(1200, 1000, 1600, 700);
    assert.ok(Math.abs(heightBound - 700 / 1000) < 1e-9);
  });

  test('scale-up is capped at MAX_SCALE (wider/taller screens grow, never past ~1.5×)', () => {
    // A compact board with loads of room would fit at 3× — capped at 1.5×.
    const scale = computeFitScale(800, 400, 2400, 1200);
    assert.equal(scale, MAX_SCALE);
  });

  test('scale-down is floored at MIN_SCALE (readability safety net)', () => {
    // An enormous board in a tiny box would need 0.1× — floored at MIN_SCALE.
    const scale = computeFitScale(2000, 2000, 400, 400);
    assert.equal(scale, MIN_SCALE);
  });

  test('a not-yet-measured (zero) stage returns MIN_SCALE without dividing by zero', () => {
    assert.equal(computeFitScale(0, 0, 1280, 720), MIN_SCALE);
    assert.equal(computeFitScale(1240, 0, 1280, 720), MIN_SCALE);
  });

  test('an exact fit returns 1×', () => {
    assert.equal(computeFitScale(1240, 700, 1240, 700), 1);
  });
});
