<script setup lang="ts">
import PublicSurfaceHealthWidget from '../../widgets/PublicSurfaceHealthWidget.vue';
import ErrorRateMonitorWidget from '../../widgets/ErrorRateMonitorWidget.vue';
import InfraCostWatchdogWidget from '../../widgets/InfraCostWatchdogWidget.vue';
// why: WP-210 §Scope (In) — the sweep-health widget consuming GET /api/sweep/latest.
import SweepHealthWidget from '../../widgets/SweepHealthWidget.vue';
// why: WP-439 — the per-process runtime-health tile leads the page; it answers the
// clustering question for THIS server process (CPU % / event-loop lag / memory /
// uptime / cores / WEB_CONCURRENCY).
import RuntimeHealthWidget from '../../widgets/RuntimeHealthWidget.vue';
import { INFRA_COST_BUDGETS } from '../../config/infraCostBudgets.js';

// why: the former per-node DataTable (fetchServerNodes → GET /api/dash/system/nodes)
// was retired. That endpoint was never provisioned — single-instance Render has no
// per-node fleet to enumerate, so the fetch 404'd and dumped a raw "Request failed
// with status 404." onto the page. WP-439's RuntimeHealthWidget above now reports
// this process's live health, superseding the table's purpose. The fetchServerNodes
// service fn + mockServerNodes + ServerNode type are kept in the service layer as a
// ready contract for if per-node infrastructure is ever introduced; they are simply
// not rendered until such an endpoint exists.
</script>

<template>
  <div class="system-page">
    <div class="page-header">
      <h1>System Health</h1>
    </div>

    <!-- why: WP-439 — the per-process runtime-health tile (CPU % / event-loop lag
         / memory / uptime / cores / WEB_CONCURRENCY) leads the page: it is the
         signal that decides whether clustering is warranted. -->
    <RuntimeHealthWidget />

    <!-- why: WP-204 §Scope (In) — the 3 ops widgets in locked order:
         PublicSurfaceHealth → ErrorRateMonitor → InfraCostWatchdog.
         `INFRA_COST_BUDGETS` is passed in as a prop so the finance-loop
         follow-up WP (D-20403) can flip placeholder values without touching
         the widget or composable. -->
    <PublicSurfaceHealthWidget />
    <ErrorRateMonitorWidget />
    <InfraCostWatchdogWidget :budgets="INFRA_COST_BUDGETS" />

    <!-- why: WP-210 §Scope (In) — the sweep-health widget renders below the
         three WP-204 widgets, consuming GET /api/sweep/latest (D-20402). -->
    <SweepHealthWidget />
  </div>
</template>

<style scoped>
.system-page {
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
</style>
