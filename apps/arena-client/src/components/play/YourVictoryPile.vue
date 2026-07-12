<script lang="ts">
import { defineComponent, toRaw, type PropType } from 'vue';
import type { UIDisplayEntry } from '@legendary-arena/game-engine';
import { useVictoryPileComposition } from '../../composables/useVictoryPileComposition';

/**
 * Your victory pile — renders the active player's
 * `players[ownIndex].{victoryCards, victoryVP}` plus composition counters
 * derived via {@link useVictoryPileComposition} per D-12906.
 *
 * The full card list is NOT rendered inline: the pile grows one card per
 * defeated villain / rescued bystander, so an inline list would push the
 * mat taller every turn and force a page scroll late-game. Instead the
 * always-visible summary is the count + VP + composition counters, and the
 * full contents open on demand in the shared `PileBrowseModal` via the
 * `open` emit — the same collapse pattern the KO pile and other shared
 * piles already use.
 *
 * Per the EC-132 §2 SFC authoring whitelist: this is a tested non-leaf
 * composer that USES a composable, so it MUST use
 * `defineComponent({ setup() { return {...} } })` per P6-30 / P6-46 /
 * D-6512.
 *
 * @see WP-129 §Acceptance Criteria — Your Victory Pile composition
 * @see DESIGN-BOARD-LAYOUT.md §3.1 YOUR VICTORY PILE
 * @see DECISIONS.md D-12906 composition counter discovery
 */
export default defineComponent({
  name: 'YourVictoryPile',
  emits: ['open'],
  props: {
    victoryCards: {
      type: Array as PropType<readonly UIDisplayEntry[]>,
      required: false,
      default: () => [],
    },
    // why: prop name uses single-cap `victoryVp` (NOT `victoryVP`) so the
    // kebab binding `:victory-vp` from PlayDesktop / PlayMobile camelizes
    // cleanly to `victoryVp`. Multi-consecutive-capital prop names break
    // Vue's kebab↔camel round-trip — `victory-vp` camelizes to `victoryVp`,
    // not `victoryVP`, so a `victoryVP` prop is treated as an unmatched
    // attr and Vue silently falls back to the default (0). The
    // engine-layer field `UIPlayerState.victoryVP` keeps the canonical
    // `totalVP` casing (WP-128 / D-12801) — only the component prop name
    // changes. Vue style guide explicitly recommends `videoSrc` over
    // `videoSRC` for this exact reason.
    victoryVp: {
      type: Number,
      required: false,
      default: 0,
    },
  },
  setup(props, { emit }) {
    function buildComposition(): ReturnType<typeof useVictoryPileComposition> {
      // why: D-12906 — derive from card effects in the loaded scenario
      // via the prefix-heuristic in `useVictoryPileComposition`. The
      // composable's contract is stable; only its internals graduate
      // to a metadata file when WP-130 lands.
      return useVictoryPileComposition([...props.victoryCards]);
    }

    function onBrowse(): void {
      // why: emit the source `victoryCards` array by JS reference via
      // `toRaw()` (no clone), mirroring KOPile.onBrowse — Vue wraps props
      // in a deep-readonly proxy, and `toRaw` reveals the underlying array
      // the engine projection built, preserving order for the modal.
      emit('open', {
        pileLabel: 'Your Victory Pile',
        cards: toRaw(props.victoryCards),
      });
    }

    return { buildComposition, onBrowse };
  },
});
</script>

<template>
  <section
    class="your-victory-pile"
    data-testid="play-your-victory-pile"
    aria-label="Your Victory Pile"
  >
    <header class="your-victory-pile__header">
      Your Victory Pile —
      <span data-testid="play-your-victory-count">{{ victoryCards.length }} cards</span> /
      <span data-testid="play-your-victory-vp">{{ victoryVp }} VP</span>
    </header>
    <!-- why: the full list is collapsed behind a browse affordance so the
         pile does not grow the mat vertically as victory cards accumulate
         (avoids a late-game page scroll). Clicking emits `open`; the page
         feeds the cards to the shared PileBrowseModal, same as the KO pile. -->
    <button
      v-if="victoryCards.length > 0"
      type="button"
      class="your-victory-pile__browse"
      data-testid="play-your-victory-browse"
      @click="onBrowse"
    >
      View all ({{ victoryCards.length }}) ▼
    </button>
    <p v-else class="your-victory-pile__empty" data-testid="play-your-victory-empty">
      No victories yet.
    </p>
    <dl class="your-victory-pile__composition" data-testid="play-your-victory-composition">
      <div>
        <dt>Bystanders rescued</dt>
        <dd data-testid="play-victory-bystanders">{{ buildComposition().bystandersRescued }}</dd>
      </div>
      <div>
        <dt>Villains defeated</dt>
        <dd data-testid="play-victory-villains">{{ buildComposition().villainsDefeated }}</dd>
      </div>
      <div>
        <dt>Henchmen defeated</dt>
        <dd data-testid="play-victory-henchmen">{{ buildComposition().henchmenDefeated }}</dd>
      </div>
      <div>
        <dt>Mastermind cards</dt>
        <dd data-testid="play-victory-mastermind">{{ buildComposition().mastermindCards }}</dd>
      </div>
      <div>
        <dt>Wounds in pile</dt>
        <dd data-testid="play-victory-wounds">{{ buildComposition().woundsInPile }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.your-victory-pile {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-foreground, #999);
}

.your-victory-pile__browse {
  align-self: flex-start;
  padding: 0.25rem 0.5rem;
}

.your-victory-pile__composition {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.25rem 1rem;
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.your-victory-pile__composition div {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.your-victory-pile__composition dt,
.your-victory-pile__composition dd {
  margin: 0;
}
</style>
