<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { SubmitMove } from './uiMoveName.types';

// why: defineComponent({ setup() { return {...} } }) per the vue-sfc-loader
// separate-compile pipeline (D-6512 / P6-30).
export default defineComponent({
  name: 'TurnActionBar',
  props: {
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
     * Emit a `drawCards` intent for a full hand. The hardcoded count
     * compensates for the engine MVP gap — see `onDraw` `// why:` comment
     * below.
     */
    function onDraw(): void {
      // why: count hardcoded to 6 to match Legendary's standard hand size
      // (one click = full refill). This Draw button is a SCAFFOLD ARTIFACT
      // per WP-100 §Constraints "Scaffold artifacts" — it exists only
      // because the engine has no automatic draw mechanic today
      // (`playerInit.ts` initializes hand to [], `turn.onBegin` does not
      // draw, `endTurn` empties hand without refilling, and there is no
      // HAND_SIZE constant). When a follow-up engine WP adds a
      // `turn.onBegin` auto-draw to a canonical HAND_SIZE constant, this
      // button must be DELETED, not refactored. See DECISIONS.md D-10003.
      props.submitMove('drawCards', { count: 6 });
    }

    /**
     * Emit an `advanceStage` intent. The engine's advanceTurnStage helper
     * (turnLoop.ts) cycles G.currentStage through the canonical sequence
     * (`start → main → cleanup`) and calls events.endTurn() if invoked
     * from cleanup.
     */
    function onAdvance(): void {
      // why: empty-object payload — advanceStage takes no arguments by
      // engine design (see game.ts advanceStage wrapper + turnLoop.ts
      // advanceTurnStage). Per D-10011, this button surfaces stage
      // progression that the original WP-100 vocabulary excluded as
      // "internal." Without it, after Draw fills the hand in `start`,
      // the player is stuck — `main` (where playCard / fightVillain /
      // recruitHero / fightMastermind are gated) is unreachable. The
      // button is enabled in `start` and `main`; in `cleanup` the End
      // Turn button is the proper exit (it does the discard work that
      // advanceStage-from-cleanup skips).
      props.submitMove('advanceStage', {});
    }

    /**
     * Emit an `endTurn` intent. The engine's `endTurn` move empties hand
     * and inPlay into discard before rotating players (see
     * `coreMoves.impl.ts:131`); the UI does not perform any cleanup
     * mutation, only emits the intent.
     */
    function onEndTurn(): void {
      // why: empty-object payload — EndTurnArgs is `Record<string, never>`
      // per `coreMoves.types.ts:57`. The move takes no arguments.
      props.submitMove('endTurn', {});
    }

    return { onDraw, onAdvance, onEndTurn };
  },
});
</script>

<template>
  <section
    class="turn-action-bar"
    data-testid="play-turn-action-bar"
    aria-label="Turn actions"
  >
    <button
      type="button"
      data-testid="play-action-draw"
      :disabled="currentStage !== 'start' && currentStage !== 'main'"
      @click="onDraw"
    >
      <!-- why: stage gating per WP-100 §Locked contract values — drawCards
           is enabled in 'start' or 'main'. -->
      Draw
    </button>
    <button
      type="button"
      data-testid="play-action-advance"
      :disabled="currentStage !== 'start' && currentStage !== 'main'"
      @click="onAdvance"
    >
      <!-- why: stage gating per D-10011 — advanceStage is enabled in
           'start' (advances to main) and 'main' (advances to cleanup).
           In 'cleanup' the End Turn button is the proper exit since it
           does the discard work that advanceStage-from-cleanup skips. -->
      Advance
    </button>
    <button
      type="button"
      data-testid="play-action-end-turn"
      :disabled="currentStage !== 'cleanup'"
      @click="onEndTurn"
    >
      <!-- why: stage gating per WP-100 §Locked contract values — endTurn
           is enabled only in 'cleanup'. -->
      End Turn
    </button>
  </section>
</template>

<style scoped>
.turn-action-bar {
  display: flex;
  gap: 0.5rem;
}

.turn-action-bar button {
  padding: 0.5rem 1rem;
}
</style>
