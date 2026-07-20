<script setup lang="ts">
/**
 * Gauntlet board panel (WP-343 / WP-345 / WP-385 / D-24131 §8a / D-24134 /
 * D-24187) — the standings for one mastermind set-gauntlet at one player
 * count, in one DIVISION. Average is the PAR-relative golf-scale score
 * (lower is better; negative = under PAR renders gold). A player-count
 * selector (1-5) switches between the solo and per-count boards; a division
 * toggle switches between the Open board and the Fixed-Pool championship
 * (D-24187 §7 — the championship framing attaches to the fixed division);
 * multiplayer rows show the full team roster; fixed rows show the hero pool
 * that earned them; each leg carries a challenge link to the pinned loadout
 * preview.
 */
import { computed } from "vue";
import type {
  GauntletIndexEntry,
  GauntletSnapshotBoard,
} from "../snapshots/snapshotClient";
import {
  buildChallengeUrl,
  buildFixedCountTabs,
  buildPlayerCountTabs,
  formatAverageScore,
  formatApprovedLoadout,
  formatCardDisplayName,
  formatHeroPool,
  isFixedBoardName,
  listApprovedLoadouts,
  rosterForEntry,
  selectApprovedLoadout,
  type PlayerCountTab,
} from "./gauntletDisplay";

const props = defineProps<{
  board: GauntletSnapshotBoard | null;
  indexEntry: GauntletIndexEntry | null;
  boardName: string | null;
  error: string | null;
}>();

// why: the active division derives from the ROUTE (WP-385) — hash routing
// already carries all navigation state, so no ref holds a division flag.
const isFixedRoute = computed((): boolean => {
  return props.boardName !== null && isFixedBoardName(props.boardName);
});

/** The open division's player-count tabs (empty on old snapshots). */
const openTabs = computed((): PlayerCountTab[] => {
  if (props.indexEntry === null) {
    return [];
  }
  return buildPlayerCountTabs(props.indexEntry);
});

/** The fixed division's tabs (empty when the index predates WP-384). */
const fixedTabs = computed((): PlayerCountTab[] => {
  if (props.indexEntry === null) {
    return [];
  }
  return buildFixedCountTabs(props.indexEntry);
});

/** Whether this gauntlet offers the fixed division at all. */
const hasFixedDivision = computed((): boolean => {
  return fixedTabs.value.length > 0;
});

/** The ACTIVE division's tabs — what the count selector renders. */
const tabs = computed((): PlayerCountTab[] => {
  return isFixedRoute.value ? fixedTabs.value : openTabs.value;
});

/** The tab the current route points at, matched by board name. */
const activeTab = computed((): PlayerCountTab | null => {
  return tabs.value.find((tab) => tab.boardName === props.boardName) ?? null;
});

/** Whether the routed count has no champions yet (renders the open state). */
const isActiveCountUnclaimed = computed((): boolean => {
  return activeTab.value !== null && !activeTab.value.isClaimed;
});

/** The routed player count (drives the division toggle's cross-links). */
const activePlayerCount = computed((): number => {
  return activeTab.value?.playerCount ?? 1;
});

/** One division-toggle chip, cross-linking at the active player count. */
interface DivisionChip {
  readonly label: string;
  readonly isActive: boolean;
  readonly targetTab: PlayerCountTab | null;
}

/** The Open | Fixed-Pool toggle chips (empty when no fixed division). */
const divisionChips = computed((): DivisionChip[] => {
  if (!hasFixedDivision.value) {
    return [];
  }
  const openTarget =
    openTabs.value.find(
      (tab) => tab.playerCount === activePlayerCount.value,
    ) ?? null;
  const fixedTarget =
    fixedTabs.value.find(
      (tab) => tab.playerCount === activePlayerCount.value,
    ) ?? null;
  return [
    {
      label: "Open",
      isActive: !isFixedRoute.value,
      targetTab: openTarget,
    },
    {
      label: "Fixed-Pool Championship",
      isActive: isFixedRoute.value,
      targetTab: fixedTarget,
    },
  ];
});

/** A short human label for one player-count tab. */
function tabLabel(tab: PlayerCountTab): string {
  return tab.playerCount === 1 ? "Solo" : `${tab.playerCount}P`;
}

