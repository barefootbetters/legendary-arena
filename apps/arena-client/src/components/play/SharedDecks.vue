<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import {
  OFFICER_RECRUIT_COST,
  SIDEKICK_RECRUIT_COST,
  type UICardDisplay,
  type UISharedPilesState,
  type UITurnEconomyState,
} from '@legendary-arena/game-engine';
import { useTurnActions, healLockGate } from '../../composables/useTurnActions';
import type { GatingResult } from '../../composables/useCardCostGating';
import CardTile from './CardTile.vue';
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
 * empty-supply structural check.
 *
 * WP-842 / D-24776: the Sidekicks cell is the second recruitable supply pile —
 * you may recruit one Sidekick per turn for 2 Recruit (rules v23 L727-729). It
 * renders as a `<button>` that dispatches `recruitSidekick` (empty payload) with
 * the Officers cell's markup. The other three cells stay static counts.
 *
 * Per the EC-132 §2 SFC authoring whitelist: this is a tested non-leaf
 * composer that USES a composable, so it MUST use
 * `defineComponent({ setup() { return {...} } })`.
 *
 * @see WP-129 §Acceptance Criteria — Shared Decks 5-cell row
 * @see WP-648 / D-24460 — recruitable Officer supply
 * @see WP-842 / D-24776 — recruitable Sidekick Stack
 * @see DESIGN-BOARD-LAYOUT.md §7.1 Shared Decks
 * @see DECISIONS.md D-12905 card-back representation
 */
