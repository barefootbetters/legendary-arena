<script setup lang="ts">
import {
  GITHUB_ACTIONS_ALLOWANCES,
  GITHUB_ACTIONS_USAGE_AS_OF,
  projectGitHubActionsAllowance,
} from '../config/githubActionsUsage.js';
import { formatCurrency, formatNumber } from '../utils/format.js';

// why: the figures are a dated manual snapshot (config/githubActionsUsage.ts),
// not a fetch, so there is no loading / error / empty arm and the badge says
// CACHED with the snapshot date rather than a relative "updated" time.
const rows = GITHUB_ACTIONS_ALLOWANCES.map((allowance) => ({
  allowance,
  projection: projectGitHubActionsAllowance(allowance),
}));
</script>

<template>
  <div class="widget">
    <header class="widget-header">
      <h3>GitHub Actions</h3>
      <span class="freshness-badge">
        <span class="source">CACHED</span>
        <span class="timestamp">as of {{ GITHUB_ACTIONS_USAGE_AS_OF }}</span>
      </span>
    </header>

    <div class="widget-data">
      <div v-for="row in rows" :key="row.allowance.account" class="metric-row">
        <span class="metric-label">{{ row.allowance.account }}</span>
        <span class="metric-rate">
          {{ formatCurrency(row.projection.overageCents / 100) }}
          <span class="metric-unit">projected overage this month</span>
        </span>
        <span class="metric-fraction">
          {{ formatNumber(row.allowance.minutesUsed) }} /
          {{ formatNumber(row.allowance.includedMinutes) }} min used; projected
          {{ formatNumber(row.projection.projectedMinutes) }}
          <template v-if="row.projection.overageMinutes > 0">
            ({{ formatNumber(row.projection.overageMinutes) }} over)
          </template>
        </span>
        <span class="metric-fraction">{{ row.allowance.description }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.widget {
  background: var(--p-surface-card, var(--p-content-background));
  border: 1px solid var(--p-surface-border, var(--p-content-border-color));
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
  background: var(--p-surface-border, var(--p-content-border-color));
  color: var(--p-text-color);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-weight: 600;
}

.widget-data {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.metric-row {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.metric-label {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.metric-rate {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--p-text-color);
}

.metric-unit {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--p-text-muted-color);
}

.metric-fraction {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}
</style>
