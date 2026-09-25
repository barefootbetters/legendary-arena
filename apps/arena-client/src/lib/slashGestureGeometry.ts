/**
 * slashGestureGeometry.ts
 *
 * Pure geometry for the WP-756 slash gesture: segment/rect intersection, the
 * full-crossing hit rule, and the stroke angle. No DOM, no Vue, no clock — every
 * function is deterministic and unit-testable on plain numbers.
 *
 * why: the hit rule is geometric on purpose. A tile counts as **crossed** only
 * when the stroke began OUTSIDE it, entered it, and later had a sample outside
 * it. A contact rule would fight a villain the moment a press-and-drag touched
 * it (any drag starting on a tile would spend attack), and a speed rule would
 * need a clock, which client code outside the D-24365 VFX subsurface may not read.
 *
 * Coordinates are `clientX` / `clientY` — the same space as
 * `getBoundingClientRect()` and the fixed VFX overlay.
 *
 * @see WP-756 §A "slashGestureGeometry.ts"
 * @see DECISIONS.md D-24585 (the slash gesture)
 */

/** A point in client (viewport) pixels. */
export interface Point {
  x: number;
  y: number;
}

/** A rectangle in client (viewport) pixels, as `getBoundingClientRect` reports it. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** One candidate tile's crossing progress inside a stroke. */
export interface CrossingTile {
  readonly extId: string;
  readonly rect: Rect;
  /** False when the stroke started inside this tile — it can never be crossed. */
  readonly isEligible: boolean;
  /** True while the stroke is inside the tile after entering it. */
  readonly isInside: boolean;
  /** Where the stroke entered the tile, or `null` before entry. */
  readonly entryPoint: Point | null;
  /** True once the tile has been crossed (each tile completes at most once). */
  readonly isCompleted: boolean;
}

/** The crossing state of one stroke across its candidate tiles. */
export interface CrossingState {
  readonly tiles: readonly CrossingTile[];
}

/** One completed crossing: which card, and the stroke angle across it. */
export interface CompletedCrossing {
  extId: string;
  angleDeg: number;
}

/** The parametric span `[enterT, exitT]` of a segment inside a rect (0..1). */
interface ClipSpan {
  enterT: number;
  exitT: number;
}

/**
 * Clips the segment `from → to` against a rect (Liang–Barsky), inclusive of
 * the rect's edges.
 *
 * @returns the parametric span inside the rect, or `null` when the segment
 *   misses it entirely.
 */
function clipSegmentToRect(from: Point, to: Point, rect: Rect): ClipSpan | null {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const directions = [-deltaX, deltaX, -deltaY, deltaY];
  const distances = [
    from.x - rect.left,
    rect.left + rect.width - from.x,
    from.y - rect.top,
    rect.top + rect.height - from.y,
  ];
  let enterT = 0;
  let exitT = 1;
  for (let i = 0; i < 4; i += 1) {
    const direction = directions[i] ?? 0;
    const distance = distances[i] ?? 0;
    if (direction === 0) {
      // why: the segment is parallel to this edge pair — it is inside the slab
      // for its whole length or outside it for its whole length.
      if (distance < 0) return null;
      continue;
    }
    const edgeT = distance / direction;
    if (direction < 0) {
      if (edgeT > exitT) return null;
      if (edgeT > enterT) enterT = edgeT;
    } else {
      if (edgeT < enterT) return null;
      if (edgeT < exitT) exitT = edgeT;
    }
  }
  return { enterT, exitT };
}

/**
 * Whether the segment `from → to` touches the rect at all (edges inclusive).
 * A zero-length segment intersects when its point lies in the rect.
 */
export function segmentIntersectsRect(from: Point, to: Point, rect: Rect): boolean {
  return clipSegmentToRect(from, to, rect) !== null;
}

/** Whether a point lies inside the rect (edges inclusive). */
export function isPointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.left + rect.width &&
    point.y >= rect.top &&
    point.y <= rect.top + rect.height
  );
}

/** The straight-line distance between two points. */
export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * The stroke angle from `from` to `to` in SCREEN convention (y down, clockwise
 * positive): right = 0, down = 90, up-left = -135. This is the same convention
 * the WP-755 slice cut uses, so a hint angle can be handed straight to it.
 */
export function strokeAngleDeg(from: Point, to: Point): number {
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
}

/** The point at parameter `t` along the segment `from → to`. */
function pointAlong(from: Point, to: Point, t: number): Point {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/**
 * Creates the crossing state for a stroke that starts at `start`.
 *
 * @param tiles - the candidate tiles (fightable at gesture start) with their rects.
 * @param start - the `pointerdown` point. A tile containing it is ineligible,
 *   because a stroke that starts on a tile never "began outside" it.
 */
export function createCrossingState(
  tiles: readonly { extId: string; rect: Rect }[],
  start: Point,
): CrossingState {
  const crossingTiles: CrossingTile[] = [];
  for (const tile of tiles) {
    crossingTiles.push({
      extId: tile.extId,
      rect: tile.rect,
      isEligible: !isPointInRect(start, tile.rect),
      isInside: false,
      entryPoint: null,
      isCompleted: false,
    });
  }
  return { tiles: crossingTiles };
}

/**
 * Advances the crossing state by one stroke segment `from → to`.
 *
 * - An eligible tile the segment enters and stays in records its entry point.
 * - A tile the stroke was inside completes when `to` is outside it.
 * - A segment that passes fully through a tile completes it in one step.
 *
 * @returns the new state and the crossings that COMPLETED on this segment, in
 *   completion order (the order the segment leaves each tile). Each `angleDeg`
 *   is measured from the tile's entry point to the completing sample.
 */
export function advanceCrossingState(
  state: CrossingState,
  from: Point,
  to: Point,
): { state: CrossingState; crossed: CompletedCrossing[] } {
  const nextTiles: CrossingTile[] = [];
  const completions: { exitT: number; crossing: CompletedCrossing }[] = [];
  for (const tile of state.tiles) {
    if (!tile.isEligible || tile.isCompleted) {
      nextTiles.push(tile);
      continue;
    }
    const span = clipSegmentToRect(from, to, tile.rect);
    const isEndInside = isPointInRect(to, tile.rect);
    let entryPoint = tile.entryPoint;
    if (!tile.isInside) {
      // why: a real entry needs the segment to run THROUGH the rect for a
      // positive length — a segment that only grazes a corner is not an entry.
      if (span === null || span.exitT <= span.enterT) {
        nextTiles.push(tile);
        continue;
      }
      entryPoint = pointAlong(from, to, span.enterT);
    }
    if (isEndInside) {
      nextTiles.push({ ...tile, isInside: true, entryPoint });
      continue;
    }
    const exitT = span === null ? 0 : span.exitT;
    const startOfAngle = entryPoint ?? from;
    completions.push({
      exitT,
      crossing: { extId: tile.extId, angleDeg: strokeAngleDeg(startOfAngle, to) },
    });
    nextTiles.push({ ...tile, isInside: false, entryPoint, isCompleted: true });
  }
  completions.sort((first, second) => first.exitT - second.exitT);
  const crossed: CompletedCrossing[] = [];
  for (const completion of completions) {
    crossed.push(completion.crossing);
  }
  return { state: { tiles: nextTiles }, crossed };
}
