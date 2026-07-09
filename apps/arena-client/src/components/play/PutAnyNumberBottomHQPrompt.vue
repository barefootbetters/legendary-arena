<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingPutAnyNumberBottomHQ } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending put-any-number-bottom-hq choice ("Choose any number of
 * cards/Heroes from the HQ. Put them on the bottom of the Hero Deck" — Wonder Man's 8th Wonder
 * of the World, Sunspot's Empyreal Force, Star-Lord (T'Challa)'s Colliding Dreams). The
 * MULTI-select sibling of OptionalPutBottomHQPrompt (D-24132).
 *
 * Renders iff `pendingPutAnyNumberBottomHQ !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Lists the eligible HQ cards, each as a TOGGLE button
 * (any number may be selected — including zero), plus a **Confirm** button that submits the
 * current selection and a **Put None** button that submits an empty selection.
 *
 * Confirm submits `resolvePutAnyNumberBottomHQ({ cardIds: [...selected] })`; Put None submits
 * `resolvePutAnyNumberBottomHQ({ cardIds: [] })`.
 *
 * // why: NON-DISMISSIBLE while the choice is pending. The choice is game-blocking (the engine's
 * advanceStage block-all guard freezes turn-end until it resolves); the only exits are Confirm
 * (with any selection, possibly empty) or Put None. NOT a modal, NOT position:fixed, NOT
 * <Teleport> — renders in normal document flow above TurnActionBar, mirroring
 * OptionalPutBottomHQPrompt.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: "PutAnyNumberBottomHQPrompt",
  props: {
    pendingPutAnyNumberBottomHQ: {
      type: Object as PropType<UIPendingPutAnyNumberBottomHQ | undefined>,
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
    // why: the set of currently-toggled HQ card ids. A plain reactive Set of strings; toggled
    // by onToggle, read by Confirm. Cleared on every new server frame (a fresh
    // pendingPutAnyNumberBottomHQ object identity) so a resolved choice does not leave stale
    // selections latched for the next one.
    const selectedCardIds = ref<Set<string>>(new Set());

    // why: isSubmitting debounces the controls after a submit so the prompt never fires
    // resolvePutAnyNumberBottomHQ twice for one choice. It clears on every new server frame
    // (a fresh pendingPutAnyNumberBottomHQ object identity), because the parent page keeps this
    // component mounted for the whole match — a persistent latch would freeze the controls. A
    // stale resubmit is engine-no-op'd, but the client must not fire twice.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingPutAnyNumberBottomHQ,
      () => {
        isSubmitting.value = false;
        selectedCardIds.value = new Set();
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingPutAnyNumberBottomHQ !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingPutAnyNumberBottomHQ.playerID
      );
    }

    function isSelected(cardId: string): boolean {
      return selectedCardIds.value.has(cardId);
    }

    function onToggle(cardId: string): void {
      if (isSubmitting.value) return;
      // why: reassign a fresh Set so Vue's ref reactivity fires (mutating a Set in place does
      // not trigger a ref update). Keeps the toggle idempotent and the template in sync.
      const next = new Set(selectedCardIds.value);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      selectedCardIds.value = next;
    }

    function onConfirm(): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolvePutAnyNumberBottomHQ", {
        cardIds: [...selectedCardIds.value],
      });
    }

    function onPutNone(): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolvePutAnyNumberBottomHQ", { cardIds: [] });
    }

    return {
      selectedCardIds,
      isSubmitting,
      shouldRender,
      isSelected,
      onToggle,
      onConfirm,
      onPutNone,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="put-any-number-hq-prompt"
    data-testid="put-any-number-hq-prompt"
    role="region"
    aria-label="Choose any number of cards from the HQ to put on the bottom of the Hero Deck"
  >
    <h3 class="put-any-number-hq-prompt__heading">
      Choose any number of cards from the HQ to put on the bottom of the Hero Deck
    </h3>
    <div class="put-any-number-hq-prompt__cards">
      <button
        v-for="card in pendingPutAnyNumberBottomHQ!.eligibleHqCards"
        :key="card.cardId"
        type="button"
        class="put-any-number-hq-prompt__card-btn"
        :class="{ 'put-any-number-hq-prompt__card-btn--selected': isSelected(card.cardId) }"
        :data-testid="`put-any-number-hq-card-${card.cardId}`"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        :aria-pressed="isSelected(card.cardId) ? 'true' : 'false'"
        :title="card.display.name"
        @click="onToggle(card.cardId)"
      >
        <span class="put-any-number-hq-prompt__card-name">{{ card.display.name }}</span>
        <img
          v-if="card.display.imageUrl"
          :src="card.display.imageUrl"
          :alt="card.display.name"
          class="put-any-number-hq-prompt__card-image"
        />
      </button>
    </div>
    <div class="put-any-number-hq-prompt__actions">
      <button
        type="button"
        class="put-any-number-hq-prompt__confirm-btn"
        data-testid="put-any-number-hq-confirm"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onConfirm"
      >
        Put {{ selectedCardIds.size }} on Bottom
      </button>
      <button
        type="button"
        class="put-any-number-hq-prompt__put-none-btn"
        data-testid="put-any-number-hq-put-none"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onPutNone"
      >
        Put None
      </button>
    </div>
  </div>
</template>

<style scoped>
.put-any-number-hq-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.put-any-number-hq-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.put-any-number-hq-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.put-any-number-hq-prompt__card-btn {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  align-items: flex-start;
}

.put-any-number-hq-prompt__card-btn--selected {
  border-color: var(--color-foreground, #333);
  outline: 2px solid var(--color-foreground, #333);
  background: var(--color-selected-bg, #e0e8ff);
}

.put-any-number-hq-prompt__card-btn:disabled,
.put-any-number-hq-prompt__confirm-btn:disabled,
.put-any-number-hq-prompt__put-none-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.put-any-number-hq-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 60px;
}

.put-any-number-hq-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}

.put-any-number-hq-prompt__actions {
  display: flex;
  gap: 0.4rem;
}

.put-any-number-hq-prompt__confirm-btn,
.put-any-number-hq-prompt__put-none-btn {
  align-self: flex-start;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}
</style>
