<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingScryKoChoice } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending Doombot scry-KO choice (WP-470).
 *
 * Renders iff `pendingScryKoChoice !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators (the revealed cards are the top of the
 * chooser's own deck — their next draws). Displays the (up to two) revealed
 * cards; clicking one submits `resolveScryKoChoice({ cardId })` to KO it (the
 * other stays on top of the deck).
 *
 * NOT a modal — the choice is game-blocking and cannot be dismissed.
 * NOT position:fixed. NOT <Teleport>. Renders in normal document flow.
 *
 * Mirrors PendingKoHeroChoicePrompt.vue (WP-243). Per D-6512: uses
 * `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-470 §Scope (In) — inline prompt spec
 * @see EC-505 Locked Values
 * @see DECISIONS.md D-24282
 */
export default defineComponent({
  name: "PendingScryKoChoicePrompt",
  props: {
    pendingScryKoChoice: {
      type: Object as PropType<UIPendingScryKoChoice | undefined>,
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
    // why: isSubmitting debounces a same-frame double-click ONLY; it must be
    // cleared on every new server frame. The parent page keeps this component
    // mounted for the whole match (only its inner `v-if` content toggles), so a
    // persistent latch would leave the buttons disabled for the rest of the
    // match after the first submission. Each server frame delivers a fresh
    // pendingScryKoChoice object; resetting on its identity change re-enables the
    // buttons and recovers from a no-op resubmit (mirrors PendingKoHeroChoicePrompt).
    const isSubmitting = ref(false);
    watch(
      () => props.pendingScryKoChoice,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingScryKoChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingScryKoChoice.playerID
      );
    }

    function onSelectCard(cardId: string): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveScryKoChoice", { cardId });
    }

    return {
      isSubmitting,
      shouldRender,
      onSelectCard,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="pending-scry-ko-choice-prompt"
    data-testid="pending-scry-ko-choice-prompt"
    role="region"
    aria-label="Scry KO choice"
  >
    <h3 class="pending-scry-ko-choice-prompt__heading">
      Look at the top two cards of your deck — choose one to KO
    </h3>
    <p class="pending-scry-ko-choice-prompt__hint">
      The card you do not KO stays on top of your deck.
    </p>
    <div class="pending-scry-ko-choice-prompt__cards">
      <button
        v-for="(entry, index) in pendingScryKoChoice!.revealedCards"
        :key="`${index}:${entry.cardId}`"
        type="button"
        class="pending-scry-ko-choice-prompt__card-btn"
        :data-testid="`pending-scry-ko-choice-card-${entry.cardId}`"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        :title="entry.display.name"
        @click="onSelectCard(entry.cardId)"
      >
        <span class="pending-scry-ko-choice-prompt__card-name">{{
          entry.display.name
        }}</span>
        <img
          v-if="entry.display.imageUrl"
          :src="entry.display.imageUrl"
          :alt="entry.display.name"
          class="pending-scry-ko-choice-prompt__card-image"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.pending-scry-ko-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.pending-scry-ko-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.pending-scry-ko-choice-prompt__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #666);
}

.pending-scry-ko-choice-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.pending-scry-ko-choice-prompt__card-btn {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  align-items: flex-start;
}

.pending-scry-ko-choice-prompt__card-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pending-scry-ko-choice-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 60px;
}

.pending-scry-ko-choice-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}
</style>
