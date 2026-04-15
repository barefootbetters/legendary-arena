/**
 * useLightbox.ts
 * Shared state for the full-screen image viewer overlay.
 *
 * Components call openLightbox(imageUrl, altText) to display any image
 * full-screen. The lightbox itself is mounted once at the App root so it
 * overlays the entire page regardless of which panel or grid is active.
 */

import { ref } from "vue";

// ── Shared reactive state (module-scoped singleton) ─────────────────────────

const isOpen   = ref<boolean>(false);
const imageUrl = ref<string>("");
const altText  = ref<string>("");
const isZoomed = ref<boolean>(false);

export function useLightbox() {
  return {
    isOpen,
    imageUrl,
    altText,
    isZoomed,
    openLightbox,
    closeLightbox,
    toggleZoom,
  };
}

/**
 * Opens the lightbox showing the given image at full size.
 * @param url - The full-size image URL to display
 * @param alt - Alt text for accessibility (typically the card/theme name)
 */
function openLightbox(url: string, alt: string): void {
  imageUrl.value = url;
  altText.value = alt;
  isZoomed.value = false;
  isOpen.value = true;
}

/**
 * Closes the lightbox and resets zoom state.
 */
function closeLightbox(): void {
  isOpen.value = false;
  isZoomed.value = false;
}

/**
 * Toggles 2x zoom on the image. When zoomed, the image can be panned by
 * scrolling inside the container.
 */
function toggleZoom(): void {
  isZoomed.value = !isZoomed.value;
}
