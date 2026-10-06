<script lang="ts">
import { defineComponent, ref, watch, type PropType } from "vue";
import type { UICityState, UIPendingMoveVillainChoice } from "@legendary-arena/game-engine";
import { citySpaceNameForIndex, formatAttackTargets } from "@legendary-arena/game-engine";
import type { SubmitMove } from "./uiMoveName.types";

/** One City-space option rendered by the prompt (a source Villain or a destination space). */
interface CitySpaceOption {
  /** The ENGINE City index (0 = Sewers … 4 = Bridge) — the value submitted to the engine. */
  cityIndex: number;
  /** The space's display name ("Sewers", "Bank", "Rooftops", "Streets", "Bridge"). */
  spaceLabel: string;
  /** The name of the Villain in that space, or null when the space is empty. */
  villainName: string | null;
}

// why: the board renders the City left-to-right as Bridge → Sewers (engine index 4 → 0, see
// useCityRow.ts), so the prompt lists spaces in that same visual order. The order is display
// only — every option carries its ENGINE index, which is what the prompt submits.
const VISUAL_ORDER_ENGINE_INDICES: readonly number[] = [4, 3, 2, 1, 0];

/**
 * Inline prompt for resolving a pending Spinning Cyclone move-a-Villain choice (WP-795 /
 * D-24664 — core Storm's "Spinning Cyclone").
 *
 * Renders iff `pendingMoveVillainChoice !== undefined AND viewerPlayerId === playerID`. Hidden
 * for opponents and spectators. Realizes "You may move a Villain to a new city space. Rescue any
 * Bystanders captured by that Villain. (If you move a Villain to a city space that already has
 * Villain, swap them.)" as two local picks — step 1 a City Villain, step 2 one of the other four
 * spaces (an occupied space reads "swap with <name>") — then a Move button, plus an
 * always-enabled Don't move button.
 *
 * Move submits `resolveMoveVillainChoice({ fromCityIndex, toCityIndex })` with ENGINE indices;
 * Don't move submits `resolveMoveVillainChoice({ decline: true })`. The client submits INTENT
 * only — the ENGINE validates the answer against the live City, moves or swaps, and rescues.
 *
 * // why: D-24664 — non-dismissible; controls disable after submit to prevent a double move.
 * The choice is game-blocking (the block-all guard freezes turn-end until it resolves). NOT a
 * modal, NOT position:fixed, NOT <Teleport> — renders in normal document flow above
 * TurnActionBar, mirroring CoveringFireChoicePrompt.
 *
 * Per D-6512 / P6-46: the local source / destination picks are template bindings that are
 * neither props nor emits, so this uses `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-795 §Locked Contract Values — Client
 * @see EC-832 Locked Values — prompt props, test ids
 * @see DECISIONS.md D-24664
 */
