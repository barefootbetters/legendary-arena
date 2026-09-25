/**
 * villainSlashGeometry.ts
 *
 * Pure geometry for the villain-slash beat (WP-755): cutting the card rectangle
 * into two polygons, the CSS clip-path for each half, the ballistic keyframes
 * each half flies along, the card-shaped box centred on a City space, and the
 * stain positions along the cut. No DOM, no Vue, no clock, no randomness —
 * `VfxOverlay.vue` only wires these into imperative nodes.
 *
 * Angle convention (locked, D-24584): `angleDeg` is in SCREEN space (y down,
 * clockwise positive) everywhere in this module and in the streak's CSS
 * `rotate()`. Only the confetti spray negates it (see `buildSliceSprayOptions`).
 *
 * @see WP-755 §B "the geometry"
 * @see DECISIONS.md D-24584
 */

import { CARD_ASPECT } from './villainSlashVfxManifest';

/** A point in card-local pixels (origin = the card box's top-left). */
export interface SlicePoint {
  readonly x: number;
  readonly y: number;
}

/** A screen-space box (the subset of `DOMRect` the overlay needs). */
export interface SliceBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** One sampled keyframe for a flying half (transform + opacity only). */
export interface SliceHalfKeyframe {
  readonly offset: number;
  readonly transform: string;
  readonly opacity: number;
}

