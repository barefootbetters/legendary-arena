/**
 * useResizable.ts
 * Drag-to-resize logic for panel widths, with localStorage persistence.
 *
 * Usage:
 *   const { width, startDrag, resetWidth } = useResizable({
 *     storageKey: 'cardDetailWidth',
 *     defaultWidth: 320,
 *     minWidth: 240,
 *     maxWidth: 720,
 *   });
 *
 * Attach @pointerdown="startDrag" to the splitter element. The composable
 * wires up window-level pointermove/pointerup so the drag continues even
 * when the pointer leaves the splitter.
 */

import { ref, onBeforeUnmount } from "vue";

export interface ResizableOptions {
  /** localStorage key to persist the user's preferred width. */
  storageKey: string;
  /** Initial width in pixels if no stored value exists. */
  defaultWidth: number;
  /** Minimum width in pixels. */
  minWidth: number;
  /** Maximum width in pixels. */
  maxWidth: number;
  /**
   * Drag direction: 'left' means the splitter is on the LEFT edge of the
   * panel, so dragging left increases width (the panel grows toward the
   * left). 'right' means the splitter is on the RIGHT edge, so dragging
   * right increases width. Default: 'left' (right sidebar pattern).
   */
  direction?: "left" | "right";
}

export function useResizable(options: ResizableOptions) {
  const {
    storageKey,
    defaultWidth,
    minWidth,
    maxWidth,
    direction = "left",
  } = options;

  // ── Load initial width from storage ────────────────────────────────────
  // why: try/catch because localStorage may be unavailable in some contexts
  // (private mode, storage quota exceeded). Fall back silently to default.
  function loadStoredWidth(): number {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!Number.isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed;
        }
      }
    } catch {
      // Silent fallback — localStorage may not be available
    }
    return defaultWidth;
  }

  const width = ref<number>(loadStoredWidth());

  // ── Drag state ─────────────────────────────────────────────────────────
  let isDragging = false;
  let startPointerX = 0;
  let startWidth = 0;

  function saveWidth(newWidth: number): void {
    try {
      localStorage.setItem(storageKey, String(newWidth));
    } catch {
      // Silent fallback
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!isDragging) return;
    event.preventDefault();

    const deltaX = event.clientX - startPointerX;
    // why: when splitter is on the left edge, dragging left (negative delta)
    // should increase width, so we subtract. When splitter is on the right
    // edge, dragging right (positive delta) should increase width.
    const rawWidth = direction === "left"
      ? startWidth - deltaX
      : startWidth + deltaX;

    // Clamp to min/max
    const clampedWidth = Math.min(Math.max(rawWidth, minWidth), maxWidth);
    width.value = clampedWidth;
  }

  function handlePointerUp(): void {
    if (!isDragging) return;
    isDragging = false;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    saveWidth(width.value);
  }

  /**
   * Call this from the splitter element's @pointerdown handler.
   * @param event - The pointerdown PointerEvent
   */
  function startDrag(event: PointerEvent): void {
    event.preventDefault();
    isDragging = true;
    startPointerX = event.clientX;
    startWidth = width.value;
    // why: global cursor + user-select:none prevents flicker and text
    // selection while dragging across the page
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  /** Resets width to the default and saves it. */
  function resetWidth(): void {
    width.value = defaultWidth;
    saveWidth(defaultWidth);
  }

  // why: cleanup on component unmount so dangling listeners don't accumulate
  // across route changes or hot reloads
  onBeforeUnmount(() => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  });

  return {
    width,
    startDrag,
    resetWidth,
  };
}
