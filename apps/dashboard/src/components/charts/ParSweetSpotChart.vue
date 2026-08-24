<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import BaseChart from './BaseChart.vue';
import { buildParSweetSpotOption } from './parSweetSpotOption.js';
import type { ParProfile } from '../../types/parFidelity.js';

/**
 * The scenario profile whose per-turn sweet-spot curve to render. All option
 * logic lives in the pure `buildParSweetSpotOption` — this component only
 * resolves theme colors and delegates (so the logic is unit-testable without a
 * `.vue` mount).
 */
const props = defineProps<{
  profile: ParProfile;
}>();

const hasBins = computed<boolean>(() => props.profile.bins.length > 0);

/**
 * Resolve a PrimeVue design-token value from the document root. ECharts paints
 * onto a canvas and cannot read CSS custom properties directly (mirrors
 * `SweepTrendChart.vue`).
 */
function readThemeColor(tokenName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
}

// Recompute colors when the dashboard theme toggle fires its event.
const themeVersion = ref(0);
function handleThemeChange(): void {
  themeVersion.value += 1;
}
onMounted(() => window.addEventListener('dashboard-theme-change', handleThemeChange));
onUnmounted(() => window.removeEventListener('dashboard-theme-change', handleThemeChange));

const chartOption = computed(() => {
  void themeVersion.value;
  return buildParSweetSpotOption(props.profile, {
    line: readThemeColor('--p-primary-color'),
    band: readThemeColor('--p-primary-color'),
    axis: readThemeColor('--p-text-muted-color'),
  });
});
</script>

<template>
  <BaseChart v-if="hasBins" :option="chartOption" height="260px" />
</template>
