<script setup lang="ts">
// why: the play surface has no icon system, and the crossed-swords affordances
// (Excessive Violence overspend, Final Blow) were rendered with a bare U+2694
// codepoint that the play-surface font does not carry — it silently collapsed to
// nothing, so the buttons read as plain text (operator-confirmed 2026-09-22). An
// inline SVG is font-independent and theme-safe: it inherits the button colour via
// `currentColor`, so it works in light/dark and against any accent. Geometry is the
// Lucide "swords" glyph (MIT-licensed), two blades crossed in an X.
</script>

<template>
  <svg
    class="crossed-swords-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
    <line x1="13" y1="19" x2="19" y2="13" />
    <line x1="16" y1="16" x2="20" y2="20" />
    <line x1="19" y1="21" x2="21" y2="19" />
    <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
    <line x1="5" y1="14" x2="9" y2="18" />
    <line x1="7" y1="17" x2="4" y2="20" />
    <line x1="3" y1="19" x2="5" y2="21" />
  </svg>
</template>

<style scoped>
/* why: sized to the em-box so callers control it with font-size; no intrinsic
   colour so it inherits the button's `color` through `currentColor`. */
.crossed-swords-icon {
  width: 1.1em;
  height: 1.1em;
  flex: 0 0 auto;
  display: inline-block;
  vertical-align: -0.15em;
}
</style>
