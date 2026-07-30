<script setup lang="ts">
/**
 * Gauntlet index panel (WP-343 / WP-345 / D-24131 §8a / D-24134) — every
 * set-gauntlet championship grouped by set. Each row shows per-player-count
 * claim chips (claimed counts link to their board; empty counts render inline
 * unclaimed state), and unclaimed gauntlets carry a challenge link that lands
 * on the leg's pinned loadout preview.
 */
import { computed, reactive } from "vue";
import type {
  GauntletIndexEntry,
  GauntletIndexSnapshot,
} from "../snapshots/snapshotClient";
import {
  buildChallengeUrl,
  buildFixedCountTabs,
  buildGauntletDetails,
  buildPlayerCountTabs,
  formatCardDisplayName,
  groupGauntletsBySet,
  pinShowcaseGauntlet,
  selectApprovedLoadout,
  type GauntletDetails,
  type PlayerCountTab,
} from "./gauntletDisplay";
import {
  downloadGauntletPack,
  type GauntletDivision,
  type GauntletPackPlayerCount,
} from "./gauntletPackDownload";
import EmptyBoardCta from "../components/EmptyBoardCta.vue";

const props = defineProps<{
  index: GauntletIndexSnapshot | null;
  error: string | null;
}>();

const setGroups = computed(() => {
  if (props.index === null) {
    return [];
  }
  // why: WP-441 — pin the Core Set / Magneto showcase gauntlet to the front of
  // the grouped index. The pin is applied AFTER groupGauntletsBySet, so that
  // function's publisher-order-preserving contract is untouched.
  return pinShowcaseGauntlet(groupGauntletsBySet(props.index.gauntlets));
});

// why: WP-456 — the player counts the details reveal lists approved adversaries
// for (the SupportedPlayerCount range the gauntlet index keys on).
const DETAIL_PLAYER_COUNTS = [1, 2, 3, 4, 5];

// why: WP-456 — precompute each gauntlet's details once per index change (keyed
// by board name) rather than re-deriving inside the template on every render;
// the reveal template reads this map. buildGauntletDetails is pure and reads only
// the already-parsed snapshot entry (no API, no registry import).
const gauntletDetailsByBoard = computed<Map<string, GauntletDetails>>(() => {
  const detailsByBoard = new Map<string, GauntletDetails>();
  for (const setGroup of setGroups.value) {
    for (const gauntlet of setGroup.gauntlets) {
      detailsByBoard.set(
        gauntlet.board,
        buildGauntletDetails(gauntlet, DETAIL_PLAYER_COUNTS),
      );
    }
  }
  return detailsByBoard;
});

const EMPTY_GAUNTLET_DETAILS: GauntletDetails = { schemes: [], loadoutsByCount: [] };

/**
 * The precomputed details for one gauntlet row, for the reveal template.
 *
 * @param gauntlet The gauntlet index entry.
 * @returns Its details, or an empty shape if not yet computed.
 */
function gauntletDetails(gauntlet: GauntletIndexEntry): GauntletDetails {
  return gauntletDetailsByBoard.value.get(gauntlet.board) ?? EMPTY_GAUNTLET_DETAILS;
}

/** One gauntlet row's download-selector state (WP-441). */
interface GauntletDownloadSelection {
  playerCount: GauntletPackPlayerCount;
  division: GauntletDivision;
}

// why: per-row selector state keyed by the gauntlet's board name — the index
// renders up to 105 rows and each row carries its own count/division choice, so
// a single shared ref would apply one row's pick to every other row.
const rowSelections = reactive<Record<string, GauntletDownloadSelection>>({});

/** The player counts a gauntlet pack may target (D-24134 §2 / WP-370). */
const PLAYER_COUNT_OPTIONS: readonly GauntletPackPlayerCount[] = [1, 2, 3, 4, 5];

/** The two competitive divisions a gauntlet can be entered in (D-24260). */
const DIVISION_OPTIONS: readonly GauntletDivision[] = ["fixed", "open"];

/**
 * The current selection for a row, defaulting to solo (1) + fixed. A plain read
 * returns the default WITHOUT writing to the reactive store, so rendering never
 * mutates state (which would risk a render loop).
 */
