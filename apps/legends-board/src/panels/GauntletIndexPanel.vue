<script setup lang="ts">
/**
 * Gauntlet index panel (WP-343 / WP-345 / D-24131 §8a / D-24134) — every
 * set-gauntlet championship grouped by set. Each row shows per-player-count
 * claim chips (claimed counts link to their board; empty counts render inline
 * unclaimed state), and unclaimed gauntlets carry a challenge link that lands
 * on the leg's pinned loadout preview.
 */
import { computed } from "vue";
import type {
  GauntletIndexEntry,
  GauntletIndexSnapshot,
} from "../snapshots/snapshotClient";
import {
  buildChallengeUrl,
  buildFixedCountTabs,
  buildPlayerCountTabs,
  formatCardDisplayName,
  groupGauntletsBySet,
  selectApprovedLoadout,
  type PlayerCountTab,
} from "./gauntletDisplay";
import EmptyBoardCta from "../components/EmptyBoardCta.vue";

const props = defineProps<{
  index: GauntletIndexSnapshot | null;
  error: string | null;
}>();

const setGroups = computed(() => {
  if (props.index === null) {
    return [];
  }
  return groupGauntletsBySet(props.index.gauntlets);
});

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
</style>
