<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingRuthlessDictatorChoice } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending Red Skull "Ruthless Dictator" scry-3 choice
 * (WP-695 / D-24512).
 *
 * Renders iff `pendingRuthlessDictatorChoice !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators (the revealed cards are the top of the chooser's own
 * deck — their next draws). For each still-unresolved revealed card, renders one button per
 * still-available disposition (KO / Discard / Top); clicking submits
 * `resolveRuthlessDictatorChoice({ cardId, disposition })`. One card resolves per submit;
 * the server sends a fresh frame with the shrunken snapshot until every card is dispositioned.
 *
 * NOT a modal — the choice is game-blocking and cannot be dismissed. Normal document flow.
 * Mirrors PendingScryKoChoicePrompt.vue (WP-470). Per D-6512: `defineComponent`.
 *
 * @see WP-695 §Scope (In)
 * @see DECISIONS.md D-24512
 */
export default defineComponent({
  name: "PendingRuthlessDictatorChoicePrompt",
  props: {
    pendingRuthlessDictatorChoice: {
      type: Object as PropType<UIPendingRuthlessDictatorChoice | undefined>,
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
    // Each frame delivers a fresh pendingRuthlessDictatorChoice object identity.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingRuthlessDictatorChoice,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingRuthlessDictatorChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingRuthlessDictatorChoice.playerID
      );
    }

    /** Human-readable label for a disposition button. */
    function dispositionLabel(disposition: "ko" | "discard" | "top"): string {
      if (disposition === "ko") return "KO";
      if (disposition === "discard") return "Discard";
      return "Keep on top";
    }

    function onAssign(cardId: string, disposition: "ko" | "discard" | "top"): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveRuthlessDictatorChoice", { cardId, disposition });
    }

    return { isSubmitting, shouldRender, dispositionLabel, onAssign };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="pending-ruthless-dictator-choice-prompt"
    data-testid="pending-ruthless-dictator-choice-prompt"
    role="region"
    aria-label="Ruthless Dictator choice"
  >
    <h3 class="pending-ruthless-dictator-choice-prompt__heading">
      Ruthless Dictator — look at the top cards of your deck
    </h3>
    <p class="pending-ruthless-dictator-choice-prompt__hint">
      Assign each card a disposition: KO one, discard one, keep one on top.
    </p>
    <div class="pending-ruthless-dictator-choice-prompt__cards">
      <div
        v-for="(entry, index) in pendingRuthlessDictatorChoice!.revealedCards"
        :key="`${index}:${entry.cardId}`"
        class="pending-ruthless-dictator-choice-prompt__card"
        :data-testid="`pending-ruthless-dictator-card-${entry.cardId}`"
      >
        <span class="pending-ruthless-dictator-choice-prompt__card-name">{{
          entry.display.name
        }}</span>
        <img
          v-if="entry.display.imageUrl"
          :src="entry.display.imageUrl"
          :alt="entry.display.name"
          class="pending-ruthless-dictator-choice-prompt__card-image"
        />
        <div class="pending-ruthless-dictator-choice-prompt__actions">
          <button
            v-for="disposition in pendingRuthlessDictatorChoice!.availableDispositions"
            :key="disposition"
            type="button"
            class="pending-ruthless-dictator-choice-prompt__action-btn"
            :data-testid="`pending-ruthless-dictator-${disposition}-${entry.cardId}`"
            :disabled="isSubmitting"
            :aria-disabled="isSubmitting ? 'true' : undefined"
            @click="onAssign(entry.cardId, disposition)"
          >
            {{ dispositionLabel(disposition) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pending-ruthless-dictator-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.pending-ruthless-dictator-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.pending-ruthless-dictator-choice-prompt__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #666);
}

.pending-ruthless-dictator-choice-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.pending-ruthless-dictator-choice-prompt__card {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.3rem;
  border: 1px solid var(--color-border, #ddd);
  align-items: flex-start;
}

.pending-ruthless-dictator-choice-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 80px;
}

.pending-ruthless-dictator-choice-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}

.pending-ruthless-dictator-choice-prompt__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.pending-ruthless-dictator-choice-prompt__action-btn {
  padding: 0.15rem 0.35rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.7rem;
}

.pending-ruthless-dictator-choice-prompt__action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
