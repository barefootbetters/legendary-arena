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
    // why: WP-848 / D-24784 — the viewer's live conditional-clause tally, the same
    // WP-708 tally the endgame Synergy Rate reads (unit = conditional clause). The
    // engine projects both integers; the client only formats them. Neither name has
    // consecutive capitals, so the kebab bindings camelize cleanly (see `victoryVp`).
    conditionalClausesPlayed: {
      type: Number,
      required: false,
      default: 0,
    },
    conditionalClausesAssembled: {
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

    /**
     * Formats the "Effects triggered" line from the projected tally.
     *
     * @returns `Effects triggered: {assembled} / {played} ({percent}%)`, or
     *   `Effects triggered: 0 / 0` when nothing has been played yet.
     */
    function buildEffectsTriggeredText(): string {
      // why: no percentage at played 0 — there is nothing to divide by, and the
      // line would otherwise read `NaN%`.
      if (props.conditionalClausesPlayed === 0) {
        return 'Effects triggered: 0 / 0';
      }
      const percent = Math.round((100 * props.conditionalClausesAssembled) / props.conditionalClausesPlayed);
      return `Effects triggered: ${props.conditionalClausesAssembled} / ${props.conditionalClausesPlayed} (${percent}%)`;
    }

    return { buildComposition, buildEffectsTriggeredText, onBrowse };
  },
});
</script>

<template>
  <section
    class="your-victory-pile"
    data-testid="play-your-victory-pile"
    aria-label="Your Victory Pile"
  >
    <!-- why: WP-848 / D-24784 — the Effects triggered pill sits in the header row.
         It wraps under the header only when the header already fills the row
         (phone width), rather than squeezing the header onto three lines. -->
    <div class="your-victory-pile__title-row">
      <header class="your-victory-pile__header">
        Your Victory Pile —
        <span data-testid="play-your-victory-count">{{ victoryCards.length }} cards</span> /
        <span data-testid="play-your-victory-vp">{{ victoryVp }} VP</span>
      </header>
      <!-- why: WP-848 / D-24784 — the live in-play view of the endgame Synergy Rate:
           conditional hero clauses assembled vs played this match. -->
      <span class="your-victory-pile__effects" data-testid="play-your-victory-effects">
        {{ buildEffectsTriggeredText() }}
      </span>
    </div>
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
    <!-- why: composition counters render as one compact wrapped line (labels
         shortened) instead of a five-row grid, so the victory pile stops being
         a tall block in the top row. The dd testids are unchanged. -->
    <dl class="your-victory-pile__composition" data-testid="play-your-victory-composition">
      <div>
        <dt>Bystanders</dt>
        <dd data-testid="play-victory-bystanders">{{ buildComposition().bystandersRescued }}</dd>
      </div>
      <div>
        <dt>Villains</dt>
        <dd data-testid="play-victory-villains">{{ buildComposition().villainsDefeated }}</dd>
      </div>
      <div>
        <dt>Henchmen</dt>
        <dd data-testid="play-victory-henchmen">{{ buildComposition().henchmenDefeated }}</dd>
      </div>
      <div>
        <dt>Mastermind</dt>
        <dd data-testid="play-victory-mastermind">{{ buildComposition().mastermindCards }}</dd>
      </div>
      <div>
        <dt>Wounds</dt>
        <dd data-testid="play-victory-wounds">{{ buildComposition().woundsInPile }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.your-victory-pile {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--color-foreground, #999);
}

.your-victory-pile__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.6rem;
}

.your-victory-pile__effects {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--la-color-border-strong, rgba(212, 175, 55, 0.3));
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.your-victory-pile__browse {
  align-self: flex-start;
  padding: 0.25rem 0.5rem;
}

.your-victory-pile__composition {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.75rem;
  margin: 0;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.your-victory-pile__composition div {
  display: flex;
  gap: 0.3rem;
}

.your-victory-pile__composition dt {
  margin: 0;
  opacity: 0.75;
}

.your-victory-pile__composition dd {
  margin: 0;
  font-weight: 600;
}
</style>
