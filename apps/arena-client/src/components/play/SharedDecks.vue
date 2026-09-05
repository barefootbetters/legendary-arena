<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import {
  OFFICER_RECRUIT_COST,
  type UISharedPilesState,
  type UITurnEconomyState,
} from '@legendary-arena/game-engine';
import { useTurnActions } from '../../composables/useTurnActions';
import type { GatingResult } from '../../composables/useCardCostGating';
import type { SubmitMove } from './uiMoveName.types';

/**
 * Shared Decks leaf — renders the 5 face-down deck cells per
 * `DESIGN-BOARD-LAYOUT.md §7.1` locked column order:
 *   `Wounds | Horrors | Bystanders | S.H.I.E.L.D. Officers | Sidekicks`.
 *
 * All five deck cells render as count-with-deck-icon per D-12905
 * (number-with-deck-icon at MVP; theme-overridable per WP-130). Top
 * cards are NEVER visible — these are face-down source pools.
 *
 * WP-648: the S.H.I.E.L.D. Officers cell is the one recruitable supply
 * pile — canonically you may buy an Officer for 3 Recruit any number of
 * times during your Main step (Marvel Legendary Universal Rules v23 §"HQ").
 * It renders as a `<button>` that dispatches `recruitOfficer` (empty
 * payload); the gate mirrors HQRow (turn → stage → resource) with an added
 * empty-supply structural check. The other four cells stay static counts.
 *
 * Per the EC-132 §2 SFC authoring whitelist: this is a tested non-leaf
 * composer that USES a composable, so it MUST use
 * `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-129 §Acceptance Criteria — Shared Decks 5-cell row
 * @see WP-648 / D-24460 — recruitable Officer supply
 * @see DESIGN-BOARD-LAYOUT.md §7.1 Shared Decks
 * @see DECISIONS.md D-12905 card-back representation
 */
export default defineComponent({
  name: 'SharedDecks',
  props: {
    piles: {
      type: Object as PropType<UISharedPilesState>,
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
    // why: WP-648 — expose the buy cost to the template so the tooltip/label
    // never re-derive the 3; sourced from the engine constant (single source of
    // truth with the recruitOfficer move, D-24460).
    const officerCost = OFFICER_RECRUIT_COST;

    function officerGate(): GatingResult {
      // why: disabled-state tooltip precedence — turn → stage → resource →
      // structural. The turn + stage gate is shared with recruitHero via
      // useTurnActions; the empty-supply and affordability checks are officer-
      // specific (the Officer token's UICardDisplay.cost is null, so the generic
      // useCardCostGating.canRecruit path cannot be reused here).
      const stage = useTurnActions(props.currentStage, props.isViewerTurn).canRecruitOfficer();
      if (!stage.allowed) {
        return stage;
      }
      if (props.piles.officersCount <= 0) {
        return { allowed: false, reason: 'No S.H.I.E.L.D. Officers remain in the supply.' };
      }
      if (props.economy.availableRecruit < officerCost) {
        return {
          allowed: false,
          reason: `Needs ${officerCost} recruit, you have ${props.economy.availableRecruit}.`,
        };
      }
      return { allowed: true, reason: null };
    }

    function onRecruitOfficer(): void {
      // why: recruitOfficer takes no arguments — all Officers are identical
      // fungible tokens, so there is no slot or index to choose.
      props.submitMove('recruitOfficer', {});
    }

    return { officerCost, officerGate, onRecruitOfficer };
  },
});
</script>

<template>
  <section
    class="shared-decks"
    data-testid="play-shared-decks"
    aria-label="Shared Decks"
  >
    <ol class="shared-decks__row">
      <li class="shared-decks__cell" data-testid="play-shared-deck-wounds">
        <span class="shared-decks__name">Wounds</span>
        <span class="shared-decks__count">[{{ piles.woundsCount }}]</span>
      </li>
      <li class="shared-decks__cell" data-testid="play-shared-deck-horrors">
        <span class="shared-decks__name">Horrors</span>
        <span class="shared-decks__count">[{{ piles.horrorsCount }}]</span>
      </li>
      <li class="shared-decks__cell" data-testid="play-shared-deck-bystanders">
        <span class="shared-decks__name">Bystanders</span>
        <span class="shared-decks__count">[{{ piles.bystandersCount }}]</span>
      </li>
      <li class="shared-decks__cell" data-testid="play-shared-deck-officers">
        <!-- why: WP-648 — the Officers cell is the one recruitable supply pile.
             Rendered as a button; the gate (turn → stage → resource → empty
             supply) drives :disabled / :title, and the click dispatches
             recruitOfficer. -->
        <button
          type="button"
          class="shared-decks__recruit"
          data-testid="play-recruit-officer"
          :disabled="!officerGate().allowed"
          :aria-disabled="!officerGate().allowed ? 'true' : undefined"
          :title="officerGate().reason ?? `Recruit a S.H.I.E.L.D. Officer for ${officerCost} recruit`"
          @click="onRecruitOfficer()"
        >
          <span class="shared-decks__name">S.H.I.E.L.D. Officers</span>
          <span class="shared-decks__count">[{{ piles.officersCount }}]</span>
          <span class="shared-decks__cost">Recruit: {{ officerCost }}</span>
        </button>
      </li>
      <li class="shared-decks__cell" data-testid="play-shared-deck-sidekicks">
        <span class="shared-decks__name">Sidekicks</span>
        <span class="shared-decks__count">[{{ piles.sidekicksCount }}]</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.shared-decks__row {
  display: flex;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.shared-decks__cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-foreground, #999);
  min-width: 5rem;
}

/* why: WP-648 — the Officers cell hosts a recruit button; it must fill the cell
   and carry the same column layout as the static cells so the row reads evenly. */
.shared-decks__cell:has(.shared-decks__recruit) {
  padding: 0;
}

.shared-decks__recruit {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.shared-decks__recruit:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.shared-decks__name {
  font-size: 0.85rem;
}

.shared-decks__count {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.shared-decks__cost {
  font-size: 0.7rem;
  opacity: 0.8;
}
</style>
