<script setup lang="ts">
/**
 * ViewModeToggle.vue
 * Toolbar control that flips between image view and data view.
 *
 * Reads the shared viewMode ref from useCardViewMode() and invokes
 * toggleViewMode() on click. Emits no events — the composable is the
 * single source of truth across the app.
 *
 * Accessibility: rendered as a native <button> with an aria-pressed
 * attribute that reflects the current mode (pressed = 'data' view
 * active). The accessible name includes the current mode so screen
 * readers announce the state change on activation.
 */

import { useCardViewMode } from "../composables/useCardViewMode";

const { viewMode, toggleViewMode } = useCardViewMode();
</script>

<template>
  <button
    type="button"
    class="view-mode-toggle"
    :aria-pressed="viewMode === 'data'"
    :title="viewMode === 'image' ? 'Switch to data view' : 'Switch to image view'"
    :aria-label="viewMode === 'image' ? 'Switch card display to data view' : 'Switch card display to image view'"
    @click="toggleViewMode"
  >
    <span v-if="viewMode === 'image'" class="toggle-icon">📋</span>
    <span v-else class="toggle-icon">🖼️</span>
    <span class="toggle-label">{{ viewMode === 'image' ? 'Data view' : 'Image view' }}</span>
  </button>
</template>

<style scoped>
.view-mode-toggle {
  background: #2a2a3a;
  border: 1px solid #3e3e56;
  color: #c8c8e0;
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}

.view-mode-toggle:hover {
  background: #35354a;
  color: #e8e8ee;
}

.view-mode-toggle[aria-pressed="true"] {
  background: #2a2a5a;
  border-color: #7070e0;
  color: #c0c0ff;
}

.view-mode-toggle[aria-pressed="true"]:hover {
  background: #35356a;
}

.toggle-icon {
  font-size: 1rem;
  line-height: 1;
}

.toggle-label {
  font-weight: 600;
}
</style>
