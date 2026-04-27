<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type {
  UICityState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
import type { SubmitMove } from './uiMoveName.types';

// why: defineComponent({ setup() { return {...} } }) per the vue-sfc-loader
// separate-compile pipeline (D-6512 / P6-30) — the template references
// onFight as a non-prop binding. Precedent: HandRow + ArenaHud + PlayerPanel.
export default defineComponent({
  name: 'CityRow',
  props: {
    city: {
      type: Object as PropType<UICityState>,
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
     * Emit a `fightVillain` intent for the City slot at the given index.
     * The engine validates Guard blocking, attack-cost affordability, and
     * stage gating, and silently no-ops on invalid input.
     */
    function onFight(cityIndex: number): void {
      props.submitMove('fightVillain', { cityIndex });
    }

    return { onFight };
  },
});
</script>

<template>
  <section
    class="city-row"
    data-testid="play-city-row"
    aria-label="City"
  >
    <ol class="city-spaces">
      <!-- why: iterate by positional index, not by card. The engine receives
           { cityIndex } and the slot's position in city.spaces is the
           authoritative target. Empty slots remain visible as non-interactive
           placeholders so positions stay stable across renders — collapsing
           empties would shift indices and break the engine's positional
           cityIndex payload contract. -->
      <li
        v-for="(card, cityIndex) in city.spaces"
        :key="cityIndex"
        class="city-space"
      >
        <button
          v-if="card !== null"
          type="button"
          data-testid="play-city-villain"
          :data-city-index="cityIndex"
          :data-card-id="card.extId"
          :disabled="currentStage !== 'main'"
          @click="onFight(cityIndex)"
        >
          <!-- why: stage-only gating per WP-100 §Locked contract values —
               fightVillain is enabled in the 'main' stage. Cost-based
               affordability gating is not applied here because UICityCard
               does not expose fightCost; when a follow-up WP projects costs,
               the disabled expression extends to also disable when
               economy.availableAttack is below the projected cost. -->
          {{ card.extId }}
        </button>
        <div
          v-else
          class="city-space-empty"
          data-testid="play-city-empty"
          :data-city-index="cityIndex"
        >
          Empty slot
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.city-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.city-spaces {
  display: flex;
  gap: 0.5rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.city-space-empty {
  padding: 0.5rem 0.75rem;
  border: 1px dashed var(--color-foreground, #666);
  opacity: 0.5;
}
</style>
