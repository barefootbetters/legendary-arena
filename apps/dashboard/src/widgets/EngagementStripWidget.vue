<script setup lang="ts">
// why: WP-791 / D-24653 — the Overview's second question is "is anyone
// playing?". Three trailing-7-day counts from the live /api/dash/matches and
// /api/dash/players feeds; the window, exclusions, and cap rules live in the
// pure computeEngagement so they are unit tested.

import { computed } from 'vue';
import { useFetch } from '../composables/useFetch.js';
import { fetchMatchRecords, fetchPlayerRecords } from '../services/endpoints.js';
import { computeEngagement, type EngagementCount } from '../utils/overviewPulse.js';
import type { ServiceResponse } from '../types/index.js';

const matchFetch = useFetch(fetchMatchRecords);
const playerFetch = useFetch(fetchPlayerRecords);

// why: the window is anchored to the moment the feeds last changed — the
// computed re-runs (and re-reads the clock) whenever either feed's polled data
// arrives, so a page left open does not count against a stale "now".
const engagement = computed(() =>
  computeEngagement({
    matches: matchFetch.error.value === null ? matchFetch.data.value : null,
    players: playerFetch.error.value === null ? playerFetch.data.value : null,
    nowMs: Date.now(),
  }),
);

interface EngagementCardView {
  readonly id: string;
  readonly label: string;
  readonly valueLabel: string;
  readonly sourceTag: string;
  readonly note: string;
}

/** The card's count text: "—" while its feed has no data, never 0. */
function describeCount(count: EngagementCount | null): string {
  return count === null ? '—' : count.displayValue;
}

/** The card's source tag ('' hides the tag while the feed is loading). */
function describeSource(source: ServiceResponse<unknown>['source'] | null): string {
  return source ?? '';
}

const cards = computed<readonly EngagementCardView[]>(() => [
  {
    id: 'matches-started',
    label: 'Matches started (7d)',
    valueLabel: describeCount(engagement.value.matchesStarted),
    sourceTag: describeSource(matchFetch.source.value),
    note: 'from the 50 most recently updated matches',
  },
  {
    id: 'matches-finished',
    label: 'Finished with a winner (7d)',
    valueLabel: describeCount(engagement.value.matchesFinished),
    sourceTag: describeSource(matchFetch.source.value),
    note: 'heroes or scheme won; ties count as unfinished',
  },
  {
    id: 'players-active',
    label: 'Scored or joined (7d)',
    valueLabel: describeCount(engagement.value.activePlayers),
    sourceTag: describeSource(playerFetch.source.value),
    note: 'last competitive score, else sign-up, among the 100 newest players',
  },
]);
</script>

<template>
  <section class="widget engagement-strip" aria-label="Engagement summary">
    <header class="widget-header">
      <h3>Engagement</h3>
    </header>

    <div class="card-row">
      <article v-for="card in cards" :key="card.id" class="strip-card" :aria-label="card.label">
        <span class="card-label">{{ card.label }}</span>
        <span v-if="card.sourceTag" class="card-source">{{ card.sourceTag }}</span>
        <span class="card-value">{{ card.valueLabel }}</span>
        <span class="card-note">{{ card.note }}</span>
      </article>
    </div>

    <footer class="widget-footer">
      <router-link to="/gameplay" class="detail-link">Matches →</router-link>
      <router-link to="/players" class="detail-link">Players →</router-link>
    </footer>
  </section>
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

.widget-header h3 {
  margin: 0;
  font-size: 0.9rem;
  color: var(--p-text-color);
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

.card-source {
  align-self: flex-start;
  font-size: 0.6rem;
  font-weight: 600;
  background: var(--p-surface-border, var(--p-content-border-color));
  color: var(--p-text-color);
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
}

.card-value {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--p-text-color);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.card-note {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
}

.widget-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--p-content-border-color);
}

.detail-link {
  color: var(--p-primary-color);
  font-weight: 600;
  text-decoration: none;
  font-size: 0.8rem;
}

.detail-link:hover,
.detail-link:focus-visible {
  text-decoration: underline;
}
</style>
