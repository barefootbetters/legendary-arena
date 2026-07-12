<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { UISchemeState, UICardDisplay } from '@legendary-arena/game-engine';
import CardTile from './CardTile.vue';

/**
 * Scheme tile leaf — renders the scheme id + twist progress bar.
 *
 * Implements `DESIGN-BOARD-LAYOUT.md §3.1` Scheme zone (desktop) and
 * `§3.2` Scheme band (mobile). The Scheme Twist Pile sits to the right
 * (desktop) or as a separate band (mobile) and is rendered by
 * `<SchemeTwistPile>` — this tile only shows the scheme identity and the
 * twist progress fraction.
 *
 * @see WP-129 §Acceptance Criteria — Scheme tile rendering
 */
export default defineComponent({
  name: 'SchemeTile',
  components: { CardTile },
  emits: ['read'],
  props: {
    scheme: {
      type: Object as PropType<UISchemeState>,
      required: true,
    },
    /**
     * Optional display data for the scheme card. When present and has a
     * truthy imageUrl, CardTile renders the scheme art. When absent or
     * imageUrl is empty, CardTile renders in fallback text mode.
     */
    schemeDisplay: {
      type: Object as PropType<UICardDisplay | null>,
      required: false,
      default: null,
    },
    /**
     * Total twist threshold for the scheme (e.g., 8 in "Capture Five
     * Bystanders" with 8 twist cards). Owned by the scenario; passed in
     * by the parent which knows the active scenario.
     */
    twistThreshold: {
      type: Number,
      required: true,
    },
  },
  setup(props, { emit }) {
    function schemeCardDisplay(): UICardDisplay {
      if (props.scheme.display !== undefined && props.scheme.display !== null) {
        return props.scheme.display;
      }
      if (props.schemeDisplay !== null) {
        return props.schemeDisplay;
      }
      // why: fallback synthesizes a UICardDisplay with empty imageUrl so
      // CardTile renders in text mode — no broken image placeholders
      return {
        extId: props.scheme.id,
        name: props.scheme.id.replace(/^scheme-/i, '').replace(/-/g, ' '),
        imageUrl: '',
        cost: null,
      };
    }

    function onRead(): void {
      // why: surface the full scheme card + its twist / win-condition rules in
      // the shared CardReaderModal. `scheme.gameText` is already projected; the
      // tile keeps it off-board to stay compact and emits it on demand.
      const card = schemeCardDisplay();
      emit('read', {
        title: card.name,
        display: card,
        gameText: props.scheme.gameText ?? [],
      });
    }

    return { schemeCardDisplay, onRead };
  },
});
</script>

<template>
  <section
    class="scheme-tile"
    data-testid="play-scheme-tile"
    aria-label="Scheme"
  >
    <CardTile :display="schemeCardDisplay()" size="md" :show-cost="false" :show-label="true" />
    <p class="scheme-tile__progress" data-testid="play-scheme-twist-progress">
      Twists: {{ scheme.twistCount }}/{{ twistThreshold }}
    </p>
    <!-- why: the scheme's twist + win-condition rules open in the shared
         CardReaderModal instead of rendering inline, keeping the tile short. -->
    <button
      type="button"
      class="scheme-tile__read"
      data-testid="play-scheme-read"
      @click="onRead"
    >
      Read card ▸
    </button>
  </section>
</template>

<style scoped>
.scheme-tile {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-foreground, #999);
}

.scheme-tile__id {
  font-weight: 600;
}

.scheme-tile__progress {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.scheme-tile__read {
  align-self: flex-start;
  padding: 0.2rem 0.5rem;
  font-size: 0.8rem;
}
</style>
