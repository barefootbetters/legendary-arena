<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingRevealThreeAssign } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/** The three dispositions a revealed card can be assigned (WP-753 / D-24580). */
type RevealThreeAssignDisposition = "draw" | "discard" | "ko";

/**
 * Inline prompt for resolving a pending reveal-three draw / discard / KO assignment
 * (WP-753 / D-24580) — Crystal of Kadavus and Interplanetary Visitor: "Reveal the top three
 * cards of your deck. Draw one of them, discard one, and KO one."
 *
 * Renders iff `pendingRevealThreeAssign !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators (the revealed cards are the top of the chooser's own
 * deck — their next draws). The heading names the source card; for each still-unassigned
 * revealed card it renders one button per still-unused disposition (Draw / Discard / KO);
 * clicking submits `resolveRevealThreeAssign({ cardId, disposition })`. One card resolves per
 * submit; the server sends a fresh frame until every card is assigned. When
 * `remainingRepeats > 0` it notes that the next three cards are revealed afterwards (Crystal of
 * Kadavus's "Do this ability again."). The client never moves a card itself.
 *
 * NOT a modal — the choice is game-blocking and cannot be dismissed. Normal document flow.
 * Mirrors PendingRuthlessDictatorChoicePrompt.vue (WP-695). Per D-6512: `defineComponent`.
 *
 * @see WP-753 §Scope (In)
 * @see DECISIONS.md D-24580
 */
export default defineComponent({
  name: "PendingRevealThreeAssignPrompt",
  props: {
    pendingRevealThreeAssign: {
      type: Object as PropType<UIPendingRevealThreeAssign | undefined>,
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
    // Each frame delivers a fresh pendingRevealThreeAssign object identity.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingRevealThreeAssign,
      () => {
        isSubmitting.value = false;
      },
    );

    /**
     * Whether the prompt is shown: a pending assignment exists and the viewer is its chooser.
     *
     * @returns true for the choosing player only.
     */
    function shouldRender(): boolean {
      return (
        props.pendingRevealThreeAssign !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingRevealThreeAssign.playerID
      );
    }

    /**
     * Human-readable label for a disposition button.
     *
     * @param disposition - The disposition slot.
     * @returns The button label.
     */
    function dispositionLabel(disposition: RevealThreeAssignDisposition): string {
      if (disposition === "draw") return "Draw";
      if (disposition === "discard") return "Discard";
      return "KO";
    }

    /**
     * Submits one assignment intent; the engine moves the card.
     *
     * @param cardId - The revealed card being assigned.
     * @param disposition - The chosen disposition.
     */
    function onAssign(cardId: string, disposition: RevealThreeAssignDisposition): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveRevealThreeAssign", { cardId, disposition });
    }

    return { isSubmitting, shouldRender, dispositionLabel, onAssign };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="pending-reveal-three-assign-prompt"
    data-testid="pending-reveal-three-assign-prompt"
    role="region"
    aria-label="Reveal three choice"
  >
    <h3 class="pending-reveal-three-assign-prompt__heading">
      {{ pendingRevealThreeAssign!.sourceCard.display.name }} — reveal the top cards of your deck
    </h3>
    <p class="pending-reveal-three-assign-prompt__hint">
      Draw one of them, discard one, and KO one.
    </p>
    <p
      v-if="pendingRevealThreeAssign!.remainingRepeats > 0"
      class="pending-reveal-three-assign-prompt__repeat"
      data-testid="pending-reveal-three-assign-repeat"
    >
      Then again on the next three cards.
    </p>
    <div class="pending-reveal-three-assign-prompt__cards">
      <div
        v-for="(entry, index) in pendingRevealThreeAssign!.revealedCards"
        :key="`${index}:${entry.cardId}`"
        class="pending-reveal-three-assign-prompt__card"
        :data-testid="`pending-reveal-three-assign-card-${entry.cardId}`"
      >
        <span class="pending-reveal-three-assign-prompt__card-name">{{
          entry.display.name
        }}</span>
        <img
          v-if="entry.display.imageUrl"
          :src="entry.display.imageUrl"
          :alt="entry.display.name"
          class="pending-reveal-three-assign-prompt__card-image"
        />
        <div class="pending-reveal-three-assign-prompt__actions">
          <button
            v-for="disposition in pendingRevealThreeAssign!.availableDispositions"
            :key="disposition"
            type="button"
            class="pending-reveal-three-assign-prompt__action-btn"
            :data-testid="`pending-reveal-three-assign-${disposition}-${entry.cardId}`"
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
.pending-reveal-three-assign-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.pending-reveal-three-assign-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.pending-reveal-three-assign-prompt__hint,
.pending-reveal-three-assign-prompt__repeat {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #666);
}

.pending-reveal-three-assign-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.pending-reveal-three-assign-prompt__card {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.3rem;
  border: 1px solid var(--color-border, #ddd);
  align-items: flex-start;
}

.pending-reveal-three-assign-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 80px;
}

.pending-reveal-three-assign-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}

.pending-reveal-three-assign-prompt__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.pending-reveal-three-assign-prompt__action-btn {
  padding: 0.15rem 0.35rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.7rem;
}

.pending-reveal-three-assign-prompt__action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
