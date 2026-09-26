<script lang="ts">
import { defineComponent, ref, type PropType } from 'vue';
import type {
  UICityState,
  UIDecksState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
import { useCityRow, type CityCell } from '../../composables/useCityRow';
import { useCardCostGating, type GatingResult } from '../../composables/useCardCostGating';
import { useTurnActions } from '../../composables/useTurnActions';
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
 * Cost gating: villains in the city render disabled when
 * `economy.availableAttack < cell.card.fightCost` — the engine's projected
 * fight cost (WP-750 / D-24574), not the printed cost — per the WP-128
 * economy projection. A `Fight N` badge shows the projected cost whenever it
 * differs from the printed one.
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
      // why: WP-750 / D-24574 — gate on `fightCost`, which is resolveFightCost,
      // the same authority the fightVillain guard reads (captured Heroes, the
      // Dark-Portal space bonus, Killbot / Skrull overlays; Patrol / Guard are
      // unset per D-2504), never on the printed `display.cost`.
      const cost = useCardCostGating(props.economy).canFight(cell.card.fightCost);
      return cost;
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

    function onFight(cityIndex: number): void {
      props.submitMove('fightVillain', { cityIndex });
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
      return useCardCostGating(props.economy).canFightWithExcessiveViolence(cell.card.fightCost);
    }

    function onFightEV(cityIndex: number): void {
      // why: WP-738 / D-24561 — the client submits INTENT (useExcessiveViolence);
      // the engine decides the outcome — it overspends +1 attack and fires the
      // enrolled EV abilities, or silently fights normally if it cannot. Once-per-
      // turn is enforced engine-side: after the EV fight the availability field
      // goes absent and this affordance disappears on the next projection.
      props.submitMove('fightVillain', { cityIndex, useExcessiveViolence: true });
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
      onFight,
      showEvFight,
      onFightEV,
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
      >
        <template v-if="cell.kind === 'escaped'">
          <EscapedPile :pile="cell.entries" />
        </template>
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
              data-testid="play-city-fight-cost"
            >Fight {{ cell.card.fightCost }}</span>
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
</style>
