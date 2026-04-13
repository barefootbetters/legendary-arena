<script setup lang="ts">
import type { ThemeDefinition } from "../lib/themeClient";

defineProps<{ themes: ThemeDefinition[]; selectedId?: string }>();
const emit = defineEmits<{ select: [theme: ThemeDefinition] }>();

/** Color for the left border accent based on the first tag. */
const TAG_COLOR: Record<string, string> = {
  "x-men": "#f472b6",
  "cosmic": "#c084fc",
  "avengers": "#60a5fa",
  "spider-man": "#f87171",
  "street-level": "#f59e0b",
  "noir": "#f59e0b",
  "espionage": "#34d399",
  "horror": "#a78bfa",
  "supernatural": "#a78bfa",
  "fantastic-four": "#60a5fa",
  "deep-cut": "#94a3b8",
  "team-up": "#94a3b8",
  "hulk": "#34d399",
  "deadpool": "#f87171",
  "inhumans": "#c084fc",
};

function accentColor(theme: ThemeDefinition): string {
  for (const tag of theme.tags ?? []) {
    if (TAG_COLOR[tag]) return TAG_COLOR[tag];
  }
  return "#6666aa";
}
</script>

<template>
  <div class="grid-wrapper">
    <div v-if="!themes.length" class="empty">No themes match your filters.</div>
    <div class="grid">
      <button
        v-for="theme in themes"
        :key="theme.themeId"
        class="theme-tile"
        :class="{ selected: theme.themeId === selectedId }"
        :style="{ borderLeftColor: accentColor(theme) }"
        @click="emit('select', theme)"
      >
        <div class="tile-header">
          <span class="tile-name">{{ theme.name }}</span>
          <span class="tile-players">{{ theme.playerCount.min }}–{{ theme.playerCount.max }}p</span>
        </div>
        <span class="tile-mastermind">{{ theme.setupIntent.mastermindId }}</span>
        <div class="tile-tags">
          <span v-for="tag in (theme.tags ?? []).slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.grid-wrapper { flex: 1; overflow-y: auto; padding: 1rem; background: #0f0f13; }
.empty { text-align: center; color: #55556a; padding: 3rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; }

.theme-tile {
  background: #1a1a24;
  border: 2px solid #2e2e42;
  border-left-width: 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  text-align: left;
}
.theme-tile:hover { border-color: #5050a0; transform: translateY(-2px); }
.theme-tile.selected { border-color: #7070e0; }

.tile-header { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
.tile-name { font-size: 0.82rem; font-weight: 700; color: #d8d8ee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile-players { font-size: 0.65rem; color: #6666aa; white-space: nowrap; flex-shrink: 0; }
.tile-mastermind { font-size: 0.7rem; color: #f87171; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.tile-tags { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.tag {
  font-size: 0.6rem;
  color: #8888cc;
  background: #1e1e2e;
  border: 1px solid #2e2e42;
  padding: 0.1rem 0.4rem;
  border-radius: 10px;
}
</style>
