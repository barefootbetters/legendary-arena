<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIState } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

// why: the engine barrel (@legendary-arena/game-engine index) re-exports every
// sibling pending-choice interface EXCEPT UIPendingGiveHqHeroChoice (an oversight
// vs. UIPendingKoHeroChoice et al.). Deriving the type from the exported UIState
// keeps the prop strongly typed without a deep import (a layer-boundary violation)
// or an engine edit (out of scope). NonNullable drops the `| undefined` the
// optional UIState field carries so the alias names the choice object itself.
type UIPendingGiveHqHeroChoice = NonNullable<
  UIState["pendingGiveHqHeroChoice"]
>;

/**
 * Inline prompt for resolving a pending give-HQ-Hero choice (WP-532 / EC-567 —
 * Paibok the Power Skrull Fight: "Choose a Hero in the HQ. Each player gains that
 * Hero.").
 *
 * Renders iff `pendingGiveHqHeroChoice !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators (the engine redacts the projection for every
 * audience but the chooser, keyed on `.playerID`). Displays one button per eligible
 * HQ Hero in `eligible` array order.
 *
 * NOT a modal — the choice is game-blocking and cannot be dismissed.
 * NOT position:fixed. NOT <Teleport>. Renders in normal document flow.
 *
 * Mirrors PendingKoHeroChoicePrompt.vue: same props (choice + viewerPlayerId +
 * submitMove), same isSubmitting same-frame debounce, same shouldRender gate.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-532 §Scope (In) — inline prompt spec
 * @see EC-567 Locked Values — move args, render formula, gate precedence
 * @see DECISIONS.md D-24343
 */
export default defineComponent({
  name: "PendingGiveHqHeroChoicePrompt",
  props: {
    pendingGiveHqHeroChoice: {
      type: Object as PropType<UIPendingGiveHqHeroChoice | undefined>,
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
    // mounted for the whole match (only its inner `v-if` content toggles, not
    // the component), so a persistent latch would leave every button disabled
    // for the rest of the match after the first submission. Each server frame
    // delivers a fresh pendingGiveHqHeroChoice object; resetting on its identity
    // change re-enables the buttons and recovers from a no-op resubmit. Without
    // this the board stays frozen by the block-all guard with no way to act.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingGiveHqHeroChoice,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingGiveHqHeroChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingGiveHqHeroChoice.playerID
      );
    }

    function onSelectCard(cardId: string): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      // why: the engine resolve matches the HQ instance id (cardId), NOT
      // display.extId — the round-trip rule (getEligibleGiveHqHeroCards).
      props.submitMove("resolveGiveHqHeroChoice", { cardId });
    }

    // why: WP-692 / D-24509 — the decline arm for the OPTIONAL free-recruit tactic
    // (Dr. Doom's Dark Technology "may recruit"). Only rendered when the projected
    // choice carries `optional: true`; the engine resolve honors { decline: true }
    // only for an optional front entry (a mandatory pick ignores it).
    function onDecline(): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveGiveHqHeroChoice", { decline: true });
    }

    return {
      isSubmitting,
      shouldRender,
      onSelectCard,
      onDecline,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="pending-give-hq-hero-choice-prompt"
    data-testid="pending-give-hq-hero-choice-prompt"
    role="region"
    aria-label="Give HQ hero choice"
  >
    <h3 class="pending-give-hq-hero-choice-prompt__heading">
      Choose a Hero to gain
    </h3>
    <p class="pending-give-hq-hero-choice-prompt__hint">
      Gain the Hero you choose from the HQ.
    </p>
    <div class="pending-give-hq-hero-choice-prompt__cards">
      <button
        v-for="entry in pendingGiveHqHeroChoice!.eligible"
        :key="entry.cardId"
        type="button"
        class="pending-give-hq-hero-choice-prompt__card-btn"
        :data-testid="`pending-give-hq-hero-choice-card-${entry.cardId}`"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        :title="entry.display.name"
        @click="onSelectCard(entry.cardId)"
      >
        <span class="pending-give-hq-hero-choice-prompt__card-name">{{
          entry.display.name
        }}</span>
        <span
          v-if="entry.display.cost !== undefined"
          class="pending-give-hq-hero-choice-prompt__card-cost"
        >
          Cost {{ entry.display.cost }}
        </span>
        <img
          v-if="entry.display.imageUrl"
          :src="entry.display.imageUrl"
          :alt="entry.display.name"
          class="pending-give-hq-hero-choice-prompt__card-image"
        />
      </button>
    </div>
    <button
      v-if="pendingGiveHqHeroChoice!.optional"
      type="button"
      class="pending-give-hq-hero-choice-prompt__decline-btn"
      data-testid="pending-give-hq-hero-choice-decline"
      :disabled="isSubmitting"
      :aria-disabled="isSubmitting ? 'true' : undefined"
      @click="onDecline()"
    >
      Decline
    </button>
  </div>
</template>

<style scoped>
.pending-give-hq-hero-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.pending-give-hq-hero-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.pending-give-hq-hero-choice-prompt__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #666);
}

.pending-give-hq-hero-choice-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.pending-give-hq-hero-choice-prompt__card-btn {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  align-items: flex-start;
}

.pending-give-hq-hero-choice-prompt__card-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pending-give-hq-hero-choice-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 60px;
}

.pending-give-hq-hero-choice-prompt__card-cost {
  font-size: 0.7rem;
  color: var(--color-text-secondary, #666);
}

.pending-give-hq-hero-choice-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}

.pending-give-hq-hero-choice-prompt__decline-btn {
  align-self: flex-start;
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}

.pending-give-hq-hero-choice-prompt__decline-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
