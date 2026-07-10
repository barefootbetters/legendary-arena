<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingReturnZeroCostDiscard } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending return-zero-cost-discard choice
 * ("Return a 0-cost card from your discard pile to your hand" — Black Knight's
 * Defend the Weak, D-24139).
 *
 * Renders iff `pendingReturnZeroCostDiscard !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Lists the eligible 0-cost discard cards, each as
 * a button showing the card name (and image). There is NO Decline button — the printed
 * text has no "you may", so the choice is mandatory (the engine rejects any decline-style
 * payload).
 *
 * Selecting a card submits `resolveReturnZeroCostDiscard({ cardId })`.
 *
 * // why: NON-DISMISSIBLE while the choice is pending. The choice is game-blocking
 * (the engine's block-all guards freeze the board until it resolves); the only exit is
 * picking an eligible card. NOT a modal, NOT position:fixed, NOT <Teleport> — renders in
 * normal document flow above TurnActionBar, mirroring OptionalPutBottomHQPrompt.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: "ReturnZeroCostDiscardPrompt",
  props: {
    pendingReturnZeroCostDiscard: {
      type: Object as PropType<UIPendingReturnZeroCostDiscard | undefined>,
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
    // resolveReturnZeroCostDiscard twice for one choice. It clears on every new server
    // frame (a fresh pendingReturnZeroCostDiscard object identity), because the parent
    // page keeps this component mounted for the whole match — a persistent latch would
    // freeze the controls. A stale resubmit is engine-no-op'd, but the client must not
    // fire twice.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingReturnZeroCostDiscard,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingReturnZeroCostDiscard !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingReturnZeroCostDiscard.playerID
      );
    }

    function onPick(cardId: string): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveReturnZeroCostDiscard", { cardId });
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
    class="return-zero-cost-prompt"
    data-testid="return-zero-cost-prompt"
    role="region"
    aria-label="Return a 0-cost card from your discard pile to your hand"
  >
    <h3 class="return-zero-cost-prompt__heading">
      Return a 0-cost card from your discard pile to your hand
    </h3>
    <div class="return-zero-cost-prompt__cards">
      <button
        v-for="card in pendingReturnZeroCostDiscard!.eligibleDiscardCards"
        :key="card.cardId"
        type="button"
        class="return-zero-cost-prompt__card-btn"
        :data-testid="`return-zero-cost-card-${card.cardId}`"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        :title="card.display.name"
        @click="onPick(card.cardId)"
      >
        <span class="return-zero-cost-prompt__card-name">{{ card.display.name }}</span>
        <img
          v-if="card.display.imageUrl"
          :src="card.display.imageUrl"
          :alt="card.display.name"
          class="return-zero-cost-prompt__card-image"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.return-zero-cost-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.return-zero-cost-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.return-zero-cost-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.return-zero-cost-prompt__card-btn {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  align-items: flex-start;
}

.return-zero-cost-prompt__card-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.return-zero-cost-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 60px;
}

.return-zero-cost-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}
</style>
