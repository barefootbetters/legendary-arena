/**
 * useRowFit.ts
 *
 * Reactive "does this row fit without sideways scrolling" flag for a board row.
 * WP-852 switches the board-card straighten-on-hover on only while a row fits:
 * the City and HQ lists are `overflow-x: auto` scroll containers, and a
 * non-`visible` overflow forces its subtree flat and clips it, so a lifted card
 * could neither counter-rotate nor rise out of a scrolling row.
 *
 * The measurement is the slash gesture's own `measureRowFits` (WP-761), and the
 * re-measure triggers mirror its fit watchers, so both features agree on what
 * "fits" means.
 *
 * @see WP-852 §Scope (In) 2
 * @see apps/arena-client/src/composables/useSlashGesture.ts (measureRowFits, the fit watchers)
 */

import { onScopeDispose, readonly, ref, watch, type Ref } from 'vue';
import { measureRowFits } from './useSlashGesture';

/**
 * Tracks whether `rowElement` fits on screen without horizontal scrolling.
 * Re-measures on mount, when the element changes, when `contentSource()`
 * changes, when the row resizes, and on window resize.
 *
 * @param rowElement - the row's scroll container (a template ref).
 * @param contentSource - what the row renders; a change re-measures.
 * @returns a read-only flag, `false` while the element is `null`.
 */
export function useRowFit(
  rowElement: Ref<HTMLElement | null>,
  contentSource: () => unknown,
): Readonly<Ref<boolean>> {
  const isRowFitting = ref(false);

  /** Re-measures the row into `isRowFitting`. */
  function measureFit(): void {
    const row = rowElement.value;
    isRowFitting.value = row !== null && measureRowFits(row);
  }

  // why: flush 'post' — measure after Vue has patched the DOM, so a content
  // change is read at its new width, not the previous one.
  watch(rowElement, measureFit, { immediate: true, flush: 'post' });
  watch(contentSource, measureFit, { flush: 'post' });

  let resizeObserver: ResizeObserver | null = null;
  watch(
    rowElement,
    (row) => {
      if (resizeObserver !== null) resizeObserver.disconnect();
      resizeObserver = null;
      // why: guarded — jsdom and older browsers have no ResizeObserver; the
      // mount / content-change / window-resize triggers still apply without it.
      if (row === null || typeof ResizeObserver !== 'function') return;
      resizeObserver = new ResizeObserver(() => measureFit());
      resizeObserver.observe(row);
    },
    { immediate: true, flush: 'post' },
  );

  const onWindowResize = (): void => measureFit();
  if (typeof window !== 'undefined') window.addEventListener('resize', onWindowResize);

  onScopeDispose(() => {
    if (resizeObserver !== null) resizeObserver.disconnect();
    resizeObserver = null;
    if (typeof window !== 'undefined') window.removeEventListener('resize', onWindowResize);
  });

  return readonly(isRowFitting);
}
