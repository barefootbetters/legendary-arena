<script setup lang="ts">
import { useLightbox } from "../composables/useLightbox";

const { isOpen, imageUrl, altText, isZoomed, closeLightbox, toggleZoom } = useLightbox();

function handleBackdropClick(event: MouseEvent) {
  // why: only close when the backdrop itself is clicked, not when a child
  // element (the image or controls) bubbles a click through
  if (event.target === event.currentTarget) {
    closeLightbox();
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="lightbox-backdrop"
    @click="handleBackdropClick"
    role="dialog"
    aria-modal="true"
    aria-label="Image viewer"
  >
    <div class="lightbox-toolbar">
      <button
        class="toolbar-btn"
        @click="toggleZoom"
        :title="isZoomed ? 'Zoom out' : 'Zoom in (2x)'"
        aria-label="Toggle zoom"
      >
        {{ isZoomed ? "🔍 1:1" : "🔍 2×" }}
      </button>
      <button
        class="toolbar-btn close-btn"
        @click="closeLightbox"
        title="Close (Esc)"
        aria-label="Close lightbox"
      >
        ✕ Close
      </button>
    </div>

    <div class="lightbox-content" :class="{ zoomed: isZoomed }">
      <img
        :src="imageUrl"
        :alt="altText"
        :class="{ zoomed: isZoomed }"
        @click="toggleZoom"
        draggable="false"
      />
    </div>

    <div class="lightbox-caption">{{ altText }}</div>
  </div>
</template>

<style scoped>
/* ── Backdrop overlay ──────────────────────────────────────────────────── */
.lightbox-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Toolbar ───────────────────────────────────────────────────────────── */
.lightbox-toolbar {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  gap: 0.5rem;
  z-index: 2;
}
.toolbar-btn {
  background: rgba(42, 42, 58, 0.9);
  border: 1px solid #3e3e56;
  color: #e8e8ee;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-family: inherit;
  font-weight: 600;
  backdrop-filter: blur(4px);
  transition: background 0.15s, border-color 0.15s;
}
.toolbar-btn:hover {
  background: rgba(58, 58, 90, 0.95);
  border-color: #7070e0;
}
.close-btn:hover {
  background: rgba(90, 30, 30, 0.9);
  border-color: #f87171;
}

/* ── Image container ───────────────────────────────────────────────────── */
.lightbox-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 4rem 2rem 3rem;
  overflow: auto;
  box-sizing: border-box;
}
.lightbox-content.zoomed {
  /* why: when zoomed, allow scrolling to pan around the enlarged image */
  align-items: flex-start;
  justify-content: flex-start;
}

.lightbox-content img {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  cursor: zoom-in;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  transition: transform 0.2s ease-out;
  user-select: none;
}
.lightbox-content img.zoomed {
  max-width: none;
  max-height: none;
  width: 180vw;
  height: auto;
  cursor: zoom-out;
}

/* ── Caption ───────────────────────────────────────────────────────────── */
.lightbox-caption {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  color: #c8c8e0;
  font-size: 0.9rem;
  font-weight: 600;
  background: rgba(26, 26, 36, 0.85);
  padding: 0.5rem 1.25rem;
  border-radius: 20px;
  backdrop-filter: blur(4px);
  max-width: 80vw;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
