<script lang="ts">
import { computed, defineComponent, ref, watch, type PropType } from "vue";
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
 * // why: the buttons render in PRINTED left-to-right order (`leftFace` first), not faceA-first —
 * sides[] order is not the printed order (for 19 of 39 split cards faceB is the left half), and a
 * picker whose order contradicts the card art invites a mis-click. Each button still carries its
 * own face id, so the submitted `face` is unaffected by the display order.
 *
 * // why: D-24546 — non-dismissible; controls disable after submit to prevent a double move. The
 * choice is game-blocking (WP-724's block-all guard freezes turn-end until it resolves); the only
 * exits are the two buttons. NOT a modal, NOT position:fixed — renders in normal document flow
 * above TurnActionBar, mirroring CoveringFireChoicePrompt.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 *
 * // why: WP-778 / D-24615 — a side with a discard-to-play cost ("To play this side, you must
 * discard a card", bkwd Attune) shows its cost, and a side the hand cannot pay is disabled with the
 * reason. Both come from the served `isSelectable` / `discardToPlayCost` fields verbatim — the client
 * never counts the hand itself (D-20105).
 *
 * @see WP-725 §Scope (In) — inline picker spec
 * @see WP-778 §Locked Contract Values — cost line, blocked hint, guard-before-latch
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

    /** The two faces in printed left-to-right order, each paired with the face id it submits. */
    const orderedFaces = computed((): { face: "a" | "b"; option: UISplitFaceOption }[] => {
      const pending = props.pendingSplitFaceChoice;
      if (pending === undefined) return [];
      const faceAEntry = { face: "a" as const, option: pending.faceA };
      const faceBEntry = { face: "b" as const, option: pending.faceB };
      if (pending.leftFace === "b") return [faceBEntry, faceAEntry];
      return [faceAEntry, faceBEntry];
    });

    /**
     * Whether a face's button is disabled: while a submit is in flight, or when the engine says the
     * face is not selectable.
     *
     * // why: WP-778 / D-24615 — the engine rejects a side whose discard-to-play cost the hand cannot
     * pay (bkwd Attune from an empty hand), so the button must not offer it. `isSelectable` is
     * optional in the engine type: absent means selectable (today's render), so compare to `false`
     * explicitly rather than reading `!option.isSelectable`.
     */
    function isFaceDisabled(option: UISplitFaceOption): boolean {
      return isSubmitting.value || option.isSelectable === false;
    }

    /** The served discard cost of a face; an absent field means no cost (today's render). */
    function faceDiscardCost(option: UISplitFaceOption): number {
      return option.discardToPlayCost ?? 0;
    }

    /** The "Discard … to play this side" line for a costed face (empty when the face is free). */
    function costLabel(option: UISplitFaceOption): string {
      const cost = faceDiscardCost(option);
      if (cost <= 0) {
        return "";
      }
      if (cost === 1) {
        return "Discard a card to play this side";
      }
      return `Discard ${String(cost)} cards to play this side`;
    }

    /** Why an unselectable face is disabled (singular for a one-card cost, plural otherwise). */
    function blockedHint(option: UISplitFaceOption): string {
      if (faceDiscardCost(option) <= 1) {
        return "No card in hand to discard";
      }
      return "Not enough cards in hand to discard";
    }

    /** Submits the chosen side, unless its button is disabled or a submit is already in flight. */
    function onChoose(entry: { face: "a" | "b"; option: UISplitFaceOption }): void {
      // why: the disabled guard runs BEFORE the latch. A latch set by a blocked click would disable
      // the other side too, and no server frame would arrive to reset it (no move was sent).
      if (isFaceDisabled(entry.option)) return;
      isSubmitting.value = true;
      props.submitMove("resolveSplitFaceChoice", { face: entry.face });
    }

    return {
      isSubmitting,
      shouldRender,
      orderedFaces,
      economyLabel,
      isFaceDisabled,
      costLabel,
      blockedHint,
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
        v-for="entry in orderedFaces"
        :key="entry.face"
        type="button"
        class="split-face-prompt__btn"
        :data-testid="`split-face-${entry.face}`"
        :disabled="isFaceDisabled(entry.option)"
        :aria-disabled="isFaceDisabled(entry.option) ? 'true' : undefined"
        @click="onChoose(entry)"
      >
        <span class="split-face-prompt__name">{{ entry.option.name }}</span>
        <span v-if="economyLabel(entry.option)" class="split-face-prompt__economy">{{ economyLabel(entry.option) }}</span>
        <span
          v-if="costLabel(entry.option)"
          class="split-face-prompt__cost"
          :data-testid="`split-face-${entry.face}-cost`"
        >{{ costLabel(entry.option) }}</span>
        <span
          v-if="entry.option.isSelectable === false"
          class="split-face-prompt__blocked"
          :data-testid="`split-face-${entry.face}-blocked`"
        >{{ blockedHint(entry.option) }}</span>
        <AbilityText v-if="entry.option.abilityText" :text="entry.option.abilityText" />
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

.split-face-prompt__blocked {
  font-style: italic;
}
</style>
