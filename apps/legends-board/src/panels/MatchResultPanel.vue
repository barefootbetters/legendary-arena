<script setup lang="ts">
import type { MatchResultView } from "./matchResultDisplay";

// why: prop-driven like every other panel — App.vue owns the fetch and passes
// the parsed view model down. The panel renders ONLY the public labels the
// result LAGN carried (handle + optional display name); it never joins an
// identity table (D-24217). An omitted seat renders anonymous.
defineProps<{
  view: MatchResultView | null;
  error: string | null;
  loading: boolean;
}>();
</script>

<template>
  <div class="panel match-result-panel">
    <h2 class="panel-title">Match Result</h2>

    <div v-if="error" class="panel-error">
      <p>Result unavailable</p>
      <p class="error-detail">{{ error }}</p>
    </div>

    <div v-else-if="loading" class="panel-loading">
      <p>Loading match result...</p>
    </div>

    <div v-else-if="!view" class="panel-empty">
      <h3>No result to show</h3>
      <p>This match is unknown or still in progress. Check back when it finishes.</p>
    </div>

    <template v-else>
      <p
        class="match-outcome"
        :class="view.isDecisive ? 'is-decisive' : 'is-draw'"
      >
        {{ view.outcomeLabel }}
      </p>

      <table class="leaderboard-table">
        <thead>
          <tr>
            <th class="col-rank">Seat</th>
            <th class="col-handle">Player</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="seat of view.seats"
            :key="seat.seat"
            class="leaderboard-row"
          >
            <td class="col-rank">{{ seat.seat + 1 }}</td>
            <td class="col-handle">
              <span v-if="seat.isAnonymous" class="seat-anonymous">Anonymous</span>
              <template v-else>
                <span class="seat-name">{{ seat.displayName ?? seat.playerId }}</span>
                <span v-if="seat.displayName" class="seat-handle">@{{ seat.playerId }}</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<style scoped>
.panel {
  padding: 1.5rem;
}

.panel-title {
  font-size: 1.5rem;
  margin: 0 0 1rem;
  color: var(--la-color-gold-bright);
}

.panel-error {
  padding: 1rem;
  background: rgba(255, 60, 60, 0.1);
  border: 1px solid rgba(255, 60, 60, 0.3);
  border-radius: 8px;
  text-align: center;
}

.error-detail {
  font-size: 0.85rem;
  color: var(--la-color-text-secondary);
  margin-top: 0.5rem;
}

.panel-loading,
.panel-empty {
  text-align: center;
  color: var(--la-color-text-secondary);
  padding: 2rem;
}

.match-outcome {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 1.25rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.match-outcome.is-decisive {
  color: var(--la-color-gold-bright);
}

.match-outcome.is-draw {
  color: var(--la-color-text-secondary);
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
}

.leaderboard-table th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  border-bottom: 2px solid var(--la-color-border-subtle);
  color: var(--la-color-text-secondary);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.leaderboard-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--la-color-border-subtle);
}

.leaderboard-row:hover {
  background: rgba(255, 215, 0, 0.05);
}

.col-rank {
  width: 4rem;
  text-align: center;
  color: var(--la-color-text-secondary);
}

.seat-handle {
  margin-left: 0.5rem;
  color: var(--la-color-text-secondary);
  font-size: 0.85rem;
}

.seat-anonymous {
  color: var(--la-color-text-secondary);
  font-style: italic;
}
</style>
