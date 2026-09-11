/**
 * Scale-to-fit observer for the WP-688 / D-24502 lock-1 desktop play board.
 *
 * The desktop play board (`<PlayDesktop>`) is authored at a fixed width (the
 * 1280×720 authoring floor) and then **scaled to fit** the viewport: it fits
 * the smallest supported desktop viewport at the largest scale that still
 * shows the whole board with no page scroll, and grows (never rewraps) on
 * wider / taller screens. This composable owns only the geometry math — it
 * measures the authored stage's natural (untransformed) size against the
 * available viewport box and returns the clamped scale factor. The page binds
 * that scale to a `transform: scale()` on the stage and reserves the *scaled*
 * height so the page itself never scrolls.
 *
 * Single-responsibility, mirroring `useViewport.ts`: this composable carries
 * no layout, no game state, no store access — it reads DOM geometry only
 * (`offsetWidth` / `offsetHeight` / `getBoundingClientRect` / `innerHeight`).
 * The `transform: scale()` does not change an element's layout box, so the
 * stage's `offsetWidth` / `offsetHeight` stay the *authored* size regardless
 * of the applied scale — that is what lets us measure once and scale visually.
 *
 * @see WP-688 §Scope (In) C — the scale-to-fit composable
 * @see DECISIONS.md D-24502 lock 1 / D-24505 — the authoring-floor + scale policy
 * @see useViewport.ts — the single-responsibility composable precedent
 */

import {
  onBeforeUnmount,
  onMounted,
  ref,
  type Ref,
} from 'vue';

/**
 * The scale band (from D-24502 lock 1, realized fit-driven). The board never
 * renders larger than {@link MAX_SCALE} (the ~1.5× cap the lock names for a
 * 1920-wide screen) and never smaller than {@link MIN_SCALE} (a readability
 * safety floor — moderate board-scoped compaction keeps the real scale at the
 * 1280 floor well above this, around ~0.75×).
 */
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 1.5;

interface ScaleToFitOptions {
  /**
   * The container box the stage is fit inside. It is laid out by CSS to the
   * available play area (the flex gap between the brand header and footer), so
   * its `clientWidth` / `clientHeight` ARE the space the board has — no
   * viewport / header / footer arithmetic is needed here.
   */
  containerRef: Ref<HTMLElement | null>;
  /** The authored board stage whose natural size is measured, then scaled. */
  stageRef: Ref<HTMLElement | null>;
  /**
   * Optional: the pending-choice prompt block inside the stage (Jeff feedback,
   * D-24505 scale carve-out). Its height is SUBTRACTED from the stage height
   * before fitting, so a response-requiring prompt that temporarily grows the
   * board is reached by SCROLLING at the resting scale — the board is not shrunk
   * (or clipped) to cram the prompt on-screen. When absent or empty (no prompt
   * active) it contributes 0, so normal play fits exactly as before.
   */
  promptsRef?: Ref<HTMLElement | null>;
}

interface ScaleToFitRefs {
  /** The clamped scale factor to apply as `transform: scale(scale)`. */
  scale: Ref<number>;
  /** Recompute on demand (e.g. after a frame that changes the stage height). */
  recompute: () => void;
}

/**
 * Compute the largest scale in [{@link MIN_SCALE}, {@link MAX_SCALE}] at which a
 * `naturalWidth × naturalHeight` stage fits inside an `availableWidth ×
 * availableHeight` box. Width- and height-fit are both honored; the smaller
 * wins, so the whole board always fits. Returns {@link MIN_SCALE} for a
 * degenerate (zero) natural size so a not-yet-measured stage never divides by
 * zero.
 */
export function computeFitScale(
  naturalWidth: number,
  naturalHeight: number,
  availableWidth: number,
  availableHeight: number,
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return MIN_SCALE;
  }
  const widthFit = availableWidth / naturalWidth;
  const heightFit = availableHeight / naturalHeight;
  const rawScale = Math.min(widthFit, heightFit);
  // why: clamp into the D-24502 band — cap the scale-up at MAX_SCALE (the lock's
  // ~1.5× ceiling for wide monitors) and floor it at MIN_SCALE (a readability
  // safety net; board-scoped compaction keeps the real 1280 scale well above it).
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));
}

/**
 * Observe the viewport and the authored stage, and expose the scale factor
 * (and the reserved scaled height) that fits the stage with no page scroll.
 *
 * In server-side / test-without-jsdom contexts (no `window`) the refs default
 * to scale 1 and height 0 and no observers are attached, so a headless mount
 * renders the board at its authored size without throwing.
 */
export function useScaleToFit(options: ScaleToFitOptions): ScaleToFitRefs {
  const scale = ref<number>(1);

  function recompute(): void {
    const container = options.containerRef.value;
    const stage = options.stageRef.value;
    if (
      typeof window === 'undefined' ||
      container === null ||
      stage === null
    ) {
      return;
    }
    // why: offsetWidth/offsetHeight are the stage's LAYOUT size, which a
    // `transform: scale()` does not change — so these stay the authored size
    // on every recompute and never feed the scale back into itself. The stage
    // is position:absolute (out of the container's flow), so it never inflates
    // the container it is measured against.
    const naturalWidth = stage.offsetWidth;
    // why: subtract the pending-prompt block's height (Jeff feedback, D-24505) so
    // the fit is computed against the RESTING board. A response prompt that grows
    // the stage then overflows below the fitted box and is reached by scrolling
    // (the fit container is overflow-y:auto) at the resting scale — the board is
    // never shrunk or clipped to fit a prompt. 0 when no prompt is active.
    const promptsHeight = options.promptsRef?.value?.offsetHeight ?? 0;
    const naturalHeight = Math.max(1, stage.offsetHeight - promptsHeight);
    // why: the container is CSS-sized to the available play area (the flex gap
    // between header and footer), so its own client box IS the space the board
    // has — measure it directly, no window/header/footer arithmetic.
    scale.value = computeFitScale(
      naturalWidth,
      naturalHeight,
      container.clientWidth,
      container.clientHeight,
    );
  }

  let resizeObserver: ResizeObserver | null = null;

  onMounted(() => {
    if (typeof window === 'undefined') {
      return;
    }
    recompute();
    window.addEventListener('resize', recompute);
    // why: the stage height changes without a window resize — a larger hand,
    // a tall pending-choice prompt, the endgame summary — so observe the stage
    // itself and re-fit. Guarded: ResizeObserver is absent in some test DOMs.
    if (typeof ResizeObserver === 'function' && options.stageRef.value !== null) {
      resizeObserver = new ResizeObserver(() => recompute());
      resizeObserver.observe(options.stageRef.value);
    }
  });

  onBeforeUnmount(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.removeEventListener('resize', recompute);
    if (resizeObserver !== null) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  });

  return { scale, recompute };
}
