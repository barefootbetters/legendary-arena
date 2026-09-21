<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingCoveringFireChoice } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending Covering Fire choice (WP-719 / D-24541 — Hawkeye's
 * "Covering Fire").
 *
 * Renders iff `pendingCoveringFireChoice !== undefined AND viewerPlayerId === playerID`. Hidden
 * for opponents and spectators. Realizes the printed "Choose one: each other player draws a card
 * or each other player discards a card" as two buttons — a Draw button and a Discard button, each
 * labeled with the number of other seats affected.
 *
 * Pressing Draw submits `resolveCoveringFireChoice({ choice: 'draw' })`; pressing Discard submits
 * `resolveCoveringFireChoice({ choice: 'discard' })`. The client submits INTENT only — the ENGINE
 * applies the chosen branch to each other seat.
 *
 * // why: D-24541 — non-dismissible; controls disable after submit to prevent a double move. The
 * choice is game-blocking (WP-719's block-all guard freezes turn-end until it resolves); the only
 * exits are the two buttons. NOT a modal, NOT position:fixed, NOT <Teleport> — renders in normal
 * document flow above TurnActionBar, mirroring DoOverPrompt / DrawOrEmpoweredPrompt.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-719 §Scope (In) — inline prompt spec
 * @see EC-756 Locked Values — move args, double-submit guard
 * @see DECISIONS.md D-24541
 */
export default defineComponent({
  name: "CoveringFireChoicePrompt",
  props: {
    pendingCoveringFireChoice: {
      type: Object as PropType<UIPendingCoveringFireChoice | undefined>,
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
    // resolveCoveringFireChoice twice for one choice. It must clear on every new server frame:
    // the parent page keeps this component mounted for the whole match (only the inner v-if
    // content toggles), so a persistent latch would freeze the controls for the rest of the
    // match. Each server frame delivers a fresh pendingCoveringFireChoice object; resetting on
    // its identity change re-enables the controls for the next choice.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingCoveringFireChoice,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingCoveringFireChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingCoveringFireChoice.playerID
      );
    }

    function onChoose(choice: "draw" | "discard"): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveCoveringFireChoice", { choice });
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
    class="covering-fire-prompt"
    data-testid="covering-fire-prompt"
    role="region"
    aria-label="Covering Fire choice"
  >
    <h3 class="covering-fire-prompt__heading">Covering Fire — choose one</h3>
    <div class="covering-fire-prompt__buttons">
      <button
        type="button"
        class="covering-fire-prompt__btn"
        data-testid="covering-fire-draw"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onChoose('draw')"
      >
        Each of {{ pendingCoveringFireChoice!.otherPlayerCount }} other player(s) draws a card
      </button>
      <button
        type="button"
        class="covering-fire-prompt__btn"
        data-testid="covering-fire-discard"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onChoose('discard')"
      >
        Each of {{ pendingCoveringFireChoice!.otherPlayerCount }} other player(s) discards a card
      </button>
    </div>
  </div>
</template>

<style scoped>
.covering-fire-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.covering-fire-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.covering-fire-prompt__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.covering-fire-prompt__btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}

.covering-fire-prompt__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
