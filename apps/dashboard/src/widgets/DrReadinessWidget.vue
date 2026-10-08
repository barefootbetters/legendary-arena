<script setup lang="ts">
import { computed } from 'vue';
import { useFetch } from '../composables/useFetch.js';
import { useDataFreshness } from '../composables/useDataFreshness.js';
import { fetchDrReadiness } from '../services/endpoints.js';
import {
  wrapLiveDrReadiness,
  type DrillResult,
  type DrReadiness,
} from '../services/drReadinessMocks.js';
import type { ServiceResponse } from '../types/index.js';

// why: WP-517 — DR-drill readiness on the ops page. Last drill (date + PASS/FAIL),
// next due, and an overdue flag, projected from the `DR drill due` GitHub issues
// the dr-drill-reminder workflow opens (#1298). Answers "are we current on the
// disaster-recovery drill cadence?" at a glance instead of in a doc nobody reads.

// why: the shared fetcher (services/endpoints.ts) stamps any 2xx LIVE. This tile
// badges the server's placeholder payload (`source: 'mock'`, no DASH_GITHUB_TOKEN)
// MOCK instead (#2567), so a live response is re-wrapped through
// wrapLiveDrReadiness; a mock-mode response already carries MOCK.
async function fetchDrReadinessForTile(): Promise<ServiceResponse<DrReadiness>> {
  const response = await fetchDrReadiness();
  if (response.source !== 'LIVE') {
    return response;
  }
  return wrapLiveDrReadiness(response.data, response.updatedAt);
}

const { data, loading, error, updatedAt, source } = useFetch(fetchDrReadinessForTile);
const { relativeTime, sourceLabel } = useDataFreshness(updatedAt, source);

// why: a placeholder payload (`source: 'mock'`, no DASH_GITHUB_TOKEN) has no real
// drill history, so a green "On track" would be a fabricated verdict.
const isPlaceholder = computed(() => data.value?.source === 'mock');

// why: an open `Backup mirror failing — pCloud` issue means the 3-2-1 second copy
// is missing while the primary R2 backup still lands. The DB Backup run stays
// green in that state, so this tile is where it must show (2026-10-05..08 went
// unnoticed for four nights). It ranks below an overdue drill: R2 still holds a
// restorable dump, so it is a watch, not a red.
const hasMirrorAlert = computed(() => data.value?.backupMirrorAlert != null);

const statusLabel = computed(() => {
  if (isPlaceholder.value) {
    return 'Not connected';
  }
  if (data.value?.overdue) {
    return 'Overdue';
  }
  if (hasMirrorAlert.value) {
    return 'Mirror failing';
  }
  return 'On track';
});

const statusTone = computed(() => {
  if (isPlaceholder.value) {
    return 'watch';
  }
  if (data.value?.overdue) {
    return 'saturated';
  }
  if (hasMirrorAlert.value) {
    return 'watch';
  }
  return 'healthy';
});

const mirrorLabel = computed(() => {
  if (isPlaceholder.value) {
    return 'Unknown';
  }
  const alert = data.value?.backupMirrorAlert;
  if (alert == null) {
    return 'No open alert';
  }
  if (alert.openedAt === null) {
    return 'Failing';
  }
  return `Failing since ${alert.openedAt}`;
});

function resultLabel(result: DrillResult): string {
  if (result === 'pass') {
    return 'PASS';
  }
  if (result === 'fail') {
    return 'FAIL';
  }
  return 'Unknown';
}

function resultTone(result: DrillResult): string {
  if (result === 'pass') {
    return 'healthy';
  }
  if (result === 'fail') {
    return 'saturated';
  }
  return 'watch';
}
</script>

