<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { SubmitMove } from './uiMoveName.types';

// why: defineComponent({ setup() { return {...} } }) is required (NOT
// <script setup>) because the template references the click handler as a
// non-prop binding. Under @legendary-arena/vue-sfc-loader's separate-compile
// pipeline (D-6512 / P6-30), top-level <script setup> bindings do not reach
// the template's _ctx. Returning the handler from setup() places it on the
// instance proxy where the template can call it. Precedent: PlayerPanel,
// ArenaHud, App.vue, LobbyView.vue.
export default defineComponent({
  name: 'HandRow',
  props: {
    handCards: {
      type: Array as PropType<readonly string[]>,
      required: true,
    },
    currentStage: {
      type: String,
      required: true,
    },
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
  },
  setup(props) {
    /**
     * Emit a `playCard` intent for the clicked card. The engine validates
     * that the card is in the active player's hand and silently no-ops on
     * invalid input — the UI never computes outcomes.
     */
    function onPlay(cardId: string): void {
      props.submitMove('playCard', { cardId });
    }

    return { onPlay };
  },
});
</script>

<template>
  <section
    class="hand-row"
    data-testid="play-hand-row"
    aria-label="Hand"
  >
    <p
      v-if="handCards.length === 0"
      class="hand-empty"
      data-testid="play-hand-empty"
    >
      Hand is empty.
    </p>
    <ul v-else class="hand-cards">
      <li v-for="cardId in handCards" :key="cardId" class="hand-card">
        <button
          type="button"
          data-testid="play-hand-card"
          :data-card-id="cardId"
          :disabled="currentStage !== 'main'"
          @click="onPlay(cardId)"
        >
          <!-- why: locked stage gating per WP-100 §Locked contract values —
               playCard is enabled only in the 'main' stage. Cost-based
               affordability gating is deferred until UIState projects card
               costs (see WP-111). -->
          {{ cardId }}
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.hand-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hand-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.hand-card button {
  padding: 0.5rem 0.75rem;
  font-variant-numeric: tabular-nums;
}
</style>
