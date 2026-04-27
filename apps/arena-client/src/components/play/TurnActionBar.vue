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
     * Emit a `revealVillainCard` intent. The engine pops a card from the
     * villain deck and places it in the City (or applies scheme-twist /
     * mastermind-strike effects per the rule pipeline). Gated to
     * `start` stage by the engine.
     */
    function onReveal(): void {
      // why: empty-object payload — revealVillainCard takes no arguments
      // by engine design (see villainDeck.reveal.ts). Per D-10012, this
      // button surfaces villain reveal that the original WP-100
      // vocabulary excluded as "internal." Without it, the City stays
      // empty after match start and fightVillain has nothing to target.
      // In tabletop Legendary this happens automatically at the start
      // of each turn; the engine MVP requires a manual call. When a
      // future engine WP wires `turn.onBegin` to auto-reveal, this
      // button is DELETED, not refactored — same scaffold-artifact
      // policy as the Draw button (D-10003).
      props.submitMove('revealVillainCard', {});
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

    return { onDraw, onReveal, onAdvance, onEndTurn };
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
      data-testid="play-action-reveal"
      :disabled="currentStage !== 'start'"
      @click="onReveal"
    >
      <!-- why: stage gating per D-10012 — revealVillainCard is enabled in
           'start' only (engine gating per coreMoves.types.ts). The City
           starts empty after match setup; this button populates it so
           fightVillain has a target. Future engine WP that wires
           turn.onBegin to auto-reveal makes this button obsolete (same
           scaffold-artifact policy as Draw per D-10003). -->
      Reveal
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
