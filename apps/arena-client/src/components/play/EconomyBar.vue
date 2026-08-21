<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { UITurnEconomyState } from '@legendary-arena/game-engine';

/**
 * Economy bar — renders `economy.{attack, recruit, availableAttack,
 * availableRecruit, piercing, woundsDrawn}`.
 *
 * SAFE-SKIP-WP128: `economy.piercing` and `economy.woundsDrawn` ship as
 * constant `0` per WP-128 / D-12806 until future engine WPs add
 * `G.turnEconomy.piercing` (and the move logic that increments it) and
 * `G.turnEconomy.woundsDrawn` (and the wound-draw tracking it requires).
 * This bar renders the zero-state until those WPs land — no behavioral
 * change is required when they do, only fixture/test updates.
 *
 * Per the EC-132 §2 SFC authoring whitelist: this is a tested non-leaf
 * composer, so it MUST use `defineComponent({ setup() { return {...} } })`
 * per P6-30 / P6-46 / D-6512.
 *
 * @see WP-129 §Acceptance Criteria — Economy bar
 * @see DESIGN-BOARD-LAYOUT.md §3.1 ECONOMY row
 */
export default defineComponent({
  name: 'EconomyBar',
  props: {
    economy: {
      type: Object as PropType<UITurnEconomyState>,
      required: true,
    },
  },
  setup() {
    return {};
  },
});
</script>

<template>
  <section
    class="economy-bar"
    data-testid="play-economy-bar"
    aria-label="Economy"
  >
    <span data-testid="play-economy-attack">
      Attack: {{ economy.availableAttack }}/{{ economy.attack }}
    </span>
    <!-- why: WP-581 / D-24390 — cue that God of Thunder's recruit-as-attack
         conversion is active this turn, so the Attack figure (which already
         folds in convertible recruit, WP-580) is explained. Accessible: the
         meaning is in the TEXT + glyph (not colour alone), it carries an
         explicit accessible name, and it has no animation (reduced-motion safe).
         Rendered only when the active-player-only flag is present. -->
    <span
      v-if="economy.recruitSpendableAsAttack"
      class="economy-convert-cue"
      data-testid="play-economy-recruit-as-attack-cue"
      role="note"
      aria-label="Recruit can be spent as Attack this turn"
    >
      ⚡ Recruit → Attack this turn
    </span>
    <span data-testid="play-economy-recruit">
      Recruit: {{ economy.availableRecruit }}/{{ economy.recruit }}
    </span>
    <span data-testid="play-economy-piercing">
      Pierce: {{ economy.piercing }}
    </span>
    <span data-testid="play-economy-wounds-drawn">
      Wounds drawn: {{ economy.woundsDrawn }}
    </span>
  </section>
</template>

<style scoped>
.economy-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  font-variant-numeric: tabular-nums;
  border: 1px solid var(--color-foreground, #999);
}

/* why: WP-581 — a subtle badge, distinguished by a border + weight (not colour
   alone), and deliberately without any animation (reduced-motion safe). */
.economy-convert-cue {
  font-weight: 600;
  padding: 0.05rem 0.4rem;
  border: 1px solid var(--color-foreground, #999);
  border-radius: 0.75rem;
}
</style>
