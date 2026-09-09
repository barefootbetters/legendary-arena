<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingSmashDiscard } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending Smash discard-for-attack choice
 * (WP-676 / D-24492 — the `smash` hero keyword, the wwhk set).
 *
 * Renders iff `pendingSmashDiscard !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Shows the "+N attack" it grants, then the
 * eligible hand cards to discard plus a first-class **Decline** button.
 *
 * Selecting a card submits `resolveSmashDiscard({ cardId })`; Decline submits
 * `resolveSmashDiscard({ decline: true })`. The client submits INTENT only — the
 * engine computes and applies the Attack grant.
 *
 * // why: D-24492 — NON-DISMISSIBLE while the choice is pending. The choice is
 * game-blocking (WP-676's block-all guard freezes turn-end until it resolves); the
 * only exits are discarding a card or pressing Decline. NOT a modal, NOT
 * position:fixed, NOT <Teleport> — renders in normal document flow above
 * TurnActionBar, mirroring OptionalKoRewardPrompt.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-676 §Scope (In) — inline prompt spec
 * @see EC-713 Locked Values — move args, round-trip rule, double-submit guard
 * @see DECISIONS.md D-24492
 */
export default defineComponent({
  name: "SmashDiscardPrompt",
  props: {
    pendingSmashDiscard: {
      type: Object as PropType<UIPendingSmashDiscard | undefined>,
      required: false,
      default: undefined,
    },
    viewerPlayerId: {
      // why: null signals a spectator with no assigned playerId; the prompt
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
    // why: isSubmitting debounces the controls after a submit so the prompt never
    // fires resolveSmashDiscard twice for one choice. It must clear on every new
    // server frame: the parent page keeps this component mounted for the whole match
    // (only the inner v-if content toggles), so a persistent latch would freeze the
    // controls. Each server frame delivers a fresh pendingSmashDiscard object;
    // resetting on its identity change re-enables the controls for the next choice
    // (a Hurl Trucks card parks two in a row) and recovers from a no-op resubmit.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingSmashDiscard,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingSmashDiscard !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingSmashDiscard.playerID
      );
    }

    function onSelectCard(cardId: string): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveSmashDiscard", { cardId });
    }

    function onDecline(): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveSmashDiscard", { decline: true });
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
    class="smash-discard-prompt"
    data-testid="smash-discard-prompt"
    role="region"
    aria-label="Smash discard-for-attack choice"
  >
    <h3 class="smash-discard-prompt__heading">
      Discard a card for
      <span class="smash-discard-prompt__reward">+{{ pendingSmashDiscard!.magnitude }} attack</span>
      (Smash)
    </h3>
    <div
      v-if="pendingSmashDiscard!.eligibleHand.length > 0"
      class="smash-discard-prompt__zone"
    >
      <h4 class="smash-discard-prompt__zone-label">From your hand</h4>
      <div class="smash-discard-prompt__cards">
        <button
          v-for="entry in pendingSmashDiscard!.eligibleHand"
          :key="`${entry.zone}:${entry.cardId}`"
          type="button"
          class="smash-discard-prompt__card-btn"
          :data-testid="`smash-discard-card-${entry.cardId}`"
          :disabled="isSubmitting"
          :aria-disabled="isSubmitting ? 'true' : undefined"
          :title="entry.display.name"
          @click="onSelectCard(entry.cardId)"
        >
          <span class="smash-discard-prompt__card-name">{{ entry.display.name }}</span>
          <img
            v-if="entry.display.imageUrl"
            :src="entry.display.imageUrl"
            :alt="entry.display.name"
            class="smash-discard-prompt__card-image"
          />
        </button>
      </div>
    </div>
    <button
      type="button"
      class="smash-discard-prompt__decline-btn"
      data-testid="smash-discard-decline"
      :disabled="isSubmitting"
      :aria-disabled="isSubmitting ? 'true' : undefined"
      @click="onDecline"
    >
      Decline
    </button>
  </div>
</template>

<style scoped>
.smash-discard-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.smash-discard-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.smash-discard-prompt__reward {
  color: var(--color-accent, #b5651d);
}

.smash-discard-prompt__zone {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.smash-discard-prompt__zone-label {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 500;
}

.smash-discard-prompt__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.smash-discard-prompt__card-btn {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  align-items: flex-start;
}

.smash-discard-prompt__card-btn:disabled,
.smash-discard-prompt__decline-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.smash-discard-prompt__card-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 60px;
}

.smash-discard-prompt__card-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}

.smash-discard-prompt__decline-btn {
  align-self: flex-start;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}
</style>
