<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingPutHandOnDeckTop } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending "put a card from your hand on top of your
 * deck" choice (Gambit's Stack the Deck, Brainstorm's Time Loop Experiments, and the
 * dstr/wpnx/wtif siblings — the `put-hand-on-deck-top` keyword, WP-700 / D-24519).
 *
 * Renders iff `pendingPutHandOnDeckTop !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Lists the player's whole (post-draw) hand, each
 * as a button showing the card name (and image). There is NO Decline button — the
 * printed text is "put a card…", not "you may", so the placement is mandatory (the
 * engine rejects any decline-style payload; the handler only parks when the hand is
 * non-empty, so an eligible card always exists).
 *
 * Selecting a card submits `resolvePutHandOnDeckTop({ cardId })`; the engine moves the
 * card to the top of the player's deck.
 *
 * // why: NON-DISMISSIBLE while the choice is pending. The choice is game-blocking (the
 * engine's block-all guards freeze the board until it resolves); the only exit is placing
 * a card on top. NOT a modal, NOT position:fixed, NOT <Teleport> — renders in normal
 * document flow above TurnActionBar, mirroring DiscardToPlayPrompt.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: "PutHandOnDeckTopPrompt",
  props: {
    pendingPutHandOnDeckTop: {
      type: Object as PropType<UIPendingPutHandOnDeckTop | undefined>,
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
    // resolvePutHandOnDeckTop twice for one placement. It clears on every new server frame
    // (a fresh pendingPutHandOnDeckTop object identity), because the parent page keeps this
    // component mounted for the whole match — a persistent latch would freeze the controls.
    // A stale resubmit is engine-no-op'd, but the client must not fire twice.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingPutHandOnDeckTop,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingPutHandOnDeckTop !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingPutHandOnDeckTop.playerID
      );
    }

    function onPick(cardId: string): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolvePutHandOnDeckTop", { cardId });
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
    class="put-hand-on-deck-top-prompt"
    data-testid="put-hand-on-deck-top-prompt"
    role="region"
    aria-label="Put a card from your hand on top of your deck"
  >
    <h3 class="put-hand-on-deck-top-prompt__heading">
      Put a card from your hand on top of your deck
    </h3>
    <div class="put-hand-on-deck-top-prompt__cards">
      <button
        v-for="card in pendingPutHandOnDeckTop!.eligibleHand"
        :key="card.cardId"
        type="button"
        class="put-hand-on-deck-top-prompt__card-btn"
        :data-testid="`put-hand-on-deck-top-card-${card.cardId}`"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        :title="card.display.name"
        @click="onPick(card.cardId)"
      >
        <span class="put-hand-on-deck-top-prompt__card-name">{{ card.display.name }}</span>
        <img
          v-if="card.display.imageUrl"
          :src="card.display.imageUrl"
          :alt="card.display.name"
          class="put-hand-on-deck-top-prompt__card-image"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.put-hand-on-deck-top-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.put-hand-on-deck-top-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.put-hand-on-deck-top-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.put-hand-on-deck-top-prompt__card-btn {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  align-items: flex-start;
}

.put-hand-on-deck-top-prompt__card-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.put-hand-on-deck-top-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 60px;
}

.put-hand-on-deck-top-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}
</style>
