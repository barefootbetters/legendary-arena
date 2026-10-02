<script setup lang="ts">
// why: WP-204 §No cross-widget composable coupling — this strip widget
// reads the same 3 composables that the full ops widgets use, NOT
// their refs / emitted events. The §Determinism scope HARD invariant
// requires that each widget instance call its own composable directly
// so the widget tree stays a forest, not a graph. The KpiSnapshot
// literals below are inline per WP-204 §Scope (In) → Widgets (rule of
// three: extract only when a second consumer surfaces, per 00.6
// §16.1).

import { computed } from 'vue';
import { useDateRange } from '../composables/useDateRange.js';
import { usePublicSurfaceHealth } from '../composables/usePublicSurfaceHealth.js';
import { useErrorRateMonitor } from '../composables/useErrorRateMonitor.js';
import { useInfraCostWatchdog } from '../composables/useInfraCostWatchdog.js';
import { fetchUptimeProbes, fetchErrorRateSnapshots } from '../services/mocks.js';
import { fetchInfraCostActuals, INFRA_COST_ACTUALS_AS_OF } from '../config/infraCostActuals.js';
import { computeKpiStatus } from '../utils/kpiStatus.js';
import { INFRA_COST_BUDGETS } from '../config/infraCostBudgets.js';
import {
  INFRA_COST_VENDORS,
  type KpiSnapshot,
  type KpiStatus,
  type ServiceResponse,
} from '../types/index.js';

const { range } = useDateRange();

// why: WP-204 §Determinism scope — capture nowMs ONCE at mount; all
// three composables receive the same stable timestamp so per-card
// derivations are reactive-stable across the strip.
const nowMs = Date.now();

const uptimeResponse = computed(() => fetchUptimeProbes(range.value, nowMs));
const errorResponse = computed(() => fetchErrorRateSnapshots(range.value, nowMs));
// why: the cost card reads the same real vendor-bill actuals as the
// System Health page's Infra Cost Watchdog. It used to read the mock
// factory, so Overview showed a made-up 6.7% "On track" while System
// Health showed the real 71.4% with Postgres over budget.
const costResponse = computed(() => fetchInfraCostActuals());

const health = usePublicSurfaceHealth(() => uptimeResponse.value);
const monitor = useErrorRateMonitor(() => errorResponse.value);
const watchdog = useInfraCostWatchdog(() => costResponse.value, INFRA_COST_BUDGETS);

/**
 * Label naming where one card's figure comes from. The strip mixes
 * sources (uptime and error rate are still mock; cost is the cached
 * vendor-bill snapshot), so each card carries its own tag instead of
 * one strip-wide badge that would describe only one of them.
 */
function buildSourceTag(source: ServiceResponse<unknown>['source']): string {
  if (source === 'CACHED') {
    return `CACHED · as of ${INFRA_COST_ACTUALS_AS_OF}`;
  }
  return source;
}

// why: D-19608 Widget State Gate Pattern — single `state` computed
// gates the entire render via the 4-arm v-if chain. WP-204 §Widget
// Data Requirements drops the strip to `empty` when all three
// underlying composables have nothing; per-card partial data renders
// `"—"` placeholder (NOT `0%` / `$0`) per §Widget Data Requirements.
const state = computed<'loading' | 'error' | 'empty' | 'data'>(() => {
  const hasUptime = health.series.value.length > 0;
  const hasErrorData = monitor.series.value.length > 0;
  let costHasAnyVendor = false;
  const mtdMap = watchdog.mtdByVendor.value;
  for (const vendor of INFRA_COST_VENDORS) {
    if (mtdMap[vendor] > 0) {
      costHasAnyVendor = true;
      break;
    }
  }
  if (!hasUptime && !hasErrorData && !costHasAnyVendor) {
    return 'empty';
  }
  return 'data';
});

const STATUS_LABEL: Readonly<Record<KpiStatus, string>> = {
  'on-track': 'On track',
  'needs-attention': 'Needs attention',
  'off-track': 'Off track',
};

interface StripCard {
  readonly id: string;
  readonly label: string;
  readonly valueLabel: string;
  readonly status: KpiStatus | null;
  readonly statusLabel: string;
  readonly sourceTag: string;
}