/** One leg's challenge link, ready for the template. */
/** The approved configurations for the routed count, as display labels. */
const approvedLoadoutLabels = computed((): string[] => {
  const entry = props.indexEntry;
  if (entry === null) {
    return [];
  }
  return listApprovedLoadouts(entry, activePlayerCount.value).map(
    formatApprovedLoadout,
  );
});

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
  // why: WP-387 — carry the routed board's player count into each challenge
  // link so the builder pre-sizes its required-count slots to this board
  // (a 4P board's links open a 4-player builder). `activePlayerCount` is the
  // routed count across both divisions (solo → 1).
  // why: WP-395 — pin the approved villain + henchmen groups too, so the
  // builder opens on a setup that can actually qualify. Without this the link
  // sends the player to build a run the board will silently reject.
  const approvedLoadout = selectApprovedLoadout(entry, activePlayerCount.value);
  return entry.legs.map((leg) => ({
    schemeSlug: leg.schemeSlug,
    schemeName: leg.schemeName,
    url: buildChallengeUrl(
      entry.setAbbr,
      leg.schemeSlug,
      entry.mastermindSlug,
      activePlayerCount.value,
      approvedLoadout,
    ),
  }));
});
</script>

<template>
  <div class="panel gauntlet-board-panel">
    <a class="back-link" href="#/">← All gauntlets</a>
    <h2 class="panel-title">
      {{ indexEntry ? `${formatCardDisplayName(indexEntry.mastermindName)} — ${indexEntry.setName}` : "Gauntlet" }}
    </h2>
    <p v-if="indexEntry && isFixedRoute" class="panel-subtitle">
      The fixed-pool championship — one hero pool
      ({{ indexEntry.legCount }} schemes, best winning score per scheme,
      averaged vs PAR; lower is better).
    </p>
    <p v-else-if="indexEntry" class="panel-subtitle">
      Best winning score across all {{ indexEntry.legCount }} schemes,
      averaged vs PAR (lower is better).
    </p>

    <!-- Division toggle (WP-385 / D-24187 §7): only when the index carries
         fixed-division data. Open is the default/acquisition surface; the
         championship framing attaches to the Fixed-Pool division. -->
    <nav
      v-if="divisionChips.length > 0"
      class="division-toggle"
      aria-label="Division"
    >
      <template v-for="chip of divisionChips" :key="chip.label">
        <span
          v-if="chip.isActive"
          class="division-chip active"
          aria-current="page"
        >{{ chip.label }}</span>
        <a
          v-else-if="chip.targetTab !== null && chip.targetTab.isClaimed"
          class="division-chip"
          :href="`#/gauntlet/${chip.targetTab.boardName}`"
        >{{ chip.label }}</a>
        <!-- why: an unclaimed division at this count has NO board file
             (D-24131 §7 lazy emission) — a link would 404, so the chip stays
             inline muted until someone claims the championship. -->
        <span
          v-else
          class="division-chip unclaimed"
          title="Unclaimed — no champions in this division at this player count yet"
        >{{ chip.label }}</span>
      </template>
    </nav>

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
      <p class="unclaimed-heading">
        {{
          isFixedRoute
            ? "No fixed-pool champions yet at this player count."
            : "No champions yet at this player count."
        }}
      </p>
      <p class="unclaimed-sub">
        {{
          isFixedRoute
            ? "Clear every leg with one hero pool to claim the championship."
            : "Rank #1 is unclaimed — win the gauntlet to open the board."
        }}
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
          <th v-if="isFixedRoute" class="col-pool">Hero Pool</th>
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
          <!-- why: the hero pool is the fixed division's prestige display
               (D-24187 §6 — the team the champion is celebrated for); a
               missing pool renders an empty cell, never a crash. -->
          <td v-if="isFixedRoute" class="col-pool">
            {{ formatHeroPool(entry.heroPool) }}
          </td>
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

    <!-- Feeder line (D-24187 §7): the open board invites the fixed-pool
         championship; renders only when the fixed division exists. -->
    <p v-if="!isFixedRoute && hasFixedDivision" class="feeder-line">
      Cleared every leg? Clear them all with one hero pool to claim the
      Fixed-Pool Championship.
    </p>

    <!-- The qualification requirement (WP-395 / D-24199). A ranked leg counts
         only when its villain + henchmen groups match one of these, so the
         board states it plainly rather than letting runs fail silently. -->
    <section v-if="approvedLoadoutLabels.length > 0" class="approved-loadouts">
      <h3 class="challenge-heading">Approved loadouts</h3>
      <p class="approved-note">
        A run counts toward this board only when its villain and henchmen
        groups match one of these. Hero choice is yours.
      </p>
      <ul class="approved-list">
        <li v-for="label of approvedLoadoutLabels" :key="label">{{ label }}</li>
      </ul>
    </section>

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
          >Challenge: {{ formatCardDisplayName(leg.schemeName) }}</a>
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
  color: var(--la-color-text-secondary);
  text-decoration: none;
  font-size: 0.9rem;
}

