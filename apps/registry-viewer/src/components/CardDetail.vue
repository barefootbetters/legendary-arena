<script setup lang="ts">
import { ref } from "vue";
import type { FlatCard } from "../../registry/browser";
import { parseAbilityText, lookupKeyword, lookupRule } from "../composables/useRules";
import type { AbilityToken } from "../composables/useRules";

defineProps<{ card: FlatCard }>();
const emit = defineEmits<{ close: [] }>();

// ── Tooltip state ─────────────────────────────────────────────────────────────
const tooltipVisible  = ref(false);
const tooltipLabel    = ref("");
const tooltipText     = ref("");
const tooltipX        = ref(0);
const tooltipY        = ref(0);

function showTooltip(event: MouseEvent, label: string, text: string) {
  if (!text) return;
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  tooltipLabel.value   = label;
  tooltipText.value    = text;
  tooltipX.value       = rect.left;
  tooltipY.value       = rect.bottom + 6;
  tooltipVisible.value = true;
}

function hideTooltip() {
  tooltipVisible.value = false;
}

// ── Token rendering helpers ───────────────────────────────────────────────────

/**
 * Get CSS class for a token based on its type and whether it has a definition.
 */
function tokenClass(token: AbilityToken): string {
  if (token.type === "keyword") {
    const hasDefinition = lookupKeyword(token.value) !== null;
    return hasDefinition ? "token-keyword has-tooltip" : "token-keyword";
  }
  if (token.type === "rule") {
    const hasDefinition = lookupRule(token.value) !== null;
    return hasDefinition ? "token-rule has-tooltip" : "token-rule";
  }
  if (token.type === "icon")  return `token-icon token-icon-${token.value}`;
  if (token.type === "hc")    return `token-hc token-hc-${token.value}`;
  if (token.type === "team")  return "token-team";
  return "";
}

/**
 * Get the display label for a token — what shows inline in the text.
 */
function tokenLabel(token: AbilityToken): string {
  if (token.type === "icon") {
    const iconLabels: Record<string, string> = {
      attack:   "⚔",
      recruit:  "★",
      cost:     "◆",
      vp:       "🏆",
      focus:    "◎",
      piercing: "↯",
      token:    "🃏",
    };
    return iconLabels[token.value] ?? token.value;
  }
  if (token.type === "hc") {
    const hcLabels: Record<string, string> = {
      covert:   "Covert",
      instinct: "Instinct",
      ranged:   "Ranged",
      strength: "Strength",
      tech:     "Tech",
    };
    return hcLabels[token.value] ?? token.value;
  }
  return token.value;
}

/**
 * Handle click/hover on a keyword token — show the tooltip.
 */
function onKeywordHover(event: MouseEvent, token: AbilityToken) {
  if (token.type === "keyword") {
    const definition = lookupKeyword(token.value);
    if (definition) {
      showTooltip(event, token.value, definition);
    }
  } else if (token.type === "rule") {
    const entry = lookupRule(token.value);
    if (entry) {
      showTooltip(event, entry.label, entry.summary);
    }
  }
}

// ── Stat display ──────────────────────────────────────────────────────────────
const HC_COLOR: Record<string, string> = {
  covert:   "#34d399",
  instinct: "#f472b6",
  ranged:   "#60a5fa",
  strength: "#f87171",
  tech:     "#fbbf24",
};

