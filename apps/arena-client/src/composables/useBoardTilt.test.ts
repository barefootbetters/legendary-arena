import '../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_LIFT_PX,
  BOARD_TILT_ANGLE_DEGREES,
  BOARD_TILT_PERSPECTIVE_PX,
  useBoardTilt,
} from './useBoardTilt';
import { useEffectIntensity } from '../vfx/effectIntensity';

/**
 * Puts Effect Intensity and reduced motion back to the defaults every other
 * test expects. Effect Intensity is a module singleton persisted to
 * localStorage, so a leaked `off` would flatten every later test's board.
 */
function restoreEffectIntensity(): void {
  const effectIntensity = useEffectIntensity();
  effectIntensity.setIntensity('full');
  effectIntensity.prefersReducedMotion.value = false;
}

describe('useBoardTilt (WP-852 / D-24788)', () => {
  test('the locked constants are 14°, 900 px and a 0 px lift', () => {
    assert.equal(BOARD_TILT_ANGLE_DEGREES, 14);
    assert.equal(BOARD_TILT_PERSPECTIVE_PX, 900);
    assert.equal(BOARD_LIFT_PX, 0);
  });

  test('at full intensity the board tilts 14deg and the hover lift is on', () => {
    try {
      useEffectIntensity().setIntensity('full');
      const boardTilt = useBoardTilt();
      assert.deepEqual(boardTilt.boardTiltStyle.value, {
        '--board-tilt-angle': '14deg',
        '--board-tilt-perspective': '900px',
        '--board-lift': '0px',
      });
      assert.equal(boardTilt.isTiltActive.value, true);
      assert.equal(boardTilt.isBoardLiftEnabled.value, true);
    } finally {
      restoreEffectIntensity();
    }
  });

  test('at low intensity the board still tilts and lifts', () => {
    try {
      useEffectIntensity().setIntensity('low');
      const boardTilt = useBoardTilt();
      assert.equal(boardTilt.isTiltActive.value, true);
      assert.equal(boardTilt.isBoardLiftEnabled.value, true);
      assert.equal(boardTilt.boardTiltStyle.value['--board-tilt-angle'], '14deg');
    } finally {
      restoreEffectIntensity();
    }
  });

  test('Effect Intensity off flattens the board and turns the lift off', () => {
    try {
      useEffectIntensity().setIntensity('off');
      const boardTilt = useBoardTilt();
      assert.equal(boardTilt.boardTiltStyle.value['--board-tilt-angle'], '0deg');
      assert.equal(boardTilt.boardTiltStyle.value['--board-tilt-perspective'], '900px');
      assert.equal(boardTilt.boardTiltStyle.value['--board-lift'], '0px');
      assert.equal(boardTilt.isTiltActive.value, false);
      assert.equal(boardTilt.isBoardLiftEnabled.value, false);
    } finally {
      restoreEffectIntensity();
    }
  });

  test('reduced motion keeps the tilt but drops the hover lift', () => {
    try {
      useEffectIntensity().setIntensity('full');
      // why: jsdom has no matchMedia to stub; prefersReducedMotion is an exposed
      // ref on the seam, as in the HandRow and effectIntensity gate tests.
      useEffectIntensity().prefersReducedMotion.value = true;
      const boardTilt = useBoardTilt();
      assert.equal(boardTilt.isTiltActive.value, true);
      assert.equal(boardTilt.isBoardLiftEnabled.value, false);
      assert.equal(boardTilt.boardTiltStyle.value['--board-tilt-angle'], '14deg');
    } finally {
      restoreEffectIntensity();
    }
  });
});