/** One stain: a card-local position plus a size multiplier. */
export interface SliceStainOffset {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

// why: how far each half is pushed apart along the cut normal over its flight —
// enough to open a visible gap without the halves leaving the space instantly.
const HALF_SEPARATION_PX = 46;
// why: a sideways drift on top of the separation so the halves fan out rather
// than sliding straight apart.
const HALF_DRIFT_PX = 28;
// why: the upward kick and gravity (both in px over the whole flight) give a
// short hop — the peak is about a fifth of the way in — then a fall of ~340px,
// which reads as the halves dropping off the board.
const HALF_KICK_PX = 220;
const HALF_GRAVITY_PX = 560;
// why: the tumble rotation reached at the end of the flight (full intensity only).
const HALF_TUMBLE_DEG = 42;
// why: the halves stay fully opaque for the first 60% and fade over the last 40%.
const HALF_FADE_START = 0.6;
// why: 11 samples (0, 0.1 … 1) are smooth enough for a ~900ms ballistic arc
// without bloating the keyframe list.
const HALF_KEYFRAME_STEPS = 10;
// why: the stains cover the middle 85% of the cut, so none sits on the card edge.
const STAIN_SPREAD = 0.85;

/** Rounds to two decimals so emitted CSS strings stay short and stable. */
function roundTwo(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  // why: normalise -0 to 0 so a zero offset prints as "0", never "-0".
  return rounded === 0 ? 0 : rounded;
}

/** Converts degrees to radians. */
function toRadians(angleDeg: number): number {
  return (angleDeg * Math.PI) / 180;
}

/**
 * Keeps the part of a polygon on one side of the cut line through the card
 * centre (one Sutherland–Hodgman half-plane pass).
 *
 * @param corners - the rectangle corners in order.
 * @param signedDistances - each corner's signed distance from the cut line.
 * @param keepSign - `-1` keeps the negative side, `1` the positive side.
 * @returns the clipped polygon.
 */
function clipToSide(
  corners: readonly SlicePoint[],
  signedDistances: readonly number[],
  keepSign: number,
): SlicePoint[] {
  const polygon: SlicePoint[] = [];
  for (let i = 0; i < corners.length; i += 1) {
    const nextIndex = (i + 1) % corners.length;
    const current = corners[i] as SlicePoint;
    const next = corners[nextIndex] as SlicePoint;
    const currentDistance = (signedDistances[i] as number) * keepSign;
    const nextDistance = (signedDistances[nextIndex] as number) * keepSign;
    if (currentDistance >= 0) {
      polygon.push({ x: roundTwo(current.x), y: roundTwo(current.y) });
    }
    const crosses =
      (currentDistance > 0 && nextDistance < 0) || (currentDistance < 0 && nextDistance > 0);
    if (crosses) {
      const fraction = currentDistance / (currentDistance - nextDistance);
      polygon.push({
        x: roundTwo(current.x + (next.x - current.x) * fraction),
        y: roundTwo(current.y + (next.y - current.y) * fraction),
      });
    }
  }
  return polygon;
}

/**
 * Cuts a `width × height` rectangle through its centre at `angleDeg`.
 *
 * @param width - the card width in px.
 * @param height - the card height in px.
 * @param angleDeg - the cut angle (screen convention).
 * @returns `[negativeSide, positiveSide]` — the two halves, in card-local px.
 *   The first flies toward `-normal` (side `-1`), the second toward `+normal`.
 */
export function splitCardAlongCut(
  width: number,
  height: number,
  angleDeg: number,
): [SlicePoint[], SlicePoint[]] {
  const radians = toRadians(angleDeg);
  const normalX = -Math.sin(radians);
  const normalY = Math.cos(radians);
  const centreX = width / 2;
  const centreY = height / 2;
  const corners: SlicePoint[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const signedDistances: number[] = [];
  for (const corner of corners) {
    signedDistances.push((corner.x - centreX) * normalX + (corner.y - centreY) * normalY);
  }
  return [clipToSide(corners, signedDistances, -1), clipToSide(corners, signedDistances, 1)];
}

/**
 * Formats a polygon as a CSS `clip-path` value.
 *
 * @param points - the polygon in card-local px.
 * @returns e.g. `polygon(0px 0px, 100px 0px, 100px 70px)`.
 */
export function toClipPathPolygon(points: readonly SlicePoint[]): string {
  const parts: string[] = [];
  for (const point of points) {
    parts.push(`${roundTwo(point.x)}px ${roundTwo(point.y)}px`);
  }
  return `polygon(${parts.join(', ')})`;
}

/**
 * The vertex average of a polygon — the tumble pivot for a half.
 *
 * @param points - the polygon (non-empty).
 * @returns the average point, or the origin for an empty polygon.
 */
export function polygonCentroid(points: readonly SlicePoint[]): SlicePoint {
  if (points.length === 0) return { x: 0, y: 0 };
  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }
  return { x: roundTwo(sumX / points.length), y: roundTwo(sumY / points.length) };
}

/**
 * Samples the ballistic flight of one half: pushed apart along the cut normal,
 * an upward kick then a gravity fall, an optional tumble, and a fade over the
 * last 40%. Transform and opacity only (GPU-composited, never layout).
 *
 * @param side - `-1` or `1` — which side of the cut this half is on.
 * @param angleDeg - the cut angle (screen convention).
 * @param isTumbling - whether the half rotates (full intensity only).
 * @returns keyframes suitable for `element.animate`.
 */
export function buildHalfKeyframes(
  side: number,
  angleDeg: number,
  isTumbling: boolean,
): SliceHalfKeyframe[] {
  const radians = toRadians(angleDeg);
  const normalX = -Math.sin(radians);
  const normalY = Math.cos(radians);
  const keyframes: SliceHalfKeyframe[] = [];
  for (let step = 0; step <= HALF_KEYFRAME_STEPS; step += 1) {
    const progress = step / HALF_KEYFRAME_STEPS;
    // why: ease-out separation — the halves snap apart, then coast.
    const separation = HALF_SEPARATION_PX * (1 - (1 - progress) * (1 - progress));
    const offsetX = side * (separation * normalX + HALF_DRIFT_PX * progress);
    const offsetY =
      side * separation * normalY - HALF_KICK_PX * progress + HALF_GRAVITY_PX * progress * progress;
    const rotation = isTumbling ? side * HALF_TUMBLE_DEG * progress : 0;
    let opacity = 1;
    if (progress > HALF_FADE_START) {
      opacity = 1 - (progress - HALF_FADE_START) / (1 - HALF_FADE_START);
    }
    keyframes.push({
      offset: roundTwo(progress),
      transform: `translate(${roundTwo(offsetX)}px, ${roundTwo(offsetY)}px) rotate(${roundTwo(rotation)}deg)`,
      opacity: roundTwo(opacity),
    });
  }
  return keyframes;
}

/**
 * The card-shaped box the halves render in, centred on a City space.
 *
 * @param spaceRect - the City space element's rect (often the empty placeholder).
 * @param referenceTileRect - a live villain `card-tile` rect to borrow the size
 *   from, or `null` when the City has no villain to measure.
 * @returns the box, or `null` when the space has no size.
 */
export function resolveCardBox(
  spaceRect: SliceBox,
  referenceTileRect: SliceBox | null,
): SliceBox | null {
  if (spaceRect.width <= 0 || spaceRect.height <= 0) return null;
  let width = spaceRect.height * CARD_ASPECT;
  let height = spaceRect.height;
  if (referenceTileRect !== null && referenceTileRect.width > 0 && referenceTileRect.height > 0) {
    width = referenceTileRect.width;
    height = referenceTileRect.height;
  }
  const centreX = spaceRect.left + spaceRect.width / 2;
  const centreY = spaceRect.top + spaceRect.height / 2;
  return {
    left: roundTwo(centreX - width / 2),
    top: roundTwo(centreY - height / 2),
    width: roundTwo(width),
    height: roundTwo(height),
  };
}

/**
 * Deterministic stain positions spread along the cut, inside the card box.
 * Positions and sizes derive from `seq` and the index — no randomness.
 *
 * @param seq - the beat's sequence id.
 * @param count - how many stains.
 * @param angleDeg - the cut angle (screen convention).
 * @param width - the card box width.
 * @param height - the card box height.
 * @returns `count` card-local offsets with a size multiplier.
 */
export function buildStainOffsets(
  seq: number,
  count: number,
  angleDeg: number,
  width: number,
  height: number,
): SliceStainOffset[] {
  const radians = toRadians(angleDeg);
  const directionX = Math.cos(radians);
  const directionY = Math.sin(radians);
  const centreX = width / 2;
  const centreY = height / 2;
  // why: the half-length of the cut inside the box — the smaller of the
  // distances to the vertical and horizontal edges along the cut direction.
  let halfLength = Number.POSITIVE_INFINITY;
  if (Math.abs(directionX) > 1e-6) halfLength = Math.min(halfLength, centreX / Math.abs(directionX));
  if (Math.abs(directionY) > 1e-6) halfLength = Math.min(halfLength, centreY / Math.abs(directionY));
  if (!Number.isFinite(halfLength)) halfLength = 0;
  const jitterUnit = Math.min(width, height) * 0.04;
  const offsets: SliceStainOffset[] = [];
  for (let index = 0; index < count; index += 1) {
    const along = ((index + 0.5) / count - 0.5) * 2 * halfLength * STAIN_SPREAD;
    // why: integer arithmetic on seq + index gives a stable per-stain wobble off
    // the cut line and a stable size, so the same beat always stains alike.
    const wobbleStep = (Math.abs(seq) * 7 + index * 13) % 5;
    const sizeStep = (Math.abs(seq) * 3 + index * 5) % 5;
    const wobble = (wobbleStep - 2) * jitterUnit;
    const rawX = centreX + along * directionX - wobble * directionY;
    const rawY = centreY + along * directionY + wobble * directionX;
    offsets.push({
      x: roundTwo(Math.min(width, Math.max(0, rawX))),
      y: roundTwo(Math.min(height, Math.max(0, rawY))),
      scale: roundTwo(0.6 + sizeStep * 0.12),
    });
  }
  return offsets;
}