const worstSurfaceCard = computed<StripCard>(() => {
  const worst = health.worstSurface.value;
  if (worst === null) {
    // why: §Widget Data Requirements partial-data rule — render the
    // `"—"` placeholder when underlying data is empty; NOT `0%` (a
    // literal zero would mislead the operator into thinking the
    // surface is at 0% uptime instead of "no data").
    return {
      id: 'worst-surface',
      label: 'Worst surface',
      valueLabel: '—',
      status: null,
      statusLabel: '',
      sourceTag: buildSourceTag(health.source.value),
    };
  }
  // why: locked KpiSnapshot literal per WP-204 §Scope (In) → Widgets
  // — `direction: 'higher-is-better'`; `target: 99.0`; `tolerance:
  // 4.0`. Thresholds: value >= 99.0 ⇒ on-track; 95.0 <= value < 99.0
  // ⇒ needs-attention; value < 95.0 ⇒ off-track. The reuse of
  // `computeKpiStatus()` preserves the WP-198 single-implementation
  // discipline; no bespoke threshold logic in the widget.
  const snapshot: KpiSnapshot = {
    id: 'worst-surface',
    label: 'Worst surface',
    value: worst.uptimePercent,
    previousValue: 0,
    unit: '%',
    trend: 'flat',
    target: 99.0,
    tolerance: 4.0,
    direction: 'higher-is-better',
  };
  const status = computeKpiStatus(snapshot) ?? 'on-track';
  // why: a status chip on mock data is a fabricated verdict — a green
  // "On track" the operator could act on. Mock cards show the value and
  // their MOCK tag only; the chip returns when the card reads real data.
  const isMock = health.source.value === 'MOCK';
  return {
    id: 'worst-surface',
    label: 'Worst surface',
    valueLabel: `${worst.uptimePercent.toFixed(1)}% (${worst.surface})`,
    status: isMock ? null : status,
    statusLabel: isMock ? '' : STATUS_LABEL[status],
    sourceTag: buildSourceTag(health.source.value),
  };
});

const currentErrorRateCard = computed<StripCard>(() => {
  const series = monitor.series.value;
  if (series.length === 0) {
    return {
      id: 'current-error-rate',
      label: 'Current error rate (1h)',
      valueLabel: '—',
      status: null,
      statusLabel: '',
      sourceTag: buildSourceTag(monitor.source.value),
    };
  }
  const rateFraction = monitor.currentRate.value;
  const ratePercent = Math.round(rateFraction * 1000) / 10;
  // why: locked KpiSnapshot literal per WP-204 §Scope (In) → Widgets
  // — value expressed as percentage 0-100; `direction:
  // 'lower-is-better'`; `target: 1.0`; `tolerance: 4.0`. Thresholds:
  // value <= 1.0 ⇒ on-track; 1.0 < value <= 5.0 ⇒ needs-attention;
  // value > 5.0 ⇒ off-track.
  const snapshot: KpiSnapshot = {
    id: 'current-error-rate',
    label: 'Current error rate (1h)',
    value: ratePercent,
    previousValue: 0,
    unit: '%',
    trend: 'flat',
    target: 1.0,
    tolerance: 4.0,
    direction: 'lower-is-better',
  };
  const status = computeKpiStatus(snapshot) ?? 'on-track';
  // why: same fabricated-verdict rule as the worst-surface card.
  const isMock = monitor.source.value === 'MOCK';
  return {
    id: 'current-error-rate',
    label: 'Current error rate (1h)',
    valueLabel: `${ratePercent.toFixed(1)}%`,
    status: isMock ? null : status,
    statusLabel: isMock ? '' : STATUS_LABEL[status],
    sourceTag: buildSourceTag(monitor.source.value),
  };
});

const costUtilizationCard = computed<StripCard>(() => {
  const mtdMap = watchdog.mtdByVendor.value;
  let hasAny = false;
  for (const vendor of INFRA_COST_VENDORS) {
    if (mtdMap[vendor] > 0) {
      hasAny = true;
      break;
    }
  }
  if (!hasAny) {
    return {
      id: 'cost-utilization',
      label: 'Cost utilization (MTD)',
      valueLabel: '—',
      status: null,
      statusLabel: '',
      sourceTag: buildSourceTag(watchdog.source.value),
    };
  }
  const utilizationFraction = watchdog.totalBudgetUtilizationRatio.value;
  const utilizationPercent = Math.round(utilizationFraction * 1000) / 10;
  // why: locked KpiSnapshot literal per WP-204 §Scope (In) → Widgets
  // — value expressed as percentage 0-100; `direction:
  // 'lower-is-better'`; `target: 80.0`; `tolerance: 20.0`.
  // Thresholds: value <= 80 ⇒ on-track; 80 < value <= 100 ⇒
  // needs-attention; value > 100 ⇒ off-track.
  const snapshot: KpiSnapshot = {
    id: 'cost-utilization',
    label: 'Cost utilization (MTD)',
    value: utilizationPercent,
    previousValue: 0,
    unit: '%',
    trend: 'flat',
    target: 80.0,
    tolerance: 20.0,
    direction: 'lower-is-better',
  };
  const status = computeKpiStatus(snapshot) ?? 'on-track';
  return {
    id: 'cost-utilization',
    label: 'Cost utilization (MTD)',
    valueLabel: `${utilizationPercent.toFixed(1)}%`,
    status,
    statusLabel: STATUS_LABEL[status],
    sourceTag: buildSourceTag(watchdog.source.value),
  };
});

