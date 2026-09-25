import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHalfKeyframes,
  buildStainOffsets,
  polygonCentroid,
  resolveCardBox,
  splitCardAlongCut,
  toClipPathPolygon,
  type SlicePoint,
} from './villainSlashGeometry';

/** Shoelace area of a polygon. */
function polygonArea(points: readonly SlicePoint[]): number {
  let doubled = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i] as SlicePoint;
    const next = points[(i + 1) % points.length] as SlicePoint;
    doubled += current.x * next.y - next.x * current.y;
  }
  return Math.abs(doubled) / 2;
}

/** Parses `translate(Xpx, Ypx) rotate(Rdeg)` into numbers. */
function parseTransform(transform: string): { x: number; y: number; rotation: number } {
  const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) rotate\((-?[\d.]+)deg\)/.exec(transform);
  assert.ok(match, `unexpected transform ${transform}`);
  return { x: Number(match[1]), y: Number(match[2]), rotation: Number(match[3]) };
}

describe('villainSlashGeometry (WP-755) — splitCardAlongCut', () => {
  const width = 100;
  const height = 140;
  for (const angle of [0, -28, 22, -16, 34, 90]) {
    test(`at ${angle}° both halves are ≥ 3-vertex polygons inside the card whose areas sum to w×h`, () => {
      const halves = splitCardAlongCut(width, height, angle);
      assert.equal(halves.length, 2);
      for (const half of halves) {
        assert.ok(half.length >= 3, `a half needs ≥ 3 vertices, got ${half.length}`);
        for (const point of half) {
          assert.ok(point.x >= 0 && point.x <= width, `x ${point.x} inside the card`);
          assert.ok(point.y >= 0 && point.y <= height, `y ${point.y} inside the card`);
        }
      }
      const total = polygonArea(halves[0]) + polygonArea(halves[1]);
      assert.ok(Math.abs(total - width * height) < 1, `areas sum ${total} ≈ ${width * height}`);
    });
  }

  test('a 0° cut splits the card into its top and bottom halves', () => {
    const [top, bottom] = splitCardAlongCut(100, 140, 0);
    assert.ok(Math.abs(polygonArea(top) - 7000) < 0.01);
    assert.ok(Math.abs(polygonArea(bottom) - 7000) < 0.01);
    for (const point of top) assert.ok(point.y <= 70);
    for (const point of bottom) assert.ok(point.y >= 70);
  });
});

describe('villainSlashGeometry (WP-755) — clip path + centroid', () => {
  test('toClipPathPolygon formats px pairs', () => {
    assert.equal(
      toClipPathPolygon([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50.126, y: 70 },
      ]),
      'polygon(0px 0px, 100px 0px, 50.13px 70px)',
    );
  });

  test('polygonCentroid is the vertex average', () => {
    assert.deepEqual(
      polygonCentroid([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 70 },
        { x: 0, y: 70 },
      ]),
      { x: 50, y: 35 },
    );
  });
});

describe('villainSlashGeometry (WP-755) — buildHalfKeyframes', () => {
  test('starts at identity, ends at opacity 0, and uses transform + opacity only', () => {
    const frames = buildHalfKeyframes(1, -28, true);
    const first = frames[0];
    const last = frames[frames.length - 1];
    assert.ok(first && last);
    assert.equal(first.offset, 0);
    assert.equal(first.opacity, 1);
    assert.deepEqual(parseTransform(first.transform), { x: 0, y: 0, rotation: 0 });
    assert.equal(last.offset, 1);
    assert.equal(last.opacity, 0);
    for (const frame of frames) {
      assert.deepEqual(Object.keys(frame).sort(), ['offset', 'opacity', 'transform']);
    }
  });

  test('stays opaque for the first 60% and fades over the last 40%', () => {
    const frames = buildHalfKeyframes(1, 22, false);
    for (const frame of frames) {
      if (frame.offset <= 0.6) assert.equal(frame.opacity, 1);
      else assert.ok(frame.opacity < 1);
    }
  });

  test('the two sides mirror horizontally and in rotation', () => {
    const left = buildHalfKeyframes(-1, 22, true);
    const right = buildHalfKeyframes(1, 22, true);
    for (let i = 0; i < left.length; i += 1) {
      const leftTransform = parseTransform((left[i] as { transform: string }).transform);
      const rightTransform = parseTransform((right[i] as { transform: string }).transform);
      // why: a tolerance, not strict equality — rounding to 2 decimals can differ
      // by 0.01 between +v and -v (Math.round rounds halves up), and -0 ≠ 0.
      assert.ok(Math.abs(leftTransform.x + rightTransform.x) <= 0.011);
      assert.ok(Math.abs(leftTransform.rotation + rightTransform.rotation) <= 0.011);
    }
  });

  test('kicks up then falls under gravity', () => {
    const frames = buildHalfKeyframes(1, 0, false);
    const ys = frames.map((frame) => parseTransform(frame.transform).y);
    assert.ok(Math.min(...ys) < 0, 'rises first');
    assert.ok((ys[ys.length - 1] as number) > 200, 'ends well below its start');
  });

  test('no rotation when not tumbling', () => {
    for (const frame of buildHalfKeyframes(-1, 34, false)) {
      assert.equal(parseTransform(frame.transform).rotation, 0);
    }
  });
});

describe('villainSlashGeometry (WP-755) — resolveCardBox', () => {
  const space = { left: 200, top: 100, width: 150, height: 120 };

  test('uses the reference tile size, centred on the space', () => {
    const box = resolveCardBox(space, { left: 0, top: 0, width: 80, height: 112 });
    assert.deepEqual(box, { left: 235, top: 104, width: 80, height: 112 });
  });

  test('falls back to a 5:7 box from the space height when there is no reference', () => {
    const box = resolveCardBox(space, null);
    assert.ok(box);
    assert.equal(box.height, 120);
    assert.equal(box.width, Math.round(((120 * 5) / 7) * 100) / 100);
    assert.ok(Math.abs(box.left + box.width / 2 - 275) < 0.01, 'centred horizontally');
    assert.equal(box.top + box.height / 2, 160);
  });

  test('a zero-size reference also falls back to 5:7', () => {
    const box = resolveCardBox(space, { left: 0, top: 0, width: 0, height: 0 });
    assert.ok(box);
    assert.equal(box.height, 120);
  });

  test('returns null for a zero-size space', () => {
    assert.equal(resolveCardBox({ left: 10, top: 10, width: 0, height: 0 }, null), null);
    assert.equal(resolveCardBox({ left: 10, top: 10, width: 40, height: 0 }, null), null);
  });
});

describe('villainSlashGeometry (WP-755) — buildStainOffsets', () => {
  test('is deterministic for the same seq and returns count entries inside the box', () => {
    const first = buildStainOffsets(7, 5, -28, 100, 140);
    const again = buildStainOffsets(7, 5, -28, 100, 140);
    assert.deepEqual(first, again);
    assert.equal(first.length, 5);
    for (const stain of first) {
      assert.ok(stain.x >= 0 && stain.x <= 100);
      assert.ok(stain.y >= 0 && stain.y <= 140);
      assert.ok(stain.scale > 0);
    }
  });

  test('works for every locked angle, including a vertical cut', () => {
    for (const angle of [-28, 22, -16, 34, 90, 0]) {
      const stains = buildStainOffsets(3, 5, angle, 80, 112);
      assert.equal(stains.length, 5);
      for (const stain of stains) {
        assert.ok(stain.x >= 0 && stain.x <= 80);
        assert.ok(stain.y >= 0 && stain.y <= 112);
      }
    }
  });
});