function selectionFor(board: string): GauntletDownloadSelection {
  return rowSelections[board] ?? { playerCount: 1, division: "fixed" };
}

/** Records a row's player-count choice. */
function setPlayerCount(
  board: string,
  playerCount: GauntletPackPlayerCount,
): void {
  rowSelections[board] = { ...selectionFor(board), playerCount };
}

/** Records a row's division choice. */
function setDivision(board: string, division: GauntletDivision): void {
  rowSelections[board] = { ...selectionFor(board), division };
}

/** Reads the chosen player count off a count `<select>`'s change event. */
function onPlayerCountChange(board: string, event: Event): void {
  const target = event.target as HTMLSelectElement;
  setPlayerCount(board, Number(target.value) as GauntletPackPlayerCount);
}

/** Reads the chosen division off a division `<select>`'s change event. */
function onDivisionChange(board: string, event: Event): void {
  const target = event.target as HTMLSelectElement;
  setDivision(board, target.value as GauntletDivision);
}

/**
 * Builds and downloads the identity pack for a gauntlet row from its
 * `{ setAbbr, mastermindSlug }` and the selected count + division. No network
 * call — the pack is assembled client-side (WP-441).
 */
function downloadRowPack(gauntlet: GauntletIndexEntry): void {
  const selection = selectionFor(gauntlet.board);
  downloadGauntletPack({
    setAbbr: gauntlet.setAbbr,
    mastermindSlug: gauntlet.mastermindSlug,
    division: selection.division,
    playerCount: selection.playerCount,
  });
}

/** The per-count claim chips for one gauntlet row. */
function countChips(gauntlet: GauntletIndexEntry): PlayerCountTab[] {
  return buildPlayerCountTabs(gauntlet);
}

/**
 * The fixed-division claim chips for one gauntlet row — CLAIMED counts
 * only (WP-385). Rendering five more muted chips per row across a
 * 105-gauntlet index would be visual noise; the unclaimed fixed state
 * lives on the board panel's division toggle instead.
 */
function fixedChips(gauntlet: GauntletIndexEntry): PlayerCountTab[] {
  const claimedChips: PlayerCountTab[] = [];
  for (const tab of buildFixedCountTabs(gauntlet)) {
    if (tab.isClaimed) {
      claimedChips.push(tab);
    }
  }
  return claimedChips;
}

/** The chip label for one player count (e.g. `1p`, `2p`). */
function chipLabel(tab: PlayerCountTab): string {
  return `${tab.playerCount}p`;
}

/**
 * The challenge link for an unclaimed gauntlet's first leg, or `null` when
 * the index entry predates WP-344 (no `legs`) so no link renders.
 */
function firstLegChallengeUrl(gauntlet: GauntletIndexEntry): string | null {
  const legs = gauntlet.legs;
  if (legs === undefined || legs.length === 0) {
    return null;
  }
  const firstLeg = legs[0];
  if (firstLeg === undefined) {
    return null;
  }
  // why: WP-395 — the index CTA has no routed count, so the solo approved
  // configuration is pinned (see selectApprovedLoadout). An unpinned link
  // would open a builder whose run cannot qualify.
  return buildChallengeUrl(
    gauntlet.setAbbr,
    firstLeg.schemeSlug,
    gauntlet.mastermindSlug,
    undefined,
    selectApprovedLoadout(gauntlet),
  );
}
</script>

