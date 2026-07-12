<script lang="ts">
import { defineComponent, toRaw, type PropType } from 'vue';
import type { UIDisplayEntry } from '@legendary-arena/game-engine';

/**
 * Scheme Twist Pile leaf — face-up destination for resolved Scheme Twist
 * cards. Sits to the right of the Scheme tile per
 * `DESIGN-BOARD-LAYOUT.md §3.1`. WP-153 populated `G.scheme.twistPile` so
 * the array is no longer a constant safe-skip.
 *
 * Renders the count + the top-card display + a click-to-browse affordance.
 * The browse modal itself is owned by the parent page-level SFC; this leaf
 * emits `open` carrying `{ pileLabel, cards }` that the page stores in its
 * `activePile` ref and feeds to a single `<PileBrowseModal>` mount.
 *
 * @see WP-129 §Acceptance Criteria — Scheme Twist Pile rendering
 * @see WP-171 §Acceptance Criteria — Pile Browse Modal (browse button + emit)
 * @see DESIGN-BOARD-LAYOUT.md §3.1 (desktop) and §3.2 (mobile)
 * @see DECISIONS.md D-12805 UIDisplayEntry shape, D-16502 type-only engine import
 */
export default defineComponent({
  name: 'SchemeTwistPile',
  props: {
    pile: {
      type: Array as PropType<readonly UIDisplayEntry[]>,
      required: true,
    },
  },
  emits: ['open'],
  setup(props, { emit }) {
    function onBrowse(): void {
      // why: WP-171 / EC-189 — emit the source `pile` array by JS reference
      // (no `.slice()`, no spread, no `Array.from`). Vue 3 wraps props in
      // a deep-readonly proxy, so `props.pile` is a proxy view of the
      // engine's array, not the array itself. `toRaw()` is the documented
      // Vue API for revealing the underlying reference — it is NOT a
      // clone; the engine's original array travels through the emit
      // byte-stable, preserving the order-preservation +
      // referential-identity ACs.
      emit('open', {
        pileLabel: 'Scheme Twist Pile',
        cards: toRaw(props.pile),
      });
    }
    return { onBrowse };
  },
});
</script>

<template>
  <section
    class="scheme-twist-pile"
    data-testid="play-scheme-twist-pile"
    aria-label="Scheme Twist Pile"
  >
    <!-- why: collapsed to a single line — matches the Master Strike Pile so the
         top row stops wasting vertical space on mostly-empty pile boxes. The
         resolved-twist count stays visible; contents open in the shared
         PileBrowseModal via the browse button (only shown when non-empty). -->
    <span class="scheme-twist-pile__count" data-testid="play-scheme-twist-count">
      Resolved twists: {{ pile.length }}
    </span>
    <button
      v-if="pile.length > 0"
      type="button"
      class="scheme-twist-pile__browse"
      data-testid="play-scheme-twist-browse"
      @click="onBrowse"
    >
      View all ▼
    </button>
  </section>
</template>

<style scoped>
.scheme-twist-pile {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-foreground, #999);
  /* why: pin to content height so the one-line box does not stretch to the
     Scheme tile's height in the stretch flex row (see MasterStrikePile). */
  align-self: flex-start;
}

.scheme-twist-pile__count {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.scheme-twist-pile__browse {
  padding: 0.15rem 0.4rem;
  font-size: 0.8rem;
}
</style>
