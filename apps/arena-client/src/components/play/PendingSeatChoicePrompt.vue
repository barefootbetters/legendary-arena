<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingSeatChoice } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Foundational inline prompt for a non-active / multi-seat pending choice
 * (WP-684 / D-24501).
 *
 * This is the SCAFFOLD the capability WP shipped; the concrete, card-specific
 * headings ship with the consuming cards. WP-683 (D-24500) adds the Deadpool
 * headings: 'here-hold-this' (pick a Villain to capture a Bystander),
 * 'random-acts-wound' (optional gain-a-Wound-to-hand), and 'random-acts-pass-left'
 * (pass a card to the player on your left). It renders one button per option from
 * the VIEWER'S OWN prompt only
 * (`pendingSeatChoice.seatPrompts[viewerPlayerId]`) — the engine's per-seat
 * audience filter has already redacted the projection to the viewing seat, so a
 * seat never sees another seat's options.
 *
 * Renders iff `pendingSeatChoice !== undefined AND viewerPlayerId` is an
 * addressed, still-outstanding seat (i.e. its own prompt is present). This is the
 * same posture that lets a NON-ACTIVE seat see and answer a choice addressed to
 * it while the active player is blocked. Pressing an option submits
 * `resolveSeatChoice({ optionIndex })`.
 *
 * // why: the choice is game-blocking (the engine block-all guard freezes turn
 * progress until every addressed seat resolves); the only exits are the option
 * buttons. Mirrors CountScaledChoicePrompt — NOT a modal, renders in normal
 * document flow. Controls disable after submit (double-move guard).
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: "PendingSeatChoicePrompt",
  props: {
    pendingSeatChoice: {
      type: Object as PropType<UIPendingSeatChoice | undefined>,
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
    // why: debounce the controls after a submit so the prompt never fires
    // resolveSeatChoice twice for one choice. Reset on every new server frame (a
    // fresh pendingSeatChoice identity) so the controls re-enable for the next
    // choice and recover from a no-op resubmit (mirrors CountScaledChoicePrompt).
    const isSubmitting = ref(false);
    watch(
      () => props.pendingSeatChoice,
      () => {
        isSubmitting.value = false;
      },
    );

    /** This viewer's own prompt (the filter redacts the projection to only this seat). */
    function ownOptions(): { label: string }[] {
      const choice = props.pendingSeatChoice;
      if (choice === undefined || props.viewerPlayerId === null) {
        return [];
      }
      return choice.seatPrompts[props.viewerPlayerId]?.options ?? [];
    }

    function shouldRender(): boolean {
      return (
        props.pendingSeatChoice !== undefined &&
        props.viewerPlayerId !== null &&
        ownOptions().length > 0
      );
    }

    /**
     * The card-specific heading for this choice, keyed by the projection's `kind`.
     * Diving Block (WP-682 / D-24499) and the Deadpool kinds (WP-683 / D-24500) are the
     * concrete consumers; "Your choice" is the foundational fallback for any other kind.
     */
    function heading(): string {
      switch (props.pendingSeatChoice?.kind) {
        case 'diving-block':
          return 'You would gain a Wound — Diving Block?';
        case 'here-hold-this':
          return 'Choose a Villain to capture a Bystander';
        case 'random-acts-wound':
          return 'Gain a Wound to your hand?';
        case 'random-acts-pass-left':
          return 'Choose a card to pass to the player on your left';
        default:
          return 'Your choice';
      }
    }

    function onChoose(optionIndex: number): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveSeatChoice", { optionIndex });
    }

    return {
      isSubmitting,
      shouldRender,
      ownOptions,
      onChoose,
      heading,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="pending-seat-choice-prompt"
    data-testid="pending-seat-choice-prompt"
    role="region"
    :aria-label="heading()"
  >
    <h3 class="pending-seat-choice-prompt__heading" data-testid="pending-seat-choice-heading">{{ heading() }}</h3>
    <div class="pending-seat-choice-prompt__buttons">
      <button
        v-for="(option, index) in ownOptions()"
        :key="index"
        type="button"
        class="pending-seat-choice-prompt__btn"
        :data-testid="`pending-seat-choice-option-${index}`"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onChoose(index)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.pending-seat-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.pending-seat-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.pending-seat-choice-prompt__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pending-seat-choice-prompt__btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}

.pending-seat-choice-prompt__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