<template>
  <div class="panel gauntlet-index-panel">
    <h2 class="panel-title">Mastermind Gauntlets</h2>
    <p class="panel-subtitle">
      Defeat a mastermind under every scheme in its set to claim a board.
    </p>

    <div v-if="error" class="panel-error">
      <p>Data unavailable</p>
      <p class="error-detail">{{ error }}</p>
    </div>

    <div v-else-if="!index" class="panel-loading">
      <p>Loading gauntlets...</p>
    </div>

    <div v-else class="set-groups">
      <section
        v-for="setGroup of setGroups"
        :key="setGroup.setAbbr"
        class="set-group"
      >
        <h3 class="set-name">{{ setGroup.setName }}</h3>
        <ul class="gauntlet-list">
          <li
            v-for="gauntlet of setGroup.gauntlets"
            :key="gauntlet.board"
            class="gauntlet-row"
          >
            <span class="mastermind-name">{{ formatCardDisplayName(gauntlet.mastermindName) }}</span>
            <span class="leg-count">{{ gauntlet.legCount }} schemes</span>

            <div class="count-chips">
              <template
                v-for="chip of countChips(gauntlet)"
                :key="chip.playerCount"
              >
                <a
                  v-if="chip.isClaimed"
                  class="chip chip-claimed"
                  :href="`#/gauntlet/${chip.boardName}`"
                >{{ chipLabel(chip) }} ✓</a>
                <!-- why: an empty count has NO board file below one entry
                     (the WP-342 publisher writes boards only at >=1 complete
                     entry, D-24131 §7) — a link would 404, so the unclaimed
                     count renders inline muted state instead. -->
                <span
                  v-else
                  class="chip chip-unclaimed"
                  title="Unclaimed"
                >{{ chipLabel(chip) }}</span>
              </template>
              <!-- Fixed-division claim chips (WP-385): claimed counts only —
                   the championship marker on the index. -->
              <a
                v-for="chip of fixedChips(gauntlet)"
                :key="`fixed-${chip.playerCount}`"
                class="chip chip-fixed"
                :href="`#/gauntlet/${chip.boardName}`"
                title="Fixed-Pool Championship claimed"
              >★ {{ chipLabel(chip) }}</a>
            </div>

            <!-- Unclaimed gauntlet CTA: challenge the first leg on a pinned
                 loadout (D-24134 §6), or the shared play CTA on an old
                 snapshot that predates `legs`. -->
            <a
              v-if="gauntlet.entryCount === 0 && firstLegChallengeUrl(gauntlet) !== null"
              class="challenge-link"
              :href="firstLegChallengeUrl(gauntlet) ?? undefined"
              target="_blank"
              rel="noopener"
            >Challenge →</a>
            <EmptyBoardCta
              v-else-if="gauntlet.entryCount === 0"
              compact
            />

            <!-- Client-side gauntlet-pack download (WP-441): a compact
                 player-count + division selector defaulting to solo (1) +
                 fixed, and a button that builds and saves the identity pack.
                 No server call — the pack is assembled from this row's data. -->
            <div class="download-control">
              <select
                class="download-select"
                :value="selectionFor(gauntlet.board).playerCount"
                aria-label="Player count"
                @change="onPlayerCountChange(gauntlet.board, $event)"
              >
                <option
                  v-for="playerCount of PLAYER_COUNT_OPTIONS"
                  :key="playerCount"
                  :value="playerCount"
                >{{ playerCount }}p</option>
              </select>
              <select
                class="download-select"
                :value="selectionFor(gauntlet.board).division"
                aria-label="Division"
                @change="onDivisionChange(gauntlet.board, $event)"
              >
                <option
                  v-for="division of DIVISION_OPTIONS"
                  :key="division"
                  :value="division"
                >{{ division }}</option>
              </select>
              <button
                type="button"
                class="download-button"
                @click="downloadRowPack(gauntlet)"
              >Download Mastermind Gauntlet</button>
            </div>

            <!-- WP-456: per-mastermind details reveal — the schemes and the
                 approved villains/henchmen per player count a run must use to
                 qualify. Rendered from already-published snapshot data (no API);
                 a native <details> so it is keyboard-accessible. -->
            <details class="gauntlet-details">
              <summary class="gauntlet-details-summary">Show details</summary>
              <div class="gauntlet-details-body">
                <p class="gauntlet-details-schemes">
                  <strong>Schemes ({{ gauntletDetails(gauntlet).schemes.length }}):</strong>
                  {{ gauntletDetails(gauntlet).schemes.join(", ") }}
                </p>
                <div
                  v-for="countDetail of gauntletDetails(gauntlet).loadoutsByCount"
                  :key="countDetail.playerCount"
                  class="gauntlet-details-count"
                >
                  <span class="gauntlet-details-count-label">{{ countDetail.playerCount }}-player approved adversaries</span>
                  <p v-if="countDetail.configs.length === 0" class="gauntlet-details-none">
                    Requirement not published for this player count.
                  </p>
                  <ul v-else class="gauntlet-details-configs">
                    <li
                      v-for="(config, configIndex) of countDetail.configs"
                      :key="configIndex"
                      class="gauntlet-details-config"
                    >
                      <span><strong>Villains:</strong> {{ config.villains.join(", ") }}</span>
                      <span><strong>Henchmen:</strong> {{ config.henchmen.join(", ") }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </details>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.panel {
  padding: 1.5rem;
}

.panel-title {
  font-size: 1.5rem;
  margin: 0 0 0.25rem;
  color: var(--la-color-gold-bright);
}

.panel-subtitle {
  color: var(--la-color-text-secondary);
  margin: 0 0 1.25rem;
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
  color: var(--la-color-text-secondary);
  margin-top: 0.5rem;
}

.panel-loading {
  text-align: center;
  color: var(--la-color-text-secondary);
  padding: 2rem;
}

.set-group {
  margin-bottom: 1.5rem;
}

.set-name {
  font-size: 1.05rem;
  color: var(--la-color-text-secondary);
  border-bottom: 1px solid var(--la-color-border-subtle);
  padding-bottom: 0.35rem;
  margin: 0 0 0.5rem;
}

.gauntlet-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.gauntlet-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.45rem 0.25rem;
  border-bottom: 1px solid rgba(26, 26, 46, 0.6);
}

