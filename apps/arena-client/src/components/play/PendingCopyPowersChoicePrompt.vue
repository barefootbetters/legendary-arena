<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIState } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

// why: the prop type is derived from the exported UIState field rather than a deep
// import of the engine's UIPendingCopyPowersChoice interface (a layer-boundary
// violation). NonNullable drops the `| undefined` the optional UIState field carries so
// the alias names the choice object itself. Mirrors PendingGiveHqHeroChoicePrompt.
type UIPendingCopyPowersChoice = NonNullable<
  UIState["pendingCopyPowersChoice"]
>;

/**
 * Inline prompt for resolving a pending Copy Powers choice (WP-535 / EC-570 — Rogue's
 * Copy Powers: "Play this card as a copy of another Hero you played this turn.").
 *
 * Renders iff `pendingCopyPowersChoice !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators (the engine redacts the projection for every
 * audience but the chooser, keyed on `.playerID`). Displays one button per eligible
 * in-play Hero in `eligible` array order.
 *
 * NOT a modal — the choice is game-blocking and cannot be dismissed.
 * NOT position:fixed. NOT <Teleport>. Renders in normal document flow.
 *
 * Mirrors PendingGiveHqHeroChoicePrompt.vue: same props (choice + viewerPlayerId +
 * submitMove), same isSubmitting same-frame debounce, same shouldRender gate.
 *
 * @see WP-535 §Scope (In) — inline prompt spec
 * @see EC-570 Locked Values — move args, render formula, gate precedence
 * @see DECISIONS.md D-24345
 */
export default defineComponent({
  name: "PendingCopyPowersChoicePrompt",
  props: {
    pendingCopyPowersChoice: {
      type: Object as PropType<UIPendingCopyPowersChoice | undefined>,
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
    // why: isSubmitting debounces a same-frame double-click ONLY; it is cleared on every
    // new server frame (each delivers a fresh pendingCopyPowersChoice object). Without the
    // reset the block-all guard would leave the board frozen with disabled buttons after
    // the first submission. Mirrors PendingGiveHqHeroChoicePrompt.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingCopyPowersChoice,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingCopyPowersChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingCopyPowersChoice.playerID
      );
    }

    function onSelectCard(cardId: string): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      // why: the engine resolve matches the in-play Hero ext_id (cardId) — the
      // round-trip rule (getEligibleCopyPowersCards).
      props.submitMove("resolveCopyPowersChoice", { cardId });
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
    class="pending-copy-powers-choice-prompt"
    data-testid="pending-copy-powers-choice-prompt"
    role="region"
    aria-label="Copy Powers choice"
  >
    <h3 class="pending-copy-powers-choice-prompt__heading">
      Choose a Hero to copy
    </h3>
    <p class="pending-copy-powers-choice-prompt__hint">
      Copy Powers becomes a copy of the Hero you choose — its ability fires and Copy
      Powers gains its class.
    </p>
    <div class="pending-copy-powers-choice-prompt__cards">
      <button
        v-for="entry in pendingCopyPowersChoice!.eligible"
        :key="entry.cardId"
        type="button"
        class="pending-copy-powers-choice-prompt__card-btn"
        :data-testid="`pending-copy-powers-choice-card-${entry.cardId}`"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        :title="entry.display.name"
        @click="onSelectCard(entry.cardId)"
      >
        <span class="pending-copy-powers-choice-prompt__card-name">{{
          entry.display.name
        }}</span>
        <span
          v-if="entry.display.cost !== undefined"
          class="pending-copy-powers-choice-prompt__card-cost"
        >
          Cost {{ entry.display.cost }}
        </span>
        <img
          v-if="entry.display.imageUrl"
          :src="entry.display.imageUrl"
          :alt="entry.display.name"
          class="pending-copy-powers-choice-prompt__card-image"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.pending-copy-powers-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.pending-copy-powers-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.pending-copy-powers-choice-prompt__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #666);
}

.pending-copy-powers-choice-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.pending-copy-powers-choice-prompt__card-btn {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  align-items: flex-start;
}

.pending-copy-powers-choice-prompt__card-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pending-copy-powers-choice-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 60px;
}

.pending-copy-powers-choice-prompt__card-cost {
  font-size: 0.7rem;
  color: var(--color-text-secondary, #666);
}

.pending-copy-powers-choice-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}
</style>
