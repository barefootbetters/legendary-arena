<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingSplitFaceChoice, UISplitFaceOption } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";
import AbilityText from "./AbilityText.vue";

/**
 * Inline picker for a pending split / dual-faced hero "choose a side" choice (WP-725 / D-24546 —
 * the client half of the WP-724 engine mechanic that un-defers D-14101).
 *
 * Renders iff `pendingSplitFaceChoice !== undefined AND viewerPlayerId === playerID`. Hidden for
 * opponents and spectators (the field is already chooser-redacted server-side; this double-gates).
 * Realizes the two halves of a split card as two buttons — each labeled with that face's name,
 * ability text (routed through AbilityText.vue, never raw marker syntax), cost, and base economy.
 *
 * Pressing face A submits `resolveSplitFaceChoice({ face: 'a' })`; face B submits
 * `resolveSplitFaceChoice({ face: 'b' })`. The client submits INTENT only — the ENGINE binds the
 * chosen face, grants its economy, and fires its ability (the other face does nothing).
 *
 * // why: D-24546 — non-dismissible; controls disable after submit to prevent a double move. The
 * choice is game-blocking (WP-724's block-all guard freezes turn-end until it resolves); the only
 * exits are the two buttons. NOT a modal, NOT position:fixed — renders in normal document flow
 * above TurnActionBar, mirroring CoveringFireChoicePrompt.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-725 §Scope (In) — inline picker spec
 * @see EC-762 Locked Values — move args, double-submit guard, AbilityText routing
 * @see DECISIONS.md D-24546
 */
export default defineComponent({
  name: "SplitFaceChoicePrompt",
  components: { AbilityText },
  props: {
    pendingSplitFaceChoice: {
      type: Object as PropType<UIPendingSplitFaceChoice | undefined>,
      required: false,
      default: undefined,
    },
    viewerPlayerId: {
      // why: null signals a spectator with no assigned playerId; the picker must not render then.
      type: [String, null] as unknown as PropType<string | null>,
      required: true,
    },
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
  },
  setup(props) {
    // why: isSubmitting debounces the controls after a submit so the picker never fires
    // resolveSplitFaceChoice twice for one choice. The parent keeps this component mounted for the
    // whole match (only the inner v-if toggles), so a persistent latch would freeze the controls;
    // each server frame delivers a fresh pendingSplitFaceChoice object, so resetting on its identity
    // change re-enables the controls for the next choice (mirrors CoveringFireChoicePrompt).
    const isSubmitting = ref(false);
    watch(
      () => props.pendingSplitFaceChoice,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingSplitFaceChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingSplitFaceChoice.playerID
      );
    }

    /** Builds the "+N Attack / +N Recruit" economy label for a face (omits zero contributions). */
    function economyLabel(face: UISplitFaceOption): string {
      const parts: string[] = [];
      if (face.attack > 0) parts.push(`+${String(face.attack)} Attack`);
      if (face.recruit > 0) parts.push(`+${String(face.recruit)} Recruit`);
      return parts.join(", ");
    }

    function onChoose(face: "a" | "b"): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveSplitFaceChoice", { face });
    }

    return {
      isSubmitting,
      shouldRender,
      economyLabel,
      onChoose,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="split-face-prompt"
    data-testid="arena-hud-split-face-choice"
    role="region"
    aria-label="Choose a side"
  >
    <h3 class="split-face-prompt__heading">Choose a side</h3>
    <div class="split-face-prompt__buttons">
      <button
        type="button"
        class="split-face-prompt__btn"
        data-testid="split-face-a"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onChoose('a')"
      >
        <span class="split-face-prompt__name">{{ pendingSplitFaceChoice!.faceA.name }}</span>
        <span v-if="economyLabel(pendingSplitFaceChoice!.faceA)" class="split-face-prompt__economy">{{ economyLabel(pendingSplitFaceChoice!.faceA) }}</span>
        <AbilityText v-if="pendingSplitFaceChoice!.faceA.abilityText" :text="pendingSplitFaceChoice!.faceA.abilityText" />
      </button>
      <button
        type="button"
        class="split-face-prompt__btn"
        data-testid="split-face-b"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onChoose('b')"
      >
        <span class="split-face-prompt__name">{{ pendingSplitFaceChoice!.faceB.name }}</span>
        <span v-if="economyLabel(pendingSplitFaceChoice!.faceB)" class="split-face-prompt__economy">{{ economyLabel(pendingSplitFaceChoice!.faceB) }}</span>
        <AbilityText v-if="pendingSplitFaceChoice!.faceB.abilityText" :text="pendingSplitFaceChoice!.faceB.abilityText" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.split-face-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.split-face-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.split-face-prompt__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.split-face-prompt__btn {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-start;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
  text-align: left;
}

.split-face-prompt__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.split-face-prompt__name {
  font-weight: 600;
}

.split-face-prompt__economy {
  font-variant-numeric: tabular-nums;
}
</style>