const cards = computed<readonly StripCard[]>(() => [
  worstSurfaceCard.value,
  currentErrorRateCard.value,
  costUtilizationCard.value,
]);
</script>

<template>
  <div
    class="widget ops-strip"
    data-testid="ops-at-a-glance-strip-widget"
    aria-label="Ops at a glance summary"
  >
    <header class="widget-header">
      <h3>Ops at a Glance</h3>
    </header>

    <div v-if="state === 'loading'" class="widget-loading" aria-hidden="true">
      <div class="skeleton-row"></div>
    </div>

    <div v-else-if="state === 'error'" class="widget-error" role="alert">
      <p>Ops summary could not be loaded; please retry or check the dashboard status page.</p>
    </div>

    <div v-else-if="state === 'empty'" class="widget-empty">
      <!-- why: §Widget Data Requirements `OpsAtAGlanceStripWidget`
           empty-partial rule — full-empty (no data anywhere across
           the three composables) drops to the strip-level empty arm.
           Per-card partial-data values render `"—"` instead (see the
           cards above). -->
      <p>No ops data captured in selected range.</p>
    </div>

    <div v-else class="widget-data">
      <div class="card-row">
        <article v-for="card in cards" :key="card.id" class="strip-card" :aria-label="card.label">
          <span class="card-label">{{ card.label }}</span>
          <span class="card-source" :data-source-tag="card.sourceTag">{{ card.sourceTag }}</span>
          <span class="card-value">{{ card.valueLabel }}</span>
          <span
            v-if="card.status !== null"
            class="status-chip"
            :class="'status-' + card.status"
            :aria-label="`Status: ${card.statusLabel}`"
            >{{ card.statusLabel }}</span
          >
        </article>
      </div>

      <footer class="widget-footer">
        <!-- why: depth-on-demand UX — the strip is a glance surface
             on Overview; the full ops widgets live on `/system`. The
             link gives the operator a single-click drilldown. Uses
             `router-link to="/system"` per WP-204 §Scope (In) widget
             contract. -->
        <router-link to="/system" class="ops-detail-link">View system health →</router-link>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.widget {
  background: var(--p-surface-card, var(--p-content-background));
  border: 1px solid var(--p-surface-border, var(--p-content-border-color));
  border-radius: 8px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.widget-header h3 {
  margin: 0;
  font-size: 0.9rem;
  color: var(--p-text-color);
}

.card-source {
  align-self: flex-start;
  font-size: 0.6rem;
  font-weight: 600;
  background: var(--p-surface-border, var(--p-content-border-color));
  color: var(--p-text-color);
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
}

.widget-loading {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.widget-loading .skeleton-row {
  height: 56px;
  background: var(--p-surface-border, var(--p-content-border-color));
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
  color: var(--p-text-color);
  font-size: 0.85rem;
}
.widget-empty {
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}

.widget-data {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

@media (max-width: 899px) {
  .card-row {
    grid-template-columns: 1fr;
  }
}

.strip-card {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.6rem 0.9rem;
  background: var(--p-content-background, var(--p-surface-card));
  border: 1px solid var(--p-content-border-color, var(--p-surface-border));
  border-radius: 6px;
}

.card-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color);
}

.card-value {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--p-text-color);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.status-chip {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  border: 1px solid var(--p-content-border-color);
  align-self: flex-start;
}

.status-on-track {
  background: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
  color: var(--p-primary-color);
}

.status-needs-attention {
  background: color-mix(in srgb, var(--p-text-muted-color) 12%, transparent);
  color: var(--p-text-color);
}

.status-off-track {
  background: color-mix(in srgb, var(--p-text-color) 12%, transparent);
  color: var(--p-text-color);
}

.widget-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.4rem;
  border-top: 1px solid var(--p-content-border-color);
}

.ops-detail-link {
  color: var(--p-primary-color);
  font-weight: 600;
  text-decoration: none;
  font-size: 0.8rem;
}

.ops-detail-link:hover,
.ops-detail-link:focus-visible {
  text-decoration: underline;
}
</style>
