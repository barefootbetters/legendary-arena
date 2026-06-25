<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingDrawOrEmpowered } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending draw-or-empowered choice (WP-287 / D-24071).
 *
 * Renders iff `pendingDrawOrEmpowered !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Realizes the printed One-Hit Wonder text
 * "Choose one: Draw a card, or you get Empowered by {class}" as two buttons — "Draw a
 * card" and the projected `empoweredLabel`.
 *
 * Pressing "Draw a card" submits `resolveDrawOrEmpowered({ choice: 'draw' })`; pressing
 * the empowered button submits `resolveDrawOrEmpowered({ choice: 'empowered' })`.
 *
 * // why: D-24071 — non-dismissible; controls disable after submit to prevent a double move.
 * The choice is game-blocking (WP-286's block-all guard freezes turn-end until it resolves);
 * the only exits are the two buttons. NOT a modal, NOT position:fixed, NOT <Teleport> —
 * renders in normal document flow above TurnActionBar, mirroring OptionalKoRewardPrompt.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-287 §Scope (In) — inline prompt spec
 * @see EC-319 Locked Values — move args, double-submit guard
 * @see DECISIONS.md D-24071
 */
export default defineComponent({
  name: "DrawOrEmpoweredPrompt",
  props: {
    pendingDrawOrEmpowered: {
      type: Object as PropType<UIPendingDrawOrEmpowered | undefined>,
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
    // fires resolveDrawOrEmpowered twice for one choice. It must clear on every new
    // server frame: the parent page keeps this component mounted for the whole match
    // (only the inner v-if content toggles), so a persistent latch would freeze the
    // controls for the rest of the match. Each server frame delivers a fresh
    // pendingDrawOrEmpowered object; resetting on its identity change re-enables the
    // controls for the next choice and recovers from a no-op resubmit. (A stale
    // resubmit is engine-no-op'd, but the client must not fire it twice.)
    const isSubmitting = ref(false);
    watch(
      () => props.pendingDrawOrEmpowered,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingDrawOrEmpowered !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingDrawOrEmpowered.playerID
      );
    }

    function onChoose(choice: "draw" | "empowered"): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveDrawOrEmpowered", { choice });
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
    class="draw-or-empowered-prompt"
    data-testid="draw-or-empowered-prompt"
    role="region"
    aria-label="Draw or Empowered choice"
  >
    <h3 class="draw-or-empowered-prompt__heading">Choose one</h3>
    <div class="draw-or-empowered-prompt__buttons">
      <button
        type="button"
        class="draw-or-empowered-prompt__btn"
        data-testid="draw-or-empowered-draw"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onChoose('draw')"
      >
        Draw a card
      </button>
      <button
        type="button"
        class="draw-or-empowered-prompt__btn"
        data-testid="draw-or-empowered-empowered"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onChoose('empowered')"
      >
        {{ pendingDrawOrEmpowered!.empoweredLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.draw-or-empowered-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.draw-or-empowered-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.draw-or-empowered-prompt__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.draw-or-empowered-prompt__btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}

.draw-or-empowered-prompt__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
