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
          <div
            v-else
            class="city-space-empty"
            data-testid="play-city-empty"
            :data-city-index="cell.cityIndex"
            :data-slot-name="cell.slotName"
          >
            {{ cell.slotName }}
          </div>
          <!-- why: WP-505 — captured cards render underneath the villain tile.
               Face-up captured heroes (attachedHeroDisplay) show as card art
               so players see which hero was taken; face-down captured
               bystanders show as a count-only "N captured" badge (identity
               hidden = face-down). Rendered outside the fight button so
               clicking a captured card does not fight the villain. -->
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

.city-space {
  min-width: 6rem;
}

.city-space-empty {
  padding: 0.5rem 0.75rem;
  border: 1px dashed var(--color-foreground, #666);
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

/* why: WP-505 — captured cards sit beneath the villain tile. Heroes render at
   a reduced scale so the stack reads as "held under" the villain; the bystander
   badge is a compact count pill. */
.city-space__captured {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem;
  margin-top: 0.2rem;
  padding-left: 0.4rem;
}

.city-space__captured-hero {
  transform: scale(0.7);
  transform-origin: top left;
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
