<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingElectromagneticBubbleChoice } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending Magneto "Electromagnetic Bubble" X-Men pick
 * (WP-695 / D-24512).
 *
 * Renders iff `pendingElectromagneticBubbleChoice !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Displays the eligible in-play X-Men Heroes; clicking
 * one submits `resolveElectromagneticBubbleChoice({ cardId })` to add it to the next hand as
 * a seventh card.
 *
 * NOT a modal — the choice is game-blocking and cannot be dismissed. Normal document flow.
 * Mirrors PendingScryKoChoicePrompt.vue (WP-470). Per D-6512: `defineComponent`.
 *
 * @see WP-695 §Scope (In)
 * @see DECISIONS.md D-24512
 */
export default defineComponent({
  name: "PendingElectromagneticBubbleChoicePrompt",
  props: {
    pendingElectromagneticBubbleChoice: {
      type: Object as PropType<UIPendingElectromagneticBubbleChoice | undefined>,
      required: false,
      default: undefined,
    },
    viewerPlayerId: {
      // why: null signals a spectator with no assigned playerId; prompt must not render.
      type: [String, null] as unknown as PropType<string | null>,
      required: true,
    },
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
  },
  setup(props) {
    // why: debounce a same-frame double-click ONLY; cleared on every new server frame.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingElectromagneticBubbleChoice,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingElectromagneticBubbleChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingElectromagneticBubbleChoice.playerID
      );
    }

    function onSelectCard(cardId: string): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveElectromagneticBubbleChoice", { cardId });
    }

    return { isSubmitting, shouldRender, onSelectCard };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="pending-electromagnetic-bubble-choice-prompt"
    data-testid="pending-electromagnetic-bubble-choice-prompt"
    role="region"
    aria-label="Electromagnetic Bubble choice"
  >
    <h3 class="pending-electromagnetic-bubble-choice-prompt__heading">
      Electromagnetic Bubble — choose an X-Men Hero
    </h3>
    <p class="pending-electromagnetic-bubble-choice-prompt__hint">
      The chosen Hero is added to your next hand as a seventh card.
    </p>
    <div class="pending-electromagnetic-bubble-choice-prompt__cards">
      <button
        v-for="(entry, index) in pendingElectromagneticBubbleChoice!.eligibleCards"
        :key="`${index}:${entry.cardId}`"
        type="button"
        class="pending-electromagnetic-bubble-choice-prompt__card-btn"
        :data-testid="`pending-electromagnetic-bubble-card-${entry.cardId}`"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        :title="entry.display.name"
        @click="onSelectCard(entry.cardId)"
      >
        <span class="pending-electromagnetic-bubble-choice-prompt__card-name">{{
          entry.display.name
        }}</span>
        <img
          v-if="entry.display.imageUrl"
          :src="entry.display.imageUrl"
          :alt="entry.display.name"
          class="pending-electromagnetic-bubble-choice-prompt__card-image"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.pending-electromagnetic-bubble-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.pending-electromagnetic-bubble-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.pending-electromagnetic-bubble-choice-prompt__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #666);
}

.pending-electromagnetic-bubble-choice-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.pending-electromagnetic-bubble-choice-prompt__card-btn {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  align-items: flex-start;
}

.pending-electromagnetic-bubble-choice-prompt__card-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pending-electromagnetic-bubble-choice-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 60px;
}

.pending-electromagnetic-bubble-choice-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}
</style>
