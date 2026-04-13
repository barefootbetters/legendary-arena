<script setup lang="ts">
import type { ThemeDefinition } from "../lib/themeClient";

defineProps<{ theme: ThemeDefinition }>();
const emit = defineEmits<{
  close: [];
  navigateToCard: [slug: string, cardType: string];
}>();
</script>

<template>
  <aside class="detail">
    <div class="detail-header">
      <h2>{{ theme.name }}</h2>
      <button class="close-btn" @click="emit('close')">✕</button>
    </div>

    <div class="detail-body">
      <!-- Description -->
      <p class="description">{{ theme.description }}</p>

      <!-- Flavor text -->
      <p v-if="theme.flavorText" class="flavor">"{{ theme.flavorText }}"</p>

      <!-- Setup Intent -->
      <div class="section">
        <div class="section-title">Setup Intent</div>

        <div class="intent-group">
          <span class="intent-label">Mastermind</span>
          <button class="intent-link mastermind" @click="emit('navigateToCard', theme.setupIntent.mastermindId, 'mastermind')">
            {{ theme.setupIntent.mastermindId }}
          </button>
        </div>

        <div class="intent-group">
          <span class="intent-label">Scheme</span>
          <button class="intent-link scheme" @click="emit('navigateToCard', theme.setupIntent.schemeId, 'scheme')">
            {{ theme.setupIntent.schemeId }}
          </button>
        </div>

        <div class="intent-group">
          <span class="intent-label">Villain Groups</span>
          <div class="intent-badges">
            <button
              v-for="villainGroupId in theme.setupIntent.villainGroupIds"
              :key="villainGroupId"
              class="intent-link villain"
              @click="emit('navigateToCard', villainGroupId, 'villain')"
            >{{ villainGroupId }}</button>
          </div>
        </div>

        <div v-if="theme.setupIntent.henchmanGroupIds?.length" class="intent-group">
          <span class="intent-label">Henchmen</span>
          <div class="intent-badges">
            <button
              v-for="henchmanGroupId in theme.setupIntent.henchmanGroupIds"
              :key="henchmanGroupId"
              class="intent-link henchman"
              @click="emit('navigateToCard', henchmanGroupId, 'henchman')"
            >{{ henchmanGroupId }}</button>
          </div>
        </div>

        <div class="intent-group">
          <span class="intent-label">Hero Decks</span>
          <div class="intent-badges">
            <button
              v-for="heroDeckId in theme.setupIntent.heroDeckIds"
              :key="heroDeckId"
              class="intent-link hero"
              @click="emit('navigateToCard', heroDeckId, 'hero')"
            >{{ heroDeckId }}</button>
          </div>
        </div>
      </div>

      <!-- Player Count -->
      <div class="section">
        <div class="section-title">Player Count</div>
        <div class="stats">
          <div class="stat">
            <span class="stat-label">Range</span>
            <span class="stat-value">{{ theme.playerCount.min }}–{{ theme.playerCount.max }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Recommended</span>
            <span class="stat-value">{{ theme.playerCount.recommended.join(', ') }}</span>
          </div>
        </div>
      </div>

      <!-- Tags -->
      <div v-if="theme.tags?.length" class="section">
        <div class="section-title">Tags</div>
        <div class="tag-list">
          <span v-for="tag in theme.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>

      <!-- References -->
      <div v-if="theme.references?.primaryStory" class="section">
        <div class="section-title">Comic Reference</div>
        <div class="stats">
          <div v-if="theme.references.primaryStory.issue" class="stat">
            <span class="stat-label">Issue</span>
            <span class="stat-value">{{ theme.references.primaryStory.issue }}</span>
          </div>
          <div v-if="theme.references.primaryStory.year" class="stat">
            <span class="stat-label">Year</span>
            <span class="stat-value">{{ theme.references.primaryStory.year }}</span>
          </div>
        </div>
        <div class="ref-links">
          <a
            v-if="theme.references.primaryStory.externalUrl"
            :href="theme.references.primaryStory.externalUrl"
            target="_blank"
            rel="noopener"
            class="ref-link"
          >🔗 Fandom Wiki</a>
          <a
            v-if="theme.references.primaryStory.marvelUnlimitedUrl"
            :href="theme.references.primaryStory.marvelUnlimitedUrl"
            target="_blank"
            rel="noopener"
            class="ref-link"
          >📖 Marvel</a>
          <a
            v-for="indexUrl in (theme.references.primaryStory.externalIndexUrls ?? [])"
            :key="indexUrl"
            :href="indexUrl"
            target="_blank"
            rel="noopener"
            class="ref-link"
          >📚 {{ indexUrl.includes('comicvine') ? 'Comic Vine' : 'Index' }}</a>
        </div>
      </div>

      <!-- Raw JSON -->
      <details class="raw-json">
        <summary>Raw JSON</summary>
        <pre>{{ JSON.stringify(theme, null, 2) }}</pre>
      </details>
    </div>
  </aside>
</template>

<style scoped>
/* ── Panel layout (matches CardDetail.vue) ─────────────────────────────── */
.detail { width: 360px; flex-shrink: 0; background: #1a1a24; border-left: 1px solid #2e2e42; display: flex; flex-direction: column; overflow: hidden; }
.detail-header { display: flex; align-items: center; justify-content: space-between; padding: 0.9rem 1rem; border-bottom: 1px solid #2e2e42; flex-shrink: 0; }
.detail-header h2 { margin: 0; font-size: 0.95rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.close-btn { background: none; border: none; color: #6666aa; font-size: 1.1rem; cursor: pointer; padding: 0.2rem 0.4rem; border-radius: 4px; }
.close-btn:hover { background: #2a2a3a; color: #e8e8ee; }
.detail-body { overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }

/* ── Description ───────────────────────────────────────────────────────── */
.description { margin: 0; font-size: 0.82rem; color: #c8c8e0; line-height: 1.6; }
.flavor { margin: 0; font-size: 0.78rem; color: #8888cc; font-style: italic; line-height: 1.5; }

/* ── Sections ──────────────────────────────────────────────────────────── */
.section { display: flex; flex-direction: column; gap: 0.5rem; }
.section-title { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: #6666aa; }

/* ── Stats grid (reused from CardDetail) ───────────────────────────────── */
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
.stat { background: #12121a; border-radius: 6px; padding: 0.4rem 0.55rem; }
.stat-label { display: block; font-size: 0.62rem; color: #6666aa; text-transform: uppercase; letter-spacing: 0.05em; }
.stat-value { font-size: 0.82rem; font-weight: 600; color: #d8d8ee; }

/* ── Setup Intent ──────────────────────────────────────────────────────── */
.intent-group { display: flex; flex-direction: column; gap: 0.25rem; }
.intent-label { font-size: 0.62rem; color: #6666aa; text-transform: uppercase; letter-spacing: 0.05em; }
.intent-badges { display: flex; flex-wrap: wrap; gap: 0.3rem; }

.intent-link {
  background: #12121a;
  border: 1px solid #2e2e42;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.intent-link:hover { border-color: #5050a0; transform: translateY(-1px); }
.intent-link.mastermind { color: #f87171; }
.intent-link.scheme { color: #a78bfa; }
.intent-link.villain { color: #f59e0b; }
.intent-link.henchman { color: #94a3b8; }
.intent-link.hero { color: #60a5fa; }

/* ── Tags ──────────────────────────────────────────────────────────────── */
.tag-list { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.tag {
  font-size: 0.65rem;
  color: #8888cc;
  background: #1e1e2e;
  border: 1px solid #2e2e42;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
}

/* ── Reference links ───────────────────────────────────────────────────── */
.ref-links { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.25rem; }
.ref-link {
  font-size: 0.72rem;
  color: #60a5fa;
  background: #12121a;
  border: 1px solid #2e2e42;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.15s;
}
.ref-link:hover { background: #1e1e3a; border-color: #5050a0; }

/* ── Raw JSON ──────────────────────────────────────────────────────────── */
.raw-json summary { cursor: pointer; font-size: 0.8rem; color: #6666aa; padding: 0.3rem 0; }
.raw-json pre { background: #0f0f13; border: 1px solid #22222e; border-radius: 6px; padding: 0.6rem; font-size: 0.68rem; color: #9999bb; overflow-x: auto; max-height: 220px; overflow-y: auto; margin: 0.4rem 0 0; }
</style>
