/**
 * useBoardTilt.ts
 *
 * The WP-852 **table perspective** for the desktop board: the adversary band,
 * City and HQ lean back like a table seen from the player's chair, and a board
 * card stands up square to the player on hover. This composable owns the locked
 * tilt values and turns the shared Effect-Intensity state into the two flags and
 * the CSS custom properties `PlayDesktop.vue` binds on its board scene.
 *
 * Presentation only: it reads `useEffectIntensity()` and nothing else — no
 * clock, no randomness, no game state.
 *
 * @see WP-852 §Contract
 * @see DECISIONS.md D-24788 (table perspective), D-24365 (Effect Intensity)
 */

import { computed, type ComputedRef } from 'vue';
import { useEffectIntensity } from '../vfx/effectIntensity';

// why: 14° under a 900 px perspective is the prototype's pick (WP-852 §Context
// table, the real board at 1440×900): the far edge draws ~6% narrower and reads
// as a table, while neighbouring City boxes stay ≥ 13.6 px apart. 8° at
// 1600 px was barely visible; 20° strained the band's text. An angle means
// nothing without its perspective distance, so the two are locked together.
export const BOARD_TILT_ANGLE_DEGREES = 14;
export const BOARD_TILT_PERSPECTIVE_PX = 900;

// why: 0 because translating the plane up only moves the dead strip the tilt
// opens above the band down to the cockpit edge (the hinge moves with it); the
// variable stays as a one-line tuning knob, locked at 0 here.
export const BOARD_LIFT_PX = 0;

/** The tilt flags and the CSS custom properties for the board scene. */
export interface BoardTiltState {
  /** True unless Effect Intensity is `off` (the off switch flattens the board). */
  isTiltActive: ComputedRef<boolean>;
  /** True when board cards may straighten on hover (the WP-699 hand-lift gate). */
  isBoardLiftEnabled: ComputedRef<boolean>;
  /** `--board-tilt-angle`, `--board-tilt-perspective`, `--board-lift` for an inline style. */
  boardTiltStyle: ComputedRef<Record<string, string>>;
}

/**
 * Returns the board tilt state, derived from the shared Effect-Intensity
 * singleton so the sound-bar control flattens or restores the board live.
 */
export function useBoardTilt(): BoardTiltState {
  const { intensity, prefersReducedMotion, shouldRender } = useEffectIntensity();

  const isTiltActive = computed(() => intensity.value !== 'off');

  // why: reduced motion keeps the tilt (a static angle is not motion) but drops
  // the hover lift (a card swinging up is), the same gate as the WP-699 hand lift.
  const isBoardLiftEnabled = computed(
    () => isTiltActive.value && shouldRender('particles') && !prefersReducedMotion.value,
  );

  const boardTiltStyle = computed<Record<string, string>>(() => {
    let angleDegrees = 0;
    if (isTiltActive.value) {
      angleDegrees = BOARD_TILT_ANGLE_DEGREES;
    }
    return {
      '--board-tilt-angle': `${angleDegrees}deg`,
      '--board-tilt-perspective': `${BOARD_TILT_PERSPECTIVE_PX}px`,
      '--board-lift': `${BOARD_LIFT_PX}px`,
    };
  });

  return { isTiltActive, isBoardLiftEnabled, boardTiltStyle };
}
