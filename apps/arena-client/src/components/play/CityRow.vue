<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type {
  UICityState,
  UIDecksState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
import { useCityRow, type CityCell } from '../../composables/useCityRow';
import { useCardCostGating, type GatingResult } from '../../composables/useCardCostGating';
import { useTurnActions } from '../../composables/useTurnActions';
import CardTile from './CardTile.vue';
import EscapedPile from './EscapedPile.vue';
import type { SubmitMove } from './uiMoveName.types';

/**
 * City row — 7-cell visual rewrite per `DESIGN-BOARD-LAYOUT.md §7.1`
 * column order: `Escaped Pile | Bridge | Streets | Rooftops | Bank |
 * Sewers | Villain Deck`. The engine indexes the city `0..4`; cells
 * 1..5 in the rendered row map to those engine indices in left-to-right
 * order.
 *
 * Cost gating: villains in the city render disabled when
 * `economy.availableAttack < villain.cost` per WP-128 economy projection.
 * Disabled-state tooltip precedence locked at EC-132 §3 (stage → resource
 * → structural). The reason is bound from useTurnActions / useCardCostGating
 * — never composed ad-hoc.
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
  components: { CardTile, EscapedPile },
  props: {
    city: {
      type: Object as PropType<UICityState>,
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
    function buildCells(): CityCell[] {
      return useCityRow(props.city, props.decks).cells;
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
      const cost = useCardCostGating(props.economy).canFight(cell.card.display);
      return cost;
    }

    function onFight(cityIndex: number): void {
      props.submitMove('fightVillain', { cityIndex });
    }

    return { buildCells, gateForCell, onFight };
  },
});
</script>

<template>
  <section
    class="city-row"
    data-testid="play-city-row"
    aria-label="City"
  >
    <ol class="city-spaces">
      <!-- why: 7-cell visual layout locked per EC-132 §2:
           Escaped Pile | Bridge | Streets | Rooftops | Bank | Sewers | Villain Deck. -->
      <li
        v-for="(cell, position) in buildCells()"
        :key="position"
        class="city-space"
      >
        <template v-if="cell.kind === 'escaped'">
          <EscapedPile :pile="cell.entries" />
        </template>
        <template v-else-if="cell.kind === 'slot'">
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
                 + UICityCard.display.cost. -->
            <CardTile
              :display="cell.card.display"
              size="sm"
              :interactive="gateForCell(cell).allowed"
              :show-label="true"
            />
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
            <span
              v-if="cell.card.attachedBystanderCount > 0"
              class="city-space__captured-bystanders"
              data-testid="play-city-captured-bystanders"
              :aria-label="cell.card.attachedBystanderCount + ' bystanders captured'"
            >
              {{ cell.card.attachedBystanderCount }} captured
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

/* why (Jeff feedback): a HORIZONTAL row — the slot label rotated on the left, the
   villain / empty placeholder in the middle, and any captured cards to the right.
   The mat has more horizontal than vertical space, so a side label + side captures
   are shorter than the old stacked column, which lets the scale-to-fit board
   (D-24505) scale larger. */
.city-space {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.15rem;
  min-width: 0;
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
  gap: 0.15rem;
  min-width: 0;
  padding-left: 0.25rem;
  border-left: 1px solid var(--color-foreground, #666);
}

.city-space__captured-bystanders {
  padding: 0.05rem 0.35rem;
  border-radius: 0.75rem;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
