<script lang="ts">
import { defineComponent, ref, type PropType } from 'vue';
import type {
  UICardDisplay,
  UICityState,
  UIDecksState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
import { citySpaceNameForIndex } from '@legendary-arena/game-engine';
import { useCityRow, type CityCell } from '../../composables/useCityRow';
import { useCardCostGating, type GatingResult } from '../../composables/useCardCostGating';
import { useTurnActions, healLockGate } from '../../composables/useTurnActions';
import { useSlashGesture } from '../../composables/useSlashGesture';
import { useSlashGestureSetting } from '../../composables/useSlashGestureSetting';
import CardTile from './CardTile.vue';
import EscapedPile from './EscapedPile.vue';
import DarkPortalMarker from './DarkPortalMarker.vue';
import CrossedSwordsIcon from './CrossedSwordsIcon.vue';
import type { SubmitMove } from './uiMoveName.types';

/**
 * City row — 7-cell visual rewrite per `DESIGN-BOARD-LAYOUT.md §7.1`
 * column order: `Escaped Pile | Bridge | Streets | Rooftops | Bank |
 * Sewers | Villain Deck`. The engine indexes the city `0..4`; cells
 * 1..5 in the rendered row map to those engine indices in left-to-right
 * order.
 *
 * Fight discard cost (WP-817 / D-24750): a villain whose City card carries
 * `fightDiscardCosts` (Primus) is fought by also discarding a hand card of one
 * of those costs. Fight is disabled with a reason when the viewer holds none;
 * otherwise Fight / Fight-EV opens a chooser over that City space and the pick is sent
 * as `discardCardId`. The engine re-validates the pick. A `Discard 2/3/5/7` cue
 * is always on the tile, and turns loud when it is the reason Fight is disabled.
 *
 * Cost gating: villains in the city render disabled when
 * `economy.availableAttack < cell.card.fightCost` — the engine's projected
 * fight cost (WP-750 / D-24574), not the printed cost — per the WP-128
 * economy projection. A `Fight N` badge shows the projected cost whenever it
 * differs from the printed one.
 * Disabled-state tooltip precedence locked at EC-132 §3 (stage → resource
 * → structural). The reason is bound from useTurnActions / useCardCostGating
 * — never composed ad-hoc.
 *
 * Column alignment: with `isColumnAligned`, each cell takes a fixed width from
 * the parent's `--board-edge-column-width` / `--board-space-column-width`, so an
 * `HQRow` with the same flag lines up under it column for column.
 *
 * Per the EC-132 §2 SFC authoring whitelist: this is a tested non-leaf
 * composer that USES composables, so it MUST use
 * `defineComponent({ setup() { return {...} } })` per P6-30 / P6-46 /
 * D-6512.
 *
 * @see WP-129 §Acceptance Criteria — City row 7 cells
 * @see DESIGN-BOARD-LAYOUT.md §7.1 City row
 * @see EC-132 §2 City visual column order
 */
export default defineComponent({
  name: 'CityRow',
  components: { CardTile, EscapedPile, DarkPortalMarker, CrossedSwordsIcon },
  props: {
    city: {
      type: Object as PropType<UICityState>,
      required: true,
    },
    // why: WP-727 / D-24548 — the city-space indices that have a Portals Dark
    // Portal (from scheme.darkPortals.citySpaceIndices) + the +N attack each
    // grants. Derived by the parent; empty / 0 for a non-Portals scheme.
    darkPortalIndices: {
      type: Array as PropType<number[]>,
      required: false,
      default: () => [],
    },
    darkPortalBonus: {
      type: Number,
      required: false,
      default: 0,
    },
    decks: {
      type: Object as PropType<UIDecksState>,
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
    // why: D-24747 — Abomination reads the HQ Hero under each City space by
    // position (Sewers over the 5th HQ slot … Bridge over the 1st). With content-
    // sized cells the HQ drifts out from under the City, so the Hero that looks
    // "under" a Villain is not the one that counts. The desktop playmat sets this,
    // together with HQRow's flag, to give both rows the same fixed columns.
    isColumnAligned: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-817 / D-24750 — the viewer's own hand (owner-only UIPlayerState
    // handCards / handDisplay / handCosts, index-aligned), so a Primus fight can
    // offer only the cards the engine will accept. Eligibility reads handCosts (the
    // engine cost), never display.cost, which is null for Officers and Sidekicks.
    viewerHandCards: {
      type: Array as PropType<string[]>,
      required: false,
      default: () => [],
    },
    viewerHandDisplay: {
      type: Array as PropType<UICardDisplay[]>,
      required: false,
      default: () => [],
    },
    viewerHandCosts: {
      type: Array as PropType<(number | null)[]>,
      required: false,
      default: () => [],
    },
  },
  setup(props) {
    function buildCells(): CityCell[] {
      return useCityRow(props.city, props.decks).cells;
    }

    /**
     * Formats a cost list for the gate reason: `2`, `2 or 3`, `2, 3, 5, or 7`.
     *
     * @param costs - The eligible costs, in order.
     * @returns The English list with `or` before the last cost.
     */
    // why: a local copy of the engine's formatEligibleCostList — the client imports
    // only the engine's runtime-safe surface, never engine internals (Layer Boundary).
    function formatCostList(costs: number[]): string {
      if (costs.length <= 1) {
        return costs.map((cost) => String(cost)).join('');
      }
      if (costs.length === 2) {
        return `${costs[0]} or ${costs[1]}`;
      }
      const leadingCosts = costs.slice(0, -1).map((cost) => String(cost)).join(', ');
      return `${leadingCosts}, or ${costs[costs.length - 1]}`;
    }

    /**
     * Lists the viewer's hand cards that may pay a fight discard cost, in hand order.
     *
     * @param fightDiscardCosts - The fought villain's eligible costs.
     * @returns One entry per eligible hand card: its id and display name.
     */
    function eligibleDiscardCards(fightDiscardCosts: number[]): { cardId: string; name: string }[] {
      const eligibleCards: { cardId: string; name: string }[] = [];
      for (let handIndex = 0; handIndex < props.viewerHandCards.length; handIndex++) {
        const cost = props.viewerHandCosts[handIndex];
        if (typeof cost !== 'number' || !fightDiscardCosts.includes(cost)) {
          continue;
        }
        const cardId = props.viewerHandCards[handIndex]!;
        // why: the WP-111 placeholder name '<unknown>' (or no display entry) falls
        // back to the humanized id, as HandRow labels the same card.
        const displayName = props.viewerHandDisplay[handIndex]?.name;
        const name = displayName === undefined || displayName === '<unknown>'
          ? cardId.replace(/-/g, ' ')
          : displayName;
        eligibleCards.push({ cardId, name });
      }
      return eligibleCards;
    }

    function gateForCell(cell: CityCell): GatingResult {
      // why: disabled-state tooltip precedence per EC-132 §3 — stage
      // first, resource second, structural third. Stage gating beats
      // cost gating beats structural.
      if (cell.kind !== 'slot' || cell.card === null) {
        return { allowed: true, reason: null };
      }
      const stage = useTurnActions(props.currentStage, props.isViewerTurn).canFightVillain();
      if (!stage.allowed) {
        return stage;
      }
      const healLock = healLockGate(props.hasHealedThisTurn);
      if (!healLock.allowed) {
        return healLock;
      }
      // why: WP-750 / D-24574 — gate on `fightCost`, which is resolveFightCost,
      // the same authority the fightVillain guard reads (captured Heroes, the
      // Dark-Portal space bonus, Killbot / Skrull overlays; Patrol / Guard are
      // unset per D-2504), never on the printed `display.cost`.
      // why: WP-790 / D-24652 — pass the cell's City space so restricted ("usable only
      // against …") attack eligible here counts, exactly as the fightVillain gate does with
      // the same citySpaceNameForIndex mapping (the served figure must match the engine gate).
      const cost = useCardCostGating(props.economy).canFight(
        cell.card.fightCost,
        citySpaceNameForIndex(cell.cityIndex),
      );
      if (!cost.allowed) {
        return cost;
      }
      // why: WP-817 / D-24750 — the fight discard cost gates last (stage → heal →
      // cost → discard): with no eligible hand card the engine would refuse the fight.
      const fightDiscardCosts = cell.card.fightDiscardCosts;
      if (fightDiscardCosts !== undefined && eligibleDiscardCards(fightDiscardCosts).length === 0) {
        return {
          allowed: false,
          reason: `Needs a card that costs ${formatCostList(fightDiscardCosts)} to discard`,
        };
      }
      return cost;
    }

    function isFightCostUnaffordable(cell: CityCell): boolean {
      // why (Jeff feedback): the Fight N badge is loud only when it explains a
      // disabled Fight — the viewer's Main stage, and the projected cost is more
      // than the attack they have. Outside that window (another player's turn, a
      // non-main stage) the badge stays the quiet informational pill.
      if (cell.kind !== 'slot' || cell.card === null) {
        return false;
      }
      const stage = useTurnActions(props.currentStage, props.isViewerTurn).canFightVillain();
      if (!stage.allowed) {
        return false;
      }
      // why: D-24614 — after a heal the Fight is disabled by the heal lock, not
      // by cost, so the badge must not go loud and blame the attack total.
      if (!healLockGate(props.hasHealedThisTurn).allowed) {
        return false;
      }
      // why: WP-790 / D-24652 — the same per-target figure as the enable gate, so the badge
      // never goes loud on a villain restricted attack can pay for.
      return !useCardCostGating(props.economy).canFight(
        cell.card.fightCost,
        citySpaceNameForIndex(cell.cityIndex),
      ).allowed;
    }

    /**
     * Builds the always-visible fight discard cost cue text, e.g. `Discard 2/3/5/7`.
     *
     * @param fightDiscardCosts - The villain's eligible discard costs, in order.
     * @returns The short cue text.
     */
    // why: slashes, not formatCostList's "2, 3, 5, or 7" — the cue sits on an 80px
    // desktop tile, where the English list would not fit. The gate reason keeps the
    // full sentence.
    function discardCostCue(fightDiscardCosts: number[]): string {
      return `Discard ${fightDiscardCosts.join('/')}`;
    }

    function isFightDiscardUnpayable(cell: CityCell): boolean {
      // why (Jeff feedback, match OSth9-iV03C): a player who had played every
      // card costing 2/3/5/7 saw Primus's Fight disabled with no visible reason,
      // because the reason lives only in the shadowed tooltip. Like the Fight N
      // badge, the discard cue goes loud only in the window where it explains a
      // disabled Fight: the viewer's Main stage, no heal lock, and no hand card
      // the engine would accept.
      if (cell.kind !== 'slot' || cell.card === null) {
        return false;
      }
      const fightDiscardCosts = cell.card.fightDiscardCosts;
      if (fightDiscardCosts === undefined) {
        return false;
      }
      if (!useTurnActions(props.currentStage, props.isViewerTurn).canFightVillain().allowed) {
        return false;
      }
      if (!healLockGate(props.hasHealedThisTurn).allowed) {
        return false;
      }
      return eligibleDiscardCards(fightDiscardCosts).length === 0;
    }

    function hasFightCostBadge(cell: CityCell): boolean {
      // why: WP-750 / D-24574 — players see the number the engine will actually
      // charge. Shown only when it differs from the printed cost (a null printed
      // cost counts as different), so a matching tile renders exactly as before.
      if (cell.kind !== 'slot' || cell.card === null) {
        return false;
      }
      return cell.card.fightCost !== cell.card.display.cost;
    }

    // why: WP-817 / D-24750 — the open discard chooser (one at a time): the City
    // index being fought and whether the Excessive Violence button opened it.
    const discardChooser = ref<{ cityIndex: number; useExcessiveViolence: boolean } | null>(null);

    /**
     * Returns the fight discard costs of the villain at a City index, if any.
     *
     * @param cityIndex - The engine City index.
     * @returns The eligible costs, or undefined when the villain has none.
     */
    function fightDiscardCostsAt(cityIndex: number): number[] | undefined {
      return props.city.spaces[cityIndex]?.fightDiscardCosts;
    }

    function onFight(cityIndex: number): void {
      if (fightDiscardCostsAt(cityIndex) !== undefined) {
        discardChooser.value = { cityIndex, useExcessiveViolence: false };
        return;
      }
      props.submitMove('fightVillain', { cityIndex });
    }

    function onPickDiscard(cardId: string): void {
      const chooser = discardChooser.value;
      if (chooser === null) {
        return;
      }
      discardChooser.value = null;
      // why: the client submits intent; the engine re-validates the card and its cost.
      if (chooser.useExcessiveViolence) {
        props.submitMove('fightVillain', {
          cityIndex: chooser.cityIndex,
          discardCardId: cardId,
          useExcessiveViolence: true,
        });
      } else {
        props.submitMove('fightVillain', { cityIndex: chooser.cityIndex, discardCardId: cardId });
      }
    }

    function onCancelDiscard(): void {
      discardChooser.value = null;
    }

    function isDiscardChooserOpen(cityIndex: number): boolean {
      return discardChooser.value !== null && discardChooser.value.cityIndex === cityIndex;
    }

    function showEvFight(cell: CityCell): boolean {
      // why: WP-738 / D-24561 — the "Fight using Excessive Violence" affordance
      // is offered only when the villain is fightable AND the player has EV
      // available (WP-739 economy.excessiveViolenceAvailable) and can afford the
      // cost + 1 overspend. The engine still validates; this gate only decides
      // whether to SHOW the control, never the outcome. Absent field = false.
      if (cell.kind !== 'slot' || cell.card === null) {
        return false;
      }
      if (!gateForCell(cell).allowed) {
        return false;
      }
      // why: WP-790 / D-24652 — the EV +1 check uses the same per-target figure as the engine.
      return useCardCostGating(props.economy).canFightWithExcessiveViolence(
        cell.card.fightCost,
        citySpaceNameForIndex(cell.cityIndex),
      );
    }

    function onFightEV(cityIndex: number): void {
      // why: WP-738 / D-24561 — the client submits INTENT (useExcessiveViolence);
      // the engine decides the outcome — it overspends +1 attack and fires the
      // enrolled EV abilities, or silently fights normally if it cannot. Once-per-
      // turn is enforced engine-side: after the EV fight the availability field
      // goes absent and this affordance disappears on the next projection.
      if (fightDiscardCostsAt(cityIndex) !== undefined) {
        discardChooser.value = { cityIndex, useExcessiveViolence: true };
        return;
      }
      props.submitMove('fightVillain', { cityIndex, useExcessiveViolence: true });
    }

    /**
     * Whether to show the "Fight + Rescue" control (Baron Zemo, WP-819 / WP-820)
     * on a City cell.
     *
     * @param cell - The City cell.
     * @returns True when the villain is fightable and the fight plus 2 Recruit is payable.
     */
    function showRescueFight(cell: CityCell): boolean {
      // why: WP-820 / D-24753 — shown only from the engine cue (economy
      // .rescueOnFightAvailable, read inside canFightAndRescue) plus the Fight gate,
      // the WP-738 / D-24561 Excessive Violence precedent. This gate only decides
      // whether to SHOW the control; the engine decides the outcome.
      if (cell.kind !== 'slot' || cell.card === null) {
        return false;
      }
      if (!gateForCell(cell).allowed) {
        return false;
      }
      // why: WP-817 / D-24750 — a villain with a fight discard cost (Primus) is fought
      // through the discard chooser; this control must not bypass it (a request
      // without discardCardId would return silently).
      if (cell.card.fightDiscardCosts !== undefined) {
        return false;
      }
      return useCardCostGating(props.economy).canFightAndRescue(
        cell.card.fightCost,
        citySpaceNameForIndex(cell.cityIndex),
      );
    }

    /**
     * Submits a fight that also pays 2 Recruit to rescue a Bystander.
     *
     * @param cityIndex - The engine City index of the fought villain.
     */
    function onFightRescue(cityIndex: number): void {
      // why: the client submits INTENT (payToRescueBystander); the engine decides —
      // it pays and rescues, or logs why it declined and fights normally.
      props.submitMove('fightVillain', { cityIndex, payToRescueBystander: true });
    }

    function hasDarkPortal(cityIndex: number): boolean {
      // why: a Dark Portal buffs the SPACE, so the marker renders on a portal'd
      // city index whether or not a villain currently occupies it.
      return props.darkPortalIndices.includes(cityIndex);
    }

    function gateForCityIndex(cityIndex: number): boolean {
      // why: WP-756 / D-24585 — the slash gesture fights exactly what the Fight
      // button would: the same gateForCell, looked up by engine City index.
      for (const cell of buildCells()) {
        if (cell.kind === 'slot' && cell.cityIndex === cityIndex) {
          // why: WP-817 / D-24750 — a discard-cost villain needs a card picked, so the
          // slash gesture never fights it (click only; the chooser never opens mid-stroke).
          if (cell.card !== null && cell.card.fightDiscardCosts !== undefined) {
            return false;
          }
          return cell.card !== null && gateForCell(cell).allowed;
        }
      }
      return false;
    }

    // why: WP-756 / D-24585 — the slash gesture. A stroke that fully crosses
    // fightable villains submits the same fightVillain({ cityIndex }) a click
    // does, one at a time, through onFight. With the setting off the row gets no
    // listeners and no classes — it is byte-identical to the click-only row.
    const cityRowEl = ref<HTMLElement | null>(null);
    const { isEnabled: isSlashGestureSettingOn } = useSlashGestureSetting();
    // why: WP-761 — the long-press slash for touch / pen on a row that scrolls:
    // `isLongPressHoldEnabled` binds the hold class (callout off, long-press
    // listeners attached) and `isLongPressArmed` the armed glow.
    const {
      isGestureEnabled,
      isTouchGestureEnabled,
      isLongPressArmed,
      isLongPressHoldEnabled,
    } = useSlashGesture({
      rowElement: cityRowEl,
      city: () => props.city,
      gateForCityIndex,
      submitFight: onFight,
      isEnabled: isSlashGestureSettingOn,
    });

    return {
      buildCells,
      gateForCell,
      hasFightCostBadge,
      isFightCostUnaffordable,
      discardCostCue,
      isFightDiscardUnpayable,
      onFight,
      showEvFight,
      onFightEV,
      showRescueFight,
      onFightRescue,
      onPickDiscard,
      onCancelDiscard,
      isDiscardChooserOpen,
      eligibleDiscardCards,
      hasDarkPortal,
      cityRowEl,
      isGestureEnabled,
      isTouchGestureEnabled,
      isLongPressArmed,
      isLongPressHoldEnabled,
    };
  },
});
</script>

<template>
  <section
    class="city-row"
    :class="{ 'city-row--column-aligned': isColumnAligned }"
    data-testid="play-city-row"
    aria-label="City"
  >
    <!-- why: WP-756 — the gesture classes: `--gesture` (setting on) stops mouse
         strokes selecting label text; `--gesture-touch` (setting on AND the row
         fits without horizontal scroll) hands horizontal finger/pen strokes to
         the gesture while vertical page scroll keeps working. WP-761:
         `--gesture-hold` (setting on AND the row scrolls, or a long press is
         live) marks the long-press slash; `--gesture-armed` glows while armed. -->
    <ol
      ref="cityRowEl"
      class="city-spaces"
      :class="{
        'city-spaces--gesture': isGestureEnabled,
        'city-spaces--gesture-touch': isTouchGestureEnabled,
        'city-spaces--gesture-hold': isLongPressHoldEnabled,
        'city-spaces--gesture-armed': isLongPressArmed,
      }"
    >
      <!-- why: 7-cell visual layout locked per EC-132 §2:
           Escaped Pile | Bridge | Streets | Rooftops | Bank | Sewers | Villain Deck. -->
      <li
        v-for="(cell, position) in buildCells()"
        :key="position"
        class="city-space"
        :class="cell.kind === 'slot' || cell.kind === 'gone' ? 'city-space--space-column' : 'city-space--edge-column'"
      >
        <template v-if="cell.kind === 'escaped'">
          <EscapedPile :pile="cell.entries" />
        </template>
        <!-- why: WP-831 / D-24764 — a space a scheme removed from the City keeps its column (so the
             HQ stays aligned) but holds nothing and has no name any more. -->
        <div
          v-else-if="cell.kind === 'gone'"
          class="city-space-gone"
          data-testid="play-city-gone"
          :data-city-index="cell.cityIndex"
          :title="`The ${cell.slotName} is not part of the City right now.`"
          aria-label="Not part of the City"
        ></div>
        <template v-else-if="cell.kind === 'slot'">
          <!-- why: WP-727 / D-24548 — the Portals Dark Portal over this city space
               (twists 2-6). Rendered even when the space is EMPTY, because the
               portal buffs the space, not a specific villain; the +N is
               prop-driven, never hardcoded. -->
          <DarkPortalMarker
            v-if="hasDarkPortal(cell.cityIndex)"
            class="city-space__portal"
            :attack-bonus="darkPortalBonus"
          />
          <!-- why (Jeff feedback): the slot name (Bridge / Streets / …) sits on the
               LEFT SIDE of the card, rotated vertical, for EVERY slot (occupied or
               empty). We have more horizontal than vertical space on the mat, so a
               side label is shorter than a label above and lets the scale-to-fit
               board (D-24505) scale larger. The frosted-pill backing keeps it
               legible over a busy playmat (the D-24482 mask). -->
          <div
            class="city-space__label"
            data-testid="play-city-slot-label"
            :data-slot-name="cell.slotName"
          >
            {{ cell.slotName }}
          </div>
          <button
            v-if="cell.card !== null"
            type="button"
            class="city-space__villain"
            data-testid="play-city-villain"
            :data-city-index="cell.cityIndex"
            :data-slot-name="cell.slotName"
            :data-card-id="cell.card.extId"
            :disabled="!gateForCell(cell).allowed"
            :aria-disabled="!gateForCell(cell).allowed ? 'true' : undefined"
            :title="gateForCell(cell).reason ?? undefined"
            @click="onFight(cell.cityIndex)"
          >
            <!-- why: disabled-state tooltip precedence locked at EC-132 §3
                 (stage → resource → structural). The reason text is bound
                 from useTurnActions / useCardCostGating, not composed
                 ad-hoc. Cost gate consumes WP-128 economy.availableAttack
                 + UICityCard.fightCost (WP-750 / D-24574). -->
            <!-- why (Jeff feedback): city villains render at `md` (was `sm`) so the
                 villain art is easier to read; the city row scrolls in-zone, so the
                 larger tiles never push the layout. -->
            <CardTile
              :display="cell.card.display"
              size="md"
              :interactive="gateForCell(cell).allowed"
              :tooltip="gateForCell(cell).reason"
              :show-label="true"
            />
            <!-- why: WP-750 / D-24574 — the engine's projected fight cost, shown only
                 when it differs from the printed cost. Inside the button, pinned to
                 the bottom (not a .city-space flex child, which would widen every
                 space and shrink the scale-to-fit board, D-24505), and clear of the
                 top band where the Dark-Portal marker and the printed cost sit. -->
            <span
              v-if="hasFightCostBadge(cell)"
              class="city-space__fight-cost"
              :class="{ 'city-space__fight-cost--unaffordable': isFightCostUnaffordable(cell) }"
              data-testid="play-city-fight-cost"
            >Fight {{ cell.card.fightCost }}</span>
            <!-- why: WP-817 / D-24750 — the fight discard cost (Primus), always on the
                 tile so a player knows to hold an eligible card back. Same pinned
                 pill as the Fight N badge, stacked above it when both show. -->
            <span
              v-if="cell.card.fightDiscardCosts !== undefined"
              class="city-space__discard-cost"
              :class="{
                'city-space__discard-cost--stacked': hasFightCostBadge(cell),
                'city-space__discard-cost--unpayable': isFightDiscardUnpayable(cell),
              }"
              data-testid="play-city-discard-cost"
            >{{ discardCostCue(cell.card.fightDiscardCosts) }}</span>
          </button>
          <!-- why (Jeff feedback): the empty placeholder no longer prints the slot
               name inside it — the name is now the side label above. It stays a
               dashed "place a villain here" box. -->
          <div
            v-else
            class="city-space-empty"
            data-testid="play-city-empty"
            :data-city-index="cell.cityIndex"
            :data-slot-name="cell.slotName"
          ></div>
          <!-- why: WP-738 / D-24561 — the "Fight using Excessive Violence"
               affordance. A SEPARATE opt-in button (the normal Fight click above
               is unchanged); shown only when the villain is fightable AND the
               player has EV available and can afford cost + 1. Submitting it sends
               the useExcessiveViolence intent; the engine decides the outcome. -->
          <button
            v-if="showEvFight(cell)"
            type="button"
            class="city-space__ev-fight"
            data-testid="play-city-villain-ev"
            :data-city-index="cell.cityIndex"
            title="Spend 1 extra attack to fire every Excessive Violence ability on cards you played this turn."
            @click="onFightEV(cell.cityIndex)"
          >
            <CrossedSwordsIcon class="city-space__ev-fight-icon" />
            <span class="city-space__ev-fight-label">Excessive Violence</span>
            <span class="city-space__ev-fight-cost">+1</span>
          </button>
          <!-- why: WP-820 / D-24753 — Baron Zemo's "you may use 2 Recruit to rescue a
               Bystander". A SEPARATE opt-in button beside the EV one (the normal Fight
               click is unchanged); shown only from the engine cue + the Fight gate.
               Submitting it sends the payToRescueBystander intent; the engine decides. -->
          <button
            v-if="showRescueFight(cell)"
            type="button"
            class="city-space__rescue-fight"
            data-testid="play-city-villain-rescue"
            :data-city-index="cell.cityIndex"
            title="Fight this Villain and pay 2 Recruit to rescue a Bystander (Baron Zemo)."
            @click="onFightRescue(cell.cityIndex)"
          >
            <span class="city-space__rescue-fight-label">Fight + Rescue</span>
            <span class="city-space__rescue-fight-cost">2 Recruit</span>
          </button>
          <!-- why: WP-817 / D-24750 — the discard chooser for a fight discard cost
               (Primus): one button per eligible hand card, plus Cancel. Picking one
               submits the fight with that card; the engine re-validates it. -->
          <div
            v-if="cell.card !== null && cell.card.fightDiscardCosts !== undefined && isDiscardChooserOpen(cell.cityIndex)"
            class="city-space__discard-chooser"
            data-testid="play-city-discard-chooser"
            :data-city-index="cell.cityIndex"
            role="group"
            aria-label="Choose a card to discard"
          >
            <span class="city-space__discard-chooser-title">Discard to fight:</span>
            <button
              v-for="option in eligibleDiscardCards(cell.card.fightDiscardCosts)"
              :key="option.cardId"
              type="button"
              class="city-space__discard-option"
              data-testid="play-city-discard-option"
              :data-card-id="option.cardId"
              @click="onPickDiscard(option.cardId)"
            >{{ option.name }}</button>
            <button
              type="button"
              class="city-space__discard-cancel"
              data-testid="play-city-discard-cancel"
              @click="onCancelDiscard()"
            >Cancel</button>
          </div>
          <!-- why: WP-505 + Jeff feedback — captured cards render to the SIDE of the
               villain tile (was underneath), saving vertical space. Face-up captured
               heroes (attachedHeroDisplay) show as card art; face-down captured
               bystanders show as a count-only "N captured" badge (identity hidden =
               face-down). Rendered outside the fight button so clicking a captured
               card does not fight the villain. -->
          <div
            v-if="cell.card !== null && (cell.card.attachedHeroDisplay.length > 0 || cell.card.attachedBystanderCount > 0)"
            class="city-space__captured"
            data-testid="play-city-captured"
            :data-city-index="cell.cityIndex"
          >
            <CardTile
              v-for="(heroDisplay, heroIndex) in cell.card.attachedHeroDisplay"
              :key="'captured-hero-' + heroIndex"
              class="city-space__captured-hero"
              data-testid="play-city-captured-hero"
              :display="heroDisplay"
              size="sm"
              :show-cost="false"
            />
            <!-- why (Jeff feedback): a compact bystander icon + count instead of the
                 horizontal "N captured" text, to save room on the mat. The count is
                 how many bystanders this villain is holding; the icon is decorative
                 (aria-hidden) with the full text on the aria-label + hover title. -->
            <span
              v-if="cell.card.attachedBystanderCount > 0"
              class="city-space__captured-bystanders"
              data-testid="play-city-captured-bystanders"
              :aria-label="cell.card.attachedBystanderCount + ' bystanders captured'"
              :title="cell.card.attachedBystanderCount + ' bystander(s) captured'"
            >
              <span class="city-space__captured-bystanders-icon" aria-hidden="true">👤</span>{{ cell.card.attachedBystanderCount }}
            </span>
          </div>
        </template>
        <template v-else>
          <div class="city-space-deck" data-testid="play-city-villain-deck">
            <header>Villain Deck</header>
            <p>[{{ cell.count }}]</p>
          </div>
        </template>
      </li>
    </ol>
  </section>
