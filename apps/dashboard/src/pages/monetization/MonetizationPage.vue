<script setup lang="ts">
import { useFetch } from '../../composables/useFetch.js';
import { useDataFreshness } from '../../composables/useDataFreshness.js';
import { fetchRevenueRecords } from '../../services/endpoints.js';
import { describeApiError } from '../../utils/apiErrorMessage.js';
import { formatCurrency } from '../../utils/format.js';
import RevenueChartWidget from '../../widgets/RevenueChartWidget.vue';
import NetRevenueChartWidget from '../../widgets/NetRevenueChartWidget.vue';
import PaidActionErrorsWidget from '../../widgets/PaidActionErrorsWidget.vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';

// why: D-19607 (Shared Revenue Source Contract) — the existing
// `RevenueChartWidget` and the new `NetRevenueChartWidget` consume revenue
// history exclusively through `fetchRevenueHistory(range)` and share the
// page-level `useDateRange()` reference. Mock determinism (D-19605) gives
// both widgets byte-identical revenue series for the same range, so
// `RevenueChartWidget`'s total equals `sum(NetRevenueChartWidget.series.gross)`
// without an explicit prop bridge.
const { data, loading, error, updatedAt, source } = useFetch(fetchRevenueRecords);
const { relativeTime, sourceLabel } = useDataFreshness(updatedAt, source);
</script>

<template>
  <div class="monetization-page">
    <div class="page-header">
      <h1>Monetization</h1>
      <span v-if="sourceLabel" class="freshness-badge">
        <span class="source">{{ sourceLabel }}</span>
        <span class="timestamp">Updated {{ relativeTime }}</span>
      </span>
    </div>

    <RevenueChartWidget />

    <div class="widget-grid">
      <NetRevenueChartWidget />
      <PaidActionErrorsWidget />
    </div>

    <div v-if="loading && !data" class="page-loading">
      <p>Loading revenue data...</p>
    </div>

    <div v-else-if="error" class="page-error">
      <p>{{ describeApiError(error) }}</p>
    </div>

    <div v-else-if="!data || data.length === 0" class="page-empty">
      <p>No revenue records found.</p>
    </div>

    <DataTable
      v-else
      :value="data"
      :loading="loading"
      :paginator="true"
      :rows="20"
      data-key="id"
      filter-display="row"
      class="revenue-table"
    >
      <Column field="date" header="Date" :sortable="true" filter />
      <Column field="amount" header="Amount" :sortable="true">
        <template #body="{ data: row }">
          {{ formatCurrency(row.amount, row.currency) }}
        </template>
      </Column>
      <Column field="source" header="Source" :sortable="true" filter />
      <Column field="currency" header="Currency" :sortable="true" />
    </DataTable>

    <section class="page-references" aria-label="Related plans and governance">
      <h2>Plans &amp; governance</h2>
      <p class="references-intro">
        The revenue model, gating, and go-to-market policy behind these numbers
        live in the Eng Wiki:
      </p>
      <ul class="references-list">
        <li>
          <a
            href="https://ewiki.legendary-arena.com/monetization-model/"
            target="_blank"
            rel="noopener"
            >Monetization Model ↗</a
          >
          <span>revenue streams and the no-pay-to-win fairness boundary</span>
        </li>
        <li>
          <a
            href="https://ewiki.legendary-arena.com/video-commerce/"
            target="_blank"
            rel="noopener"
            >Video Commerce ↗</a
          >
          <span
            >the gear-purchase goal, C1–C4 readiness gates, Fourthwall / YouTube
            Shopping</span
          >
        </li>
        <li>
          <a
            href="https://ewiki.legendary-arena.com/go-to-market-plan/"
            target="_blank"
            rel="noopener"
            >Go-to-Market Plan ↗</a
          >
          <span>launch sequence, G1–G5 gates, 90-day directional targets</span>
        </li>
        <li>
          <a
            href="https://ewiki.legendary-arena.com/youtube-channel-plan/"
            target="_blank"
            rel="noopener"
            >YouTube Channel Plan ↗</a
          >
          <span>the content engine feeding the funnel</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.monetization-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #0f172a;
}

.freshness-badge {
  font-size: 0.75rem;
  color: #94a3b8;
  display: flex;
  gap: 0.5rem;
}

.freshness-badge .source {
  background: #f1f5f9;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-weight: 600;
}

.page-loading,
.page-error,
.page-empty {
  padding: 2rem;
  text-align: center;
}

.page-error {
  color: #dc2626;
}
.page-empty {
  color: #94a3b8;
}

.widget-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1.5rem;
}

.page-references {
  border-top: 1px solid var(--p-content-border-color);
  padding-top: 1.25rem;
}

.page-references h2 {
  margin: 0 0 0.35rem;
  font-size: 1rem;
  color: var(--p-text-color);
}

.references-intro {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.references-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.references-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem;
}

.references-list a {
  font-weight: 600;
  color: var(--p-primary-color);
  text-decoration: none;
}

.references-list a:hover {
  text-decoration: underline;
}

.references-list span {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

@media (max-width: 768px) {
  .widget-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
