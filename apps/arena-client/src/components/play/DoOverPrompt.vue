<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingDoOver } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending Do-Over choice (WP-681 / D-24498 — Deadpool's
 * "Hey, Can I Get a Do-Over?").
 *
 * Renders iff `pendingDoOver !== undefined AND viewerPlayerId === playerID`. Hidden for
 * opponents and spectators. Realizes the printed "you may discard the rest of your hand and
 * draw four cards" as two buttons — an Accept button labeled with the concrete cost
 * ("Discard N cards and draw 4") and a Decline button.
 *
 * Pressing Accept submits `resolveDoOver({ accept: true })`; pressing Decline submits
 * `resolveDoOver({ decline: true })`. The client submits INTENT only — the ENGINE performs
 * the discard + draw.
 *
 * // why: D-24498 — non-dismissible; controls disable after submit to prevent a double move.
 * The choice is game-blocking (WP-681's block-all guard freezes turn-end until it resolves);
 * the only exits are the two buttons. NOT a modal, NOT position:fixed, NOT <Teleport> —
 * renders in normal document flow above TurnActionBar, mirroring DrawOrEmpoweredPrompt.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-681 §Scope (In) — inline prompt spec
 * @see EC-718 Locked Values — move args, double-submit guard
 * @see DECISIONS.md D-24498
 */
export default defineComponent({
  name: "DoOverPrompt",
  props: {
    pendingDoOver: {
      type: Object as PropType<UIPendingDoOver | undefined>,
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
    // why: isSubmitting debounces the controls after a submit so the prompt never fires
    // resolveDoOver twice for one choice. It must clear on every new server frame: the parent
    // page keeps this component mounted for the whole match (only the inner v-if content
    // toggles), so a persistent latch would freeze the controls for the rest of the match.
    // Each server frame delivers a fresh pendingDoOver object; resetting on its identity
    // change re-enables the controls for the next choice and recovers from a no-op resubmit.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingDoOver,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingDoOver !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingDoOver.playerID
      );
    }

    function onChoose(choice: "accept" | "decline"): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      if (choice === "accept") {
        props.submitMove("resolveDoOver", { accept: true });
      } else {
        props.submitMove("resolveDoOver", { decline: true });
      }
    }

    return {
      isSubmitting,
      shouldRender,
      onChoose,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="do-over-prompt"
    data-testid="do-over-prompt"
    role="region"
    aria-label="Do-Over choice"
  >
    <h3 class="do-over-prompt__heading">Hey, can I get a Do-Over?</h3>
    <div class="do-over-prompt__buttons">
      <button
        type="button"
        class="do-over-prompt__btn"
        data-testid="do-over-accept"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onChoose('accept')"
      >
        Discard {{ pendingDoOver!.handSize }} card(s) and draw {{ pendingDoOver!.drawCount }}
      </button>
      <button
        type="button"
        class="do-over-prompt__btn"
        data-testid="do-over-decline"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onChoose('decline')"
      >
        Decline
      </button>
    </div>
  </div>
</template>

<style scoped>
.do-over-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.do-over-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.do-over-prompt__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.do-over-prompt__btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}

.do-over-prompt__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
