<script setup lang="ts">
import type { FlatCard } from "../../registry/browser";

defineProps<{ cards: FlatCard[]; selectedKey?: string }>();
const emit = defineEmits<{ select: [card: FlatCard] }>();

const TYPE_COLOR: Record<string, string> = {
  hero: "#60a5fa", mastermind: "#f87171", villain: "#f59e0b", scheme: "#a78bfa",
};
const HC_COLOR: Record<string, string> = {
  covert: "#34d399", instinct: "#f472b6", ranged: "#60a5fa", strength: "#f87171", tech: "#fbbf24",
};
const RARITY_DOT: Record<number, string> = { 1: "#9ca3af", 2: "#34d399", 3: "#60a5fa" };
</script>

<template>
  <div class="grid-wrapper">
    <div v-if="!cards.length" class="empty">No cards match your filters.</div>
    <div class="grid">
      <button
        v-for="card in cards"
        :key="card.key"
        class="card-tile"
        :class="{ selected: card.key === selectedKey }"
        @click="emit('select', card)"
      >
        <div class="img-wrap">
          <img :src="card.imageUrl" :alt="card.name" loading="lazy"
            @error="($event.target as HTMLImageElement).style.opacity = '0.2'" />
          <span class="type-badge" :style="{ background: TYPE_COLOR[card.cardType] + '22', color: TYPE_COLOR[card.cardType] }">
            {{ card.cardType }}
          </span>
        </div>
        <div class="tile-info">
          <span class="tile-name">{{ card.name }}</span>
          <span v-if="card.heroName && card.heroName !== card.name" class="tile-hero">{{ card.heroName }}</span>
          <div class="tile-meta">
            <span v-if="card.hc" class="hc-tag" :style="{ color: HC_COLOR[card.hc] }">{{ card.hc }}</span>
            <span v-if="card.cost !== undefined" class="cost">⚡{{ card.cost }}</span>
            <span v-if="card.rarity" class="rarity-dot" :style="{ background: RARITY_DOT[card.rarity] }"></span>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.grid-wrapper { flex: 1; overflow-y: auto; padding: 1rem; background: #0f0f13; }
.empty { text-align: center; color: #55556a; padding: 3rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.75rem; }
.card-tile { background: #1a1a24; border: 2px solid #2e2e42; border-radius: 8px; cursor: pointer; transition: border-color 0.15s, transform 0.1s; overflow: hidden; display: flex; flex-direction: column; text-align: left; padding: 0; }
.card-tile:hover { border-color: #5050a0; transform: translateY(-2px); }
.card-tile.selected { border-color: #7070e0; }
.img-wrap { position: relative; width: 100%; aspect-ratio: 3/4; background: #12121a; overflow: hidden; }
.img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
.type-badge { position: absolute; bottom: 4px; left: 4px; font-size: 0.6rem; padding: 0.1rem 0.35rem; border-radius: 3px; font-weight: 600; text-transform: capitalize; }
.tile-info { padding: 0.4rem 0.5rem 0.5rem; display: flex; flex-direction: column; gap: 0.15rem; }
.tile-name { font-size: 0.72rem; font-weight: 600; color: #d8d8ee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile-hero { font-size: 0.62rem; color: #7777aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile-meta { display: flex; align-items: center; gap: 0.35rem; margin-top: 0.1rem; }
.hc-tag { font-size: 0.6rem; text-transform: capitalize; }
.cost { font-size: 0.65rem; color: #fbbf24; }
.rarity-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-left: auto; }
</style>