.mastermind-name {
  flex: 1;
  color: var(--la-color-text-primary);
}

.leg-count {
  color: var(--la-color-text-muted);
  font-size: 0.85rem;
}

/* Per-count claim chips */
.count-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.chip {
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  text-decoration: none;
}

.chip-claimed {
  color: var(--la-color-gold-bright);
  border: 1px solid rgba(255, 215, 0, 0.4);
}

.chip-claimed:hover {
  background: rgba(255, 215, 0, 0.12);
}

.chip-unclaimed {
  color: var(--la-color-border-strong);
  border: 1px dashed var(--la-color-border-subtle);
}

.chip-fixed {
  color: var(--la-color-gold-bright);
  border: 1px solid rgba(255, 215, 0, 0.7);
  background: rgba(255, 215, 0, 0.08);
  font-weight: 600;
}

.chip-fixed:hover {
  background: rgba(255, 215, 0, 0.18);
}

.challenge-link {
  color: var(--la-color-gold-bright);
  text-decoration: none;
  font-size: 0.85rem;
  white-space: nowrap;
}

.challenge-link:hover {
  text-decoration: underline;
}

/* Gauntlet-pack download control (WP-441) */
.download-control {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.download-select {
  padding: 0.15rem 0.35rem;
  border-radius: 6px;
  border: 1px solid var(--la-color-border-subtle);
  background: transparent;
  color: var(--la-color-text-primary);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.download-button {
  padding: 0.2rem 0.7rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 215, 0, 0.4);
  background: transparent;
  color: var(--la-color-gold-bright);
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
}

.download-button:hover {
  background: rgba(255, 215, 0, 0.12);
}

/* WP-456: per-mastermind gauntlet details reveal */
.gauntlet-details {
  flex-basis: 100%;
  margin-top: 0.35rem;
  border-top: 1px solid var(--la-color-border-subtle);
  padding-top: 0.35rem;
}

.gauntlet-details-summary {
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--la-color-gold-bright);
}

.gauntlet-details-body {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-top: 0.4rem;
  font-size: 0.8rem;
  color: var(--la-color-text-secondary);
}

.gauntlet-details-schemes {
  margin: 0;
}

.gauntlet-details-count {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.gauntlet-details-count-label {
  color: var(--la-color-text-primary);
  font-weight: 600;
}

.gauntlet-details-none {
  margin: 0;
  font-style: italic;
  opacity: 0.75;
}

.gauntlet-details-configs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.gauntlet-details-config {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}
</style>