export default defineComponent({
  name: 'SharedDecks',
  components: { CardTile },
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
    // why: D-24614 — UIState.game.hasHealedThisTurn. The engine refuses
    // recruit and fight for the rest of a turn in which the viewer healed
    // (D-24180 heal lock), so the button gate must see it too.
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
    // why: WP-854 / D-24790 — the band stand-up of the Officers and Sidekicks
    // piles. Only PlayDesktop sets it (from useBoardTilt's lift gate); every
    // other use, PlayMobile included, keeps it false and renders as before.
    isTiltLiftEnabled: {
      type: Boolean,
      required: false,
      default: false,
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
      const healLock = healLockGate(props.hasHealedThisTurn);
      if (!healLock.allowed) {
        return healLock;
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

    function officerDisplay(): UICardDisplay {
      // why: piles.officerDisplay is the engine-projected S.H.I.E.L.D. Officer
      // card face — rendering it (instead of a bare count) is what tells the
      // player the deck is a shop. Older/hand-written snapshots may omit the
      // optional field; fall back to a text-only display so the tile still
      // names the card rather than crashing on a missing prop.
      return (
        props.piles.officerDisplay ?? {
          extId: 'pile-shield-officer',
          name: 'S.H.I.E.L.D. Officer',
          imageUrl: '',
          cost: null,
        }
      );
    }

    // why: WP-842 — expose the Sidekick buy cost to the template, sourced from the
    // engine constant (single source of truth with the recruitSidekick move, D-24776).
    const sidekickCost = SIDEKICK_RECRUIT_COST;

    function sidekickGate(): GatingResult {
      // why: disabled-state tooltip precedence — turn → stage → heal lock →
      // once-per-turn → empty Stack → resource. The turn + stage + heal-lock gate
      // comes from useTurnActions; the rest are Sidekick-specific. The Sidekick
      // token's UICardDisplay.cost is null, so useCardCostGating.canRecruit cannot
      // be reused here (the officerGate precedent).
      const stage = useTurnActions(props.currentStage, props.isViewerTurn).canRecruitSidekick();
      if (!stage.allowed) {
        return stage;
      }
      const healLock = healLockGate(props.hasHealedThisTurn);
      if (!healLock.allowed) {
        return healLock;
      }
      if (props.economy.hasRecruitedSidekickThisTurn === true) {
        return { allowed: false, reason: 'You already recruited a Sidekick this turn.' };
      }
      if (props.piles.sidekicksCount <= 0) {
        return { allowed: false, reason: 'No Sidekicks remain in the Sidekick Stack.' };
      }
      if (props.economy.availableRecruit < SIDEKICK_RECRUIT_COST) {
        return {
          allowed: false,
          reason: `Needs ${sidekickCost} recruit, you have ${props.economy.availableRecruit}.`,
        };
      }
      return { allowed: true, reason: null };
    }

    function onRecruitSidekick(): void {
      // why: recruitSidekick takes no arguments — all Sidekicks are identical
      // fungible tokens, so there is no slot or index to choose.
      props.submitMove('recruitSidekick', {});
    }

    function sidekickDisplay(): UICardDisplay {
      // why: piles.sidekickDisplay is the engine-projected Sidekick card face.
      // Older/hand-written snapshots may omit the optional field; fall back to a
      // text-only display so the tile still names the card.
      return (
        props.piles.sidekickDisplay ?? {
          extId: 'pile-sidekick',
          name: 'Sidekick',
          imageUrl: '',
          cost: null,
        }
      );
    }

    return {
      officerCost,
      officerGate,
      onRecruitOfficer,
      officerDisplay,
      sidekickCost,
      sidekickGate,
      onRecruitSidekick,
      sidekickDisplay,
    };
  },
});
</script>

<template>
  <section
    class="shared-decks"
    :class="{ 'shared-decks--tilt-lift': isTiltLiftEnabled }"
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
          <!-- why: WP-648 follow-on — render the actual Officer card face so the
               cell reads as a recruitable shop, not a face-down deck like the
               other four. size="sm" keeps the row height even; show-cost is off
               because the printed cost is null and the buy cost (Recruit: N) is
               shown below as its own line. -->
          <CardTile
            :display="officerDisplay()"
            size="sm"
            :show-cost="false"
            :interactive="officerGate().allowed"
            :tooltip="officerGate().reason"
          />
          <span class="shared-decks__name">S.H.I.E.L.D. Officers</span>
          <span class="shared-decks__count">[{{ piles.officersCount }}]</span>
          <span class="shared-decks__cost">Recruit: {{ officerCost }}</span>
        </button>
      </li>
      <li class="shared-decks__cell" data-testid="play-shared-deck-sidekicks">
        <!-- why: WP-842 / D-24776 — the Sidekicks cell is the second recruitable
             supply pile (once per turn). Same markup as the Officers button; the
             gate (turn → stage → heal lock → once-per-turn → empty Stack →
             resource) drives :disabled / :title. -->
        <button
          type="button"
          class="shared-decks__recruit"
          data-testid="play-recruit-sidekick"
          :disabled="!sidekickGate().allowed"
          :aria-disabled="!sidekickGate().allowed ? 'true' : undefined"
          :title="sidekickGate().reason ?? `Recruit a Sidekick for ${sidekickCost} recruit (once per turn)`"
          @click="onRecruitSidekick()"
        >
          <CardTile
            :display="sidekickDisplay()"
            size="sm"
            :show-cost="false"
            :interactive="sidekickGate().allowed"
            :tooltip="sidekickGate().reason"
          />
          <span class="shared-decks__name">Sidekicks</span>
          <span class="shared-decks__count">[{{ piles.sidekicksCount }}]</span>
          <span class="shared-decks__cost">Recruit: {{ sidekickCost }}</span>
        </button>
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

/* why: WP-648 / WP-842 — the Officers and Sidekicks cells host a recruit button; it must fill the cell
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

/* why: WP-854 / D-24790 — the Officers and Sidekicks stand up on hover, as the
   City and HQ cards do (D-24788). Pointer devices only, and only under
   --tilt-lift. Every link from the root down to the recruit button preserves
   3D, or the card would rise but stay tilted; the links are on only while a
   recruit cell is hovered, because at rest coplanar preserve-3d layers z-fight
   in Chrome's hit test and steal clicks (EC-890 Amendment A). */
@media (hover: hover) {
  .shared-decks--tilt-lift:has(.shared-decks__cell:hover > .shared-decks__recruit),
  .shared-decks--tilt-lift:has(.shared-decks__cell:hover > .shared-decks__recruit) .shared-decks__row,
  .shared-decks--tilt-lift:has(.shared-decks__cell:hover > .shared-decks__recruit) .shared-decks__cell,
  .shared-decks--tilt-lift:has(.shared-decks__cell:hover > .shared-decks__recruit) .shared-decks__recruit {
    transform-style: preserve-3d;
  }
  /* why: the bottom-edge origin makes the card rise off the table rather than
     into it, and keeps that edge put, so every point of the resting button stays
     under the lifted one (no dead click strip; hence no translateY). */
  .shared-decks--tilt-lift .shared-decks__recruit {
    transform-origin: 50% 100%;
    transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
  }
  /* why: the hover sits on the cell, which keeps its box, while the transform
     moves the button; hovering the button itself would flicker as it moves out
     from under the pointer. */
  .shared-decks--tilt-lift .shared-decks__cell:hover > .shared-decks__recruit {
    transform: rotateX(calc(-1 * var(--board-tilt-angle))) scale(1.06);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
  }
  /* why: the tile's own 1.05 hover scale would compound with the lift; inside a
     lifting pile the lifted card is exactly 1.06. */
  .shared-decks--tilt-lift .shared-decks__recruit .card-tile--interactive:hover {
    transform: none;
  }
}
</style>
