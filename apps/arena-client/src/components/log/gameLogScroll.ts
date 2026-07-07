/**
 * Pure scroll helper for the game log panel (WP-321).
 *
 * Takes plain pixel measurements rather than a DOM node so the "stick to the
 * bottom" decision is unit-testable without a layout engine — jsdom does not
 * compute `scrollHeight` / `clientHeight`, so the component's auto-scroll logic
 * lives here where it can be exercised directly.
 */

// why: WP-321 — a few pixels of slack absorbs sub-pixel rounding and fractional
// line heights, so "at the bottom" is not defeated by a sub-pixel gap after a
// new row lands. Kept small so a genuine scroll-up (to read history) is still
// detected as "not at the bottom".
export const GAME_LOG_STICK_THRESHOLD_PX = 24;

/**
 * Returns whether a scroll viewport is at (or within the stick threshold of)
 * its bottom — i.e. whether a newly-appended entry should auto-scroll into view.
 *
 * A viewport whose content fits without scrolling (`scrollHeight <=
 * clientHeight`) yields a non-positive gap and counts as pinned.
 *
 * @param scrollHeight - Total scrollable content height (px).
 * @param scrollTop - Current scroll offset from the top (px).
 * @param clientHeight - Visible viewport height (px).
 * @param threshold - Pixels of slack that still count as "at the bottom".
 * @returns True when the viewport is pinned to the bottom.
 */
export function isPinnedToBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  threshold: number = GAME_LOG_STICK_THRESHOLD_PX,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}
