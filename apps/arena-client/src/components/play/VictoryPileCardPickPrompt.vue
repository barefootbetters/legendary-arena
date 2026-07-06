<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingVictoryPileCardPick } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending victory-pile villain pick (WP-313 / D-24099 —
 * the UX half of WP-285's `victory-villain-attack`, e.g. The Ebony Blade).
 *
 * Renders iff `pendingVictoryPileCardPick !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Lists the eligible villains from the player's
 * victory pile, each as a button showing the villain's name and its `+N Attack` value.
 * Clicking one submits `resolveVictoryPileCardPick({ cardId })`.
 *
 * // why: D-24099 — non-dismissible; controls disable after submit to prevent a double
 * move. The choice is game-blocking (WP-285's block-all guard freezes turn-end until it
 * resolves); the only exit is picking a villain. NOT a modal, NOT position:fixed, NOT
 * <Teleport> — renders in normal document flow above TurnActionBar, mirroring
 * DrawOrEmpoweredPrompt / OptionalKoRewardPrompt.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: "VictoryPileCardPickPrompt",
  props: {
    pendingVictoryPileCardPick: {
      type: Object as PropType<UIPendingVictoryPileCardPick | undefined>,
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
    // why: isSubmitting debounces the buttons after a submit so the prompt never fires
    // resolveVictoryPileCardPick twice for one pick. It clears on every new server frame
    // (a fresh pendingVictoryPileCardPick object identity), because the parent page keeps
    // this component mounted for the whole match — a persistent latch would freeze the
    // controls. A stale resubmit is engine-no-op'd, but the client must not fire twice.
    const isSubmitting = ref(false);
    watch(
      () => props.pendingVictoryPileCardPick,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingVictoryPileCardPick !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingVictoryPileCardPick.playerID
      );
    }

    function onPick(cardId: string): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveVictoryPileCardPick", { cardId });
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
    class="victory-pile-pick-prompt"
    data-testid="victory-pile-pick-prompt"
    role="region"
    aria-label="Victory-pile villain pick"
  >
    <h3 class="victory-pile-pick-prompt__heading">Choose a Villain from your Victory Pile</h3>
    <div class="victory-pile-pick-prompt__buttons">
      <button
        v-for="villain in pendingVictoryPileCardPick!.eligibleVillains"
        :key="villain.cardId"
        type="button"
        class="victory-pile-pick-prompt__btn"
        :data-testid="`victory-pile-pick-${villain.cardId}`"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onPick(villain.cardId)"
      >
        {{ villain.display.name }} (+{{ villain.attackValue }} Attack)
      </button>
    </div>
  </div>
</template>

<style scoped>
.victory-pile-pick-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.victory-pile-pick-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.victory-pile-pick-prompt__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.victory-pile-pick-prompt__btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}

.victory-pile-pick-prompt__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
