<script lang="ts">
import { defineComponent, nextTick, ref, watch, type PropType } from 'vue';
import type {
  UICardDisplay,
  UIDecksState,
  UIHQState,
  UIPlayerState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
import { useHqRow, type HqCell } from '../../composables/useHqRow';
import { useCardCostGating, type GatingResult } from '../../composables/useCardCostGating';
import { useTurnActions, healLockGate } from '../../composables/useTurnActions';
import { useRowFit } from '../../composables/useRowFit';
import CardTile from './CardTile.vue';
import HauntedExorciseChooser, { type ExorciseChoice } from './HauntedExorciseChooser.vue';
import type { SubmitMove } from './uiMoveName.types';

// why: WP-759 / D-24587 — the engine's recruitHero refuses a Haunted slot at any budget,
// so the Recruit button says why instead of reading as a dead click.
const HAUNTED_RECRUIT_REASON = 'Haunted — exorcise it first';
// why: WP-759 — exorciseHauntedHero carries the D-24180 heal lock, but the shared
// healLockGate reason names only recruit and fight (exorcise is neither, rulebook v23
// p.27), so Exorcise gets its own wording.
const EXORCISE_HEAL_LOCK_REASON = "You healed this turn — you can't exorcise";

/**
 * HQ row — 6-cell visual rewrite per `DESIGN-BOARD-LAYOUT.md §7.1`
 * column order: `Hero1 | Hero2 | Hero3 | Hero4 | Hero5 | Hero Deck`.
 * Per D-12903 the count gracefully extends to 7 cells when a 6-slot
 * scenario projects.
 *
 * Haunt (WP-759 / D-24587): a Haunted slot shows its haunter, disables Recruit, and
 * offers Exorcise (a sibling button under the card) that opens the in-flow
 * `HauntedExorciseChooser` below the slot list. A match with no haunt projects no
 * `hq.haunters`, so none of it renders.
 *
 * Cost gating: heroes in HQ render disabled when
 * `economy.availableRecruit < hero.cost` per WP-128 economy projection.
 * Disabled-state tooltip precedence locked at EC-132 §3 (stage → resource
 * → structural).
 *
 * Column alignment: with `isColumnAligned`, a blank leading cell sits under the
 * City's Escaped Pile and every cell takes the same fixed widths as a
 * column-aligned `CityRow`, so Hero 1 is under the Bridge … Hero 5 under the
 * Sewers, and the Hero Deck under the Villain Deck, as on the physical board.
 *
 * Per the EC-132 §2 SFC authoring whitelist: this is a tested non-leaf
 * composer that USES composables, so it MUST use
 * `defineComponent({ setup() { return {...} } })` per P6-30 / P6-46 /
 * D-6512.
 *
 * @see WP-129 §Acceptance Criteria — HQ row 6 cells
 * @see DESIGN-BOARD-LAYOUT.md §7.1 HQ row
 * @see EC-132 §2 HQ visual column order
 */
export default defineComponent({
  name: 'HQRow',
  components: { CardTile, HauntedExorciseChooser },
  props: {
    hq: {
      type: Object as PropType<UIHQState>,
      required: true,
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
    // why: WP-831 / D-24764 — City spaces beyond the normal five (a scheme can add them). Each adds
    // a blank leading cell so Hero 1 stays under the Bridge; the HQ itself is always 5 (rules v23).
    extraCitySpaces: {
      type: Number,
      required: false,
      default: 0,
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
    // why: D-24747 — Abomination pairs each City space with the HQ slot under it
    // by position. The desktop playmat sets this with CityRow's flag, so the Hero
    // a player sees under a Villain is the one its fight cost reads.
    isColumnAligned: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-852 / D-24788 — the desktop board's straighten-on-hover. Only
    // PlayDesktop sets it (from useBoardTilt's lift gate); every other use,
    // PlayMobile included, keeps it false and renders the row exactly as before.
    isTiltLiftEnabled: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-759 — the seats an exorcised Hero can be given to (UIState.players).
    // Optional so every existing mount and test renders unchanged.
    players: {
      type: Array as PropType<UIPlayerState[]>,
      required: false,
      default: () => [],
    },
    // why: WP-759 — the viewing seat, listed first ("You") in the exorcise chooser.
    // Null (a spectator, or a mount that does not pass it) renders no Exorcise button.
    viewerPlayerId: {
      type: String as PropType<string | null>,
      required: false,
      default: null,
    },
    // why: WP-759 — names a Mastermind haunter on the slot's haunter strip
    // (UIState.mastermind.display.name); a Mastermind haunter projects no display.
    mastermindName: {
      type: String,
      required: false,
      default: '',
    },
  },
  setup(props) {
    function buildCells(): HqCell[] {
      return useHqRow(props.hq, props.decks).cells;
    }

    function gateForCell(cell: HqCell): GatingResult {
      // why: disabled-state tooltip precedence per EC-132 §3 — stage →
      // resource → structural. When display payload is missing (engine
      // hasn't projected slotDisplay yet), we fall back to stage-only
      // gating so the surface remains usable.
      if (cell.kind !== 'hero' || cell.cardId === null) {
        return { allowed: true, reason: null };
      }
      const stage = useTurnActions(props.currentStage, props.isViewerTurn).canRecruitHero();
      if (!stage.allowed) {
        return stage;
      }
      const healLock = healLockGate(props.hasHealedThisTurn);
      if (!healLock.allowed) {
        return healLock;
      }
      // why: WP-759 / D-24587 — Haunted outranks the resource gate because recruiting a
      // Haunted Hero is impossible at any budget. It sits before the display-null
      // fallback so a Haunted slot with no projected display is still locked.
      if (cell.haunter !== null) {
        return { allowed: false, reason: HAUNTED_RECRUIT_REASON };
      }
      if (cell.display === null) {
        return stage;
      }
      // why: D-24801 — the engine's Size-Changing price for this slot, when projected.
      return useCardCostGating(props.economy).canRecruit(cell.display, props.hq.recruitCosts?.[cell.hqIndex]);
    }

    /**
     * Whether a cell offers Exorcise: a Haunted, occupied slot, seen by a seated viewer.
     *
     * @param cell - The HQ cell.
     * @returns True when the Exorcise button renders.
     */
    function isExorciseOffered(cell: HqCell): boolean {
      // why: the engine refuses an empty slot (nothing to exorcise), so a haunter left
      // on a dry slot shows its strip with no button; a spectator never acts.
      return cell.kind === 'hero' && cell.haunter !== null && cell.cardId !== null && props.viewerPlayerId !== null;
    }

    /**
     * The Exorcise button gate. It mirrors the engine's exorciseHauntedHero guard so the
     * button never offers a move the engine will no-op (the WP-750 dead-button lesson):
     * turn + stage, then the heal lock, then the Hero's printed cost.
     *
     * // why: like Recruit, this does not read the pending-choice flags: while a choice
     * is open the engine's block-all guards no-op both moves. Making every board button
     * pending-aware is a separate change (accepted residual, WP-759 copilot #11).
     *
     * @param cell - A cell for which `isExorciseOffered` is true.
     * @returns The gate result, with a full-sentence reason when blocked.
     */
    function gateForExorcise(cell: HqCell): GatingResult {
      if (cell.kind !== 'hero') {
        return { allowed: false, reason: null };
      }
      const stage = useTurnActions(props.currentStage, props.isViewerTurn).canExorciseHauntedHero();
      if (!stage.allowed) {
        return stage;
      }
      if (props.hasHealedThisTurn) {
        return { allowed: false, reason: EXORCISE_HEAL_LOCK_REASON };
      }
      if (cell.display === null) {
        return stage;
      }
      // why: D-24587 — exorcise pays the Hero's PRINTED cost (the engine reads
      // G.cardStats and treats a missing cost as 0), never the D-24801 Size-Changing
      // price, so no recruitCosts argument is passed here.
      const printedCost = cell.display.cost ?? 0;
      return useCardCostGating(props.economy).canRecruit({ ...cell.display, cost: printedCost });
    }

    /**
     * The Exorcise button label: the printed price when the display is projected.
     *
     * @param cell - The HQ cell.
     * @returns "Exorcise (6)", or "Exorcise" when the display is missing.
     */
    function exorciseLabelForCell(cell: HqCell): string {
      if (cell.kind !== 'hero' || cell.display === null) {
        return 'Exorcise';
      }
      return `Exorcise (${String(cell.display.cost ?? 0)})`;
    }

    /**
     * The haunter strip's name: the Villain's embedded display name, or the Mastermind.
     *
     * @param cell - The HQ cell.
     * @returns The haunter's name, or an empty string for an unhaunted cell.
     */
    function haunterNameForCell(cell: HqCell): string {
      if (cell.kind !== 'hero' || cell.haunter === null) {
        return '';
      }
      if (cell.haunter.kind === 'villain') {
        return cell.haunter.display.name;
      }
      if (props.mastermindName !== '') {
        return props.mastermindName;
      }
      return 'the Mastermind';
    }

    /**
     * The haunter Villain's card art URL, or an empty string (a Mastermind haunter or
     * a Villain without art shows its name only).
     *
     * @param cell - The HQ cell.
     * @returns The image URL, or an empty string.
     */
    function haunterImageForCell(cell: HqCell): string {
      if (cell.kind !== 'hero' || cell.haunter === null || cell.haunter.kind !== 'villain') {
        return '';
      }
      return cell.haunter.display.imageUrl;
    }

    // why: WP-759 — which slot's exorcise chooser is open (null = closed); one at a time.
    const openExorciseIndex = ref<number | null>(null);
    const rootElement = ref<HTMLElement | null>(null);

    /**
     * Opens (or, on a second click, closes) the exorcise chooser for a slot.
     *
     * @param hqIndex - The Haunted slot.
     */
    function onExorcise(hqIndex: number): void {
      if (openExorciseIndex.value === hqIndex) {
        openExorciseIndex.value = null;
        return;
      }
      openExorciseIndex.value = hqIndex;
    }

    /**
     * The cell whose chooser is open, while it can still be exorcised; null otherwise,
     * so a stale chooser (the turn moved on, the slot refilled) never renders.
     *
     * @returns The open cell, or null.
     */
    function chooserCell(): HqCell | null {
      const openIndex = openExorciseIndex.value;
      if (openIndex === null) {
        return null;
      }
      for (const cell of buildCells()) {
        if (cell.kind === 'hero' && cell.hqIndex === openIndex) {
          if (isExorciseOffered(cell) && gateForExorcise(cell).allowed) {
            return cell;
          }
          return null;
        }
      }
      return null;
    }

    /**
     * The open chooser's Hero name and printed price, or null while it is closed.
     *
     * @returns The Hero's name and cost (null when no display is projected), or null.
     */
    function chooserHero(): { name: string; cost: number | null } | null {
      const cell = chooserCell();
      if (cell === null || cell.kind !== 'hero') {
        return null;
      }
      if (cell.display === null) {
        return { name: displayForCell(cell).name, cost: null };
      }
      return { name: cell.display.name, cost: cell.display.cost ?? 0 };
    }

    /**
     * Submits the chosen exorcise outcome and closes the chooser. The engine decides.
     *
     * @param choice - The payload the chooser built.
     */
    function onExorciseChoose(choice: ExorciseChoice): void {
      openExorciseIndex.value = null;
      props.submitMove('exorciseHauntedHero', choice);
    }

    /** Closes the chooser and returns focus to the Exorcise button that opened it. */
    function onExorciseClose(): void {
      const closedIndex = openExorciseIndex.value;
      openExorciseIndex.value = null;
      if (closedIndex === null) {
        return;
      }
      void nextTick(() => {
        const opener = rootElement.value?.querySelector<HTMLButtonElement>(
          `[data-testid="play-hq-exorcise"][data-hq-index="${String(closedIndex)}"]`,
        );
        opener?.focus();
      });
    }

    // why: a new snapshot (a move resolved, the turn passed) can make an open choice
    // stale; closing on any HQ change keeps the chooser tied to the board it opened on.
    watch(
      () => props.hq,
      () => {
        openExorciseIndex.value = null;
      },
    );

    /**
     * The Size-Changing price label for a slot, or null when the slot costs its printed cost.
     *
     * @param cell - The HQ cell.
     * @returns A short label such as "Costs 0 now", or null.
     */
    function sizeChangingLabelForCell(cell: HqCell): string | null {
      if (cell.kind !== 'hero' || cell.display === null || cell.display.cost === null) {
        return null;
      }
      const recruitCost = props.hq.recruitCosts?.[cell.hqIndex];
      if (typeof recruitCost !== 'number' || recruitCost === cell.display.cost) {
        return null;
      }
      if (recruitCost < 0) {
        return `Costs 0 now, +${String(-recruitCost)} recruit`;
      }
      return `Costs ${String(recruitCost)} now`;
    }

    function onRecruit(hqIndex: number): void {
      props.submitMove('recruitHero', { hqIndex });
    }

    function displayForCell(cell: HqCell): UICardDisplay {
      if (cell.kind === 'hero' && cell.display !== null) {
        return cell.display;
      }
      const cardId = cell.kind === 'hero' ? cell.cardId ?? '' : '';
      return {
        extId: cardId,
        name: cardId.replace(/-/g, ' '),
        imageUrl: '',
        cost: null,
      };
    }

    // why: WP-852 — the hover lift needs `overflow: visible` on the list, and a
    // scroll container forces its subtree flat and clips it, so the lift is on
    // only while the row fits without sideways scroll. The extra spacer columns
    // a bigger City adds change the row's width, so they re-measure too.
    const hqSlotsElement = ref<HTMLElement | null>(null);
    const isRowFitting = useRowFit(hqSlotsElement, () => [props.hq, props.extraCitySpaces]);

    return {
      buildCells,
      gateForCell,
      onRecruit,
      displayForCell,
      sizeChangingLabelForCell,
      hqSlotsElement,
      isRowFitting,
      isExorciseOffered,
      gateForExorcise,
      exorciseLabelForCell,
      haunterNameForCell,
      haunterImageForCell,
      openExorciseIndex,
      rootElement,
      onExorcise,
      chooserHero,
      onExorciseChoose,
      onExorciseClose,
    };
  },
});
</script>

<template>
  <section
    ref="rootElement"
    class="hq-row"
    :class="{
      'hq-row--column-aligned': isColumnAligned,
      'hq-row--tilt-lift': isTiltLiftEnabled && isRowFitting,
    }"
    data-testid="play-hq-row"
    aria-label="HQ"
  >
    <ol ref="hqSlotsElement" class="hq-slots">
      <!-- why: D-24747 — the blank cell under the City's Escaped Pile, as on the
           physical board, so Hero 1 lands under the Bridge. Decorative only. -->
      <li
        v-if="isColumnAligned"
        class="hq-slot hq-slot--edge-column"
        data-testid="play-hq-spacer"
        aria-hidden="true"
      />
      <li
        v-for="extraIndex in (isColumnAligned ? extraCitySpaces : 0)"
        :key="`extra-${extraIndex}`"
        class="hq-slot hq-slot--space-column"
        data-testid="play-hq-extra-spacer"
        aria-hidden="true"
      />
      <!-- why: 6-cell visual layout locked per EC-132 §2:
           Hero1 | Hero2 | Hero3 | Hero4 | Hero5 | Hero Deck.
           Per D-12903, 6-slot scenarios extend gracefully to 7 cells. -->
      <li
        v-for="(cell, position) in buildCells()"
        :key="position"
        class="hq-slot"
        :class="[
          cell.kind === 'hero' ? 'hq-slot--space-column' : 'hq-slot--edge-column',
          { 'hq-slot--haunted': cell.kind === 'hero' && cell.haunter !== null },
        ]"
      >
        <template v-if="cell.kind === 'hero'">
          <button
            v-if="cell.cardId !== null"
            type="button"
            class="hq-slot__hero"
            data-testid="play-hq-hero"
            :data-hq-index="cell.hqIndex"
            :data-card-id="cell.cardId"
            :disabled="!gateForCell(cell).allowed"
            :aria-disabled="!gateForCell(cell).allowed ? 'true' : undefined"
            :title="gateForCell(cell).reason ?? undefined"
            @click="onRecruit(cell.hqIndex)"
          >
            <!-- why: disabled-state tooltip precedence locked at EC-132 §3
                 (stage → resource → structural). Reason text is bound from
                 useTurnActions / useCardCostGating. Cost gate consumes
                 WP-128 economy.availableRecruit + UICardDisplay.cost. -->
            <CardTile
              :display="displayForCell(cell)"
              size="md"
              :interactive="gateForCell(cell).allowed"
              :tooltip="gateForCell(cell).reason"
              :show-label="true"
            />
            <!-- why: D-24801 — the Size-Changing price when it differs from the printed cost. -->
            <span
              v-if="sizeChangingLabelForCell(cell) !== null"
              class="hq-slot__size-changing"
              data-testid="play-hq-size-changing-cost"
            >{{ sizeChangingLabelForCell(cell) }}</span>
          </button>
          <div
            v-else
            class="hq-slot-empty"
            data-testid="play-hq-empty"
            :data-hq-index="cell.hqIndex"
          >
            Empty slot
          </div>
          <!-- why: WP-759 / D-24587 — the haunter, tucked face-up beneath the Hero
               (rulebook v23 p.27). A sibling of the card button, never inside it. -->
          <div
            v-if="cell.haunter !== null"
            class="hq-slot__haunter"
            data-testid="play-hq-haunter"
            :data-haunter-kind="cell.haunter.kind"
            :data-haunter-ext-id="cell.haunter.kind === 'villain' ? cell.haunter.extId : undefined"
            :title="`Haunted by ${haunterNameForCell(cell)}`"
          >
            <img
              v-if="haunterImageForCell(cell) !== ''"
              class="hq-slot__haunter-art"
              :src="haunterImageForCell(cell)"
              alt=""
            />
            <span class="hq-slot__haunter-name">Haunted by {{ haunterNameForCell(cell) }}</span>
          </div>
          <!-- why: WP-759 — Exorcise is a sibling of the card button (a button cannot hold
               a button), gated exactly like the engine's exorciseHauntedHero guard. -->
          <button
            v-if="isExorciseOffered(cell)"
            type="button"
            class="hq-slot__exorcise"
            data-testid="play-hq-exorcise"
            :data-hq-index="cell.hqIndex"
            :disabled="!gateForExorcise(cell).allowed"
            :aria-disabled="!gateForExorcise(cell).allowed ? 'true' : undefined"
            :aria-expanded="openExorciseIndex === cell.hqIndex ? 'true' : 'false'"
            :title="gateForExorcise(cell).reason ?? undefined"
            @click="onExorcise(cell.hqIndex)"
          >
            {{ exorciseLabelForCell(cell) }}
          </button>
        </template>
        <template v-else>
          <div class="hq-slot-deck" data-testid="play-hq-hero-deck">
            <header>Hero Deck</header>
            <p>[{{ cell.count }}]</p>
          </div>
        </template>
      </li>
    </ol>
    <!-- why: WP-759 — the chooser renders in normal flow below the slot list, never
         absolute or fixed: the list scrolls sideways (overflow-x would clip anything
         positioned out of it), and the mobile scroll band and the desktop fit-stage
         scale transform would offset a fixed panel from its slot. -->
    <HauntedExorciseChooser
      v-if="chooserHero() !== null && openExorciseIndex !== null && viewerPlayerId !== null"
      :key="openExorciseIndex"
      :hq-index="openExorciseIndex"
      :hero-name="chooserHero()!.name"
      :cost="chooserHero()!.cost"
      :players="players"
      :viewer-player-id="viewerPlayerId"
      @choose="onExorciseChoose"
      @close="onExorciseClose"
    />
  </section>
</template>

<style scoped>
.hq-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hq-slots {
  display: flex;
  gap: 0.25rem;
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-x: auto;
}

.hq-slot {
  min-width: 6rem;
}

/* why: D-24747 — the same fixed columns as a column-aligned CityRow; the Hero is
   centred in its column so it reads as sitting under that City space. */
.hq-row--column-aligned .hq-slot--edge-column {
  flex: 0 0 var(--board-edge-column-width, auto);
  min-width: 0;
}

/* why: the HQ can sit inside a padded panel the City row does not have; the
   parent names that left inset in --board-hq-row-inset, and the blank leading
   cell gives it back so the columns still line up. */
.hq-row--column-aligned .hq-slot--edge-column[data-testid='play-hq-spacer'] {
  flex-basis: calc(var(--board-edge-column-width, 0px) - var(--board-hq-row-inset, 0px));
}

.hq-row--column-aligned .hq-slot--space-column {
  flex: 0 0 var(--board-space-column-width, auto);
  min-width: 0;
  display: flex;
  justify-content: center;
}

.hq-slot-empty {
  padding: 0.5rem 0.75rem;
  border: 1px dashed var(--color-foreground, #666);
  opacity: 0.5;
}

.hq-slot-deck {
  padding: 0.5rem;
  border: 1px solid var(--color-foreground, #999);
  font-variant-numeric: tabular-nums;
}

.hq-slot-deck p,
.hq-slot__cost {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.hq-slot__size-changing {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.hq-slot__name {
  display: block;
  font-weight: 600;
}

/* why: WP-759 — a Haunted slot stacks the card, its haunter strip and the Exorcise
   button vertically (a column-aligned slot is otherwise a centring row). */
.hq-slot--haunted,
.hq-row--column-aligned .hq-slot--space-column.hq-slot--haunted {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.hq-slot__haunter {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  max-width: 100%;
  padding: 0.05rem 0.3rem;
  border-radius: 0.3rem;
  background: var(--color-haunt, #5b21b6);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
}

.hq-slot__haunter-art {
  width: 1.1rem;
  height: 1.1rem;
  object-fit: cover;
  border-radius: 0.15rem;
}

.hq-slot__haunter-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.hq-slot__exorcise {
  padding: 0.1rem 0.45rem;
  font-size: 0.72rem;
  font-weight: 700;
}

/* why: WP-852 / D-24788 — the board-card straighten-on-hover. Pointer devices
   only, and only under --tilt-lift (the lift gate AND a row that fits: a scroll
   container forces its subtree flat and clips, so the list's overflow turns
   visible here and nowhere else). Every link from the tilted plane down to the
   button preserves 3D, or the card would rise but stay tilted. The links are on
   only while a liftable card is hovered: at rest, coplanar preserve-3d layers
   z-fight in Chrome's hit test and steal clicks from resting cards (WP-852 EC
   amendment A). */
@media (hover: hover) {
  .hq-row--tilt-lift:has(.hq-slot:hover > .hq-slot__hero),
  .hq-row--tilt-lift:has(.hq-slot:hover > .hq-slot__hero) .hq-slots,
  .hq-row--tilt-lift:has(.hq-slot:hover > .hq-slot__hero) .hq-slot,
  .hq-row--tilt-lift:has(.hq-slot:hover > .hq-slot__hero) .hq-slot__hero {
    transform-style: preserve-3d;
  }
  .hq-row--tilt-lift .hq-slots {
    overflow: visible;
  }
  /* why: the bottom-edge origin makes the card rise off the table rather than
     into it, and keeps that edge put, so every point of the resting card stays
     under the lifted one (no dead click strip; hence no translateY). */
  .hq-row--tilt-lift .hq-slot__hero {
    transform-origin: 50% 100%;
    transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
  }
  /* why: the hover sits on the li, which keeps its box, while the transform
     moves the button; hovering the button itself would flicker as it moves out
     from under the pointer. */
  .hq-row--tilt-lift .hq-slot:hover > .hq-slot__hero {
    transform: rotateX(calc(-1 * var(--board-tilt-angle))) scale(1.06);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
  }
  /* why: the tile's own 1.05 hover scale would compound with the lift; inside a
     lifting row the lifted card is exactly 1.06. */
  .hq-row--tilt-lift .card-tile--interactive:hover {
    transform: none;
  }
}
</style>