.back-link:hover {
  color: var(--la-color-gold-bright);
}

.panel-title {
  font-size: 1.5rem;
  margin: 0.5rem 0 0.25rem;
  color: var(--la-color-gold-bright);
}

.panel-subtitle {
  color: var(--la-color-text-secondary);
  margin: 0 0 1rem;
  font-size: 0.9rem;
}

/* Division toggle (WP-385) */
.division-toggle {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0 0 0.75rem;
}

.division-chip {
  padding: 0.3rem 0.9rem;
  border: 1px solid var(--la-color-border-subtle);
  border-radius: 6px;
  font-size: 0.85rem;
  text-decoration: none;
  color: var(--la-color-text-secondary);
}

a.division-chip:hover {
  border-color: var(--la-color-gold-bright);
  color: var(--la-color-gold-bright);
}

.division-chip.active {
  background: rgba(255, 215, 0, 0.15);
  border-color: rgba(255, 215, 0, 0.5);
  color: var(--la-color-gold-bright);
  font-weight: 600;
}

.division-chip.unclaimed {
  color: var(--la-color-border-strong);
  border-style: dashed;
  border-color: var(--la-color-border-subtle);
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
  border: 1px solid var(--la-color-border-subtle);
  border-radius: 16px;
  font-size: 0.85rem;
  text-decoration: none;
  color: var(--la-color-text-secondary);
}

a.count-tab:hover {
  border-color: var(--la-color-gold-bright);
  color: var(--la-color-gold-bright);
}

.count-tab.active {
  background: rgba(255, 215, 0, 0.15);
  border-color: rgba(255, 215, 0, 0.5);
  color: var(--la-color-gold-bright);
  font-weight: 600;
}

.count-tab.unclaimed {
  color: var(--la-color-border-strong);
  border-style: dashed;
  border-color: var(--la-color-border-subtle);
}

/* Unclaimed-count state */
.panel-unclaimed {
  padding: 2rem 1rem;
  text-align: center;
}

.unclaimed-heading {
  font-size: 1.2rem;
  color: var(--la-color-text-primary);
  margin: 0 0 0.5rem;
}

.unclaimed-sub {
  color: var(--la-color-text-secondary);
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
  color: var(--la-color-text-secondary);
  margin-top: 0.5rem;
}

.panel-loading {
  text-align: center;
  color: var(--la-color-text-secondary);
  padding: 2rem;
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
  width: 3rem;
  text-align: center;
  color: var(--la-color-text-secondary);
}

.col-legs {
  text-align: center;
  color: var(--la-color-text-secondary);
}

.col-score {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--la-color-text-primary);
}

.col-score.under-par {
  color: var(--la-color-gold-bright);
}

.col-pool {
  color: var(--la-color-text-secondary);
  font-size: 0.85rem;
}

/* Feeder line (WP-385) */
.feeder-line {
  margin: 1rem 0 0;
  color: var(--la-color-text-secondary);
  font-size: 0.85rem;
  font-style: italic;
}

/* Challenge links */
.approved-loadouts {
  margin-top: 1.5rem;
  border-top: 1px solid var(--la-color-border-subtle);
  padding-top: 1rem;
}

.approved-note {
  font-size: 0.85rem;
  color: var(--la-color-text-secondary);
  margin: 0 0 0.5rem;
}

.approved-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  color: var(--la-color-text-primary);
}

.challenge-legs {
  margin-top: 1.5rem;
  border-top: 1px solid var(--la-color-border-subtle);
  padding-top: 1rem;
}

.challenge-heading {
  font-size: 0.95rem;
  color: var(--la-color-text-secondary);
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
  color: var(--la-color-gold-bright);
  text-decoration: none;
}

.challenge-link:hover {
  text-decoration: underline;
}
</style>
