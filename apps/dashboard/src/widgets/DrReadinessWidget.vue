<script setup lang="ts">
import { computed } from 'vue';
import { useFetch } from '../composables/useFetch.js';
import { useDataFreshness } from '../composables/useDataFreshness.js';
import { apiClient } from '../services/api.js';
import {
  mockDrReadiness,
  type DrillResult,
  type DrReadiness,
} from '../services/drReadinessMocks.js';
import type { ServiceResponse } from '../types/index.js';

// why: WP-517 — DR-drill readiness on the ops page. Last drill (date + PASS/FAIL),
// next due, and an overdue flag, projected from the `DR drill due` GitHub issues
// the dr-drill-reminder workflow opens (#1298). Answers "are we current on the
// disaster-recovery drill cadence?" at a glance instead of in a doc nobody reads.

// why: mock-mode-first (D-20402) — no endpoints.ts edit is in this WP's file
// allowlist, so the fetch seam lives here: mock in mock mode, else the admin-
// gated GET /api/dash/dr-readiness (bearer attached by apiClient). Mirrors the
// `fetchRuntimeHealth` shape (server returns the bare `{ data }` envelope).
function isMockMode(): boolean {
  return import.meta.env.VITE_USE_MOCKS === 'true';
}

async function fetchDrReadiness(): Promise<ServiceResponse<DrReadiness>> {
  if (isMockMode()) {
    return mockDrReadiness(Date.now());
  }
  const response = await apiClient.get<ServiceResponse<DrReadiness>>('/api/dash/dr-readiness');
  return response.data;
}

const { data, loading, error, updatedAt, source } = useFetch(fetchDrReadiness);
const { relativeTime, sourceLabel } = useDataFreshness(updatedAt, source);

const statusLabel = computed(() => (data.value?.overdue ? 'Overdue' : 'On track'));
const statusTone = computed(() => (data.value?.overdue ? 'saturated' : 'healthy'));

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
  background: #ffffff;
  border: 1px solid #e2e8f0;
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
  color: #475569;
}

.freshness-badge {
  font-size: 0.65rem;
  color: #94a3b8;
  display: flex;
  gap: 0.35rem;
}

.freshness-badge .source {
  background: #f1f5f9;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-weight: 600;
}

.widget-loading .skeleton-block {
  height: 48px;
  background: #e2e8f0;
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
  color: #dc2626;
  font-size: 0.85rem;
}
.widget-empty {
  color: #94a3b8;
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
  color: #0f172a;
}
.metric-label {
  font-size: 0.8rem;
  color: #64748b;
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
  background: #dcfce7;
  color: #166534;
}
.status-watch,
.result-watch {
  background: #fef9c3;
  color: #854d0e;
}
.status-saturated,
.result-saturated {
  background: #fee2e2;
  color: #991b1b;
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
  color: #94a3b8;
}
.metric dd {
  margin: 0.15rem 0 0;
  font-size: 0.9rem;
  color: #0f172a;
}
.metric .sub {
  display: block;
  font-size: 0.7rem;
  color: #94a3b8;
}
</style>
