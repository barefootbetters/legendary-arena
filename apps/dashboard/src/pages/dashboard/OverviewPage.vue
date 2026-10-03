<script setup lang="ts">
// why: D-24653 — the Overview answers the survival question first: money
// (BusinessPulse) → KPIs → engagement → health (Ops strip) → the operator's
// daily checklist. Every widget here reads LIVE, CACHED, or operator-entered
// LOCAL data; nothing is MOCK in production. The build/governance widgets moved
// to Vision & Roadmap, the DAU chart and acquisition strip to Players, and the
// Alerts panel (no server route) is mounted nowhere. No widget here reads the
// date range any more, so the range selector is gone too.
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGovernanceSnapshot } from '../../composables/useGovernanceSnapshot.js';
import { useLastVisit } from '../../composables/useLastVisit.js';
import KpiCard from '../../widgets/KpiCard.vue';
import BusinessPulseWidget from '../../widgets/BusinessPulseWidget.vue';
import EngagementStripWidget from '../../widgets/EngagementStripWidget.vue';
import OpsAtAGlanceStripWidget from '../../widgets/OpsAtAGlanceStripWidget.vue';
import DailyExecutionPanel from '../../widgets/DailyExecutionPanel.vue';
import type { KpiSnapshot } from '../../types/index.js';

const router = useRouter();

const governance = useGovernanceSnapshot();
const { lastVisit, markVisited } = useLastVisit();

// why: D-19910 — strict 4-step ordering at mount:
//   (1) snapshot the local lastVisit value at mount time,
//   (2) compute the diff counts against THAT local snapshot,
//   (3) render the since-you-last-looked line with the computed counts,
//   (4) ONLY THEN call markVisited().
// Steps (1) and (2) happen synchronously below by capturing
// `lastVisit.value` into `lastVisitSnapshotRef` BEFORE markVisited fires.
// Steps (3) and (4) are sequenced in onMounted — render is the template
// reading `lastVisitSnapshotRef`/`diffCounts`/`isFirstVisit`; the mount
// hook fires AFTER the first render frame so markVisited cannot zero out
// the diff for the operator's eye.
const lastVisitSnapshotRef = ref<string | null>(lastVisit.value);

const isFirstVisit = computed(() => lastVisitSnapshotRef.value === null);

const diffCounts = computed(() => {
  const anchor = lastVisitSnapshotRef.value;
  if (anchor === null) {
    return { newCommits: 0, newDecisions: 0, newStatusEntries: 0 };
  }
  const anchorDate = anchor.slice(0, 10);
  let newDecisions = 0;
  for (const decision of governance.decisions(50)) {
    if (decision.mtime > anchor) {
      newDecisions += 1;
    }
  }
  let newStatusEntries = 0;
  for (const entry of governance.statusEntries(50)) {
    if (entry.date > anchorDate) {
      newStatusEntries += 1;
    }
  }
  const commitsList = governance.commits(50);
  let newCommits = 0;
  // why: D-19903 + WP-198 §D — CommitEntry carries no timestamp (the activity
  // feed source is `git log --oneline` only). The since-you-last-looked
  // count for commits is therefore the count of commits whose sha is NOT
  // present in the operator's last-seen state. Without a per-sha record we
  // approximate: count is zero on same-build reloads (snapshot.generatedAt
  // equal to anchor → no rebuild → no new commits possible); when a new
  // build with a newer generatedAt loads, every commit in the snapshot is
  // a candidate "new" entry. Conservative: report count of commits when
  // generatedAt > anchor, else zero.
  if (governance.generatedAt > anchor) {
    newCommits = commitsList.length;
  }
  return { newCommits, newDecisions, newStatusEntries };
});

const sinceYouLastLookedLine = computed(() => {
  if (isFirstVisit.value) {
    if (governance.generatedAt === '') {
      return 'First visit — viewing the latest build snapshot.';
    }
    return `First visit — viewing snapshot from ${governance.generatedAt}.`;
  }
  const counts = diffCounts.value;
  return `Since you last looked: ${counts.newCommits} new commits, ${counts.newDecisions} new DECISIONS, ${counts.newStatusEntries} new STATUS entries.`;
});

onMounted(() => {
  // Step 4 of D-19910 — mark the visit AFTER first render. The render reads
  // `lastVisitSnapshotRef` + `diffCounts` + `isFirstVisit` (all captured
  // synchronously above), so writing the new value here cannot zero the
  // diff the operator sees on this load.
  if (governance.generatedAt !== '') {
    markVisited(governance.generatedAt);
  }
});

// why: routes each top-strip KPI to the page that owns its detail. The ids are
// the live server contract from GET /api/dash/kpis (getKpiSnapshots in
// apps/server/src/dashboard/dashboardGameplay.logic.ts) — the previous
// placeholder ids (active-players/matches-running/revenue-today/server-health)
// had no server source, so every card rendered "No data available" in live mode.
function handleKpiClick(kpi: KpiSnapshot): void {
  if (kpi.id === 'total_players' || kpi.id === 'new_players_30d') {
    router.push({ name: 'players' });
  } else if (kpi.id === 'revenue_30d') {
    router.push({ name: 'monetization' });
  } else if (kpi.id === 'total_matches' || kpi.id === 'hero_win_rate_30d') {
    router.push({ name: 'gameplay' });
  }
}
</script>

<template>
  <div class="overview-page">
    <div class="page-header">
      <h1>Overview</h1>
    </div>

    <p class="since-you-last-looked">{{ sinceYouLastLookedLine }}</p>

    <BusinessPulseWidget />

    <div class="kpi-grid">
      <KpiCard kpi-id="total_players" @click="handleKpiClick" />
      <KpiCard kpi-id="new_players_30d" @click="handleKpiClick" />
      <KpiCard kpi-id="total_matches" @click="handleKpiClick" />
      <KpiCard kpi-id="revenue_30d" @click="handleKpiClick" />
      <KpiCard kpi-id="hero_win_rate_30d" @click="handleKpiClick" />
    </div>

    <EngagementStripWidget />

    <OpsAtAGlanceStripWidget />

    <DailyExecutionPanel />
  </div>
</template>

<style scoped>
.overview-page {
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
  color: var(--p-text-color);
}

.since-you-last-looked {
  margin: -0.75rem 0 0;
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
  font-style: italic;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 1rem;
}

@media (max-width: 1199px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>
