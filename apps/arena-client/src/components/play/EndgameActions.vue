<script lang="ts">
import { defineComponent, type PropType } from 'vue';

/**
 * Post-match action panel (WP-502 / D-24306).
 *
 * A pure, presentational panel shown once a match is over (the host passes
 * `visible` from `UIState.gameOver`). It offers the arcade-style "Play Again"
 * (relaunch the same loadout — "insert another quarter") and a "Back to Lobby"
 * escape. All behaviour lives in the host (PlayViewport): this component only
 * renders the buttons and calls the injected handlers, mirroring the pure-banner
 * pattern of BotAllyStallBanner / UpdateAvailableBanner.
 *
 * Per the vue-sfc-loader separate-compile constraint (D-6512), this SFC uses the
 * `defineComponent({ ... })` form, not `<script setup>`.
 */
export default defineComponent({
  name: 'EndgameActions',
  props: {
    // why: the match is over — mirrors `UIState.gameOver !== undefined` at the host.
    visible: {
      type: Boolean,
      required: true,
    },
    // why: the players ended the match early (endedEarly marker) — changes the
    // heading copy so an abandoned match doesn't read like a natural finish.
    endedEarly: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: Play Again needs an authenticated account AND the stashed loadout for
    // this match; the host computes this and hides the button when either is
    // missing (a guest, or a player who joined a match they did not create).
    canPlayAgain: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: disables Play Again while the create+join round-trip is in flight so a
    // second click cannot spawn two matches.
    isRelaunching: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: a launch failure message; empty string renders nothing.
    errorMessage: {
      type: String,
      required: false,
      default: '',
    },
    onPlayAgain: {
      type: Function as PropType<() => void>,
      required: true,
    },
    onReturnToLobby: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
});
</script>

<template>
  <div
    v-if="visible"
    class="endgame-actions"
    role="group"
    aria-label="Post-match actions"
    data-testid="play-endgame-actions"
  >
    <p class="endgame-actions__title">
      {{ endedEarly ? 'Match ended early' : 'Match over' }}
    </p>
    <div class="endgame-actions__buttons">
      <button
        v-if="canPlayAgain"
        type="button"
        class="endgame-actions__play-again"
        data-testid="play-action-play-again"
        :disabled="isRelaunching"
        :aria-disabled="isRelaunching ? 'true' : undefined"
        @click="onPlayAgain"
      >
        {{ isRelaunching ? 'Starting…' : '↻ Play Again' }}
      </button>
      <button
        type="button"
        class="endgame-actions__lobby"
        data-testid="play-action-return-lobby"
        @click="onReturnToLobby"
      >
        Back to Lobby
      </button>
    </div>
    <p
      v-if="errorMessage !== ''"
      class="endgame-actions__error"
      role="alert"
      data-testid="play-endgame-actions-error"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>

<style scoped>
/* why: WP-502 — a fixed, prominent call-to-action anchored bottom-center so it is
   the obvious next step on match end across both the desktop and mobile surfaces.
   It sits above the score-submission status toast (z-index 41 > 40). */
.endgame-actions {
  position: fixed;
  bottom: 3.25rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 41;
  max-width: min(92vw, 26rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.6rem;
  background: rgba(20, 20, 28, 0.95);
  color: #f4f4f5;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
  text-align: center;
}

.endgame-actions__title {
  margin: 0;
  font-weight: 700;
  font-size: 1rem;
}

.endgame-actions__buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.endgame-actions__buttons button {
  padding: 0.4rem 0.9rem;
  font-size: 0.9rem;
  border-radius: 0.4rem;
  cursor: pointer;
}

.endgame-actions__play-again {
  background: rgba(21, 94, 61, 0.96);
  color: #f4f4f5;
  border: 1px solid rgba(40, 130, 90, 0.9);
  font-weight: 700;
}

.endgame-actions__play-again:disabled {
  opacity: 0.6;
  cursor: default;
}

.endgame-actions__lobby {
  background: rgba(60, 66, 82, 0.96);
  color: #f4f4f5;
  border: 1px solid rgba(90, 96, 115, 0.9);
}

.endgame-actions__error {
  margin: 0;
  font-size: 0.8rem;
  color: #fca5a5;
}
</style>
