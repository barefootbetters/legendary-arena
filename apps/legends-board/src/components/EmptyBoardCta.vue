<script setup lang="ts">
/**
 * Shared empty-board call-to-action (WP-343). Replaces the header-only
 * empty tables on the classic panels and renders the "unclaimed" state
 * on gauntlet surfaces. Compact mode is the inline one-liner used inside
 * index rows; full mode is the centered panel state.
 */
const props = defineProps<{
  compact?: boolean;
}>();

const PLAY_URL = "https://play.legendary-arena.com";
</script>

<template>
  <span v-if="props.compact" class="empty-cta-compact">
    Unclaimed —
    <a class="cta-link" :href="PLAY_URL">be the first</a>
  </span>
  <div v-else class="empty-cta">
    <p class="empty-heading">No Legends yet</p>
    <p class="empty-sub">
      The board opens with the first replay-verified score. Rank #1 is
      unclaimed.
    </p>
    <a class="cta-button" :href="PLAY_URL">Play now — be the first</a>
  </div>
</template>

<style scoped>
.empty-cta {
  text-align: center;
  padding: 2.5rem 1rem;
}

.empty-heading {
  font-size: 1.4rem;
  color: var(--la-color-text-primary);
  margin: 0 0 0.5rem;
}

.empty-sub {
  color: var(--la-color-text-secondary);
  margin: 0 0 1.25rem;
}

.cta-button {
  display: inline-block;
  padding: 0.6rem 1.5rem;
  background: rgba(255, 215, 0, 0.15);
  color: var(--la-color-gold-bright);
  border: 1px solid rgba(255, 215, 0, 0.4);
  border-radius: 22px;
  text-decoration: none;
  font-weight: 600;
}

.cta-button:hover {
  background: rgba(255, 215, 0, 0.25);
}

.empty-cta-compact {
  color: var(--la-color-text-secondary);
  font-size: 0.9rem;
}

.cta-link {
  color: var(--la-color-gold-bright);
  text-decoration: none;
}

.cta-link:hover {
  text-decoration: underline;
}
</style>
