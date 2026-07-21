<script setup lang="ts">
import { ref } from "vue";
import type { MatchResultView } from "./matchResultDisplay";
import { downloadMatchLagn } from "./matchResultDownload";

// why: prop-driven like every other panel — App.vue owns the fetch and passes
// the parsed view model down. The panel renders ONLY the public labels the
// result LAGN carried (handle + optional display name); it never joins an
// identity table (D-24217). An omitted seat renders anonymous.
const props = defineProps<{
  view: MatchResultView | null;
  error: string | null;
  loading: boolean;
}>();

// why: WP-408 — the portable-download state lives on the panel. The download is
// EXPORT-ONLY (D-24218): it hands the user a copy of the server-produced record
// and nothing re-ingests it to score, credit, or rank.
const isDownloading = ref(false);
const downloadError = ref<string | null>(null);

/**
 * Fetch this match's result LAGN and trigger a `match-<id>.lagn.json` download.
 *
 * why: a failed fetch shows a visible full-sentence error rather than a silent
 * no-op (the twice-bitten dead-button pattern).
 */
async function handleDownload(): Promise<void> {
  if (props.view === null) {
    return;
  }
  downloadError.value = null;
  isDownloading.value = true;
  try {
    await downloadMatchLagn(props.view.matchId);
  } catch (caughtError) {
    downloadError.value =
      "This match record could not be downloaded. Please try again in a moment.";
    console.error(
      `[legends] Match LAGN download "${props.view.matchId}" failed:`,
      caughtError,
    );
  } finally {
    isDownloading.value = false;
  }
}
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

      <!-- why: EXPORT-ONLY (D-24218) — downloads a portable COPY of this public
           record; nothing re-ingests it to score/credit/rank. A client Blob, no
           new server endpoint (reuses WP-406's read). -->
      <div class="match-download">
        <button
          class="download-button"
          type="button"
          :disabled="isDownloading"
          @click="handleDownload"
        >
          {{ isDownloading ? "Preparing download..." : "Download this match as LAGN" }}
        </button>
        <p v-if="downloadError" class="download-error">{{ downloadError }}</p>
      </div>
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

.match-download {
  margin-top: 1.5rem;
}

.download-button {
  padding: 0.6rem 1.1rem;
  font: inherit;
  color: var(--la-color-bg-primary);
  background: var(--la-color-gold-bright);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  letter-spacing: 0.02em;
}

.download-button:hover:not(:disabled) {
  background: var(--la-color-gold-muted);
}

.download-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.download-error {
  margin-top: 0.75rem;
  color: var(--la-color-error);
  font-size: 0.9rem;
}
</style>
