<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { UICardDisplay } from '@legendary-arena/game-engine';
import CardTile from './CardTile.vue';

/**
 * Active player's played-cards zone — renders one tile per CardExtId in
 * `players[ownIndex].inPlayCards` under a visible "Played This Turn"
 * heading, so the mat shows where hand cards go after being played and
 * before `endTurn` sweeps them to the discard pile.
 *
 * Read-only: cards already in play cannot be un-played, so tiles are
 * non-interactive (no buttons, no move submission). The projection fields
 * (`inPlayCards` / `inPlayDisplay`, WP-128 / D-12803) are own-player-only;
 * opponents see the count via OpponentPanel instead.
 *
 * Per the EC-132 §2 SFC authoring whitelist: tested composer, so it uses
 * `defineComponent({ setup() { return {...} } })` per P6-30 / P6-46 /
 * D-6512.
 */
export default defineComponent({
  name: 'PlayedCardsRow',
  components: { CardTile },
  props: {
    inPlayCards: {
      type: Array as PropType<readonly string[]>,
      required: true,
    },
    /**
     * Parallel display payload for `inPlayCards`; populated by WP-128's
     * `players[ownIndex].inPlayDisplay`. Length must match `inPlayCards`
     * exactly when present. Undefined when redacted (other audiences) —
     * but for the active-player surface the field is always present.
     */
    inPlayDisplay: {
      type: Array as PropType<readonly UICardDisplay[] | undefined>,
      required: false,
      default: undefined,
    },
  },
  setup(props) {
    function humanizeCardId(cardId: string): string {
      // why: produce a readable label from a CardExtId when the engine's
      // cardDisplayData lookup misses (returns the WP-111
      // UNKNOWN_DISPLAY_PLACEHOLDER with name '<unknown>'). Same gap and
      // same formatting-only fallback as HandRow — the engine-synthetic
      // starter cards land in this zone the moment they are played.
      return cardId.replace(/-/g, ' ');
    }

    function resolveDisplay(cardId: string, index: number): UICardDisplay {
      if (props.inPlayDisplay !== undefined && index < props.inPlayDisplay.length) {
        const entry = props.inPlayDisplay[index]!;
        if (entry.name !== '<unknown>') {
          return entry;
        }
      }
      return {
        extId: cardId,
        name: humanizeCardId(cardId),
        imageUrl: '',
        cost: null,
      };
    }

    return { resolveDisplay };
  },
});
</script>

<template>
  <section
    class="played-row"
    data-testid="play-played-row"
    aria-label="Played this turn"
  >
    <header class="played-row__heading" data-testid="play-played-heading">
      Played This Turn — {{ inPlayCards.length }}
    </header>
    <p
      v-if="inPlayCards.length === 0"
      class="played-row__empty"
      data-testid="play-played-empty"
    >
      No cards played yet.
    </p>
    <ul v-else class="played-row__cards">
      <li
        v-for="(cardId, index) in inPlayCards"
        :key="`${cardId}-${index}`"
        class="played-row__card"
        data-testid="play-played-card"
        :data-card-id="cardId"
      >
        <CardTile
          :display="resolveDisplay(cardId, index)"
          size="md"
          :show-label="true"
        />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.played-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.played-row__heading {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.85;
}

.played-row__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.played-row__empty {
  margin: 0;
  font-style: italic;
  opacity: 0.7;
  font-size: 0.85rem;
}
</style>
