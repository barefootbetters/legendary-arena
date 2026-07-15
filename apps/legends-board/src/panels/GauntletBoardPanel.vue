<script setup lang="ts">
/**
 * Gauntlet board panel (WP-343 / WP-345 / D-24131 §8a / D-24134) — the
 * standings for one mastermind set-gauntlet at one player count. Average is
 * the PAR-relative golf-scale score (lower is better; negative = under PAR
 * renders gold). A player-count selector (1-5) switches between the solo and
 * per-count boards; multiplayer rows show the full team roster; each leg
 * carries a challenge link to the pinned loadout preview.
 */
import { computed } from "vue";
import type {
  GauntletIndexEntry,
  GauntletSnapshotBoard,
} from "../snapshots/snapshotClient";
import {
  buildChallengeUrl,
  buildPlayerCountTabs,
  formatAverageScore,
  rosterForEntry,
  type PlayerCountTab,
} from "./gauntletDisplay";

const props = defineProps<{
  board: GauntletSnapshotBoard | null;
  indexEntry: GauntletIndexEntry | null;
  boardName: string | null;
  error: string | null;
}>();

/** The player-count tabs for this gauntlet (empty on old snapshots). */
const tabs = computed((): PlayerCountTab[] => {
  if (props.indexEntry === null) {
    return [];
  }
  return buildPlayerCountTabs(props.indexEntry);
});

/** The tab the current route points at, matched by board name. */
const activeTab = computed((): PlayerCountTab | null => {
  return tabs.value.find((tab) => tab.boardName === props.boardName) ?? null;
});

/** Whether the routed count has no champions yet (renders the open state). */
const isActiveCountUnclaimed = computed((): boolean => {
  return activeTab.value !== null && !activeTab.value.isClaimed;
});

/** A short human label for one player-count tab. */
function tabLabel(tab: PlayerCountTab): string {
  return tab.playerCount === 1 ? "Solo" : `${tab.playerCount}P`;
}

/** One leg's challenge link, ready for the template. */
interface ChallengeLeg {
  readonly schemeSlug: string;
  readonly schemeName: string;
  readonly url: string;
}

/** The per-leg challenge links (empty when the index entry predates WP-344). */
const challengeLegs = computed((): ChallengeLeg[] => {
  const entry = props.indexEntry;
  if (entry === null || entry.legs === undefined) {
    return [];
  }
  return entry.legs.map((leg) => ({
    schemeSlug: leg.schemeSlug,
    schemeName: leg.schemeName,
    url: buildChallengeUrl(entry.setAbbr, leg.schemeSlug, entry.mastermindSlug),
  }));
});
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

    <!-- Player-count selector: only when the index carries per-count data
         (a single solo tab on old snapshots renders no selector). -->
    <nav v-if="tabs.length > 1" class="count-selector" aria-label="Player count">
      <template v-for="tab of tabs" :key="tab.playerCount">
        <span
          v-if="tab.boardName === boardName"
          class="count-tab active"
          aria-current="page"
        >{{ tabLabel(tab) }}</span>
        <a
          v-else-if="tab.isClaimed"
          class="count-tab"
          :href="`#/gauntlet/${tab.boardName}`"
        >{{ tabLabel(tab) }}</a>
        <!-- why: an unclaimed count has NO board file below one entry
             (D-24131 §7) — rendering it as a link would 404, so empty counts
             stay inline (muted, not a link) until someone claims them. -->
        <span
          v-else
          class="count-tab unclaimed"
          title="Unclaimed — no champions at this player count yet"
        >{{ tabLabel(tab) }}</span>
      </template>
    </nav>

    <!-- Unclaimed count: open-championship state (never an error). -->
    <div v-if="isActiveCountUnclaimed" class="panel-unclaimed">
      <p class="unclaimed-heading">No champions yet at this player count.</p>
      <p class="unclaimed-sub">
        Rank #1 is unclaimed — win the gauntlet to open the board.
      </p>
    </div>

    <div v-else-if="error" class="panel-error">
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
          <th class="col-handle">Players</th>
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
          <td class="col-handle">{{ rosterForEntry(entry) }}</td>
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

    <!-- Per-leg challenge links: open the pinned loadout preview so a
         visitor can try the gauntlet (D-24134 §6). Absent on old snapshots. -->
    <section v-if="challengeLegs.length > 0" class="challenge-legs">
      <h3 class="challenge-heading">Challenge a leg</h3>
      <ul class="challenge-list">
        <li v-for="leg of challengeLegs" :key="leg.schemeSlug">
          <a
            class="challenge-link"
            :href="leg.url"
            target="_blank"
            rel="noopener"
          >Challenge: {{ leg.schemeName }}</a>
        </li>
      </ul>
    </section>
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

/* Player-count selector */
.count-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0 0 1.25rem;
}

.count-tab {
  padding: 0.3rem 0.8rem;
  border: 1px solid #333;
  border-radius: 16px;
  font-size: 0.85rem;
  text-decoration: none;
  color: #aaa;
}

a.count-tab:hover {
  border-color: #ffd700;
  color: #ffd700;
}

.count-tab.active {
  background: rgba(255, 215, 0, 0.15);
  border-color: rgba(255, 215, 0, 0.5);
  color: #ffd700;
  font-weight: 600;
}

.count-tab.unclaimed {
  color: #555;
  border-style: dashed;
  border-color: #2a2a3a;
}

/* Unclaimed-count state */
.panel-unclaimed {
  padding: 2rem 1rem;
  text-align: center;
}

.unclaimed-heading {
  font-size: 1.2rem;
  color: #e0e0e0;
  margin: 0 0 0.5rem;
}

.unclaimed-sub {
  color: #888;
  margin: 0;
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

/* Challenge links */
.challenge-legs {
  margin-top: 1.5rem;
  border-top: 1px solid #1a1a2e;
  padding-top: 1rem;
}

.challenge-heading {
  font-size: 0.95rem;
  color: #aaa;
  margin: 0 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.challenge-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.challenge-link {
  color: #ffd700;
  text-decoration: none;
}

.challenge-link:hover {
  text-decoration: underline;
}
</style>