const TYPE_COLOR: Record<string, string> = {
  hero:       "#60a5fa",
  mastermind: "#f87171",
  villain:    "#f59e0b",
  scheme:     "#a78bfa",
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

      <!-- Abilities with rich token rendering -->
      <div v-if="card.abilities.length" class="section">
        <div class="section-title">
          Abilities
          <span class="tooltip-hint">hover keywords for rules</span>
        </div>
        <ul class="ability-list">
          <li v-for="(abilityLine, lineIndex) in card.abilities" :key="lineIndex" class="ability-line">
            <!-- Skip pipeline artifacts -->
            <template v-if="abilityLine !== '[object Object]'">
              <template v-for="(token, tokenIndex) in parseAbilityText(abilityLine)" :key="tokenIndex">
                <!-- Plain text — no decoration -->
                <span v-if="token.type === 'text'" class="token-text">{{ token.value }}</span>

                <!-- Keyword token — gold, underlined, hoverable if defined -->
                <span
                  v-else-if="token.type === 'keyword'"
                  :class="tokenClass(token)"
                  @mouseenter="onKeywordHover($event, token)"
                  @mouseleave="hideTooltip"
                >{{ tokenLabel(token) }}</span>

                <!-- Rule reference — purple, hoverable -->
                <span
                  v-else-if="token.type === 'rule'"
                  :class="tokenClass(token)"
                  @mouseenter="onKeywordHover($event, token)"
                  @mouseleave="hideTooltip"
                >{{ tokenLabel(token) }}</span>

                <!-- Icon token — colored symbol badge -->
                <span v-else-if="token.type === 'icon'" :class="tokenClass(token)">{{ tokenLabel(token) }}</span>

                <!-- Hero class token — colored class name pill -->
                <span v-else-if="token.type === 'hc'" :class="tokenClass(token)" :style="{ color: HC_COLOR[token.value] }">{{ tokenLabel(token) }}</span>

                <!-- Team token — teal label -->
                <span v-else-if="token.type === 'team'" class="token-team">{{ tokenLabel(token) }}</span>
              </template>
            </template>
          </li>
        </ul>
      </div>

      <!-- Raw JSON -->
      <details class="raw-json">
        <summary>Raw JSON</summary>
        <pre>{{ JSON.stringify(card, null, 2) }}</pre>
      </details>
    </div>

    <!-- Tooltip portal — fixed position, rendered above everything -->
    <Teleport to="body">
      <div
        v-if="tooltipVisible"
        class="rule-tooltip"
        :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
      >
        <div class="tooltip-label">{{ tooltipLabel }}</div>
        <div class="tooltip-body">{{ tooltipText }}</div>
      </div>
    </Teleport>
  </aside>
</template>

<style scoped>
/* ── Panel layout ─────────────────────────────────────────────────────────── */
.detail { width: 320px; flex-shrink: 0; background: #1a1a24; border-left: 1px solid #2e2e42; display: flex; flex-direction: column; overflow: hidden; }
.detail-header { display: flex; align-items: center; justify-content: space-between; padding: 0.9rem 1rem; border-bottom: 1px solid #2e2e42; flex-shrink: 0; }
.detail-header h2 { margin: 0; font-size: 0.95rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.close-btn { background: none; border: none; color: #6666aa; font-size: 1.1rem; cursor: pointer; padding: 0.2rem 0.4rem; border-radius: 4px; }
.close-btn:hover { background: #2a2a3a; color: #e8e8ee; }
.detail-body { overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }

/* ── Card image ───────────────────────────────────────────────────────────── */
.img-wrap { border-radius: 8px; overflow: hidden; background: #12121a; }
.img-wrap img { width: 100%; display: block; object-fit: cover; }

/* ── Stats grid ──────────────────────────────────────────────────────────── */
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
.stat { background: #12121a; border-radius: 6px; padding: 0.4rem 0.55rem; }
.stat-label { display: block; font-size: 0.62rem; color: #6666aa; text-transform: uppercase; letter-spacing: 0.05em; }
.stat-value { font-size: 0.82rem; font-weight: 600; color: #d8d8ee; text-transform: capitalize; }
.stat-value small { color: #6666aa; font-weight: 400; }

/* ── Abilities section ───────────────────────────────────────────────────── */
.section { display: flex; flex-direction: column; gap: 0.4rem; }
.section-title { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: #6666aa; display: flex; align-items: center; gap: 0.5rem; }
.tooltip-hint { font-size: 0.6rem; color: #44445a; text-transform: none; letter-spacing: 0; font-style: italic; }

.ability-list { margin: 0; padding-left: 1.1rem; list-style-type: disc; display: flex; flex-direction: column; gap: 0.4rem; }
.ability-line { font-size: 0.8rem; color: #c8c8e0; line-height: 1.7; }

/* ── Inline tokens ───────────────────────────────────────────────────────── */
.token-text { /* plain text — no styling needed */ }

/* Keyword: gold underline, pointer cursor. Clickable if has-tooltip class is present. */
.token-keyword {
  color: #f0c040;
  font-weight: 600;
}
.token-keyword.has-tooltip {
  text-decoration: underline dotted #f0c040;
  cursor: help;
}
.token-keyword.has-tooltip:hover {
  color: #ffd966;
  background: rgba(240, 192, 64, 0.12);
  border-radius: 3px;
  padding: 0 2px;
}

/* Rule reference: purple underline */
.token-rule {
  color: #c084fc;
  font-weight: 600;
}
.token-rule.has-tooltip {
  text-decoration: underline dotted #c084fc;
  cursor: help;
}
.token-rule.has-tooltip:hover {
  color: #d8b4fe;
  background: rgba(192, 132, 252, 0.12);
  border-radius: 3px;
  padding: 0 2px;
}

/* Icon tokens: small colored symbol */
.token-icon       { font-size: 0.85em; font-weight: 700; padding: 0 1px; }
.token-icon-attack   { color: #f87171; }
.token-icon-recruit  { color: #60a5fa; }
.token-icon-cost     { color: #fbbf24; }
.token-icon-vp       { color: #34d399; }
.token-icon-focus    { color: #c084fc; }
.token-icon-piercing { color: #f472b6; }
.token-icon-token    { color: #94a3b8; }

/* Hero class tokens: colored label */
.token-hc {
  font-size: 0.75em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 3px;
  border-radius: 3px;
  background: rgba(255,255,255,0.06);
}

/* Team tokens: teal label */
.token-team {
  color: #2dd4bf;
  font-size: 0.8em;
  font-weight: 600;
}

/* ── Raw JSON ─────────────────────────────────────────────────────────────── */
.raw-json summary { cursor: pointer; font-size: 0.8rem; color: #6666aa; padding: 0.3rem 0; }
.raw-json pre { background: #0f0f13; border: 1px solid #22222e; border-radius: 6px; padding: 0.6rem; font-size: 0.68rem; color: #9999bb; overflow-x: auto; max-height: 220px; overflow-y: auto; margin: 0.4rem 0 0; }
</style>

<!-- Tooltip styles must NOT be scoped — the tooltip is teleported to <body> -->
<style>
.rule-tooltip {
  position: fixed;
  z-index: 9999;
  max-width: 280px;
  background: #1e1e30;
  border: 1px solid #5050a0;
  border-radius: 8px;
  padding: 0.6rem 0.8rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}

.rule-tooltip .tooltip-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: #f0c040;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.3rem;
}

.rule-tooltip .tooltip-body {
  font-size: 0.78rem;
  color: #c8c8e0;
  line-height: 1.55;
}
</style>
