import { computed, ref, onUnmounted, type Ref, type ComputedRef } from 'vue';
import type { ServiceResponse } from '../types/index.js';

// why: D-19804 — the 'BUILD' label is additive over the fetched-data labels
// owned by ServiceResponse.source (LIVE/CACHED/MOCK). Build-time-baked data
// has a different freshness semantic than runtime-fetched data (no auto-
// refresh, no retry), so the operator must see which axis a widget rode at
// build time. The widening is local to useDataFreshness — ServiceResponse
// stays untouched so fetched-data callsites keep their narrower contract.
export type DataFreshnessSource = ServiceResponse<unknown>['source'] | 'BUILD';

interface UseDataFreshnessReturn {
  relativeTime: ComputedRef<string>;
  sourceLabel: ComputedRef<string>;
}

export function useDataFreshness(
  updatedAt: Ref<number | null>,
  source: Ref<DataFreshnessSource | null>,
): UseDataFreshnessReturn {
  const now = ref(Date.now());

  const tickInterval = setInterval(() => {
    now.value = Date.now();
  }, 5000);

  onUnmounted(() => {
    clearInterval(tickInterval);
  });

  const relativeTime = computed(() => {
    const timestamp = updatedAt.value;
    // why: WP-527 / D-19804 — the live /api/dash/* routes return a bare { data }
    // envelope carrying no updatedAt, so at runtime the timestamp arrives absent
    // (undefined) or NaN despite the number|null type; an unguarded
    // `now - timestamp` then renders "NaNh ago". Number.isFinite rejects
    // null / undefined / NaN alike, so every no-timestamp case maps to 'Never'.
    if (timestamp === null || !Number.isFinite(timestamp)) {
      return 'Never';
    }
    const diffMs = now.value - timestamp;
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 5) {
      return 'Just now';
    }
    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    }
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }
    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours}h ago`;
  });

  const sourceLabel = computed(() => {
    // why: WP-527 — the live bare { data } envelope carries no source, so
    // source.value is undefined (not just null); both mean "no provenance
    // label", so both collapse to '' and the badge's v-if="sourceLabel" hides it.
    if (source.value === null || source.value === undefined) {
      return '';
    }
    return source.value;
  });

  return { relativeTime, sourceLabel };
}
