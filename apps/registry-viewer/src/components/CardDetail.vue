<script setup lang="ts">
import type { FlatCard } from "../../registry/browser";

defineProps<{ card: FlatCard }>();
const emit = defineEmits<{ close: [] }>();

// Strip markup tags like [keyword:X], [hc:X], [icon:X] for plain display
function stripMarkup(text: string): string {
  return text.replace(/\[[\w-]+:[^\]]+\]/g, (m) => {
    const inner = m.slice(1, -1);
    return inner.split(":")[1] ?? inner;
  });
}

const HC_COLOR: Record<string, string> = {
  covert: "#34d399", instinct: "#f472b6", ranged: "#60a5fa", strength: "#f87171", tech: "#fbbf24",
};
const TYPE_COLOR: Record<string, string> = {
  hero: "#60a5fa", mastermind: "#f87171", villain: "#f59e0b", scheme: "#a78bfa",
};
const RARITY_LABEL: Record<number, string> = { 1: "Common", 2: "Uncommon", 3: "Rare" };
</script>

<template>
  <aside class="detail">
    <div class="detail-header">
      <h2>{{ card.name }}</h2>
      <button class="close-btn" @click="emit('close')">✕</button>
    </div>
    <div class="detail-body">
      <!-- Image -->
      <div class="img-wrap">
        <img :src="card.imageUrl" :alt="card.name" />
      </div>

      <!-- Stats -->
      <div class="stats">
        <div class="stat">
          <span class="stat-label">Type</span>
          <span class="stat-value" :style="{ color: TYPE_COLOR[card.cardType] }">{{ card.cardType }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Set</span>
          <span class="stat-value">{{ card.setName }} <small>({{ card.setAbbr }})</small></span>
        </div>
        <div v-if="card.heroName" class="stat">
          <span class="stat-label">Hero</span>
          <span class="stat-value">{{ card.heroName }}</span>
        </div>
        <div v-if="card.team" class="stat">
          <span class="stat-label">Team</span>
          <span class="stat-value">{{ card.team }}</span>
        </div>
        <div v-if="card.hc" class="stat">
          <span class="stat-label">Class</span>
          <span class="stat-value" :style="{ color: HC_COLOR[card.hc] }">{{ card.hc }}</span>
        </div>
        <div v-if="card.cost !== undefined" class="stat">
          <span class="stat-label">Cost</span>
          <span class="stat-value">{{ card.cost }}</span>
        </div>
        <div v-if="card.attack" class="stat">
          <span class="stat-label">Attack</span>
          <span class="stat-value">{{ card.attack }}</span>
        </div>
        <div v-if="card.recruit" class="stat">
          <span class="stat-label">Recruit</span>
          <span class="stat-value">{{ card.recruit }}</span>
        </div>
        <div v-if="card.rarity" class="stat">
          <span class="stat-label">Rarity</span>
          <span class="stat-value">{{ RARITY_LABEL[card.rarity] }}</span>
        </div>
        <div v-if="card.slot" class="stat">
          <span class="stat-label">Slot</span>
          <span class="stat-value">{{ card.slot }}</span>
        </div>
      </div>

      <!-- Abilities -->
      <div v-if="card.abilities.length" class="section">
        <div class="section-title">Abilities</div>
        <ul class="ability-list">
          <li v-for="(ab, i) in card.abilities" :key="i">{{ stripMarkup(ab) }}</li>
        </ul>
      </div>

      <!-- Raw JSON -->
      <details class="raw-json">
        <summary>Raw JSON</summary>
        <pre>{{ JSON.stringify(card, null, 2) }}</pre>
      </details>
    </div>
  </aside>
</template>

<style scoped>
.detail { width: 320px; flex-shrink: 0; background: #1a1a24; border-left: 1px solid #2e2e42; display: flex; flex-direction: column; overflow: hidden; }
.detail-header { display: flex; align-items: center; justify-content: space-between; padding: 0.9rem 1rem; border-bottom: 1px solid #2e2e42; flex-shrink: 0; }
.detail-header h2 { margin: 0; font-size: 0.95rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.close-btn { background: none; border: none; color: #6666aa; font-size: 1.1rem; cursor: pointer; padding: 0.2rem 0.4rem; border-radius: 4px; }
.close-btn:hover { background: #2a2a3a; color: #e8e8ee; }
.detail-body { overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }
.img-wrap { border-radius: 8px; overflow: hidden; background: #12121a; }
.img-wrap img { width: 100%; display: block; object-fit: cover; }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
.stat { background: #12121a; border-radius: 6px; padding: 0.4rem 0.55rem; }
.stat-label { display: block; font-size: 0.62rem; color: #6666aa; text-transform: uppercase; letter-spacing: 0.05em; }
.stat-value { font-size: 0.82rem; font-weight: 600; color: #d8d8ee; text-transform: capitalize; }
.stat-value small { color: #6666aa; font-weight: 400; }
.section { display: flex; flex-direction: column; gap: 0.4rem; }
.section-title { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: #6666aa; }
.ability-list { margin: 0; padding-left: 1.1rem; font-size: 0.8rem; color: #c8c8e0; line-height: 1.6; display: flex; flex-direction: column; gap: 0.35rem; }
.raw-json summary { cursor: pointer; font-size: 0.8rem; color: #6666aa; padding: 0.3rem 0; }
.raw-json pre { background: #0f0f13; border: 1px solid #22222e; border-radius: 6px; padding: 0.6rem; font-size: 0.68rem; color: #9999bb; overflow-x: auto; max-height: 220px; overflow-y: auto; margin: 0.4rem 0 0; }
</style>