export default defineComponent({
  name: "MoveVillainChoicePrompt",
  props: {
    pendingMoveVillainChoice: {
      type: Object as PropType<UIPendingMoveVillainChoice | undefined>,
      required: false,
      default: undefined,
    },
    city: {
      // why: snapshot.city supplies the Villain names for the source list and the
      // "swap with <name>" destination labels.
      type: Object as PropType<UICityState>,
      required: true,
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
    const selectedSourceIndex = ref<number | null>(null);
    const selectedDestinationIndex = ref<number | null>(null);
    const isSubmitting = ref(false);

    // why: the parent page keeps this component mounted for the whole match (only the inner
    // v-if content toggles), so the picks and the isSubmitting latch must clear on every new
    // server frame. Each frame delivers a fresh pendingMoveVillainChoice object; resetting on its
    // identity change re-enables the controls for the next choice (the Covering Fire guard).
    watch(
      () => props.pendingMoveVillainChoice,
      () => {
        selectedSourceIndex.value = null;
        selectedDestinationIndex.value = null;
        isSubmitting.value = false;
      },
    );

    function shouldRender(): boolean {
      return (
        props.pendingMoveVillainChoice !== undefined &&
        props.viewerPlayerId !== null &&
        props.viewerPlayerId === props.pendingMoveVillainChoice.playerID
      );
    }

    function buildOption(cityIndex: number): CitySpaceOption {
      const spaceName = citySpaceNameForIndex(cityIndex);
      let spaceLabel = `Space ${cityIndex}`;
      if (spaceName !== undefined) {
        spaceLabel = formatAttackTargets([spaceName]);
      }
      const card = props.city.spaces[cityIndex] ?? null;
      let villainName: string | null = null;
      if (card !== null) {
        villainName = card.display.name;
      }
      return { cityIndex, spaceLabel, villainName };
    }

    function sourceOptions(): CitySpaceOption[] {
      const options: CitySpaceOption[] = [];
      const pending = props.pendingMoveVillainChoice;
      if (pending === undefined) return options;
      for (const cityIndex of VISUAL_ORDER_ENGINE_INDICES) {
        if (pending.villainCityIndices.includes(cityIndex)) {
          options.push(buildOption(cityIndex));
        }
      }
      return options;
    }

    function destinationOptions(): CitySpaceOption[] {
      const options: CitySpaceOption[] = [];
      if (selectedSourceIndex.value === null) return options;
      for (const cityIndex of VISUAL_ORDER_ENGINE_INDICES) {
        if (cityIndex !== selectedSourceIndex.value) {
          options.push(buildOption(cityIndex));
        }
      }
      return options;
    }

    function sourceLabel(option: CitySpaceOption): string {
      return `${option.villainName ?? "Villain"} — ${option.spaceLabel}`;
    }

    function destinationLabel(option: CitySpaceOption): string {
      if (option.villainName !== null) {
        return `${option.spaceLabel} (swap with ${option.villainName})`;
      }
      return option.spaceLabel;
    }

    function selectSource(cityIndex: number): void {
      if (isSubmitting.value) return;
      selectedSourceIndex.value = cityIndex;
      selectedDestinationIndex.value = null;
    }

    function selectDestination(cityIndex: number): void {
      if (isSubmitting.value) return;
      selectedDestinationIndex.value = cityIndex;
    }

    function canConfirm(): boolean {
      return (
        !isSubmitting.value &&
        selectedSourceIndex.value !== null &&
        selectedDestinationIndex.value !== null
      );
    }

    function onConfirm(): void {
      const fromCityIndex = selectedSourceIndex.value;
      const toCityIndex = selectedDestinationIndex.value;
      if (isSubmitting.value || fromCityIndex === null || toCityIndex === null) return;
      isSubmitting.value = true;
      // why: D-24664 — submit the ENGINE indices carried on each option (0 = Sewers … 4 = Bridge),
      // never a position in the visual Bridge → Sewers list; a visual index would land the
      // Villain in the mirrored space.
      props.submitMove("resolveMoveVillainChoice", { fromCityIndex, toCityIndex });
    }

    function onDecline(): void {
      if (isSubmitting.value) return;
      isSubmitting.value = true;
      props.submitMove("resolveMoveVillainChoice", { decline: true });
    }

    return {
      selectedSourceIndex,
      selectedDestinationIndex,
      isSubmitting,
      shouldRender,
      sourceOptions,
      destinationOptions,
      sourceLabel,
      destinationLabel,
      selectSource,
      selectDestination,
      canConfirm,
      onConfirm,
      onDecline,
    };
  },
});
</script>

<template>
  <div
    v-if="shouldRender()"
    class="move-villain-prompt"
    data-testid="move-villain-prompt"
    role="region"
    aria-label="Spinning Cyclone: move a Villain"
  >
    <h3 class="move-villain-prompt__heading">Spinning Cyclone: move a Villain</h3>
    <p class="move-villain-prompt__hint">
      Pick a Villain, then a new city space. Its captured Bystanders are rescued.
    </p>
    <div class="move-villain-prompt__step" aria-label="Villain to move">
      <button
        v-for="option in sourceOptions()"
        :key="`source-${option.cityIndex}`"
        type="button"
        class="move-villain-prompt__btn"
        :class="{ 'move-villain-prompt__btn--selected': selectedSourceIndex === option.cityIndex }"
        data-testid="move-villain-source"
        :aria-pressed="selectedSourceIndex === option.cityIndex ? 'true' : 'false'"
        :disabled="isSubmitting"
        @click="selectSource(option.cityIndex)"
      >
        {{ sourceLabel(option) }}
      </button>
    </div>
    <div
      v-if="selectedSourceIndex !== null"
      class="move-villain-prompt__step"
      aria-label="Destination space"
    >
      <button
        v-for="option in destinationOptions()"
        :key="`destination-${option.cityIndex}`"
        type="button"
        class="move-villain-prompt__btn"
        :class="{ 'move-villain-prompt__btn--selected': selectedDestinationIndex === option.cityIndex }"
        data-testid="move-villain-destination"
        :aria-pressed="selectedDestinationIndex === option.cityIndex ? 'true' : 'false'"
        :disabled="isSubmitting"
        @click="selectDestination(option.cityIndex)"
      >
        {{ destinationLabel(option) }}
      </button>
    </div>
    <div class="move-villain-prompt__actions">
      <button
        type="button"
        class="move-villain-prompt__btn move-villain-prompt__btn--primary"
        data-testid="move-villain-confirm"
        :disabled="!canConfirm()"
        :aria-disabled="!canConfirm() ? 'true' : undefined"
        @click="onConfirm()"
      >
        Move
      </button>
      <button
        type="button"
        class="move-villain-prompt__btn"
        data-testid="move-villain-decline"
        :disabled="isSubmitting"
        :aria-disabled="isSubmitting ? 'true' : undefined"
        @click="onDecline()"
      >
        Don't move
      </button>
    </div>
  </div>
</template>

<style scoped>
.move-villain-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--color-foreground, #333);
  background: var(--color-background, #fff);
}

.move-villain-prompt__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.move-villain-prompt__hint {
  margin: 0;
  font-size: 0.8rem;
}

.move-villain-prompt__step,
.move-villain-prompt__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.move-villain-prompt__btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  background: var(--color-button-bg, #f5f5f5);
  cursor: pointer;
  font-size: 0.8rem;
}

.move-villain-prompt__btn--selected {
  border-color: var(--color-foreground, #333);
  font-weight: 600;
}

.move-villain-prompt__btn--primary {
  font-weight: 600;
}

.move-villain-prompt__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
