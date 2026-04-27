<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type {
  UIMastermindState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
import type { SubmitMove } from './uiMoveName.types';

// why: defineComponent({ setup() { return {...} } }) per the vue-sfc-loader
// separate-compile pipeline (D-6512 / P6-30). Precedent: HandRow, CityRow,
// HQRow.
export default defineComponent({
  name: 'MastermindTile',
  props: {
    mastermind: {
      type: Object as PropType<UIMastermindState>,
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
     * Emit a `fightMastermind` intent. The engine targets the top tactic
     * of the current mastermind implicitly; mastermind identity and tactic
     * selection are not arguments.
     */
    function onFight(): void {
      // why: empty-object payload — fightMastermind takes no arguments by
      // engine design. The move always defeats the top tactic of the
      // current mastermind; multi-tactic defeat and tactic-text effects
      // are deferred to WP-024 per `fightMastermind.ts`.
      props.submitMove('fightMastermind', {});
    }

    return { onFight };
  },
});
</script>

<template>
  <section
    class="mastermind-tile"
    data-testid="play-mastermind-tile"
    aria-label="Mastermind"
  >
    <button
      type="button"
      data-testid="play-mastermind-button"
      :data-mastermind-id="mastermind.id"
      :disabled="currentStage !== 'main' || mastermind.tacticsRemaining === 0"
      @click="onFight"
    >
      <!-- why: stage-only gating per WP-100 §Locked contract values plus the
           tactics-remaining check (no fight is possible once all tactics
           are defeated). Cost-based affordability gating is not applied
           here because UIMastermindState does not expose fightCost. -->
      <span class="mastermind-id">{{ mastermind.id }}</span>
      <span class="mastermind-status">
        Tactics remaining: {{ mastermind.tacticsRemaining }}
      </span>
    </button>
  </section>
</template>

<style scoped>
.mastermind-tile {
  display: flex;
  flex-direction: column;
}

.mastermind-tile button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
}

.mastermind-id {
  font-weight: 600;
}

.mastermind-status {
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}
</style>
