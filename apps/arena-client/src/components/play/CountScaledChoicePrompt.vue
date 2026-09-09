<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingCountScaledChoice } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending count-scaled choose-one (WP-675 / D-24490 — vnom's
 * Symbiotic Adaptation).
 *
 * Renders iff `pendingCountScaledChoice !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Realizes the printed "Choose one: +N recruit for each
 * other card with a recruit icon / Or +N attack for each other card with an attack icon" as
 * one button per option, each labelled with its RESOLVED grant (e.g. "+2 Recruit").
 *
 * Pressing an option submits `resolveCountScaledChoice({ optionIndex })`.
 *
 * // why: the choice is game-blocking (WP-675's block-all guard freezes turn-end until it
 * resolves); the only exits are the option buttons. Mirrors DrawOrEmpoweredPrompt — NOT a
 * modal, renders in normal document flow. Controls disable after submit (double-move guard).
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: "CountScaledChoicePrompt",
  props: {
    pendingCountScaledChoice: {
      type: Object as PropType<UIPendingCountScaledChoice | undefined>,
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
    // resolveCountScaledChoice twice for one choice. Reset on every new server frame (a fresh
    // pendingCountScaledChoice identity) so the controls re-enable for the next choice and
    // recover from a no-op resubmit (mirrors DrawOrEmpoweredPrompt).
    const isSubmitting = ref(false);
    watch(
      () => props.pendingCountScaledChoice,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingCountScaledChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingCountScaledChoice.playerID
      );
    }

    /** "+2 Recruit" / "+3 Attack" — the resolved grant this option would apply now. */
    function optionLabel(option: { resource: "attack" | "recruit"; total: number }): string {
      const resourceLabel = option.resource === "attack" ? "Attack" : "Recruit";
      return `+${option.total} ${resourceLabel}`;
    }

    function onChoose(optionIndex: number): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveCountScaledChoice", { optionIndex });
    }

    return {
      isSubmitting,
      shouldRender,
      optionLabel,
      onChoose,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="count-scaled-choice-prompt"
    data-testid="count-scaled-choice-prompt"
    role="region"
    aria-label="Count-scaled choice"
  >
    <h3 class="count-scaled-choice-prompt__heading">Choose one</h3>
    <div class="count-scaled-choice-prompt__buttons">
      <button
        v-for="(option, index) in pendingCountScaledChoice!.options"
        :key="index"
        type="button"
        class="count-scaled-choice-prompt__btn"
        :data-testid="`count-scaled-choice-option-${index}`"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onChoose(index)"
      >
        {{ optionLabel(option) }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.count-scaled-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.count-scaled-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.count-scaled-choice-prompt__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.count-scaled-choice-prompt__btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}

.count-scaled-choice-prompt__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
