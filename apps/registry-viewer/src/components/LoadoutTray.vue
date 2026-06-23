<script setup lang="ts">
// LoadoutTray.vue — floating "🧰 Loadout" pill (WP-279 / EC-310 / D-24054).
//
// Presentation only: it renders a compact summary of the shared loadout draft
// and emits `open` when clicked. It owns no slot logic and never mutates the
// draft. App.vue derives the summary props and gates visibility (the pill is
// hidden on a blank draft and while the Loadout tab is active), so this
// component just draws what it is given. Never throws.

import { computed } from "vue";

// why: the read-only summary App.vue derives from the shared draft composition
// (the two single slots as booleans, the three group slots as counts) plus the
// live validation issue count. Counts/booleans only — no draft handle here.
interface Props {
  schemeSet: boolean;
  mastermindSet: boolean;
  heroes: number;
  villains: number;
  henchmen: number;
  issues: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{ open: [] }>();

/** The compact "1 scheme · 4 heroes · 2 villains" parts, omitting empty slots. */
const pickParts = computed<string[]>(() => {
  const parts: string[] = [];
  if (props.schemeSet) {
    parts.push("1 scheme");
  }
  if (props.mastermindSet) {
    parts.push("1 mastermind");
  }
  if (props.heroes > 0) {
    parts.push(`${props.heroes} ${props.heroes === 1 ? "hero" : "heroes"}`);
  }
  if (props.villains > 0) {
    parts.push(`${props.villains} ${props.villains === 1 ? "villain" : "villains"}`);
  }
  if (props.henchmen > 0) {
    parts.push(`${props.henchmen} ${props.henchmen === 1 ? "henchman" : "henchmen"}`);
  }
  return parts;
});

const summaryText = computed<string>(() => pickParts.value.join(" · "));

/** "✓ ready" when there are no validation issues, else "⚠ N issue(s)". */
const statusText = computed<string>(() => {
  if (props.issues === 0) {
    return "✓ ready";
  }
  return `⚠ ${props.issues} ${props.issues === 1 ? "issue" : "issues"}`;
});
</script>

<template>
  <!-- why: a <button> (not a styled <div>) so the pill is keyboard-focusable
       and announced to screen readers — same affordance pattern as the
       glossary FAB and the EC-103 control conversions in this app. -->
  <button
    type="button"
    class="loadout-tray"
    @click="emit('open')"
    title="Go to the Loadout tab"
    aria-label="Open the Loadout tab"
  >
    <span class="tray-icon" aria-hidden="true">🧰</span>
    <span class="tray-label">Loadout</span>
    <span v-if="summaryText" class="tray-summary">{{ summaryText }}</span>
    <span class="tray-status" :class="{ ready: issues === 0, issues: issues > 0 }">{{ statusText }}</span>
  </button>
</template>

<style scoped>
/* why: fixed bottom-LEFT so the pill never overlaps the bottom-right glossary
   FAB (.floating-glossary-btn in App.vue). z-index matches the FAB so both sit
   above the card grid. */
.loadout-tray {
  position: fixed;
  bottom: 1.25rem;
  left: 1.25rem;
  z-index: 100;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #2a2a5a;
  border: 2px solid #7070e0;
  color: #fff;
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transition: transform 0.15s, background 0.15s;
}
.loadout-tray:hover {
  background: #3a3a7a;
  transform: scale(1.03);
}
.tray-icon { font-size: 1rem; }
.tray-label { font-weight: 700; }
.tray-summary { color: #c0c0ff; font-weight: 400; }
.tray-status { font-weight: 600; }
.tray-status.ready { color: #6ee7b7; }
.tray-status.issues { color: #fcd34d; }
</style>
