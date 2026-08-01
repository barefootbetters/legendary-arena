<script lang="ts">
import { defineComponent, ref, watch, computed, type PropType } from "vue";
import type { UIPendingReorderChoice } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending reveal-remainder reorder choice
 * (WP-479 / D-24286 — The Amazing Spider-Man's "Put the rest back in any order").
 *
 * Renders iff `pendingReorderChoice !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Shows the revealed remainder face-up; the
 * player clicks the cards in the order they want them placed back on TOP of their
 * deck (first pick = top), then submits `resolveReorderChoice({ orderedCardIds })`
 * — a permutation of the remainder ext_ids.
 *
 * Order is tracked by CARD INDEX (not cardId) so duplicate ext_ids are each
 * orderable independently; the submitted `orderedCardIds` map indices → ext_ids.
 *
 * NOT a modal — the choice is game-blocking and cannot be dismissed.
 * NOT position:fixed. NOT <Teleport>. Renders in normal document flow.
 *
 * Mirrors PendingDiscardChoicePrompt.vue (mirror-not-import). Per D-6512: uses
 * `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-479 §Scope (In) — inline prompt spec
 * @see EC-514 Locked Values — move args, render formula, gate precedence
 * @see DECISIONS.md D-24286
 */
export default defineComponent({
  name: "PendingReorderChoicePrompt",
  props: {
    pendingReorderChoice: {
      type: Object as PropType<UIPendingReorderChoice | undefined>,
      required: false,
      default: undefined,
    },
    viewerPlayerId: {
      // why: null signals a spectator with no assigned playerId; prompt
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
    // why: isSubmitting debounces a same-frame double-click ONLY; selectedOrder
    // holds the in-progress pick order. BOTH must reset on every new server frame —
    // the parent page keeps this component mounted for the whole match (only its
    // inner `v-if` content toggles), so a persistent latch would freeze the next
    // reorder. Each server frame delivers a fresh pendingReorderChoice object;
    // resetting on its identity change re-enables the prompt and recovers from a
    // no-op resubmit. Without this the board stays frozen by the block-all guard.
    const isSubmitting = ref(false);
    const selectedOrder = ref<number[]>([]);
    watch(
      () => props.pendingReorderChoice,
      () => {
        isSubmitting.value = false;
        selectedOrder.value = [];
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingReorderChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingReorderChoice.playerID
      );
    }

    // why: the player must order EVERY remainder card (a full permutation); the
    // engine resolve rejects any submission that is not a permutation of the parked
    // cards, so the submit is enabled only when all cards have been assigned a slot.
    const totalCount = computed<number>(() => {
      if (!props.pendingReorderChoice) return 0;
      return props.pendingReorderChoice.cards.length;
    });

    /** The 1-based order position of a card (its place from the TOP of the deck), or 0 if unpicked. */
    function orderPosition(cardIndex: number): number {
      const at = selectedOrder.value.indexOf(cardIndex);
      return at === -1 ? 0 : at + 1;
    }

    function isSelected(cardIndex: number): boolean {
      return selectedOrder.value.includes(cardIndex);
    }

    function toggleCard(cardIndex: number): void {
      if (isSubmitting.value) return;
      // why: clicking an already-picked card removes it (and its slot) so the player
      // can correct a mis-order; clicking an unpicked card appends it to the order
      // (next-from-top). No over-pick is possible — every card is picked at most once.
      if (selectedOrder.value.includes(cardIndex)) {
        selectedOrder.value = selectedOrder.value.filter((index) => index !== cardIndex);
        return;
      }
      selectedOrder.value = [...selectedOrder.value, cardIndex];
    }

    const canSubmit = computed<boolean>(() => {
      return !isSubmitting.value && selectedOrder.value.length === totalCount.value && totalCount.value > 0;
    });

    function onSubmit(): void {
      if (!canSubmit.value || !props.pendingReorderChoice) return;
      isSubmitting.value = true;
      const cards = props.pendingReorderChoice.cards;
      const orderedCardIds = selectedOrder.value.map((cardIndex) => cards[cardIndex]!.cardId);
      props.submitMove("resolveReorderChoice", { orderedCardIds });
    }

    return {
      isSubmitting,
      selectedOrder,
      shouldRender,
      totalCount,
      orderPosition,
      isSelected,
      toggleCard,
      canSubmit,
      onSubmit,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="pending-reorder-choice-prompt"
    data-testid="pending-reorder-choice-prompt"
    role="region"
    aria-label="Reorder choice"
  >
    <h3 class="pending-reorder-choice-prompt__heading">
      Put the rest back in any order
      <span class="pending-reorder-choice-prompt__hint">
        (click cards top-first)
      </span>
    </h3>
    <div class="pending-reorder-choice-prompt__cards">
      <button
        v-for="(entry, cardIndex) in pendingReorderChoice!.cards"
        :key="`${cardIndex}:${entry.cardId}`"
        type="button"
        class="pending-reorder-choice-prompt__card-btn"
        :class="{ 'pending-reorder-choice-prompt__card-btn--selected': isSelected(cardIndex) }"
        :data-testid="`pending-reorder-choice-card-${cardIndex}`"
        :disabled="isSubmitting"
        :aria-pressed="isSelected(cardIndex) ? 'true' : 'false'"
        :title="entry.display.name"
        @click="toggleCard(cardIndex)"
      >
        <span
          v-if="orderPosition(cardIndex) > 0"
          class="pending-reorder-choice-prompt__order-badge"
          :data-testid="`pending-reorder-choice-order-${cardIndex}`"
        >{{ orderPosition(cardIndex) }}</span>
        <span class="pending-reorder-choice-prompt__card-name">{{ entry.display.name }}</span>
        <img
          v-if="entry.display.imageUrl"
          :src="entry.display.imageUrl"
          :alt="entry.display.name"
          class="pending-reorder-choice-prompt__card-image"
        />
      </button>
    </div>
    <button
      type="button"
      class="pending-reorder-choice-prompt__submit"
      data-testid="pending-reorder-choice-submit"
      :disabled="!canSubmit"
      :aria-disabled="!canSubmit ? 'true' : undefined"
      @click="onSubmit"
    >
      Put back {{ selectedOrder.length }} / {{ totalCount }}
    </button>
  </div>
</template>

<style scoped>
.pending-reorder-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.pending-reorder-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.pending-reorder-choice-prompt__hint {
  font-size: 0.85rem;
  font-weight: normal;
  color: var(--color-text-secondary, #666);
}

.pending-reorder-choice-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.pending-reorder-choice-prompt__card-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  align-items: flex-start;
}

.pending-reorder-choice-prompt__card-btn--selected {
  border-color: var(--color-foreground, #333);
  background: var(--color-accent, #ffe4b5);
  outline: 2px solid var(--color-foreground, #333);
}

.pending-reorder-choice-prompt__card-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pending-reorder-choice-prompt__order-badge {
  position: absolute;
  top: -0.4rem;
  left: -0.4rem;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 0.2rem;
  border-radius: 999px;
  background: var(--color-foreground, #333);
  color: var(--color-background, #fff);
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.1rem;
  text-align: center;
}

.pending-reorder-choice-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 60px;
}

.pending-reorder-choice-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}

.pending-reorder-choice-prompt__submit {
  align-self: flex-start;
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--color-foreground, #333);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-weight: 600;
}

.pending-reorder-choice-prompt__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