</template>

<style scoped>
/* why: WP-831 / D-24764 — a removed City space: a faint hatched box in its usual column. */
.city-space-gone {
  width: 100%;
  min-height: 4rem;
  border: 1px dashed var(--color-foreground, #999);
  border-radius: 0.35rem;
  opacity: 0.25;
  background: repeating-linear-gradient(45deg, transparent 0 6px, rgba(128, 128, 128, 0.35) 6px 8px);
}

.city-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.city-spaces {
  display: flex;
  gap: 0.25rem;
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-x: auto;
}

/* why: WP-756 — with the slash gesture on, a mouse stroke across the row must
   never select the slot labels' text. */
.city-spaces--gesture {
  user-select: none;
  -webkit-user-select: none;
}

/* why: WP-756 — only while the row fits (no horizontal scroll): horizontal
   finger / pen strokes go to the gesture, and pan-y keeps vertical page scroll.
   On a scrolling row this class is absent, so touch keeps native scrolling. */
.city-spaces--gesture-touch {
  touch-action: pan-y;
}

/* why: WP-761 — during a long press iOS would open the image / link callout
   over the card art. Only on the hold class (the row scrolls, or a long press is
   live), so a fitting row keeps WP-756's styling exactly. */
.city-spaces--gesture-hold {
  -webkit-touch-callout: none;
}

/* why: WP-761 — the "armed" cue. INSET, because the row and its mobile band are
   overflow-x: auto and would clip an outer glow. A short pulse draws the eye to
   the arm; reduced motion keeps the glow and drops the pulse. */
.city-spaces--gesture-armed {
  box-shadow: inset 0 0 0 2px rgba(214, 194, 255, 0.95), inset 0 0 14px rgba(214, 194, 255, 0.55);
  border-radius: 0.35rem;
  animation: city-spaces-armed-pulse 600ms ease-out 1;
}

@keyframes city-spaces-armed-pulse {
  from {
    box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 1), inset 0 0 22px rgba(214, 194, 255, 0.9);
  }
  to {
    box-shadow: inset 0 0 0 2px rgba(214, 194, 255, 0.95), inset 0 0 14px rgba(214, 194, 255, 0.55);
  }
}

