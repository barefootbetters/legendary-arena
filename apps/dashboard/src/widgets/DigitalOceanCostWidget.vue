<script setup lang="ts">
import {
  DIGITALOCEAN_BILLING_AS_OF,
  DIGITALOCEAN_BILLING_MONTHS,
  DIGITALOCEAN_BILLING_URL,
  DIGITALOCEAN_DROPLET_MONTHLY_CAP_CENTS,
  DIGITALOCEAN_MONTHLY_BUDGET_CENTS,
  digitalOceanChargedCents,
  sumDigitalOceanUsageCents,
} from '../config/digitalOceanBilling.js';

// why: bill amounts read like the invoice ($2.70, $24.00); the shared
// formatCurrency helper trims trailing zeros, which shows $2.70 as "$2.7".
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

// why: the figures are a dated manual snapshot (config/digitalOceanBilling.ts),
// not a fetch, so there is no loading / error / empty arm and the badge says
// CACHED with the snapshot date rather than a relative "updated" time.
const rows = DIGITALOCEAN_BILLING_MONTHS.map((billingMonth) => ({
  billingMonth,
  usageCents: sumDigitalOceanUsageCents(billingMonth),
  chargedCents: digitalOceanChargedCents(billingMonth),
}));
</script>

<template>
  <div class="widget">
    <header class="widget-header">
      <h3>DigitalOcean</h3>
      <span class="freshness-badge">
        <span class="source">CACHED</span>
        <span class="timestamp">as of {{ DIGITALOCEAN_BILLING_AS_OF }}</span>
      </span>
    </header>

    <div class="widget-data">
      <div v-for="row in rows" :key="row.billingMonth.month" class="metric-row">
        <span class="metric-label">
          {{ row.billingMonth.month }}
          {{ row.billingMonth.status === 'invoiced' ? '(invoiced)' : '(month to date)' }}
        </span>
        <span class="metric-rate">
          {{ formatCents(row.chargedCents) }}
          <span class="metric-unit">
            {{ row.billingMonth.status === 'invoiced' ? 'charged' : 'so far' }}
          </span>
          <span class="metric-unit">
            of {{ formatCents(DIGITALOCEAN_MONTHLY_BUDGET_CENTS) }} budget
          </span>
        </span>
        <span class="metric-fraction">
          <template v-for="(line, index) in row.billingMonth.lines" :key="line.product">
            <template v-if="index > 0"> · </template>
            {{ line.product }} {{ formatCents(line.cents) }}
          </template>
          <template v-if="row.billingMonth.creditCents > 0">
            · usage {{ formatCents(row.usageCents) }} less
            {{ formatCents(row.billingMonth.creditCents) }} credit
          </template>
        </span>
        <span class="metric-fraction">{{ row.billingMonth.note }}</span>
      </div>

      <p class="metric-fraction">
        Steady state: the 2 vCPU / 4 GB droplet bills at most
        {{ formatCents(DIGITALOCEAN_DROPLET_MONTHLY_CAP_CENTS) }} a month, plus backups.
        <a :href="DIGITALOCEAN_BILLING_URL" target="_blank" rel="noopener">Billing ↗</a>
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
