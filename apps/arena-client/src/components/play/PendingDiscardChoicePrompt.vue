<script lang="ts">
import { defineComponent, ref, watch, computed, type PropType } from "vue";
import type { UIPendingDiscardChoice } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending discard-to-limit choice (WP-476 / D-24284).
 *
 * Renders iff `pendingDiscardChoice !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Shows the chooser's hand; the player
 * toggles exactly `hand.length - limit` cards and submits
 * `resolveDiscardChoice({ cardIds })`.
 *
 * Selection is tracked by HAND INDEX (not cardId) so duplicate ext_ids in hand
 * are each selectable independently; the submitted `cardIds` map indices → ext_ids.
 *
 * NOT a modal — the choice is game-blocking and cannot be dismissed.
 * NOT position:fixed. NOT <Teleport>. Renders in normal document flow.
 *
 * Mirrors PendingKoHeroChoicePrompt.vue (mirror-not-import). Per D-6512: uses
 * `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-476 §Scope (In) — inline prompt spec
 * @see EC-511 Locked Values — move args, render formula, gate precedence
 * @see DECISIONS.md D-24284
 */
export default defineComponent({
  name: "PendingDiscardChoicePrompt",
  props: {
    pendingDiscardChoice: {
      type: Object as PropType<UIPendingDiscardChoice | undefined>,
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
    // holds the in-progress selection. BOTH must reset on every new server frame —
    // the parent page keeps this component mounted for the whole match (only its
    // inner `v-if` content toggles), so a persistent latch would freeze the next
    // discard. Each server frame delivers a fresh pendingDiscardChoice object;
    // resetting on its identity change re-enables the prompt and recovers from a
    // no-op resubmit. Without this the board stays frozen by the block-all guard
    // with no way to act.
    const isSubmitting = ref(false);
    const selectedIndices = ref<number[]>([]);
    watch(
      () => props.pendingDiscardChoice,
      () => {
        isSubmitting.value = false;
        selectedIndices.value = [];
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingDiscardChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingDiscardChoice.playerID
      );
    }

    // why: the player must discard EXACTLY down to the limit, i.e. select
    // `hand.length - limit` cards. The engine resolve rejects any other count.
    const requiredCount = computed<number>(() => {
      if (!props.pendingDiscardChoice) return 0;
      return props.pendingDiscardChoice.hand.length - props.pendingDiscardChoice.limit;
    });

    function isSelected(handIndex: number): boolean {
      return selectedIndices.value.includes(handIndex);
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
      if (!canSubmit.value || !props.pendingDiscardChoice) return;
      isSubmitting.value = true;
      const hand = props.pendingDiscardChoice.hand;
      const cardIds = selectedIndices.value.map((handIndex) => hand[handIndex]!.cardId);
      props.submitMove("resolveDiscardChoice", { cardIds });
    }

    return {
      isSubmitting,
      selectedIndices,
      shouldRender,
      requiredCount,
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
    class="pending-discard-choice-prompt"
    data-testid="pending-discard-choice-prompt"
    role="region"
    aria-label="Discard choice"
  >
    <h3 class="pending-discard-choice-prompt__heading">
      Choose {{ requiredCount }} card{{ requiredCount === 1 ? '' : 's' }} to discard
      <span class="pending-discard-choice-prompt__limit">
        (down to {{ pendingDiscardChoice!.limit }})
      </span>
    </h3>
    <div class="pending-discard-choice-prompt__cards">
      <button
        v-for="(entry, handIndex) in pendingDiscardChoice!.hand"
        :key="`${handIndex}:${entry.cardId}`"
        type="button"
        class="pending-discard-choice-prompt__card-btn"
        :class="{ 'pending-discard-choice-prompt__card-btn--selected': isSelected(handIndex) }"
        :data-testid="`pending-discard-choice-card-${handIndex}`"
        :disabled="isSubmitting"
        :aria-pressed="isSelected(handIndex) ? 'true' : 'false'"
        :title="entry.display.name"
        @click="toggleCard(handIndex)"
      >
        <span class="pending-discard-choice-prompt__card-name">{{ entry.display.name }}</span>
        <img
          v-if="entry.display.imageUrl"
          :src="entry.display.imageUrl"
          :alt="entry.display.name"
          class="pending-discard-choice-prompt__card-image"
        />
      </button>
    </div>
    <button
      type="button"
      class="pending-discard-choice-prompt__submit"
      data-testid="pending-discard-choice-submit"
      :disabled="!canSubmit"
      :aria-disabled="!canSubmit ? 'true' : undefined"
      @click="onSubmit"
    >
      Discard {{ selectedIndices.length }} / {{ requiredCount }}
    </button>
  </div>
</template>

<style scoped>
.pending-discard-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.pending-discard-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.pending-discard-choice-prompt__limit {
  font-size: 0.85rem;
  font-weight: normal;
  color: var(--color-text-secondary, #666);
}

.pending-discard-choice-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.pending-discard-choice-prompt__card-btn {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  align-items: flex-start;
}

.pending-discard-choice-prompt__card-btn--selected {
  border-color: var(--color-foreground, #333);
  background: var(--color-accent, #ffe4b5);
  outline: 2px solid var(--color-foreground, #333);
}

.pending-discard-choice-prompt__card-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pending-discard-choice-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 60px;
}

.pending-discard-choice-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}

.pending-discard-choice-prompt__submit {
  align-self: flex-start;
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--color-foreground, #333);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-weight: 600;
}

.pending-discard-choice-prompt__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