@media (prefers-reduced-motion: reduce) {
  .city-spaces--gesture-armed {
    animation: none;
  }
}

/* why (Jeff feedback): a HORIZONTAL row — the slot label rotated on the left, the
   villain / empty placeholder in the middle, and any captured cards to the right.
   The mat has more horizontal than vertical space, so a side label + side captures
   are shorter than the old stacked column, which lets the scale-to-fit board
   (D-24505) scale larger. */
.city-space {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.15rem;
  min-width: 0;
}

/* why: D-24747 — fixed columns shared with HQRow, so each HQ slot sits under the
   City space Abomination pairs it with. The edge columns (Escaped Pile, Villain
   Deck) and the five spaces take the parent's width tokens; the edge cell's
   content fills its column. */
.city-row--column-aligned .city-space--edge-column {
  flex: 0 0 var(--board-edge-column-width, auto);
}

.city-row--column-aligned .city-space--edge-column > * {
  flex: 1 1 auto;
  min-width: 0;
}

.city-row--column-aligned .city-space--space-column {
  flex: 0 0 var(--board-space-column-width, auto);
}

/* why: WP-750 — the villain button is the positioning context for the Fight N
   badge, so the badge overlays the tile instead of taking layout space. */
.city-space__villain {
  position: relative;
}

