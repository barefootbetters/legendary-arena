<script lang="ts">
import { defineComponent, ref, watch, computed, type PropType } from "vue";
import type { UIPendingPutCardsOnDeckChoice } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending put-cards-on-deck choice (WP-538 / D-24347).
 *
 * Renders iff `pendingPutCardsOnDeckChoice !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Shows the chooser's hand; the player picks
 * exactly `count` cards IN TOP ORDER (the first picked ends up on top of the deck,
 * drawn first) and submits `resolvePutCardsOnDeckChoice({ cardIds })`.
 *
 * Selection is tracked by HAND INDEX in pick order (not cardId) so duplicate ext_ids
 * in hand are each selectable independently AND the pick order becomes the deck-top
 * order; the submitted `cardIds` map indices → ext_ids in that order.
 *
 * NOT a modal — the choice is game-blocking and cannot be dismissed.
 * NOT position:fixed. NOT <Teleport>. Renders in normal document flow.
 *
 * Mirrors PendingDiscardChoicePrompt.vue (mirror-not-import). Per D-6512: uses
 * `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-538 §Scope (In) — inline prompt spec
 * @see EC-573 Locked Values — move args, render formula, gate precedence
 * @see DECISIONS.md D-24347
 */
export default defineComponent({
  name: "PendingPutCardsOnDeckChoicePrompt",
  props: {
    pendingPutCardsOnDeckChoice: {
      type: Object as PropType<UIPendingPutCardsOnDeckChoice | undefined>,
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
    // why: isSubmitting debounces a same-frame double-click ONLY; selectedIndices
    // holds the in-progress selection in PICK ORDER (= deck-top order). BOTH must
    // reset on every new server frame — the parent page keeps this component mounted
    // for the whole match (only its inner `v-if` content toggles), so a persistent
    // latch would freeze the next choice. Each server frame delivers a fresh
    // pendingPutCardsOnDeckChoice object; resetting on its identity change re-enables
    // the prompt and recovers from a no-op resubmit. Without this the board stays
    // frozen by the block-all guard with no way to act.
    const isSubmitting = ref(false);
    const selectedIndices = ref<number[]>([]);
    watch(
      () => props.pendingPutCardsOnDeckChoice,
      () => {
        isSubmitting.value = false;
        selectedIndices.value = [];
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingPutCardsOnDeckChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingPutCardsOnDeckChoice.playerID
      );
    }

    // why: the player must put EXACTLY `count` cards on top. The engine resolve
    // rejects any other count.
    const requiredCount = computed<number>(() => {
      if (!props.pendingPutCardsOnDeckChoice) return 0;
      return props.pendingPutCardsOnDeckChoice.count;
    });

    function isSelected(handIndex: number): boolean {
      return selectedIndices.value.includes(handIndex);
    }

    // why: the pick ORDER is the deck-top order — the position badge shows which
    // card ends up on top (1 = top / drawn first).
    function selectionPosition(handIndex: number): number {
      return selectedIndices.value.indexOf(handIndex) + 1;
    }

    function toggleCard(handIndex: number): void {
      if (isSubmitting.value) return;
      if (selectedIndices.value.includes(handIndex)) {
        selectedIndices.value = selectedIndices.value.filter((index) => index !== handIndex);
        return;
      }
      // why: never let the player over-select — once the required count is picked,
      // further picks are ignored so the submitted count always matches exactly.
      if (selectedIndices.value.length >= requiredCount.value) return;
      selectedIndices.value = [...selectedIndices.value, handIndex];
    }

    const canSubmit = computed<boolean>(() => {
      return !isSubmitting.value && selectedIndices.value.length === requiredCount.value;
    });

    function onSubmit(): void {
      if (!canSubmit.value || !props.pendingPutCardsOnDeckChoice) return;
      isSubmitting.value = true;
      const hand = props.pendingPutCardsOnDeckChoice.hand;
      // why: selectedIndices is in PICK ORDER, so cardIds[0] is the card the player
      // picked first — it ends up on top of the deck (drawn first).
      const cardIds = selectedIndices.value.map((handIndex) => hand[handIndex]!.cardId);
      props.submitMove("resolvePutCardsOnDeckChoice", { cardIds });
    }

    return {
      isSubmitting,
      selectedIndices,
      shouldRender,
      requiredCount,
      isSelected,
      selectionPosition,
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
    class="pending-put-cards-on-deck-choice-prompt"
    data-testid="pending-put-cards-on-deck-choice-prompt"
    role="region"
    aria-label="Put cards on deck choice"
  >
    <h3 class="pending-put-cards-on-deck-choice-prompt__heading">
      Choose {{ requiredCount }} card{{ requiredCount === 1 ? '' : 's' }} to put on top of your deck
      <span class="pending-put-cards-on-deck-choice-prompt__hint">
        (first picked ends up on top)
      </span>
    </h3>
    <div class="pending-put-cards-on-deck-choice-prompt__cards">
      <button
        v-for="(entry, handIndex) in pendingPutCardsOnDeckChoice!.hand"
        :key="`${handIndex}:${entry.cardId}`"
        type="button"
        class="pending-put-cards-on-deck-choice-prompt__card-btn"
        :class="{ 'pending-put-cards-on-deck-choice-prompt__card-btn--selected': isSelected(handIndex) }"
        :data-testid="`pending-put-cards-on-deck-card-${handIndex}`"
        :disabled="isSubmitting"
        :aria-pressed="isSelected(handIndex) ? 'true' : 'false'"
        :title="entry.display.name"
        @click="toggleCard(handIndex)"
      >
        <span
          v-if="isSelected(handIndex)"
          class="pending-put-cards-on-deck-choice-prompt__position"
          :aria-label="`Position ${selectionPosition(handIndex)} from top`"
        >{{ selectionPosition(handIndex) }}</span>
        <span class="pending-put-cards-on-deck-choice-prompt__card-name">{{ entry.display.name }}</span>
        <img
          v-if="entry.display.imageUrl"
          :src="entry.display.imageUrl"
          :alt="entry.display.name"
          class="pending-put-cards-on-deck-choice-prompt__card-image"
        />
      </button>
    </div>
    <button
      type="button"
      class="pending-put-cards-on-deck-choice-prompt__submit"
      data-testid="pending-put-cards-on-deck-submit"
      :disabled="!canSubmit"
      :aria-disabled="!canSubmit ? 'true' : undefined"
      @click="onSubmit"
    >
      Put {{ selectedIndices.length }} / {{ requiredCount }} on top
    </button>
  </div>
</template>

<style scoped>
.pending-put-cards-on-deck-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.pending-put-cards-on-deck-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.pending-put-cards-on-deck-choice-prompt__hint {
  font-size: 0.85rem;
  font-weight: normal;
  color: var(--color-text-secondary, #666);
}

.pending-put-cards-on-deck-choice-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.pending-put-cards-on-deck-choice-prompt__card-btn {
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

.pending-put-cards-on-deck-choice-prompt__card-btn--selected {
  border-color: var(--color-foreground, #333);
  background: var(--color-accent, #ffe4b5);
  outline: 2px solid var(--color-foreground, #333);
}

.pending-put-cards-on-deck-choice-prompt__card-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pending-put-cards-on-deck-choice-prompt__position {
  position: absolute;
  top: -0.4rem;
  left: -0.4rem;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 0.2rem;
  border-radius: 0.6rem;
  background: var(--color-foreground, #333);
  color: var(--color-background, #fff);
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.1rem;
  text-align: center;
}

.pending-put-cards-on-deck-choice-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 60px;
}

.pending-put-cards-on-deck-choice-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}

.pending-put-cards-on-deck-choice-prompt__submit {
  align-self: flex-start;
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--color-foreground, #333);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-weight: 600;
}

.pending-put-cards-on-deck-choice-prompt__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
