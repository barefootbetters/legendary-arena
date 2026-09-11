<script lang="ts">
import { defineComponent, ref, watch, type PropType } from 'vue';
import type { SubmitMove } from './uiMoveName.types';

/**
 * The "End Game for everyone" escape hatch (engine `endMatchEarly`, WP-502 /
 * D-24306). Extracted out of `<TurnActionBar>` (Jeff feedback) so it can live in
 * the top ribbon beside the Mastermind rather than under the three turn steps —
 * ending the match is a table-level concern (e.g. a co-op group ran out of time),
 * not a turn step.
 *
 * Two-click confirm (request → confirm) rather than a native `window.confirm`, so
 * the confirmation is part of the component's own DOM (testable, styleable).
 * Ending the match is irreversible and closes it out for every seat, so it must
 * never fire on a single stray click.
 *
 * Shown only on the viewer's turn: only the current player's move applies
 * (boardgame.io gates top-level moves to the active player), so a control on
 * another seat's turn would be a dead button.
 *
 * Per the EC-132 §2 SFC authoring whitelist: this is a tested component with
 * local reactive state, so it MUST use `defineComponent({ setup() {...} })`.
 *
 * @see WP-502 / D-24306 — endMatchEarly two-click confirm
 */
export default defineComponent({
  name: 'EndGameControl',
  props: {
    // why: only the active player's endMatchEarly applies; the control is hidden
    // otherwise. Defaults false so an audience / spectator mount never shows it.
    isViewerTurn: {
      type: Boolean,
      required: false,
      default: false,
    },
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
  },
  setup(props) {
    // why: WP-502 / D-24306 — the confirm affordance is a two-step latch so an
    // irreversible match-end never fires on a single stray click.
    const isConfirmingEndGame = ref(false);

    function requestEndGame(): void {
      isConfirmingEndGame.value = true;
    }

    function cancelEndGame(): void {
      isConfirmingEndGame.value = false;
    }

    function confirmEndGame(): void {
      // why: WP-502 / D-24306 — empty-object payload; the endMatchEarly move takes
      // no arguments. It latches MATCH_ENDED_EARLY so the engine's endIf ends the
      // match (an endedEarly tie) for ALL seats on the next frame.
      props.submitMove('endMatchEarly', {});
      isConfirmingEndGame.value = false;
    }

    // why: WP-502 — the confirm affordance is hidden (not unmounted) between the
    // viewer's turns via `v-if="isViewerTurn"`, so a confirm left un-actioned would
    // survive to the viewer's NEXT turn and render the armed "Yes, end it" button
    // first — a single stray click could then end the match. Re-arm to the safe
    // (un-confirming) state whenever it stops being the viewer's turn.
    watch(
      () => props.isViewerTurn,
      (isViewerTurn) => {
        if (!isViewerTurn) {
          isConfirmingEndGame.value = false;
        }
      },
    );

    return {
      isConfirmingEndGame,
      requestEndGame,
      cancelEndGame,
      confirmEndGame,
    };
  },
});
</script>

<template>
  <div
    v-if="isViewerTurn"
    class="end-game-control"
    data-testid="play-end-game"
  >
    <template v-if="!isConfirmingEndGame">
      <span class="end-game-control__label">Out of time?</span>
      <button
        type="button"
        class="end-game-control__request"
        data-testid="play-action-end-game"
        title="End the match now for every player (e.g. your group ran out of time). This closes the game out for everyone."
        @click="requestEndGame"
      >
        ⏹ End Game for everyone
      </button>
    </template>
    <template v-else>
      <span class="end-game-control__prompt">End the match for everyone?</span>
      <button
        type="button"
        class="end-game-control__confirm"
        data-testid="play-action-end-game-confirm"
        @click="confirmEndGame"
      >
        Yes, end it
      </button>
      <button
        type="button"
        class="end-game-control__cancel"
        data-testid="play-action-end-game-cancel"
        @click="cancelEndGame"
      >
        Keep playing
      </button>
    </template>
  </div>
</template>

<style scoped>
/* why: WP-502 (discoverability follow-up) — the End Game control must be
   de-emphasized relative to the primary turn actions but still clearly a button a
   player can find when their group runs out of time. It reads as a real outlined
   button with a lead-in label; the confirm button is tinted danger-red to signal
   irreversibility. */
.end-game-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.end-game-control button {
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.end-game-control__label {
  font-weight: 600;
  opacity: 0.85;
}

.end-game-control__request {
  border: 1px solid rgba(160, 60, 60, 0.8);
  border-radius: 0.3rem;
  background: rgba(120, 40, 40, 0.12);
  color: var(--color-foreground, #7a2828);
  font-weight: 600;
}

.end-game-control__request:hover {
  background: rgba(120, 40, 40, 0.22);
}

.end-game-control__prompt {
  font-weight: 700;
}

.end-game-control__confirm {
  background: rgba(120, 40, 40, 0.94);
  color: #f4f4f5;
  border: 1px solid rgba(160, 60, 60, 0.9);
  border-radius: 0.3rem;
}

.end-game-control__cancel {
  border-radius: 0.3rem;
}
</style>
