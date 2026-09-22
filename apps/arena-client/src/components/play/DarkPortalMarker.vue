<script lang="ts">
import { defineComponent } from 'vue';

/**
 * Dark Portal marker (WP-727 / D-24548) — the board overlay for the "Portals to
 * the Dark Dimension" scheme. Renders a dark-portal glyph plus the `+N attack`
 * the portal grants, above the Mastermind tile or a portal'd city space.
 *
 * Purely presentational: it reads the served bonus and renders it. The `+N` is
 * bound from the `attackBonus` prop (the engine's `scheme.darkPortals`
 * descriptor), never a hardcoded literal — a future multi-stack buff renders
 * faithfully. No move, no game logic, no state (Vision NG-1, off-ranking).
 *
 * Per the EC-132 §2 SFC authoring whitelist this is a leaf presentational
 * component with only props, so `defineComponent({ props })` (no `setup`) is
 * sufficient — props are exposed to the template directly.
 *
 * @see WP-727 §Scope A — DarkPortalMarker
 * @see DECISIONS.md D-24548 board-overlay visual contract
 */
export default defineComponent({
  name: 'DarkPortalMarker',
  props: {
    attackBonus: {
      type: Number,
      required: true,
    },
  },
});
</script>

<template>
  <span
    class="dark-portal-marker"
    data-testid="dark-portal-marker"
    :aria-label="'Dark Portal: +' + attackBonus + ' attack'"
    :title="'Dark Portal: +' + attackBonus + ' attack'"
  >
    <span class="dark-portal-marker__glyph" aria-hidden="true">🌀</span>
    <span class="dark-portal-marker__bonus">+{{ attackBonus }}</span>
    <span class="dark-portal-marker__unit"> attack</span>
  </span>
</template>

<style scoped>
/* why: a compact pill mirroring the city-villain / bystander badges (WP-505), so
   the portal overlay reads as the same visual family. Dark violet to signal the
   Dark Dimension threat; frosted edge for legibility over a busy playmat. */
.dark-portal-marker {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
  padding: 0.05rem 0.35rem;
  border-radius: 0.75rem;
  background: rgba(46, 16, 74, 0.88);
  border: 1px solid rgba(180, 130, 240, 0.55);
  color: #f2e9ff;
  font-size: 0.7rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}

.dark-portal-marker__glyph {
  font-size: 0.72rem;
}

.dark-portal-marker__unit {
  opacity: 0.85;
  font-weight: 600;
}
</style>
