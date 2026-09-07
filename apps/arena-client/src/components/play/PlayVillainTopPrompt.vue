<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingPlayVillainTop } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/**
 * Inline prompt for resolving a pending play-top-Villain-Deck choice (WP-663 / D-24474 —
 * Emma Frost's Shadowed Thoughts).
 *
 * Renders iff `pendingPlayVillainTop !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. Realizes the printed text "You may play the top
 * card of the Villain Deck. If you do, you get +N Attack." as two buttons — an accept
 * ("Play the top Villain Deck card") and a decline.
 *
 * Pressing accept submits `resolvePlayVillainTopChoice({ accept: true })`; pressing decline
 * submits `resolvePlayVillainTopChoice({ accept: false })`.
 *
 * // why: D-24474 — playing the top Villain-Deck card has a real downside (it can enter the
 * city as a threat), so the "may" is a GENUINE choice — the prompt never auto-takes it, and
 * both buttons stay first-class exits. Non-dismissible; controls disable after submit to
 * prevent a double move. The choice is game-blocking (the engine block-all guard freezes the
 * board until it resolves); the only exits are the two buttons. NOT a modal, NOT
 * position:fixed, NOT <Teleport> — renders in normal document flow above TurnActionBar,
 * mirroring DrawOrEmpoweredPrompt / OptionalKoRewardPrompt.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-663 §Scope (In) — inline prompt spec
 * @see EC-700 — move args, double-submit guard
 * @see DECISIONS.md D-24474
 */
export default defineComponent({
  name: "PlayVillainTopPrompt",
  props: {
    pendingPlayVillainTop: {
      type: Object as PropType<UIPendingPlayVillainTop | undefined>,
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
    // resolvePlayVillainTopChoice twice for one choice. It must clear on every new server
    // frame: the parent page keeps this component mounted for the whole match (only the
    // inner v-if content toggles), so a persistent latch would freeze the controls for the
    // rest of the match. Each server frame delivers a fresh pendingPlayVillainTop object;
    // resetting on its identity change re-enables the controls for the next choice and
    // recovers from a no-op resubmit. (A stale resubmit is engine-no-op'd, but the client
    // must not fire it twice.)
    const isSubmitting = ref(false);
    watch(
      () => props.pendingPlayVillainTop,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingPlayVillainTop !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingPlayVillainTop.playerID
      );
    }

    function onChoose(accept: boolean): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolvePlayVillainTopChoice", { accept });
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
    class="play-villain-top-prompt"
    data-testid="play-villain-top-prompt"
    role="region"
    aria-label="Play the top Villain Deck card choice"
  >
    <h3 class="play-villain-top-prompt__heading">Shadowed Thoughts</h3>
    <p class="play-villain-top-prompt__body">
      You may play the top card of the Villain Deck. If you do, you get
      +{{ pendingPlayVillainTop!.attackReward }} Attack.
    </p>
    <div class="play-villain-top-prompt__buttons">
      <button
        type="button"
        class="play-villain-top-prompt__btn play-villain-top-prompt__btn--accept"
        data-testid="play-villain-top-accept"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onChoose(true)"
      >
        Play the top Villain Deck card (+{{ pendingPlayVillainTop!.attackReward }} Attack)
      </button>
      <button
        type="button"
        class="play-villain-top-prompt__btn play-villain-top-prompt__btn--decline"
        data-testid="play-villain-top-decline"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onChoose(false)"
      >
        Decline
      </button>
    </div>
  </div>
</template>

<style scoped>
.play-villain-top-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.play-villain-top-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.play-villain-top-prompt__body {
  margin: 0;
  font-size: 0.85rem;
}

.play-villain-top-prompt__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.play-villain-top-prompt__btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}

.play-villain-top-prompt__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
