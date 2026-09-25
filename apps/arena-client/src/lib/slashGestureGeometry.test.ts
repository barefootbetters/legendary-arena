import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceCrossingState,
  createCrossingState,
  distanceBetween,
  isPointInRect,
  segmentIntersectsRect,
  strokeAngleDeg,
  type Point,
  type Rect,
} from './slashGestureGeometry';

const TILE_A: Rect = { left: 100, top: 100, width: 80, height: 110 };
const TILE_B: Rect = { left: 200, top: 100, width: 80, height: 110 };

/** Runs a polyline through the crossing state and collects every completion. */
function runStroke(
  tiles: { extId: string; rect: Rect }[],
  points: Point[],
): { extId: string; angleDeg: number }[] {
  const first = points[0] as Point;
  let state = createCrossingState(tiles, first);
  const crossed: { extId: string; angleDeg: number }[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const result = advanceCrossingState(state, points[i - 1] as Point, points[i] as Point);
    state = result.state;
    crossed.push(...result.crossed);
  }
  return crossed;
}

describe('slashGestureGeometry — segment / rect (WP-756 §A)', () => {
  test('a segment passing through the rect intersects it', () => {
    assert.equal(segmentIntersectsRect({ x: 50, y: 150 }, { x: 250, y: 150 }, TILE_A), true);
  });

  test('a segment touching only an edge intersects it (edges inclusive)', () => {
    assert.equal(segmentIntersectsRect({ x: 50, y: 100 }, { x: 250, y: 100 }, TILE_A), true);
  });

  test('a segment fully outside does not intersect', () => {
    assert.equal(segmentIntersectsRect({ x: 0, y: 0 }, { x: 90, y: 50 }, TILE_A), false);
  });

  test('a zero-length segment intersects only when its point is inside', () => {
    assert.equal(segmentIntersectsRect({ x: 120, y: 120 }, { x: 120, y: 120 }, TILE_A), true);
    assert.equal(segmentIntersectsRect({ x: 20, y: 20 }, { x: 20, y: 20 }, TILE_A), false);
  });

  test('isPointInRect is edge-inclusive', () => {
    assert.equal(isPointInRect({ x: 100, y: 100 }, TILE_A), true);
    assert.equal(isPointInRect({ x: 180, y: 210 }, TILE_A), true);
    assert.equal(isPointInRect({ x: 181, y: 150 }, TILE_A), false);
  });

  test('distanceBetween is Euclidean', () => {
    assert.equal(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  });
});

describe('slashGestureGeometry — the full-crossing rule (WP-756 §A)', () => {
  const tiles = [{ extId: 'a', rect: TILE_A }];

  test('a stroke starting inside a tile never crosses it', () => {
    const crossed = runStroke(tiles, [
      { x: 140, y: 150 },
      { x: 60, y: 150 },
      { x: 20, y: 150 },
    ]);
    assert.deepEqual(crossed, []);
  });

  test('enter then exit completes exactly one crossing', () => {
    const crossed = runStroke(tiles, [
      { x: 60, y: 150 },
      { x: 140, y: 150 },
      { x: 220, y: 150 },
    ]);
    assert.equal(crossed.length, 1);
    assert.equal(crossed[0]?.extId, 'a');
  });

  test('enter without exit completes nothing', () => {
    const crossed = runStroke(tiles, [
      { x: 60, y: 150 },
      { x: 140, y: 150 },
      { x: 160, y: 160 },
    ]);
    assert.deepEqual(crossed, []);
  });

  test('a single segment spanning a tile completes it', () => {
    const crossed = runStroke(tiles, [
      { x: 60, y: 150 },
      { x: 220, y: 150 },
    ]);
    assert.equal(crossed.length, 1);
  });

  test('two tiles complete in crossing order, in either direction', () => {
    const both = [
      { extId: 'b', rect: TILE_B },
      { extId: 'a', rect: TILE_A },
    ];
    const rightward = runStroke(both, [
      { x: 60, y: 150 },
      { x: 320, y: 150 },
    ]);
    assert.deepEqual(
      rightward.map((crossing) => crossing.extId),
      ['a', 'b'],
    );
    const leftward = runStroke(both, [
      { x: 320, y: 150 },
      { x: 60, y: 150 },
    ]);
    assert.deepEqual(
      leftward.map((crossing) => crossing.extId),
      ['b', 'a'],
    );
  });

  test('each tile completes at most once per stroke', () => {
    const crossed = runStroke(tiles, [
      { x: 60, y: 150 },
      { x: 220, y: 150 },
      { x: 60, y: 160 },
      { x: 220, y: 170 },
    ]);
    assert.equal(crossed.length, 1);
  });

  test('angleDeg is measured from the entry point to the completing sample', () => {
    // Enter on the left edge at (100, 150), wander inside, leave straight down.
    const crossed = runStroke(tiles, [
      { x: 60, y: 150 },
      { x: 140, y: 150 },
      { x: 140, y: 250 },
    ]);
    const expected = strokeAngleDeg({ x: 100, y: 150 }, { x: 140, y: 250 });
    assert.equal(crossed.length, 1);
    assert.ok(Math.abs((crossed[0]?.angleDeg ?? 0) - expected) < 1e-9);
  });
});

describe('slashGestureGeometry — strokeAngleDeg (screen convention)', () => {
  test('right = 0, down = 90, up-left = -135', () => {
    assert.equal(strokeAngleDeg({ x: 0, y: 0 }, { x: 10, y: 0 }), 0);
    assert.equal(strokeAngleDeg({ x: 0, y: 0 }, { x: 0, y: 10 }), 90);
    assert.equal(strokeAngleDeg({ x: 0, y: 0 }, { x: -10, y: -10 }), -135);
  });
});
