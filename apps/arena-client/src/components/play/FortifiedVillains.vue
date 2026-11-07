<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { UIFortifier, UITurnEconomyState } from '@legendary-arena/game-engine';
import { UNNAMED_CITY_SPACE_TARGET } from '@legendary-arena/game-engine';
import { useCardCostGating, type GatingResult } from '../../composables/useCardCostGating';
import { useTurnActions, healLockGate } from '../../composables/useTurnActions';
import type { SubmitMove } from './uiMoveName.types';

/**
 * Fortified Villains strip (WP-873 / D-24818) — rendered by `<CityRow>` under the
 * Escaped Pile.
 *
 * A fortifying Villain (Squirrel Girl at the Sidekick Stack, Colleen Wing at the
 * Mastermind) left the Escape Pile and sits beside the place it locks. Each tile shows
 * the Villain, the place it fortifies, the engine-written lock text and a `Fight N`
 * button priced like a City fight. Clicking it sends
 * `fightVillain({ fortifiedPlace })`; the engine re-validates every check.
 *
 * Gate order (EC-132 §3, stage → resource → structural): stage, heal lock, cost at the
 * unnamed target (a fortifier is on no named City space, so restricted Attack never
 * counts), then the projected fight restriction. The client renders the projected
 * `placeLabel` / `lockText` and never switches on the place or lock (D-24574).
 *
 * Per the EC-132 §2 SFC authoring whitelist: a tested component that uses composables
 * uses `defineComponent({ setup() { return {...} } })`.
 */
export default defineComponent({
  name: 'FortifiedVillains',
  props: {
    fortifiers: {
      type: Array as PropType<UIFortifier[]>,
      required: true,
    },
    currentStage: {
      type: String,
      required: true,
    },
    isViewerTurn: {
      type: Boolean,
      required: false,
      default: true,
    },
    // why: D-24180 — the engine refuses a fight for the rest of a turn in which the viewer
    // healed, so the button gate must see the heal lock too (the CityRow precedent).
    hasHealedThisTurn: {
      type: Boolean,
      required: false,
      default: false,
    },
    economy: {
      type: Object as PropType<UITurnEconomyState>,
      required: true,
    },
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
  },
  setup(props) {
    /**
     * Returns whether the viewer can fight a fortifier now, and why not.
     *
     * @param fortifier - The projected fortifier tile.
     * @returns The gating result; the reason is the disabled button's title.
     */
    function gateForFortifier(fortifier: UIFortifier): GatingResult {
      const stage = useTurnActions(props.currentStage, props.isViewerTurn).canFightVillain();
      if (!stage.allowed) {
        return stage;
      }
      const healLock = healLockGate(props.hasHealedThisTurn);
      if (!healLock.allowed) {
        return healLock;
      }
      // why: WP-873 / D-24818 — the engine checks the spendable Attack at
      // UNNAMED_CITY_SPACE_TARGET (findFightableFortifier), so the served figure must match.
      const cost = useCardCostGating(props.economy).canFight(fortifier.fightCost, UNNAMED_CITY_SPACE_TARGET);
      if (!cost.allowed) {
        return cost;
      }
      // why: WP-871 / D-24816 — the fortifier's own printed fight restriction (Squirrel Girl:
      // at most one card played) gates last; the engine writes the reason only while it blocks.
      if (fortifier.fightRestrictionReason !== undefined) {
        return { allowed: false, reason: fortifier.fightRestrictionReason };
      }
      return cost;
    }

    /**
     * Sends the fortifier fight for a place.
     *
     * @param fortifier - The projected fortifier tile.
     */
    function onFightFortifier(fortifier: UIFortifier): void {
      if (!gateForFortifier(fortifier).allowed) {
        return;
      }
      props.submitMove('fightVillain', { fortifiedPlace: fortifier.place });
    }

    return { gateForFortifier, onFightFortifier };
  },
});
</script>

<template>
  <ul class="fortified-villains" aria-label="Fortifying Villains">
    <li
      v-for="fortifier in fortifiers"
      :key="fortifier.place"
      class="fortified-villains__tile"
      data-testid="play-fortifier"
      :data-place="fortifier.place"
    >
      <p class="fortified-villains__name">{{ fortifier.display.name }}</p>
      <p class="fortified-villains__place">Fortifying {{ fortifier.placeLabel }}</p>
      <p class="fortified-villains__lock">{{ fortifier.lockText }}</p>
      <button
        type="button"
        class="fortified-villains__fight"
        data-testid="play-fortifier-fight"
        :disabled="!gateForFortifier(fortifier).allowed"
        :aria-disabled="!gateForFortifier(fortifier).allowed ? 'true' : undefined"
        :title="gateForFortifier(fortifier).reason ?? undefined"
        @click="onFightFortifier(fortifier)"
      >
        Fight {{ fortifier.fightCost }}
      </button>
    </li>
  </ul>
</template>

<style scoped>
.fortified-villains {
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.fortified-villains__tile {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.375rem;
  border: 1px solid var(--color-threat, #7c3aed);
  border-radius: 0.25rem;
  min-width: 5rem;
  font-size: 0.75rem;
}

.fortified-villains__name {
  margin: 0;
  font-weight: 600;
}

.fortified-villains__place,
.fortified-villains__lock {
  margin: 0;
}

.fortified-villains__lock {
  opacity: 0.8;
}

.fortified-villains__fight {
  margin-top: 0.125rem;
}
</style>
