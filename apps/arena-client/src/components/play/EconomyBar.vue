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
    <!-- why: WP-790 / D-24652 — one chip per restricted ("usable only against …")
         grant with attack left: the Attack figure above excludes these amounts, so
         the chip says how much more attack exists and where it can be spent. The
         engine projects the label; this renders served data only. Active-player-only
         and omit-when-absent, so no chip renders without a restricted grant.
         The chips sit LAST, in their own full-width row under the Attack / Recruit /
         Pierce / Wounds line, and that row never widens the bar (see
         .economy-restricted-chips), so they wrap inside the cockpit column instead
         of squeezing Played This Turn / Your Hand. -->
    <div
      v-if="(economy.restrictedAttack ?? []).length > 0"
      class="economy-restricted-chips"
    >
      <span
        v-for="(grant, grantIndex) in economy.restrictedAttack"
        :key="grantIndex"
        class="economy-restricted-attack"
        data-testid="economy-restricted-attack"
      >+{{ grant.remaining }} only against: {{ grant.label }}</span>
    </div>
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

/* why: WP-790 — the chips get their own row (flex-basis 100%) whose intrinsic width
   is zero (width: 0) and whose laid-out width is the full bar (min-width: 100%). On
   desktop the cockpit's side column is an `auto` grid track sized to its widest
   content, and the main column (Played This Turn / Your Hand) takes what is left; a
   chip row that counted toward that width took up to ~400px from the hand. Now the
   column keeps its no-chip width and the chips wrap inside it. */
.economy-restricted-chips {
  flex: 1 0 100%;
  width: 0;
  min-width: 100%;
  /* why: pull the chip row up toward the Attack line (the bar's 1rem gap is sized
     for spacing items within a line, not between lines). */
  margin-top: -0.6rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.4rem;
  font-size: 0.85rem;
}

/* why: WP-790 — the restricted-attack chip uses the same bordered-pill shape as the
   convert cue (meaning in the text, not colour alone; no animation). */
.economy-restricted-attack {
  padding: 0.05rem 0.4rem;
  border: 1px dashed var(--color-foreground, #999);
  border-radius: 0.75rem;
}
</style>