/* why: WP-750 / D-24574 — the projected fight cost, pinned to the bottom of the
   villain tile. Dark pill, like the captured-bystander badge, so it reads over
   any card art; the top band is left to the Dark-Portal marker and printed cost. */
.city-space__fight-cost {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  padding: 0.05rem 0.35rem;
  border-radius: 0.75rem;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  white-space: nowrap;
  pointer-events: none;
}

/* why (Jeff feedback, match 25-GJ0oXBwy): the quiet dark pill went unnoticed at the
   one moment it matters — the villain costs more than the attack in hand. On that
   state only, the badge turns red, grows slightly and pulses once; reduced motion
   keeps the colour and drops the pulse. */
.city-space__fight-cost--unaffordable {
  background: #b91c1c;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9), 0 0 10px rgba(185, 28, 28, 0.85);
  font-size: 0.75rem;
  animation: city-space__fight-cost-pulse 700ms ease-out 1;
}

@keyframes city-space__fight-cost-pulse {
  from {
    transform: translateX(-50%) scale(1.35);
  }
  to {
    transform: translateX(-50%) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .city-space__fight-cost--unaffordable {
    animation: none;
  }
}

/* why: WP-817 / D-24750 — the fight discard cost cue, the Fight N badge's pill.
   It may wrap to two lines ("Discard" / "2/3/5/7") so it never overflows the
   80px desktop tile. */
.city-space__discard-cost {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  width: max-content;
  max-width: calc(100% - 6px);
  padding: 0.05rem 0.35rem;
  border-radius: 0.75rem;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  text-align: center;
  pointer-events: none;
}

/* why: clears the Fight N badge below it, including its larger loud state. */
.city-space__discard-cost--stacked {
  bottom: 1.45rem;
}

/* why (Jeff feedback, match OSth9-iV03C): loud only when no hand card can pay —
   the same red, ring and single pulse as the unaffordable Fight N badge. */
.city-space__discard-cost--unpayable {
  background: #b91c1c;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9), 0 0 10px rgba(185, 28, 28, 0.85);
  animation: city-space__fight-cost-pulse 700ms ease-out 1;
}

@media (prefers-reduced-motion: reduce) {
  .city-space__discard-cost--unpayable {
    animation: none;
  }
}

/* why: WP-727 — the Dark Portal marker sits at the top of the space, centered,
   overlapping the cell. Kept inside the cell's top edge (not above it) so the
   `.city-spaces` overflow-x scroll container never clips it. */
.city-space__portal {
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
}

/* why (Jeff feedback): the slot name rotated 90° on the LEFT side of the card.
   `writing-mode: vertical-rl` makes the box vertical (takes width, not height);
   `rotate(180deg)` reads bottom-to-top (the conventional side-label direction). It
   stretches to the card's height. Frosted pill for legibility over the mat
   (D-24482). */
.city-space__label {
  flex: 0 0 auto;
  align-self: stretch;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem 0.12rem;
  border-radius: 0.35rem;
  background: rgba(248, 249, 252, 0.85);
  border: 1px solid rgba(40, 44, 66, 0.25);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  color: #1c2333;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

/* why (Jeff feedback): the empty placeholder is a dashed "place a villain here" box
   with NO text (the name is the side label now). A min-height keeps it card-tall so
   the side label reads at a usable height. */
.city-space-empty {
  flex: 1 1 auto;
  min-width: 2.75rem;
  min-height: 76px;
  border: 1px dashed var(--color-foreground, #666);
  border-radius: 0.35rem;
  opacity: 0.5;
}

.city-space-deck {
  padding: 0.5rem;
  border: 1px solid var(--color-foreground, #999);
  font-variant-numeric: tabular-nums;
}

.city-space-deck p,
.city-space__cost {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.city-space__name {
  display: block;
  font-weight: 600;
}

/* why: WP-505 + Jeff feedback — captured cards sit to the SIDE of the villain tile
   (a right-hand column), not underneath, saving vertical height. Heroes are shrunk
   for REAL by locally overriding the `--card-width-sm` custom property CardTile
   reads for its width — NOT a `transform: scale()`, which would leave a full-size
   layout box. The dashed left border reads as "attached alongside". */
.city-space__captured {
  --card-width-sm: 2.2rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  /* why (Jeff feedback): center the captured block against the villain card and
     let it size to its own content. Without this it inherits the row's
     `align-items: stretch` and grows to the full card height, leaving blank
     bordered space beneath a lone bystander pill. */
  align-self: center;
  gap: 0.15rem;
  min-width: 0;
  padding-left: 0.25rem;
  border-left: 1px solid var(--color-foreground, #666);
}

/* why (Jeff feedback): a compact icon + count badge (was the "N captured" text) —
   an inline-flex pill so the person glyph and the number sit tight together and the
   badge takes minimal room on the mat. */
.city-space__captured-bystanders {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
  padding: 0.05rem 0.3rem;
  border-radius: 0.75rem;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
}

.city-space__captured-bystanders-icon {
  font-size: 0.7rem;
}

/* why: WP-738 / D-24561, graphic fix-forward 2026-09-22 — the per-villain "Fight
   using Excessive Violence" opt-in. A filled RED overspend action so it reads as a
   deliberate, costly extra-attack fight distinct from the normal Fight click — not
   as card ability-text (the earlier subtle outline + a non-rendering U+2694 glyph
   made operators miss it entirely). The crossed-swords SVG and the "+1" cost badge
   spell out the extra-attack price on the button itself. */
.city-space__ev-fight {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  align-self: center;
  margin-top: 0.2rem;
  padding: 0.2rem 0.45rem;
  border: 1px solid #7a2818;
  border-radius: 0.35rem;
  background: linear-gradient(180deg, #c8452b 0%, #a5361f 100%);
  color: #fff;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(122, 40, 24, 0.45);
}

.city-space__ev-fight:hover {
  background: linear-gradient(180deg, #d85336 0%, #b53d24 100%);
}

.city-space__ev-fight:active {
  transform: translateY(1px);
}

.city-space__ev-fight-icon {
  font-size: 0.8rem;
}

/* why: the "+1" attack-cost badge — a lighter inset pill so the price of the
   overspend is unmistakable without a separate tooltip read. */
.city-space__ev-fight-cost {
  padding: 0 0.25rem;
  border-radius: 0.25rem;
  background: rgba(0, 0, 0, 0.28);
  font-variant-numeric: tabular-nums;
}

/* why: WP-820 / D-24753 — the per-villain "Fight + Rescue" opt-in (Baron Zemo), in
   the Excessive Violence button's shape but filled with the existing Recruit brand
   token, so it reads as "this fight also spends Recruit". The "2 Recruit" badge
   spells out the price on the button itself. */
.city-space__rescue-fight {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  align-self: center;
  margin-top: 0.2rem;
  padding: 0.2rem 0.45rem;
  border: 1px solid rgba(0, 0, 0, 0.35);
  border-radius: 0.35rem;
  background: var(--la-color-recruit);
  color: #fff;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}

.city-space__rescue-fight:hover {
  filter: brightness(1.1);
}

.city-space__rescue-fight:active {
  transform: translateY(1px);
}

.city-space__rescue-fight-label {
  line-height: 1.2;
}

/* why: the "2 Recruit" cost badge — the same lighter inset pill as the EV "+1". */
.city-space__rescue-fight-cost {
  padding: 0 0.25rem;
  border-radius: 0.25rem;
  background: rgba(0, 0, 0, 0.28);
  font-variant-numeric: tabular-nums;
}

/* why: WP-817 / D-24750 — the Primus discard chooser, an overlay on its own City
   space. As a flex sibling of the villain tile it landed to the RIGHT of the tile
   (the space is a horizontal row), overflowed the fixed D-24747 column, and the
   next cell (the Villain Deck, for Sewers) painted over it, so the options could
   be neither seen nor clicked (Jeff feedback). Inset to the space, it never widens
   the row (the scale-to-fit board, D-24505) and stays inside the overflow-x
   scroller, which also clips vertically; a long hand scrolls inside it. z-index 3
   clears the Dark-Portal marker (2). */
.city-space__discard-chooser {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.2rem;
  padding: 0.25rem;
  overflow-y: auto;
  border: 1px solid #ffd700;
  border-radius: 0.35rem;
  background: rgba(16, 20, 36, 0.95);
  color: #fff;
}

.city-space__discard-chooser-title {
  font-size: 0.6rem;
  font-weight: 700;
  color: #ffd700;
}

/* why: flex: none keeps each button its natural height inside the overlay; a
   hand with many eligible cards scrolls the chooser instead of squashing the
   labels. */
.city-space__discard-option,
.city-space__discard-cancel {
  flex: none;
  line-height: 1.2;
  padding: 0.15rem 0.35rem;
  border: 1px solid currentColor;
  border-radius: 0.3rem;
  background: transparent;
  color: inherit;
  font-size: 0.62rem;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.city-space__discard-option {
  font-weight: 700;
}
</style>
