<script lang="ts">
import { defineComponent, computed } from 'vue';

import { useTheme } from '../../composables/useTheme';

/**
 * Day/night theme toggle — a sun/moon button in the brand header. Shows the
 * moon in light mode (click → night) and the sun in dark mode (click → day),
 * the standard web convention. Uses the shared `useTheme` composable, so the
 * whole app (chrome + play board) flips via the brand-token dark palette.
 *
 * why: `defineComponent` (NOT `<script setup>`) per the arena-client
 * separate-compile SFC convention (D-6512 / P6-30), matching `Header.vue`.
 */
export default defineComponent({
  name: 'ThemeToggle',
  setup() {
    const { activeTheme, toggleTheme } = useTheme();

    const isDark = computed(() => activeTheme.value === 'dark');
    const glyph = computed(() => (isDark.value ? '☀️' : '🌙'));
    const label = computed(() =>
      isDark.value ? 'Switch to day theme' : 'Switch to night theme',
    );

    return { isDark, glyph, label, toggleTheme };
  },
});
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    data-testid="theme-toggle"
    :aria-label="label"
    :aria-pressed="isDark ? 'true' : 'false'"
    :title="label"
    @click="toggleTheme"
  >
    <span aria-hidden="true">{{ glyph }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: var(--la-font-size-body);
  line-height: 1;
}

.theme-toggle:hover,
.theme-toggle:focus-visible {
  opacity: 0.75;
}
</style>
