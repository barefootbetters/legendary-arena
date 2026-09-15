/**
 * handArc.ts — pure geometry for the shallow hand arc/fan (WP-699).
 *
 * Given the hand size and a card's index, returns that card's rotation
 * (degrees) and vertical offset (px) so the hand lays along a gentle arc
 * centered on 0°: the middle card sits upright and highest, the edge cards
 * tilt outward and dip slightly, reading as a fan rather than a flat strip.
 *
 * Pure and deterministic — a function of (handSize, index) only, with no DOM,
 * no reactivity, and no side effects — so it is unit-testable without mounting
 * the component. `HandRow.vue` binds the result as inline CSS custom properties
 * and the hand-rolled CSS applies the transform (WP-699 / D-24365: no animation
 * dependency).
 */

/** A single hand card's resting arc transform. */
export interface HandArcTransform {
  /** Rotation in degrees; negative tilts left of centre, positive right. */
  rotationDegrees: number;
  /** Downward vertical offset in px; 0 at centre, larger toward the edges. */
  offsetPx: number;
}

// why: the total end-to-end fan spread. Kept shallow (a gentle tilt, not a
// playing-card splay) so the arc never fights the fitted 1280×720 board
// (WP-688 / D-24505) or the card labels.
const MAX_TOTAL_SPREAD_DEGREES = 24;

// why: how far each card dips per degree of its own rotation, so the edges sit
// lower than the centre and the row curves. 0.55 px/° gives the widest fan a
// ~6.6 px dip at each shoulder — visible as an arc, small enough to stay inside
// the hand well without a scrollbar.
const VERTICAL_DIP_PX_PER_DEGREE = 0.55;

/**
 * Computes the resting arc transform for one hand card.
 *
 * @param handSize - total number of cards in the hand.
 * @param index - the card's 0-based position in the hand.
 * @returns the card's rotation and vertical offset.
 */
export function computeHandArc(handSize: number, index: number): HandArcTransform {
  // why: a single card (or an out-of-range index) sits flat and centred — there
  // is no arc to distribute, and the step divisor below (handSize - 1) would be
  // zero or negative.
  if (handSize <= 1 || index < 0 || index >= handSize) {
    return { rotationDegrees: 0, offsetPx: 0 };
  }
  const stepDegrees = MAX_TOTAL_SPREAD_DEGREES / (handSize - 1);
  const rotationDegrees = -(MAX_TOTAL_SPREAD_DEGREES / 2) + index * stepDegrees;
  // why: dip keys off |rotation| so the centre card (rotation ≈ 0) is highest
  // and the two ends dip symmetrically — the arc's low-shoulders shape.
  const offsetPx = Math.abs(rotationDegrees) * VERTICAL_DIP_PX_PER_DEGREE;
  return { rotationDegrees, offsetPx };
}
