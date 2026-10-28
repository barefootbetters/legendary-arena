<script lang="ts">
import { defineComponent, ref, type PropType } from 'vue';
import type {
  UICardDisplay,
  UIDecksState,
  UIHQState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
import { useHqRow, type HqCell } from '../../composables/useHqRow';
import { useCardCostGating, type GatingResult } from '../../composables/useCardCostGating';
import { useTurnActions, healLockGate } from '../../composables/useTurnActions';
import { useRowFit } from '../../composables/useRowFit';
import CardTile from './CardTile.vue';
import type { SubmitMove } from './uiMoveName.types';

/**
 * HQ row — 6-cell visual rewrite per `DESIGN-BOARD-LAYOUT.md §7.1`
 * column order: `Hero1 | Hero2 | Hero3 | Hero4 | Hero5 | Hero Deck`.
 * Per D-12903 the count gracefully extends to 7 cells when a 6-slot
 * scenario projects.
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
  components: { CardTile },
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
      if (cell.display === null) {
        return stage;
      }
      return useCardCostGating(props.economy).canRecruit(cell.display);
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

    return { buildCells, gateForCell, onRecruit, displayForCell, hqSlotsElement, isRowFitting };
  },
});
</script>

<template>
  <section
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
        :class="cell.kind === 'hero' ? 'hq-slot--space-column' : 'hq-slot--edge-column'"
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
          </button>
          <div
            v-else
            class="hq-slot-empty"
            data-testid="play-hq-empty"
            :data-hq-index="cell.hqIndex"
          >
            Empty slot
          </div>
        </template>
        <template v-else>
          <div class="hq-slot-deck" data-testid="play-hq-hero-deck">
            <header>Hero Deck</header>
            <p>[{{ cell.count }}]</p>
          </div>
        </template>
      </li>
    </ol>
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

.hq-slot__name {
  display: block;
  font-weight: 600;
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
