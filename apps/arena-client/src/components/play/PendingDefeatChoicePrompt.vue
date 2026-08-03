<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingDefeatChoice } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending Silent Sniper defeat-with-a-Bystander
 * choice (WP-486 / D-24291 — "Defeat a Villain or Mastermind that has a
 * Bystander.").
 *
 * Renders iff `pendingDefeatChoice !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Shows the eligible targets (City Villains
 * holding a Bystander + the Mastermind); the player clicks ONE and it submits
 * `resolveDefeatChoice({ targetKind, cityIndex })` immediately (mandatory-if-able:
 * exactly one pick, no confirm step, no decline).
 *
 * NOT a modal — the choice is game-blocking and cannot be dismissed.
 * NOT position:fixed. NOT <Teleport>. Renders in normal document flow.
 *
 * Mirrors PendingReorderChoicePrompt.vue (mirror-not-import). Per D-6512: uses
 * `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-486 §Scope (In) — inline prompt spec
 * @see EC-521 Locked Values — move args, render formula, gate precedence
 * @see DECISIONS.md D-24291
 */
export default defineComponent({
  name: "PendingDefeatChoicePrompt",
  props: {
    pendingDefeatChoice: {
      type: Object as PropType<UIPendingDefeatChoice | undefined>,
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
    // why: isSubmitting debounces a same-frame double-click ONLY. It must reset on
    // every new server frame — the parent page keeps this component mounted for the
    // whole match (only its inner `v-if` content toggles), so a persistent latch
    // would freeze the next defeat choice. Each server frame delivers a fresh
    // pendingDefeatChoice object; resetting on its identity change re-enables the
    // prompt and recovers from a no-op resubmit. Without this the board stays frozen
    // by the block-all guard.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingDefeatChoice,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingDefeatChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingDefeatChoice.playerID
      );
    }

    /** The prompt label for a target — the Mastermind is prefixed for clarity. */
    function targetLabel(kind: "villain" | "mastermind", name: string): string {
      return kind === "mastermind" ? `Mastermind: ${name}` : name;
    }

    function onChoose(targetIndex: number): void {
      if (isSubmitting.value || !props.pendingDefeatChoice) return;
      const target = props.pendingDefeatChoice.targets[targetIndex];
      if (!target) return;
      isSubmitting.value = true;
      // why: a villain target carries its City space index (the engine resolve
      // selector); the Mastermind target omits it.
      if (target.kind === "villain") {
        props.submitMove("resolveDefeatChoice", { targetKind: "villain", cityIndex: target.cityIndex });
        return;
      }
      props.submitMove("resolveDefeatChoice", { targetKind: "mastermind" });
    }

    return {
      isSubmitting,
      shouldRender,
      targetLabel,
      onChoose,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="pending-defeat-choice-prompt"
    data-testid="pending-defeat-choice-prompt"
    role="region"
    aria-label="Defeat choice"
  >
    <h3 class="pending-defeat-choice-prompt__heading">
      Defeat a Villain or Mastermind that has a Bystander
      <span class="pending-defeat-choice-prompt__hint">
        (click a target)
      </span>
    </h3>
    <div class="pending-defeat-choice-prompt__targets">
      <button
        v-for="(target, targetIndex) in pendingDefeatChoice!.targets"
        :key="`${targetIndex}:${target.kind}:${target.cityIndex ?? 'm'}`"
        type="button"
        class="pending-defeat-choice-prompt__target-btn"
        :data-testid="`pending-defeat-choice-target-${targetIndex}`"
        :disabled="isSubmitting"
        :title="targetLabel(target.kind, target.display.name)"
        @click="onChoose(targetIndex)"
      >
        <span class="pending-defeat-choice-prompt__target-name">{{ targetLabel(target.kind, target.display.name) }}</span>
        <img
          v-if="target.display.imageUrl"
          :src="target.display.imageUrl"
          :alt="target.display.name"
          class="pending-defeat-choice-prompt__target-image"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.pending-defeat-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.pending-defeat-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.pending-defeat-choice-prompt__hint {
  font-size: 0.85rem;
  font-weight: normal;
  color: var(--color-text-secondary, #666);
}

.pending-defeat-choice-prompt__targets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.pending-defeat-choice-prompt__target-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  align-items: flex-start;
}

.pending-defeat-choice-prompt__target-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pending-defeat-choice-prompt__target-name {
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 90px;
}

.pending-defeat-choice-prompt__target-image {
  max-width: 60px;
  max-height: 60px;
  object-fit: contain;
}
</style>
