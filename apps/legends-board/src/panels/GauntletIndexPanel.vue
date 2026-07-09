<script setup lang="ts">
/**
 * Gauntlet index panel (WP-343 / D-24131 §8a) — every set-gauntlet
 * championship grouped by set. Populated boards link to their board
 * view; zero-entry boards render the unclaimed CTA inline.
 */
import { computed } from "vue";
import type { GauntletIndexSnapshot } from "../snapshots/snapshotClient";
import { groupGauntletsBySet } from "./gauntletDisplay";
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
            <span class="mastermind-name">{{ gauntlet.mastermindName }}</span>
            <span class="leg-count">{{ gauntlet.legCount }} schemes</span>
            <!-- why: zero-entry gauntlets have NO board file (the WP-342
                 publisher writes boards only at >=1 complete entry,
                 D-24131 §7) — a link here would 404, so the unclaimed
                 state renders inline instead. -->
            <a
              v-if="gauntlet.entryCount > 0"
              class="board-link"
              :href="`#/gauntlet/${gauntlet.board}`"
            >
              {{ gauntlet.entryCount }}
              {{ gauntlet.entryCount === 1 ? "champion" : "champions" }} →
            </a>
            <EmptyBoardCta v-else compact />
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
  color: #ffd700;
}

.panel-subtitle {
  color: #888;
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
  color: #888;
  margin-top: 0.5rem;
}

.panel-loading {
  text-align: center;
  color: #888;
  padding: 2rem;
}

.set-group {
  margin-bottom: 1.5rem;
}

.set-name {
  font-size: 1.05rem;
  color: #aaa;
  border-bottom: 1px solid #1a1a2e;
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
  color: #e0e0e0;
}

.leg-count {
  color: #666;
  font-size: 0.85rem;
}

.board-link {
  color: #ffd700;
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}

.board-link:hover {
  text-decoration: underline;
}
</style>
