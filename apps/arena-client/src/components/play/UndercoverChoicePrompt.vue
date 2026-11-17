<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UIPendingUndercoverChoice } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";
import CardImage from "./CardImage.vue";

/**
 * Inline prompt for resolving a pending Undercover target pick (WP-678 / D-24494; the
 * client half deferred from WP-678 and shipped with WP-679 / D-24495; the your-hero shape
 * added by WP-901 / D-24858).
 *
 * Two shapes:
 * - S.H.I.E.L.D. hand pick (D-24494): a "send a [team:shield] Hero from your hand Undercover"
 *   effect with TWO OR MORE eligible hand Heroes (0 → no-op, 1 → auto-send, neither parks).
 *   Reached both from a bare Undercover card and from the shld mixed choose-one's Undercover
 *   option (a nested pick). Lists the eligible hand-Hero ext_ids; no decline.
 * - Your-hero pick (D-24858): "You may send one of your [other] Heroes Undercover". The
 *   projection carries `eligibleHand` / `eligibleInPlay` (named cards) and `canDecline`, so the
 *   prompt shows a "From your hand" and a "Played this turn" group plus a "Don't send" button.
 *
 * Renders iff `pendingUndercoverChoice !== undefined AND viewerPlayerId === playerID`.
 * Hidden for opponents and spectators. A pick submits
 * `resolveUndercoverChoice({ targetExtId })` (S.H.I.E.L.D.) or `({ zone, targetExtId })`
 * (your-hero); "Don't send" submits `({ decline: true })`.
 *
 * // why: game-blocking (WP-678's block-all guard freezes turn-end until it resolves). NOT a
 * modal — renders in normal document flow, mirroring CountScaledChoicePrompt /
 * VictoryPileCardPickPrompt. Controls disable after submit.
 *
 * Per D-6512: uses `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: "UndercoverChoicePrompt",
  components: { CardImage },
  props: {
    pendingUndercoverChoice: {
      type: Object as PropType<UIPendingUndercoverChoice | undefined>,
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
    // why: debounce the controls after a submit so the prompt never fires resolveUndercoverChoice
    // twice. Reset on every new server frame (a fresh pendingUndercoverChoice identity) so the
    // controls re-enable for the next pick (mirrors CountScaledChoicePrompt).
    const isSubmitting = ref(false);
    watch(
      () => props.pendingUndercoverChoice,
      () => {
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingUndercoverChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingUndercoverChoice.playerID
      );
    }

    // why: WP-901 / D-24858 — the your-hero shape is recognized by its named target lists (present
    // only for a 'your-hero' pick); without them the S.H.I.E.L.D. rendering is unchanged.
    function isYourHeroPick(): boolean {
      return (
        props.pendingUndercoverChoice !== undefined &&
        (props.pendingUndercoverChoice.eligibleHand !== undefined ||
          props.pendingUndercoverChoice.eligibleInPlay !== undefined)
      );
    }

    function onPick(targetExtId: string): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveUndercoverChoice", { targetExtId });
    }

    function onPickFromZone(zone: "hand" | "inPlay", targetExtId: string): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveUndercoverChoice", { zone, targetExtId });
    }

    function onDecline(): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveUndercoverChoice", { decline: true });
    }

    return {
      isSubmitting,
      shouldRender,
      isYourHeroPick,
      onPick,
      onPickFromZone,
      onDecline,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="undercover-choice-prompt"
    data-testid="undercover-choice-prompt"
    role="region"
    aria-label="Undercover target"
  >
    <template v-if="isYourHeroPick()">
      <h3 class="undercover-choice-prompt__heading">You may send one of your Heroes Undercover</h3>
      <div
        v-if="(pendingUndercoverChoice!.eligibleHand ?? []).length > 0"
        class="undercover-choice-prompt__zone"
      >
        <h4 class="undercover-choice-prompt__zone-label">From your hand</h4>
        <div class="undercover-choice-prompt__buttons">
          <!-- why: starter cards repeat their ext id (several S.H.I.E.L.D. Agents), so the key is zone + index. -->
          <button
            v-for="(entry, index) in pendingUndercoverChoice!.eligibleHand ?? []"
            :key="`${entry.zone}:${index}`"
            type="button"
            class="undercover-choice-prompt__card-btn"
            :data-testid="`undercover-choice-card-${entry.zone}-${entry.cardId}`"
            :disabled="isSubmitting"
            :aria-disabled="isSubmitting ? 'true' : undefined"
            :title="entry.display.name"
            @click="onPickFromZone('hand', entry.cardId)"
          >
            <span class="undercover-choice-prompt__card-name">{{ entry.display.name }}</span>
            <CardImage
              v-if="entry.display.imageUrl"
              :image-url="entry.display.imageUrl"
              :alt="entry.display.name"
              class="undercover-choice-prompt__card-image"
            />
          </button>
        </div>
      </div>
      <div
        v-if="(pendingUndercoverChoice!.eligibleInPlay ?? []).length > 0"
        class="undercover-choice-prompt__zone"
      >
        <h4 class="undercover-choice-prompt__zone-label">Played this turn</h4>
        <div class="undercover-choice-prompt__buttons">
          <button
            v-for="(entry, index) in pendingUndercoverChoice!.eligibleInPlay ?? []"
            :key="`${entry.zone}:${index}`"
            type="button"
            class="undercover-choice-prompt__card-btn"
            :data-testid="`undercover-choice-card-${entry.zone}-${entry.cardId}`"
            :disabled="isSubmitting"
            :aria-disabled="isSubmitting ? 'true' : undefined"
            :title="entry.display.name"
            @click="onPickFromZone('inPlay', entry.cardId)"
          >
            <span class="undercover-choice-prompt__card-name">{{ entry.display.name }}</span>
            <CardImage
              v-if="entry.display.imageUrl"
              :image-url="entry.display.imageUrl"
              :alt="entry.display.name"
              class="undercover-choice-prompt__card-image"
            />
          </button>
        </div>
      </div>
      <button
        v-if="pendingUndercoverChoice!.canDecline === true"
        type="button"
        class="undercover-choice-prompt__decline-btn"
        data-testid="undercover-choice-decline"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onDecline"
      >
        Don't send
      </button>
    </template>
    <template v-else>
      <h3 class="undercover-choice-prompt__heading">Send which S.H.I.E.L.D. Hero Undercover?</h3>
      <div class="undercover-choice-prompt__buttons">
        <button
          v-for="(targetExtId, index) in pendingUndercoverChoice!.eligibleTargets"
          :key="targetExtId"
          type="button"
          class="undercover-choice-prompt__btn"
          :data-testid="`undercover-choice-option-${index}`"
          :disabled="isSubmitting"
          :aria-disabled="isSubmitting ? 'true' : undefined"
          @click="onPick(targetExtId)"
        >
          {{ targetExtId }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.undercover-choice-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.undercover-choice-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.undercover-choice-prompt__zone {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.undercover-choice-prompt__zone-label {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 500;
}

.undercover-choice-prompt__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.undercover-choice-prompt__btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}

.undercover-choice-prompt__card-btn {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  align-items: flex-start;
}

.undercover-choice-prompt__card-name {
  font-size: 0.8rem;
}

.undercover-choice-prompt__decline-btn {
  align-self: flex-start;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}

.undercover-choice-prompt__btn:disabled,
.undercover-choice-prompt__card-btn:disabled,
.undercover-choice-prompt__decline-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
