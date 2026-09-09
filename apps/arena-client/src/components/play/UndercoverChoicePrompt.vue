<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingUndercoverChoice } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending Undercover target pick (WP-678 / D-24494; the
 * client half deferred from WP-678 and shipped with WP-679 / D-24495).
 *
 * Parked when a "send a [team:shield] Hero from your hand Undercover" effect has TWO OR MORE
 * eligible hand Heroes (0 → no-op, 1 → auto-send, neither parks). Reached both from a bare
 * Undercover card and from the shld mixed choose-one's Undercover option (a nested pick).
 *
 * Renders iff `pendingUndercoverChoice !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Lists the eligible hand-Hero ext_ids as buttons;
 * clicking one submits `resolveUndercoverChoice({ targetExtId })`.
 *
 * // why: game-blocking (WP-678's block-all guard freezes turn-end until it resolves); the
 * only exit is picking a Hero. NOT a modal — renders in normal document flow, mirroring
 * CountScaledChoicePrompt / VictoryPileCardPickPrompt. Controls disable after submit.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: "UndercoverChoicePrompt",
  props: {
    pendingUndercoverChoice: {
      type: Object as PropType<UIPendingUndercoverChoice | undefined>,
      required: false,
      default: undefined,
    },
    viewerPlayerId: {
      // why: null signals a spectator with no assigned playerId; the prompt must not render.
      type: [String, null] as unknown as PropType<string | null>,
      required: true,
    },
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
  },
  setup(props) {
    // why: debounce the controls after a submit so the prompt never fires resolveUndercoverChoice
    // twice. Reset on every new server frame (a fresh pendingUndercoverChoice identity) so the
    // controls re-enable for the next pick (mirrors CountScaledChoicePrompt).
    const isSubmitting = ref(false);
    watch(
      () => props.pendingUndercoverChoice,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingUndercoverChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingUndercoverChoice.playerID
      );
    }

    function onPick(targetExtId: string): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveUndercoverChoice", { targetExtId });
    }

    return {
      isSubmitting,
      shouldRender,
      onPick,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="undercover-choice-prompt"
    data-testid="undercover-choice-prompt"
    role="region"
    aria-label="Undercover target"
  >
    <h3 class="undercover-choice-prompt__heading">Send which S.H.I.E.L.D. Hero Undercover?</h3>
    <div class="undercover-choice-prompt__buttons">
      <button
        v-for="(targetExtId, index) in pendingUndercoverChoice!.eligibleTargets"
        :key="targetExtId"
        type="button"
        class="undercover-choice-prompt__btn"
        :data-testid="`undercover-choice-option-${index}`"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onPick(targetExtId)"
      >
        {{ targetExtId }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.undercover-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.undercover-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.undercover-choice-prompt__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.undercover-choice-prompt__btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}

.undercover-choice-prompt__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
