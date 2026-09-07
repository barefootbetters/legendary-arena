<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { UIDisplayEntry } from '@legendary-arena/game-engine';
import CardTile from './CardTile.vue';

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
  setup() {
    return {};
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
        v-for="entry in transformDeck"
        :key="entry.extId"
        class="transform-deck__cell"
      >
        <!-- why: face-up + non-interactive — the transform cards are visible so
             the player can see what each base becomes, but they are never
             recruited directly (they arrive only via the engine swap). -->
        <CardTile
          :display="entry.display"
          size="sm"
          :show-cost="true"
          :interactive="false"
        />
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

.transform-deck__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.transform-deck__cell {
  display: flex;
}
</style>
