<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type {
  UIHQState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
import type { SubmitMove } from './uiMoveName.types';

// why: defineComponent({ setup() { return {...} } }) per the vue-sfc-loader
// separate-compile pipeline (D-6512 / P6-30). Precedent: HandRow, CityRow.
export default defineComponent({
  name: 'HQRow',
  props: {
    hq: {
      type: Object as PropType<UIHQState>,
      required: true,
    },
    currentStage: {
      type: String,
      required: true,
    },
    economy: {
      type: Object as PropType<UITurnEconomyState>,
      required: true,
    },
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
  },
  setup(props) {
    /**
     * Emit a `recruitHero` intent for the HQ slot at the given index. The
     * engine validates recruit-cost affordability and stage gating and
     * silently no-ops on invalid input.
     */
    function onRecruit(hqIndex: number): void {
      props.submitMove('recruitHero', { hqIndex });
    }

    return { onRecruit };
  },
});
</script>

<template>
  <section
    class="hq-row"
    data-testid="play-hq-row"
    aria-label="HQ"
  >
    <ol class="hq-slots">
      <!-- why: iterate by positional index, not by card. The engine receives
           { hqIndex } and the slot's position in hq.slots is the
           authoritative target. Empty slots remain visible as non-interactive
           placeholders so positions stay stable across renders — collapsing
           empties would shift indices and break the engine's positional
           hqIndex payload contract. -->
      <li
        v-for="(cardId, hqIndex) in hq.slots"
        :key="hqIndex"
        class="hq-slot"
      >
        <button
          v-if="cardId !== null"
          type="button"
          data-testid="play-hq-hero"
          :data-hq-index="hqIndex"
          :data-card-id="cardId"
          :disabled="currentStage !== 'main'"
          @click="onRecruit(hqIndex)"
        >
          <!-- why: stage-only gating per WP-100 §Locked contract values —
               recruitHero is enabled in the 'main' stage. UIHQState.slots
               carries bare CardExtId strings (NOT the UICityCard shape used
               by City), so cost data is not available here. When a follow-up
               WP projects costs into UIState, the disabled expression
               extends to also disable when economy.availableRecruit is below
               the projected cost. -->
          {{ cardId }}
        </button>
        <div
          v-else
          class="hq-slot-empty"
          data-testid="play-hq-empty"
          :data-hq-index="hqIndex"
        >
          Empty slot
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.hq-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hq-slots {
  display: flex;
  gap: 0.5rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.hq-slot-empty {
  padding: 0.5rem 0.75rem;
  border: 1px dashed var(--color-foreground, #666);
  opacity: 0.5;
}
</style>
