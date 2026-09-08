<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue';
import type { UIDisplayEntry } from '@legendary-arena/game-engine';
import CardTile from './CardTile.vue';

/**
 * One unique second-form card in the collapsed side-deck view, plus how many
 * copies of it the pile holds (EC-703 Jeff feedback — see `groupedDeck` below).
 */
interface TransformDeckGroup {
  readonly entry: UIDisplayEntry;
  readonly count: number;
}

/**
 * Transform Deck leaf — the face-up side deck of Transform second-form cards
 * (`UIState.transformDeck`, projected from `G.transformDeck` by WP-657 /
 * D-24468 and surfaced by WP-664 / D-24475).
 *
 * These are the set-aside second forms a base card swaps into via
 * `[keyword:Transform]` (WP-658) — e.g. She-Hulk's `Hurl Legal Objections`
 * becomes `Hurl Trucks`. They are NOT recruitable from the HQ; they enter play
 * only through the engine swap, so this pile is DISPLAY-ONLY (no click / recruit
 * affordance, no browse modal — the pile is small and shown face-up inline,
 * matching the physical game where Transform cards are laid out face-up).
 *
 * Hidden entirely when the deck is empty or absent, so it only appears for a
 * match with Transform heroes (today: the `wwhk` set).
 *
 * EC-703 (Jeff feedback): the pile holds every copy of each second-form, so the
 * view COLLAPSES to one tile per unique card with a copy count (`×N`); the header
 * still reports the total pile size. Showing the base "transformer" card each one
 * comes from is a deferred follow-up.
 *
 * Type-only engine import (D-16502). Renders `CardTile`, so per the EC-132 SFC
 * authoring whitelist it is a `defineComponent` composer.
 *
 * @see WP-664 / D-24475 — Transform side-deck UI projection + render
 * @see DECISIONS.md D-24468 transform side deck, D-12805 UIDisplayEntry shape
 */
export default defineComponent({
  name: 'TransformDeck',
  components: { CardTile },
  props: {
    transformDeck: {
      // why: WP-664 — optional in UIState (always populated by buildUIState, but
      // older / hand-written snapshots may omit it); default `[]` so the pile is
      // simply hidden rather than crashing on a missing prop.
      type: Array as PropType<readonly UIDisplayEntry[]>,
      required: false,
      default: () => [],
    },
  },
  setup(props) {
    // why: EC-703 (Jeff feedback) — the side deck holds every copy of each
    // second-form (e.g. 5× Like Totally Smart Hulk), which rendered as a long row
    // of identical tiles. Collapse to ONE tile per unique card with a copy count.
    // Strip the "#n" copy suffix from the ext-id so every copy shares one group
    // key; preserve first-seen order via the Map's insertion order.
    const groupedDeck = computed<TransformDeckGroup[]>(() => {
      const groupsByBaseId = new Map<string, { entry: UIDisplayEntry; count: number }>();
      for (const entry of props.transformDeck) {
        const baseId = entry.extId.replace(/#\d+$/, '');
        const existingGroup = groupsByBaseId.get(baseId);
        if (existingGroup === undefined) {
          groupsByBaseId.set(baseId, { entry, count: 1 });
        } else {
          existingGroup.count += 1;
        }
      }
      return [...groupsByBaseId.values()];
    });
    return { groupedDeck };
  },
});
</script>

<template>
  <!-- why: WP-664 — hidden for non-transform (non-wwhk) games; the pile appears
       only when the projected side deck has cards. -->
  <section
    v-if="transformDeck.length > 0"
    class="transform-deck"
    data-testid="play-transform-deck"
    aria-label="Transform Deck"
  >
    <header class="transform-deck__header">
      Transform Deck [{{ transformDeck.length }}]
    </header>
    <ol class="transform-deck__row">
      <li
        v-for="group in groupedDeck"
        :key="group.entry.extId"
        class="transform-deck__cell"
      >
        <!-- why: face-up + non-interactive — the transform cards are visible so
             the player can see what each base becomes, but they are never
             recruited directly (they arrive only via the engine swap). -->
        <CardTile
          :display="group.entry.display"
          size="sm"
          :show-cost="true"
          :interactive="false"
        />
        <!-- why: EC-703 (Jeff feedback) — one tile per unique second-form, with a
             copy count so the collapsed pile still shows how many of each remain. -->
        <span
          class="transform-deck__count"
          :aria-label="`${group.count} copies`"
        >×{{ group.count }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.transform-deck {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-foreground, #999);
}

.transform-deck__header {
  font-weight: 600;
  font-size: 0.85rem;
}

/* why: WP-664 follow-up — a single non-wrapping row that scrolls horizontally, so
   a large side deck stays bounded in width (to the right of the HQ) instead of
   wrapping tall or pushing the layout. overflow-x:auto shows the scrollbar only
   when the cards exceed the available width. */
.transform-deck__row {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0 0 0.25rem;
  overflow-x: auto;
}

/* why: WP-664 follow-up — each cell keeps its intrinsic card width (no shrink) so
   the row scrolls horizontally rather than squashing the tiles. EC-703: stack the
   count badge under the tile. */
.transform-deck__cell {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

/* why: EC-703 (Jeff feedback) — copy count for a collapsed unique second-form. */
.transform-deck__count {
  font-size: 0.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-foreground, #333);
}
</style>
