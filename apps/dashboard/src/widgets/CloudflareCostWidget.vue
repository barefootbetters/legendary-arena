<script setup lang="ts">
import {
  CLOUDFLARE_BILLING_AS_OF,
  CLOUDFLARE_BILLING_CYCLES,
  CLOUDFLARE_BILLING_URL,
  CLOUDFLARE_MONTHLY_BUDGET_CENTS,
  sumCloudflareCycleCents,
} from '../config/cloudflareBilling.js';

// why: bill amounts read like the invoice ($0.90, $15.90); the shared
// formatCurrency helper trims trailing zeros, which shows $0.90 as "$0.9".
const billFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format an integer number of cents as a US-dollar bill amount with two decimals.
 */
function formatCents(cents: number): string {
  return billFormatter.format(cents / 100);
}

// why: the figures are a dated manual snapshot (config/cloudflareBilling.ts),
// not a fetch, so there is no loading / error / empty arm and the badge says
// CACHED with the snapshot date rather than a relative "updated" time.
const rows = CLOUDFLARE_BILLING_CYCLES.map((billingCycle) => ({
  billingCycle,
  totalCents: sumCloudflareCycleCents(billingCycle),
}));
</script>

<template>
  <div class="widget">
    <header class="widget-header">
      <h3>Cloudflare</h3>
      <span class="freshness-badge">
        <span class="source">CACHED</span>
        <span class="timestamp">as of {{ CLOUDFLARE_BILLING_AS_OF }}</span>
      </span>
    </header>

    <div class="widget-data">
      <div v-for="row in rows" :key="row.billingCycle.cycle" class="metric-row">
        <span class="metric-label">
          {{ row.billingCycle.cycle }}
          {{ row.billingCycle.status === 'invoiced' ? '(invoiced)' : '(cycle to date)' }}
        </span>
        <span class="metric-rate">
          {{ formatCents(row.totalCents) }}
          <span class="metric-unit">
            {{ row.billingCycle.status === 'invoiced' ? 'charged' : 'so far' }}
          </span>
          <span class="metric-unit">
            of {{ formatCents(CLOUDFLARE_MONTHLY_BUDGET_CENTS) }} budget
          </span>
        </span>
        <span v-if="row.billingCycle.status === 'cycle-to-date'" class="metric-fraction">
          Projected cycle cost {{ formatCents(row.billingCycle.projectedCycleCents) }}
        </span>
        <span
          v-for="line in row.billingCycle.lines"
          :key="line.product"
          class="metric-fraction"
        >
          {{ line.product }} ({{ line.usage }}) {{ formatCents(line.cents) }}
        </span>
        <span class="metric-fraction">{{ row.billingCycle.note }}</span>
      </div>

      <p class="metric-fraction">
        R2 bills on a 23rd-to-22nd cycle. Infrequent Access operations have no
        free tier and bill by the million, rounded up.
        <a :href="CLOUDFLARE_BILLING_URL" target="_blank" rel="noopener">Billing ↗</a>
      </p>
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
  margin: 0;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.metric-fraction a {
  color: var(--p-primary-color);
}
</style>
