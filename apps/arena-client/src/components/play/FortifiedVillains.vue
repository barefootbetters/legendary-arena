<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { FortifyPlace, UIFortifier, UITurnEconomyState } from '@legendary-arena/game-engine';
import { UNNAMED_CITY_SPACE_TARGET } from '@legendary-arena/game-engine';
import { useCardCostGating, type GatingResult } from '../../composables/useCardCostGating';
import { useTurnActions, healLockGate } from '../../composables/useTurnActions';
import type { SubmitMove } from './uiMoveName.types';

/**
 * Fortifying Villain chip (WP-873 / D-24818; placement D-24819).
 *
 * A fortifying Villain (Squirrel Girl at the Sidekick Stack, Colleen Wing at the
 * Mastermind) left the Escape Pile and sits on the place it locks (rules v23 L1454:
 * "put on or near" it). The host that draws that place mounts this component with its
 * own `place`: `<SharedDecks>` on the Sidekicks cell, `<MastermindTile>` on the
 * Mastermind. Each chip shows the Villain's name and a `Fight N` button priced like a
 * City fight; the place and the engine-written lock text are its title and screen-reader
 * text. Clicking Fight sends `fightVillain({ fortifiedPlace })`; the engine re-validates
 * every check.
 *
 * The chip list is absolutely positioned over the host's card, so it never adds height
 * to the board row it sits in (D-24819; the scale-to-fit board, D-24505).
 *
 * Gate order (EC-132 §3, stage → resource → structural): stage, heal lock, cost at the
 * unnamed target (a fortifier is on no named City space, so restricted Attack never
 * counts), then the projected fight restriction. `place` only routes a fortifier to the
 * host that draws its place; no gate reads the place or the lock (D-24819).
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
    // why: D-24819 — the place the host draws; only fortifiers of this place render here.
    place: {
      type: String as PropType<FortifyPlace>,
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
     * Returns the fortifiers on this host's place, in projection order.
     *
     * @returns The fortifiers whose place is the host's place.
     */
    function fortifiersHere(): UIFortifier[] {
      const here: UIFortifier[] = [];
      for (const fortifier of props.fortifiers) {
        if (fortifier.place === props.place) {
          here.push(fortifier);
        }
      }
      return here;
    }

    /**
     * Builds the chip's hover text from the projected place label and lock text.
     *
     * @param fortifier - The projected fortifier.
     * @returns The sentence shown as the chip's title.
     */
    function chipTitle(fortifier: UIFortifier): string {
      return `${fortifier.display.name} fortifies ${fortifier.placeLabel}: ${fortifier.lockText}. Fight ${fortifier.display.name} to end it.`;
    }

    /**
     * Returns whether the viewer can fight a fortifier now, and why not.
     *
     * @param fortifier - The projected fortifier.
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
     * @param fortifier - The projected fortifier.
     */
    function onFightFortifier(fortifier: UIFortifier): void {
      if (!gateForFortifier(fortifier).allowed) {
        return;
      }
      props.submitMove('fightVillain', { fortifiedPlace: fortifier.place });
    }

    return { fortifiersHere, chipTitle, gateForFortifier, onFightFortifier };
  },
});
</script>

<template>
  <ul
    v-if="fortifiersHere().length > 0"
    class="fortified-villains"
    aria-label="Fortifying Villains"
  >
    <li
      v-for="fortifier in fortifiersHere()"
      :key="fortifier.place"
      class="fortified-villains__chip"
      data-testid="play-fortifier"
      :data-place="fortifier.place"
      :title="chipTitle(fortifier)"
    >
      <span class="fortified-villains__name">{{ fortifier.display.name }}</span>
      <span class="sr-only">Fortifying {{ fortifier.placeLabel }}: {{ fortifier.lockText }}</span>
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
/* why: D-24819 — the chips sit ON the fortified card (rules v23 L1454) and are
   absolutely positioned, so the host row keeps its height and the scale-to-fit board
   (D-24505) never rescales because a Villain fortified something. The host provides
   the positioning context. */
.fortified-villains {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
  pointer-events: none;
}

.fortified-villains__chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.2rem 0.4rem;
  border: 2px solid var(--color-threat, #7c3aed);
  border-radius: 0.4rem;
  background: rgba(24, 12, 48, 0.9);
  color: #fff;
  font-size: 0.7rem;
  line-height: 1.1;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
  pointer-events: auto;
}

.fortified-villains__name {
  font-weight: 700;
}

.fortified-villains__fight {
  padding: 0.1rem 0.45rem;
  font-size: 0.7rem;
  font-weight: 700;
}
</style>
