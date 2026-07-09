<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingOptionalPutBottomHQ } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending optional-put-bottom-hq choice
 * ("You may put a card from the HQ on the bottom of the Hero Deck" — Wonder Man's
 * Ionic Energy).
 *
 * Renders iff `pendingOptionalPutBottomHQ !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Lists the eligible HQ cards, each as a button
 * showing the card name (and image), plus a first-class **Decline** button (the ability
 * is optional — "You may…").
 *
 * Selecting a card submits `resolveOptionalPutBottomHQ({ cardId })`; Decline submits
 * `resolveOptionalPutBottomHQ({ decline: true })`.
 *
 * // why: NON-DISMISSIBLE while the choice is pending. The choice is game-blocking
 * (the engine's advanceStage block-all guard freezes turn-end until it resolves); the
 * only exits are picking an HQ card or pressing Decline. NOT a modal, NOT position:fixed,
 * NOT <Teleport> — renders in normal document flow above TurnActionBar, mirroring
 * VictoryPileCardPickPrompt / OptionalKoRewardPrompt.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: "OptionalPutBottomHQPrompt",
  props: {
    pendingOptionalPutBottomHQ: {
      type: Object as PropType<UIPendingOptionalPutBottomHQ | undefined>,
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
    // resolveOptionalPutBottomHQ twice for one choice. It clears on every new server frame
    // (a fresh pendingOptionalPutBottomHQ object identity), because the parent page keeps
    // this component mounted for the whole match — a persistent latch would freeze the
    // controls. A stale resubmit is engine-no-op'd, but the client must not fire twice.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingOptionalPutBottomHQ,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingOptionalPutBottomHQ !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingOptionalPutBottomHQ.playerID
      );
    }

    function onPick(cardId: string): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveOptionalPutBottomHQ", { cardId });
    }

    function onDecline(): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveOptionalPutBottomHQ", { decline: true });
    }

    return {
      isSubmitting,
      shouldRender,
      onPick,
      onDecline,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="put-bottom-hq-prompt"
    data-testid="put-bottom-hq-prompt"
    role="region"
    aria-label="Put a card from the HQ on the bottom of the Hero Deck"
  >
    <h3 class="put-bottom-hq-prompt__heading">
      Put a card from the HQ on the bottom of the Hero Deck
    </h3>
    <div class="put-bottom-hq-prompt__cards">
      <button
        v-for="card in pendingOptionalPutBottomHQ!.eligibleHqCards"
        :key="card.cardId"
        type="button"
        class="put-bottom-hq-prompt__card-btn"
        :data-testid="`put-bottom-hq-card-${card.cardId}`"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        :title="card.display.name"
        @click="onPick(card.cardId)"
      >
        <span class="put-bottom-hq-prompt__card-name">{{ card.display.name }}</span>
        <img
          v-if="card.display.imageUrl"
          :src="card.display.imageUrl"
          :alt="card.display.name"
          class="put-bottom-hq-prompt__card-image"
        />
      </button>
    </div>
    <!-- why: D-24133 — Decline is offered only for the OPTIONAL form ("You may put
         a card…", Ionic Energy). The MANDATORY form (Absorb Ambient Power) hides it
         so the player cannot no-op a required choice (the engine also rejects a
         decline while front.mandatory is set). -->
    <button
      v-if="!pendingOptionalPutBottomHQ!.mandatory"
      type="button"
      class="put-bottom-hq-prompt__decline-btn"
      data-testid="put-bottom-hq-decline"
      :disabled="isSubmitting"
      :aria-disabled="isSubmitting ? 'true' : undefined"
      @click="onDecline"
    >
      Decline
    </button>
  </div>
</template>

<style scoped>
.put-bottom-hq-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.put-bottom-hq-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.put-bottom-hq-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.put-bottom-hq-prompt__card-btn {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  align-items: flex-start;
}

.put-bottom-hq-prompt__card-btn:disabled,
.put-bottom-hq-prompt__decline-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.put-bottom-hq-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 60px;
}

.put-bottom-hq-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}

.put-bottom-hq-prompt__decline-btn {
  align-self: flex-start;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}
</style>
