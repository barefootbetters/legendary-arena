<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingDiscardToPlay } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending discard-to-play cost
 * ("To play this card, you must discard a card from your hand" — Cyclops
 * Determination/Optic Blast + siblings, WP-383 / D-24184).
 *
 * Renders iff `pendingDiscardToPlay !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Lists the player's whole hand, each as a
 * button showing the card name (and image). There is NO Decline button — the
 * printed text has no "you may", so the cost is mandatory (the engine rejects
 * any decline-style payload; payability was pre-guaranteed before the play
 * committed, so an eligible card always exists).
 *
 * Selecting a card submits `resolveDiscardToPlay({ cardId })`. For multi-discard
 * cards (remaining > 1) the prompt stays up, decrementing, until the cost is paid.
 *
 * // why: NON-DISMISSIBLE while the choice is pending. The choice is game-blocking
 * (the engine's block-all guards freeze the board until it resolves); the only exit is
 * discarding a card. NOT a modal, NOT position:fixed, NOT <Teleport> — renders in
 * normal document flow above TurnActionBar, mirroring ReturnZeroCostDiscardPrompt.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: "DiscardToPlayPrompt",
  props: {
    pendingDiscardToPlay: {
      type: Object as PropType<UIPendingDiscardToPlay | undefined>,
      required: false,
      default: undefined,
    },
    viewerPlayerId: {
      // why: null signals a spectator with no assigned playerId; the prompt
      // must not render in that case.
      type: [String, null] as unknown as PropType<string | null>,
      required: true,
    },
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
  },
  setup(props) {
    // why: isSubmitting debounces the controls after a submit so the prompt never fires
    // resolveDiscardToPlay twice for one discard. It clears on every new server frame (a
    // fresh pendingDiscardToPlay object identity), because the parent page keeps this
    // component mounted for the whole match — a persistent latch would freeze the
    // controls. A stale resubmit is engine-no-op'd, but the client must not fire twice.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingDiscardToPlay,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingDiscardToPlay !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingDiscardToPlay.playerID
      );
    }

    function onPick(cardId: string): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveDiscardToPlay", { cardId });
    }

    return {
      isSubmitting,
      shouldRender,
      onPick,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="discard-to-play-prompt"
    data-testid="discard-to-play-prompt"
    role="region"
    aria-label="Discard a card from your hand to play this card"
  >
    <h3 class="discard-to-play-prompt__heading">
      Discard a card from your hand to play this card
      <span
        v-if="pendingDiscardToPlay!.remaining > 1"
        class="discard-to-play-prompt__remaining"
      >({{ pendingDiscardToPlay!.remaining }} remaining)</span>
    </h3>
    <div class="discard-to-play-prompt__cards">
      <button
        v-for="card in pendingDiscardToPlay!.eligibleDiscardCards"
        :key="card.cardId"
        type="button"
        class="discard-to-play-prompt__card-btn"
        :data-testid="`discard-to-play-card-${card.cardId}`"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        :title="card.display.name"
        @click="onPick(card.cardId)"
      >
        <span class="discard-to-play-prompt__card-name">{{ card.display.name }}</span>
        <img
          v-if="card.display.imageUrl"
          :src="card.display.imageUrl"
          :alt="card.display.name"
          class="discard-to-play-prompt__card-image"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.discard-to-play-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.discard-to-play-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.discard-to-play-prompt__remaining {
  font-weight: 400;
  opacity: 0.8;
}

.discard-to-play-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.discard-to-play-prompt__card-btn {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  align-items: flex-start;
}

.discard-to-play-prompt__card-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.discard-to-play-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 60px;
}

.discard-to-play-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}
</style>
