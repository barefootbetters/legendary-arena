<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingRevealTopDispose } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending reveal-top discard-or-keep choice (WP-702 / D-24521).
 *
 * Renders iff `pendingRevealTopDispose !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators (the revealed cards are the tops of players' own
 * decks — hidden next-draw information). Displays each revealed deck top (owner-labelled)
 * with a Discard and a Keep button; clicking one submits
 * `resolveRevealTopDispose({ ownerPlayerID, cardId, disposition })` — 'discard' moves the
 * card to that player's discard pile, 'top' leaves it on top. One card resolves per click;
 * the server returns a new frame with the resolved card dropped until every top is decided.
 *
 * NOT a modal — the choice is game-blocking and cannot be dismissed.
 * NOT position:fixed. NOT <Teleport>. Renders in normal document flow.
 *
 * Mirrors PendingMelterKoChoicePrompt.vue (WP-603). Per D-6512: uses
 * `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-702 §Scope (In) — inline prompt spec
 * @see EC-739 Locked Values
 * @see DECISIONS.md D-24521
 */
export default defineComponent({
  name: "PendingRevealTopDisposePrompt",
  props: {
    pendingRevealTopDispose: {
      type: Object as PropType<UIPendingRevealTopDispose | undefined>,
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
    // match (only its inner `v-if` content toggles), so a persistent latch would leave the
    // buttons disabled for the rest of the match. Each resolved card delivers a fresh
    // pendingRevealTopDispose object (one fewer revealedTops); resetting on its identity
    // change re-enables the buttons for the next card and recovers from a no-op resubmit
    // (mirrors PendingMelterKoChoicePrompt).
    const isSubmitting = ref(false);
    watch(
      () => props.pendingRevealTopDispose,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingRevealTopDispose !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingRevealTopDispose.playerID
      );
    }

    function onDecide(ownerPlayerID: string, cardId: string, disposition: "discard" | "top"): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveRevealTopDispose", { ownerPlayerID, cardId, disposition });
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
    class="pending-reveal-top-dispose-prompt"
    data-testid="pending-reveal-top-dispose-prompt"
    role="region"
    aria-label="Reveal-top discard or keep choice"
  >
    <h3 class="pending-reveal-top-dispose-prompt__heading">
      Reveal the top card — discard it or put it back
    </h3>
    <p class="pending-reveal-top-dispose-prompt__hint">
      A card you keep stays face-up on top of that player's deck.
    </p>
    <ul class="pending-reveal-top-dispose-prompt__rows">
      <li
        v-for="(entry, index) in pendingRevealTopDispose!.revealedTops"
        :key="`${index}:${entry.ownerPlayerID}:${entry.cardId}`"
        class="pending-reveal-top-dispose-prompt__row"
        :data-testid="`pending-reveal-top-dispose-row-${entry.ownerPlayerID}-${entry.cardId}`"
      >
        <span class="pending-reveal-top-dispose-prompt__owner">
          Player {{ entry.ownerPlayerID }}
        </span>
        <span class="pending-reveal-top-dispose-prompt__card-name" :title="entry.display.name">
          {{ entry.display.name }}
        </span>
        <img
          v-if="entry.display.imageUrl"
          :src="entry.display.imageUrl"
          :alt="entry.display.name"
          class="pending-reveal-top-dispose-prompt__card-image"
        />
        <button
          type="button"
          class="pending-reveal-top-dispose-prompt__discard-btn"
          :data-testid="`pending-reveal-top-dispose-discard-${entry.ownerPlayerID}-${entry.cardId}`"
          :disabled="isSubmitting"
          :aria-disabled="isSubmitting ? 'true' : undefined"
          @click="onDecide(entry.ownerPlayerID, entry.cardId, 'discard')"
        >
          Discard
        </button>
        <button
          type="button"
          class="pending-reveal-top-dispose-prompt__keep-btn"
          :data-testid="`pending-reveal-top-dispose-keep-${entry.ownerPlayerID}-${entry.cardId}`"
          :disabled="isSubmitting"
          :aria-disabled="isSubmitting ? 'true' : undefined"
          @click="onDecide(entry.ownerPlayerID, entry.cardId, 'top')"
        >
          Keep
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pending-reveal-top-dispose-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.pending-reveal-top-dispose-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.pending-reveal-top-dispose-prompt__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #666);
}

.pending-reveal-top-dispose-prompt__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.pending-reveal-top-dispose-prompt__row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.pending-reveal-top-dispose-prompt__owner {
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 4.5rem;
}

.pending-reveal-top-dispose-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  flex: 1;
}

.pending-reveal-top-dispose-prompt__card-image {
  max-width: 40px;
  max-height: 40px;
  object-fit: contain;
}

.pending-reveal-top-dispose-prompt__discard-btn,
.pending-reveal-top-dispose-prompt__keep-btn {
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--color-border, #ddd);
  cursor: pointer;
}

.pending-reveal-top-dispose-prompt__discard-btn {
  background: var(--color-danger-bg, #f9e0e0);
}

.pending-reveal-top-dispose-prompt__keep-btn {
  background: var(--color-button-bg, #f5f5f5);
}

.pending-reveal-top-dispose-prompt__discard-btn:disabled,
.pending-reveal-top-dispose-prompt__keep-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
