<script setup lang="ts">
/**
 * Gauntlet board panel (WP-343 / D-24131 §8a) — the standings for one
 * mastermind set-gauntlet. Average is the PAR-relative golf-scale score
 * (lower is better; negative = under PAR renders gold).
 */
import type {
  GauntletIndexEntry,
  GauntletSnapshotBoard,
} from "../snapshots/snapshotClient";
import { formatAverageScore } from "./gauntletDisplay";

const props = defineProps<{
  board: GauntletSnapshotBoard | null;
  indexEntry: GauntletIndexEntry | null;
  error: string | null;
}>();
</script>

<template>
  <div class="panel gauntlet-board-panel">
    <a class="back-link" href="#/">← All gauntlets</a>
    <h2 class="panel-title">
      {{ indexEntry ? `${indexEntry.mastermindName} — ${indexEntry.setName}` : "Gauntlet" }}
    </h2>
    <p v-if="indexEntry" class="panel-subtitle">
      Best winning score across all {{ indexEntry.legCount }} schemes,
      averaged vs PAR (lower is better).
    </p>

    <div v-if="error" class="panel-error">
      <p>Data unavailable</p>
      <p class="error-detail">{{ error }}</p>
    </div>

    <div v-else-if="!board" class="panel-loading">
      <p>Loading standings...</p>
    </div>

    <table v-else class="leaderboard-table">
      <thead>
        <tr>
          <th class="col-rank">#</th>
          <th class="col-handle">Player</th>
          <th class="col-legs">Schemes</th>
          <th class="col-score">Avg vs PAR</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="entry of board.entries"
          :key="`${entry.rank}-${entry.handle}`"
          class="leaderboard-row"
        >
          <td class="col-rank">{{ entry.rank }}</td>
          <td class="col-handle">{{ entry.handle }}</td>
          <td class="col-legs">{{ entry.legCount }}</td>
          <td
            class="col-score"
            :class="{ 'under-par': entry.averageScoreCentis < 0 }"
          >
            {{ formatAverageScore(entry.averageScoreCentis) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.panel {
  padding: 1.5rem;
}

.back-link {
  color: #888;
  text-decoration: none;
  font-size: 0.9rem;
}

.back-link:hover {
  color: #ffd700;
}

.panel-title {
  font-size: 1.5rem;
  margin: 0.5rem 0 0.25rem;
  color: #ffd700;
}

.panel-subtitle {
  color: #888;
  margin: 0 0 1rem;
  font-size: 0.9rem;
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
  color: #888;
  margin-top: 0.5rem;
}

.panel-loading {
  text-align: center;
  color: #888;
  padding: 2rem;
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
}

.leaderboard-table th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  border-bottom: 2px solid #333;
  color: #aaa;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.leaderboard-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #1a1a2e;
}

.leaderboard-row:hover {
  background: rgba(255, 215, 0, 0.05);
}

.col-rank {
  width: 3rem;
  text-align: center;
  color: #888;
}

.col-legs {
  text-align: center;
  color: #aaa;
}

.col-score {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #e0e0e0;
}

.col-score.under-par {
  color: #ffd700;
}
</style>
