<script lang="ts">
import { defineComponent, ref, watch, computed, type PropType } from "vue";
import type { UIPendingKoDiscardChoice } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending KO-from-discard choice (WP-693 / D-24510 —
 * Loki's Maniacal Tyrant: "KO up to four cards from your discard pile").
 *
 * Renders iff `pendingKoDiscardChoice !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Shows the chooser's discard; the player picks
 * 0..maxCount cards to KO and submits `resolveKoDiscardChoice({ cardIds })`. An empty
 * selection ("KO None") is the legal "KO nothing" choice.
 *
 * // why: the engine resolve rejects a payload repeating an ext_id (the selection is a
 * DISTINCT set, D-24510). So selecting a discard entry whose ext_id is ALREADY selected
 * is blocked here — the submitted cardIds are always distinct, never a rejected payload.
 *
 * NOT a modal — the choice is game-blocking and cannot be dismissed.
 * NOT position:fixed. NOT <Teleport>. Renders in normal document flow.
 *
 * Mirrors PendingPutCardsOnDeckChoicePrompt.vue (mirror-not-import). Per D-6512: uses
 * `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-693 §Scope (In) — inline prompt spec
 * @see EC-730 Locked Values — move args, render formula, gate precedence
 * @see DECISIONS.md D-24510
 */
export default defineComponent({
  name: "PendingKoDiscardChoicePrompt",
  props: {
    pendingKoDiscardChoice: {
      type: Object as PropType<UIPendingKoDiscardChoice | undefined>,
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
    // why: isSubmitting debounces a same-frame double-click ONLY; selectedIndices holds
    // the in-progress selection (order irrelevant — KO is a set). BOTH must reset on
    // every new server frame — the parent page keeps this component mounted for the whole
    // match (only its inner `v-if` content toggles), so a persistent latch would freeze
    // the next choice. Each server frame delivers a fresh pendingKoDiscardChoice object;
    // resetting on its identity change re-enables the prompt and recovers from a no-op
    // resubmit. Without this the board stays frozen by the block-all guard.
    const isSubmitting = ref(false);
    const selectedIndices = ref<number[]>([]);
    watch(
      () => props.pendingKoDiscardChoice,
      () => {
        isSubmitting.value = false;
        selectedIndices.value = [];
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingKoDiscardChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingKoDiscardChoice.playerID
      );
    }

    // why: the player may KO at most `maxCount` cards (the printed "up to four").
    const maxCount = computed<number>(() => {
      if (!props.pendingKoDiscardChoice) return 0;
      return props.pendingKoDiscardChoice.maxCount;
    });

    function isSelected(discardIndex: number): boolean {
      return selectedIndices.value.includes(discardIndex);
    }

    /** The ext_id already selected at some OTHER discard index (distinct-set guard). */
    function extIdAlreadySelected(discardIndex: number): boolean {
      const choice = props.pendingKoDiscardChoice;
      if (!choice) return false;
      const thisExtId = choice.discard[discardIndex]?.cardId;
      if (thisExtId === undefined) return false;
      for (const selectedIndex of selectedIndices.value) {
        if (selectedIndex === discardIndex) continue;
        if (choice.discard[selectedIndex]?.cardId === thisExtId) return true;
      }
      return false;
    }

    function toggleCard(discardIndex: number): void {
      if (isSubmitting.value) return;
      if (selectedIndices.value.includes(discardIndex)) {
        selectedIndices.value = selectedIndices.value.filter((index) => index !== discardIndex);
        return;
      }
      // why: never let the player over-select beyond the cap.
      if (selectedIndices.value.length >= maxCount.value) return;
      // why: D-24510 — the engine rejects a repeated ext_id, so block selecting a second
      // copy of an already-selected card (keeps the submit a distinct set).
      if (extIdAlreadySelected(discardIndex)) return;
      selectedIndices.value = [...selectedIndices.value, discardIndex];
    }

    // why: 0 is a legal choice ("up to four"), so submit is enabled at any count ≤ cap.
    const canSubmit = computed<boolean>(() => !isSubmitting.value);

    function onSubmit(): void {
      if (!canSubmit.value || !props.pendingKoDiscardChoice) return;
      isSubmitting.value = true;
      const discard = props.pendingKoDiscardChoice.discard;
      const cardIds = selectedIndices.value.map((discardIndex) => discard[discardIndex]!.cardId);
      props.submitMove("resolveKoDiscardChoice", { cardIds });
    }

    return {
      isSubmitting,
      selectedIndices,
      shouldRender,
      maxCount,
      isSelected,
      extIdAlreadySelected,
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
    class="pending-ko-discard-choice-prompt"
    data-testid="pending-ko-discard-choice-prompt"
    role="region"
    aria-label="KO from discard choice"
  >
    <h3 class="pending-ko-discard-choice-prompt__heading">
      Maniacal Tyrant — KO up to {{ maxCount }} card{{ maxCount === 1 ? '' : 's' }} from your discard pile
    </h3>
    <div class="pending-ko-discard-choice-prompt__cards">
      <button
        v-for="(entry, discardIndex) in pendingKoDiscardChoice!.discard"
        :key="`${discardIndex}:${entry.cardId}`"
        type="button"
        class="pending-ko-discard-choice-prompt__card-btn"
        :class="{ 'pending-ko-discard-choice-prompt__card-btn--selected': isSelected(discardIndex) }"
        :data-testid="`pending-ko-discard-card-${discardIndex}`"
        :disabled="isSubmitting || (!isSelected(discardIndex) && extIdAlreadySelected(discardIndex))"
        :aria-pressed="isSelected(discardIndex) ? 'true' : 'false'"
        :title="entry.display.name"
        @click="toggleCard(discardIndex)"
      >
        <span class="pending-ko-discard-choice-prompt__card-name">{{ entry.display.name }}</span>
        <img
          v-if="entry.display.imageUrl"
          :src="entry.display.imageUrl"
          :alt="entry.display.name"
          class="pending-ko-discard-choice-prompt__card-image"
        />
      </button>
    </div>
    <button
      type="button"
      class="pending-ko-discard-choice-prompt__submit"
      data-testid="pending-ko-discard-submit"
      :disabled="!canSubmit"
      :aria-disabled="!canSubmit ? 'true' : undefined"
      @click="onSubmit"
    >
      {{ selectedIndices.length === 0 ? 'KO None' : `KO ${selectedIndices.length} card${selectedIndices.length === 1 ? '' : 's'}` }}
    </button>
  </div>
</template>

<style scoped>
.pending-ko-discard-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.pending-ko-discard-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.pending-ko-discard-choice-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.pending-ko-discard-choice-prompt__card-btn {
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

.pending-ko-discard-choice-prompt__card-btn--selected {
  border-color: var(--color-foreground, #333);
  background: var(--color-accent, #ffe4b5);
  outline: 2px solid var(--color-foreground, #333);
}

.pending-ko-discard-choice-prompt__card-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pending-ko-discard-choice-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 60px;
}

.pending-ko-discard-choice-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}

.pending-ko-discard-choice-prompt__submit {
  align-self: flex-start;
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--color-foreground, #333);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-weight: 600;
}

.pending-ko-discard-choice-prompt__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
