<script lang="ts">
import { defineComponent, toRaw, type PropType } from 'vue';
import type { UIDisplayEntry } from '@legendary-arena/game-engine';

/**
 * Master Strike Pile leaf — face-up destination for resolved Master Strike
 * cards. Sits to the right of the Mastermind tile per
 * `DESIGN-BOARD-LAYOUT.md §3.1`. WP-153 populated `G.mastermind.strikePile`
 * so the array is no longer a constant safe-skip.
 *
 * Renders the count + the top-card display + a click-to-browse affordance.
 * The browse modal itself is owned by the parent page-level SFC; this leaf
 * emits `open` carrying `{ pileLabel, cards }` that the page stores in its
 * `activePile` ref and feeds to a single `<PileBrowseModal>` mount.
 *
 * @see WP-129 §Acceptance Criteria — Master Strike Pile rendering
 * @see WP-171 §Acceptance Criteria — Pile Browse Modal (browse button + emit)
 * @see DESIGN-BOARD-LAYOUT.md §3.1 (desktop) and §3.2 (mobile)
 * @see DECISIONS.md D-12805 UIDisplayEntry shape, D-16502 type-only engine import
 */
export default defineComponent({
  name: 'MasterStrikePile',
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
        pileLabel: 'Master Strike Pile',
        cards: toRaw(props.pile),
      });
    }
    return { onBrowse };
  },
});
</script>

<template>
  <section
    class="master-strike-pile"
    data-testid="play-master-strike-pile"
    aria-label="Master Strike Pile"
  >
    <!-- why: collapsed to a single line — the pile is usually empty early game,
         so the old header + count + top + empty stack was vertical noise that
         "revealed nothing useful". The count stays visible; the full contents
         open in the shared PileBrowseModal via the browse button (kept, and
         still only shown when there is something to browse). -->
    <span class="master-strike-pile__count" data-testid="play-master-strike-count">
      Master Strikes: {{ pile.length }}
    </span>
    <button
      v-if="pile.length > 0"
      type="button"
      class="master-strike-pile__browse"
      data-testid="play-master-strike-browse"
      @click="onBrowse"
    >
      View all ▼
    </button>
  </section>
</template>

<style scoped>
.master-strike-pile {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-foreground, #999);
  /* why: the parent zone is a stretch flex row, so without this the one-line
     box would stretch to the (taller) tile's height, leaving a one-liner
     floating in a tall bordered box. Pin to content height. */
  align-self: flex-start;
}

.master-strike-pile__count {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.master-strike-pile__browse {
  padding: 0.15rem 0.4rem;
  font-size: 0.8rem;
}
</style>
