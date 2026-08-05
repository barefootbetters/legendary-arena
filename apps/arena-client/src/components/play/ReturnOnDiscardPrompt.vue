<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingReturnOnDiscard } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending OPTIONAL return-on-discard choice
 * ("If a card effect makes you discard this card, you may return this card to
 * your hand" — Cyclops Unending Energy, WP-498 / D-24301).
 *
 * Renders iff `pendingReturnOnDiscard !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Lists the single just-discarded card as a
 * Return button, plus a first-class **Decline** button (the ability is optional —
 * "you may…").
 *
 * Selecting the card submits `resolveReturnOnDiscard({ cardId })`; Decline submits
 * `resolveReturnOnDiscard({ decline: true })`.
 *
 * // why: NON-DISMISSIBLE while the choice is pending. The choice is game-blocking
 * (the engine's advanceStage block-all guard freezes turn-end until it resolves); the
 * only exits are returning the card or pressing Decline. NOT a modal, NOT position:fixed,
 * NOT <Teleport> — renders in normal document flow above TurnActionBar, mirroring
 * OptionalPutBottomHQPrompt.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: "ReturnOnDiscardPrompt",
  props: {
    pendingReturnOnDiscard: {
      type: Object as PropType<UIPendingReturnOnDiscard | undefined>,
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
    // resolveReturnOnDiscard twice for one choice. It clears on every new server frame
    // (a fresh pendingReturnOnDiscard object identity), because the parent page keeps this
    // component mounted for the whole match — a persistent latch would freeze the controls.
    // A stale resubmit is engine-no-op'd, but the client must not fire twice.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingReturnOnDiscard,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingReturnOnDiscard !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingReturnOnDiscard.playerID
      );
    }

    function onReturn(cardId: string): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveReturnOnDiscard", { cardId });
    }

    function onDecline(): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveReturnOnDiscard", { decline: true });
    }

    return {
      isSubmitting,
      shouldRender,
      onReturn,
      onDecline,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="return-on-discard-prompt"
    data-testid="return-on-discard-prompt"
    role="region"
    aria-label="Return the discarded card to your hand"
  >
    <h3 class="return-on-discard-prompt__heading">
      Return this card to your hand?
    </h3>
    <div class="return-on-discard-prompt__cards">
      <button
        v-for="card in pendingReturnOnDiscard!.eligibleReturnCards"
        :key="card.cardId"
        type="button"
        class="return-on-discard-prompt__card-btn"
        :data-testid="`return-on-discard-card-${card.cardId}`"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        :title="card.display.name"
        @click="onReturn(card.cardId)"
      >
        <span class="return-on-discard-prompt__card-name">Return {{ card.display.name }}</span>
        <img
          v-if="card.display.imageUrl"
          :src="card.display.imageUrl"
          :alt="card.display.name"
          class="return-on-discard-prompt__card-image"
        />
      </button>
    </div>
    <!-- why: WP-498 / D-24301 — Decline is always offered; the printed text is
         "you MAY return this card", so there is no mandatory form. Declining leaves
         the card in the discard pile. -->
    <button
      type="button"
      class="return-on-discard-prompt__decline-btn"
      data-testid="return-on-discard-decline"
      :disabled="isSubmitting"
      :aria-disabled="isSubmitting ? 'true' : undefined"
      @click="onDecline"
    >
      Decline
    </button>
  </div>
</template>

<style scoped>
.return-on-discard-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.return-on-discard-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.return-on-discard-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.return-on-discard-prompt__card-btn {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  align-items: flex-start;
}

.return-on-discard-prompt__card-btn:disabled,
.return-on-discard-prompt__decline-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.return-on-discard-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 80px;
}

.return-on-discard-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}

.return-on-discard-prompt__decline-btn {
  align-self: flex-start;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}
</style>
