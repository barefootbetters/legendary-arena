<script setup lang="ts">
import { computed } from 'vue';
import { useFetch } from '../composables/useFetch.js';
import { useDataFreshness } from '../composables/useDataFreshness.js';
import { fetchRuntimeHealth } from '../services/endpoints.js';
import { formatUptime } from '../utils/format.js';
import {
  computeRuntimeHealthStatus,
  describeClusteringHint,
  formatCpuPercent,
  oneCoreCeilingPercent,
} from '../utils/runtimeHealth.js';

// why: WP-439 — the game server's per-process runtime health (CPU %, event-loop
// lag, memory, uptime, cores, WEB_CONCURRENCY). Answers "is one Node process
// CPU-saturated — is clustering worth its cost yet?".
const { data, loading, error, updatedAt, source } = useFetch(fetchRuntimeHealth);
const { relativeTime, sourceLabel } = useDataFreshness(updatedAt, source);

const status = computed(() => (data.value ? computeRuntimeHealthStatus(data.value) : null));
const hint = computed(() => (data.value ? describeClusteringHint(data.value) : ''));
const oneCoreCeiling = computed(() =>
  data.value ? oneCoreCeilingPercent(data.value.cpuCount) : null,
);
</script>

<template>
  <div class="widget">
    <div class="widget-header">
      <h3>Server Runtime Health</h3>
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
      <p>No runtime data available.</p>
    </div>

    <div v-else class="widget-data">
      <div class="headline">
        <div class="headline-metric">
          <span class="metric-value"
            >{{ data.eventLoopDelayMs.p99 }}<span class="unit">ms</span></span
          >
          <span class="metric-label">event-loop lag (p99)</span>
        </div>
        <span v-if="status" :class="'status-chip status-' + status">{{ status }}</span>
      </div>

      <dl class="metric-grid">
        <div class="metric">
          <dt>CPU</dt>
          <dd>
            {{ formatCpuPercent(data.cpuPercent) }}
            <span class="sub"
              >of {{ data.cpuCount }} core{{ data.cpuCount === 1 ? '' : 's' }} · one core ≈
              {{ oneCoreCeiling }}%</span
            >
          </dd>
        </div>
        <div class="metric">
          <dt>Event loop</dt>
          <dd>{{ data.eventLoopDelayMs.mean }}ms mean · {{ data.eventLoopDelayMs.max }}ms max</dd>
        </div>
        <div class="metric">
          <dt>Memory (RSS)</dt>
          <dd>{{ data.memoryRssMb }} MB</dd>
        </div>
        <div class="metric">
          <dt>Uptime</dt>
          <dd>{{ formatUptime(data.uptimeSeconds) }}</dd>
        </div>
        <div class="metric">
          <dt>WEB_CONCURRENCY</dt>
          <dd>
            {{ data.webConcurrency === null ? 'unset' : data.webConcurrency }}
            <span class="sub">(inert — single process)</span>
          </dd>
        </div>
      </dl>

      <p class="hint">{{ hint }}</p>
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
.metric-value .unit {
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  margin-left: 0.15rem;
}
.metric-label {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.status-chip {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
}
.status-healthy {
  background: color-mix(in srgb, var(--p-green-500) 18%, transparent);
  color: color-mix(in srgb, var(--p-green-500) 70%, var(--p-text-color));
}
.status-watch {
  background: color-mix(in srgb, var(--p-yellow-500) 18%, transparent);
  color: color-mix(in srgb, var(--p-yellow-500) 70%, var(--p-text-color));
}
.status-saturated {
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
.metric .sub {
  display: block;
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
}

.hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--p-text-color);
  border-left: 3px solid var(--p-content-border-color);
  padding-left: 0.6rem;
}
</style>
