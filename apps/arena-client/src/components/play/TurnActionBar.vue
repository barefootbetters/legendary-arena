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
    handCount: {
      // why: per D-10013, the Draw button computes `count` from the
      // current hand size to cap the hand at 6 cards (Legendary's
      // standard hand size). Without this, two clicks = 12 cards
      // (illegal in tabletop Legendary). The engine's drawCards move
      // has no HAND_SIZE check; the cap is enforced UI-side.
      type: Number,
      required: true,
    },
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
  },
  setup(props) {
    /**
     * Emit a `drawCards` intent that fills the hand to exactly 6 cards.
     * Computes `count = max(0, 6 - handCount)` so the button is
     * idempotent — re-clicking with a full hand is a no-op.
     */
    function onDraw(): void {
      // why: count is dynamic per D-10013 — fills to 6 cards exactly,
      // capping at Legendary's standard hand size. The engine's
      // drawCards move has no HAND_SIZE check, so without this UI-side
      // cap, repeated clicks produced illegal hand sizes (12, 18, ...).
      // The original D-10003 hardcoded count: 6 was correct only on
      // initial draw (when hand=0); D-10013 generalizes to any hand
      // size. This Draw button remains a SCAFFOLD ARTIFACT per WP-100
      // §Constraints — it exists only because the engine has no
      // automatic turn-start draw. When a follow-up engine WP adds
      // `turn.onBegin` auto-draw to a canonical HAND_SIZE constant,
      // both this button AND the handCount-based cap are DELETED, not
      // refactored. See DECISIONS.md D-10003 + D-10013.
      const cardsToDraw = Math.max(0, 6 - props.handCount);
      if (cardsToDraw === 0) return;
      props.submitMove('drawCards', { count: cardsToDraw });
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
      :disabled="(currentStage !== 'start' && currentStage !== 'main') || handCount >= 6"
      @click="onDraw"
    >
      <!-- why: stage gating per WP-100 §Locked contract values — drawCards
           is enabled in 'start' or 'main'. Per D-10013, also disabled when
           handCount >= 6 so the button is idempotent and prevents illegal
           hand sizes from repeated clicks. -->
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
