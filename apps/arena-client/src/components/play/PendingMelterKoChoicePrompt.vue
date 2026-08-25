<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingMelterKoChoice } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending Melter Fight KO/keep choice (WP-603 / D-24413).
 *
 * Renders iff `pendingMelterKoChoice !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators (the revealed cards are the tops of players' own
 * decks — hidden next-draw information). Displays each player's revealed deck top
 * (owner-labelled) with a KO and a Keep button; clicking one submits
 * `resolveMelterKoChoice({ ownerPlayerID, cardId, keep })` — KO removes the card from
 * that player's deck, Keep leaves it on top. One card resolves per click; the server
 * returns a new frame with the resolved card dropped until every top is decided.
 *
 * NOT a modal — the choice is game-blocking and cannot be dismissed.
 * NOT position:fixed. NOT <Teleport>. Renders in normal document flow.
 *
 * Mirrors PendingScryKoChoicePrompt.vue (WP-470). Per D-6512: uses
 * `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-603 §Scope (In) — inline prompt spec
 * @see EC-638 Locked Values
 * @see DECISIONS.md D-24413
 */
export default defineComponent({
  name: "PendingMelterKoChoicePrompt",
  props: {
    pendingMelterKoChoice: {
      type: Object as PropType<UIPendingMelterKoChoice | undefined>,
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
    // why: isSubmitting debounces a same-frame double-click ONLY; it must be cleared on
    // every new server frame. The parent page keeps this component mounted for the whole
    // match (only its inner `v-if` content toggles), so a persistent latch would leave
    // the buttons disabled for the rest of the match. Each resolved card delivers a
    // fresh pendingMelterKoChoice object (one fewer revealedTops); resetting on its
    // identity change re-enables the buttons for the next card and recovers from a no-op
    // resubmit (mirrors PendingScryKoChoicePrompt).
    const isSubmitting = ref(false);
    watch(
      () => props.pendingMelterKoChoice,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingMelterKoChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingMelterKoChoice.playerID
      );
    }

    function onDecide(ownerPlayerID: string, cardId: string, keep: boolean): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveMelterKoChoice", { ownerPlayerID, cardId, keep });
    }

    return {
      isSubmitting,
      shouldRender,
      onDecide,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="pending-melter-ko-choice-prompt"
    data-testid="pending-melter-ko-choice-prompt"
    role="region"
    aria-label="Melter KO or keep choice"
  >
    <h3 class="pending-melter-ko-choice-prompt__heading">
      Melter — KO or keep each player's revealed deck top
    </h3>
    <p class="pending-melter-ko-choice-prompt__hint">
      A card you keep stays face-up on top of that player's deck.
    </p>
    <ul class="pending-melter-ko-choice-prompt__rows">
      <li
        v-for="(entry, index) in pendingMelterKoChoice!.revealedTops"
        :key="`${index}:${entry.ownerPlayerID}:${entry.cardId}`"
        class="pending-melter-ko-choice-prompt__row"
        :data-testid="`pending-melter-ko-choice-row-${entry.ownerPlayerID}-${entry.cardId}`"
      >
        <span class="pending-melter-ko-choice-prompt__owner">
          Player {{ entry.ownerPlayerID }}
        </span>
        <span class="pending-melter-ko-choice-prompt__card-name" :title="entry.display.name">
          {{ entry.display.name }}
        </span>
        <img
          v-if="entry.display.imageUrl"
          :src="entry.display.imageUrl"
          :alt="entry.display.name"
          class="pending-melter-ko-choice-prompt__card-image"
        />
        <button
          type="button"
          class="pending-melter-ko-choice-prompt__ko-btn"
          :data-testid="`pending-melter-ko-choice-ko-${entry.ownerPlayerID}-${entry.cardId}`"
          :disabled="isSubmitting"
          :aria-disabled="isSubmitting ? 'true' : undefined"
          @click="onDecide(entry.ownerPlayerID, entry.cardId, false)"
        >
          KO
        </button>
        <button
          type="button"
          class="pending-melter-ko-choice-prompt__keep-btn"
          :data-testid="`pending-melter-ko-choice-keep-${entry.ownerPlayerID}-${entry.cardId}`"
          :disabled="isSubmitting"
          :aria-disabled="isSubmitting ? 'true' : undefined"
          @click="onDecide(entry.ownerPlayerID, entry.cardId, true)"
        >
          Keep
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pending-melter-ko-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.pending-melter-ko-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.pending-melter-ko-choice-prompt__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #666);
}

.pending-melter-ko-choice-prompt__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.pending-melter-ko-choice-prompt__row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.pending-melter-ko-choice-prompt__owner {
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 4.5rem;
}

.pending-melter-ko-choice-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  flex: 1;
}

.pending-melter-ko-choice-prompt__card-image {
  max-width: 40px;
  max-height: 40px;
  object-fit: contain;
}

.pending-melter-ko-choice-prompt__ko-btn,
.pending-melter-ko-choice-prompt__keep-btn {
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--color-border, #ddd);
  cursor: pointer;
}

.pending-melter-ko-choice-prompt__ko-btn {
  background: var(--color-danger-bg, #f9e0e0);
}

.pending-melter-ko-choice-prompt__keep-btn {
  background: var(--color-button-bg, #f5f5f5);
}

.pending-melter-ko-choice-prompt__ko-btn:disabled,
.pending-melter-ko-choice-prompt__keep-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