<template>
  <div class="widget">
    <div class="widget-header">
      <h3>DR Readiness</h3>
      <span v-if="sourceLabel" class="freshness-badge">
        <span class="source">{{ sourceLabel }}</span>
        <span class="timestamp">{{ relativeTime }}</span>
      </span>
    </div>

    <div v-if="loading && !data" class="widget-loading">
      <div class="skeleton-block"></div>
    </div>

    <div v-else-if="error" class="widget-error">
      <p>{{ error.message }}</p>
    </div>

    <div v-else-if="!data" class="widget-empty">
      <p>No DR-readiness data available.</p>
    </div>

    <div v-else class="widget-data">
      <div class="headline">
        <div class="headline-metric">
          <span class="metric-value">{{ statusLabel }}</span>
          <span class="metric-label">disaster-recovery drill cadence</span>
        </div>
        <span :class="'status-chip status-' + statusTone">{{ statusLabel }}</span>
      </div>

      <dl class="metric-grid">
        <div class="metric">
          <dt>Last drill</dt>
          <dd v-if="data.lastDrill">
            {{ data.lastDrill.date }}
            <span :class="'result-chip result-' + resultTone(data.lastDrill.result)">{{
              resultLabel(data.lastDrill.result)
            }}</span>
          </dd>
          <dd v-else>None recorded</dd>
        </div>
        <div class="metric">
          <dt>Next due</dt>
          <dd>{{ data.nextDue }}</dd>
        </div>
        <div class="metric">
          <dt>pCloud backup mirror</dt>
          <dd>
            <span :class="{ 'mirror-failing': hasMirrorAlert }">{{ mirrorLabel }}</span>
            <span class="sub">{{
              hasMirrorAlert
                ? '(R2 primary still current — see the open GitHub issue)'
                : '(second offsite copy)'
            }}</span>
          </dd>
        </div>
        <div class="metric">
          <dt>Feed</dt>
          <dd>
            {{ data.source }}
            <span class="sub">{{
              data.source === 'mock' ? '(no token — placeholder)' : '(live issues)'
            }}</span>
          </dd>
        </div>
      </dl>
    </div>
  </div>
</template>

<style scoped>
.widget {
  background: var(--p-content-background, var(--p-surface-card));
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 1.25rem;
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.widget-header h3 {
  margin: 0;
  font-size: 0.9rem;
  color: var(--p-text-color);
}

.freshness-badge {
  font-size: 0.65rem;
  color: var(--p-text-muted-color);
  display: flex;
  gap: 0.35rem;
}

.freshness-badge .source {
  background: var(--p-content-border-color);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-weight: 600;
}

.widget-loading .skeleton-block {
  height: 48px;
  background: var(--p-content-border-color);
  border-radius: 4px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.widget-error {
  color: color-mix(in srgb, var(--p-red-500) 70%, var(--p-text-color));
  font-size: 0.85rem;
}
.widget-empty {
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}

.widget-data {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.headline {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.headline-metric {
  display: flex;
  flex-direction: column;
}

.metric-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--p-text-color);
}
.metric-label {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.status-chip,
.result-chip {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
}
.result-chip {
  margin-left: 0.4rem;
}
.status-healthy,
.result-healthy {
  background: color-mix(in srgb, var(--p-green-500) 18%, transparent);
  color: color-mix(in srgb, var(--p-green-500) 70%, var(--p-text-color));
}
.status-watch,
.result-watch {
  background: color-mix(in srgb, var(--p-yellow-500) 18%, transparent);
  color: color-mix(in srgb, var(--p-yellow-500) 70%, var(--p-text-color));
}
.status-saturated,
.result-saturated {
  background: color-mix(in srgb, var(--p-red-500) 18%, transparent);
  color: color-mix(in srgb, var(--p-red-500) 70%, var(--p-text-color));
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin: 0;
}
.metric dt {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color);
}
.metric dd {
  margin: 0.15rem 0 0;
  font-size: 0.9rem;
  color: var(--p-text-color);
}
.mirror-failing {
  font-weight: 700;
  color: color-mix(in srgb, var(--p-yellow-500) 70%, var(--p-text-color));
}
.metric .sub {
  display: block;
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
}
</style>
