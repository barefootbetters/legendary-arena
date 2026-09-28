<script lang="ts">
import { defineComponent, computed } from 'vue';
import { storeToRefs } from 'pinia';
import type { HollowEffectRecord } from '@legendary-arena/game-engine';
import { useUiStateStore } from '../../stores/uiState';
import { groupHollowEffects } from './hollowEffects.group';
import type { HollowEffectGroup } from './hollowEffects.group';

/**
 * Compact, unobtrusive debug panel listing the hollow effects observed in the
 * current match. A *hollow* effect is a declared card ability whose executable
 * handler was absent or unreachable at runtime (WP-257 detector); this panel is
 * the first of three reporting consumers (the Download-diagnostics export and the
 * future `/coverage` overlay are the other two).
 *
 * It reads the engine projection `useUiStateStore().snapshot?.hollowEffects`
 * (surfaced from the runtime G.diagnostics channel by WP-258) and renders one
 * row per (card, mechanic, timing, reason) — card name, cardType, mechanic,
 * timing, reason, count, and the turns it fired on (D-24626). It is purely
 * presentational: it never interprets game state, never imports the engine
 * runtime, and only consumes the read-only UIState projection.
 *
 * // why: renders ONLY when ≥1 record is present (`v-if`). An absent or empty
 * `hollowEffects` is the no-hollow-effects case and must produce no DOM at all
 * (EC-289) — the panel should be invisible during a clean match and appear only
 * when there is something to flag.
 *
 * Per the `@legendary-arena/vue-sfc-loader` separate-compile pipeline (D-6512),
 * this SFC uses `defineComponent({ setup() { return {...} } })` so the
 * `setup()` bindings reach the template's `_ctx` (the ArenaHud store-read
 * precedent). Placement idiom mirrors the `DiagnosticExportButton.vue` sibling
 * (a fixed-position, high-z-index, unobtrusive play-surface overlay).
 *
 * @see WP-258 §Scope (In) B; EC-289 §Locked Values
 * @see DESIGN-HOLLOW-EFFECT-DETECTION.md §6
 */
export default defineComponent({
  name: 'HollowEffectsPanel',
  setup() {
    const store = useUiStateStore();
    const { snapshot } = storeToRefs(store);

    // why: derive the record list once. `snapshot?.hollowEffects` is the
    // optional engine projection — `[]` when absent so the template's
    // `v-if="hollowEffects.length > 0"` cleanly resolves the no-render case.
    const hollowEffects = computed<HollowEffectRecord[]>(
      () => snapshot.value?.hollowEffects ?? [],
    );

    // why: D-24626 — one row per distinct gap, not per play. The raw records stay
    // untouched in the snapshot, so the Download-diagnostics export is unchanged.
    const hollowEffectGroups = computed<HollowEffectGroup[]>(
      () => groupHollowEffects(hollowEffects.value),
    );

    /**
     * Formats a group's turn list for the Turns column.
     *
     * @param turns - The group's distinct turns, ascending.
     * @returns The turns joined with commas.
     */
    function formatTurns(turns: number[]): string {
      return turns.join(', ');
    }

    return { hollowEffects, hollowEffectGroups, formatTurns };
  },
});
</script>

<template>
  <section
    v-if="hollowEffects.length > 0"
    class="hollow-effects-panel"
    data-testid="hollow-effects-panel"
    aria-label="Hollow effects observed this match"
  >
    <h2 class="hollow-effects-title">
      Hollow effects
      <span class="hollow-effects-summary" data-testid="hollow-effects-summary">
        {{ hollowEffects.length }} across {{ hollowEffectGroups.length }}
        {{ hollowEffectGroups.length === 1 ? 'ability' : 'abilities' }}
      </span>
    </h2>
    <table class="hollow-effects-table">
      <thead>
        <tr>
          <th scope="col">Card</th>
          <th scope="col">Type</th>
          <th scope="col">Mechanic</th>
          <th scope="col">Timing</th>
          <th scope="col">Reason</th>
          <th scope="col">Count</th>
          <th scope="col">Turns</th>
        </tr>
      </thead>
      <tbody>
        <!--
          // why: groups are built in first-seen order from an append-only channel,
          // so a group's index is stable for the life of a single UIState. A new
          // snapshot tears the list down and rebuilds it.
        -->
        <tr
          v-for="(group, index) in hollowEffectGroups"
          :key="index"
          :data-index="index"
          :title="group.cardKey"
          data-testid="hollow-effects-row"
        >
          <td data-testid="hollow-effects-cardName">{{ group.cardName }}</td>
          <td data-testid="hollow-effects-cardType">{{ group.cardType }}</td>
          <td data-testid="hollow-effects-mechanic">{{ group.mechanic }}</td>
          <td data-testid="hollow-effects-timing">{{ group.timing }}</td>
          <td data-testid="hollow-effects-reason">{{ group.reason }}</td>
          <td data-testid="hollow-effects-count">×{{ group.count }}</td>
          <td data-testid="hollow-effects-turn" class="hollow-effects-turns">{{ formatTurns(group.turns) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.hollow-effects-panel {
  position: fixed;
  bottom: 8px;
  right: 8px;
  /* why: wide enough for the grouped columns plus the vertical scrollbar, but never
     wider than the viewport, so the fixed panel cannot spill off a phone screen. */
  max-width: min(42rem, calc(100vw - 16px));
  max-height: 14rem;
  overflow-y: auto;
  padding: 6px 10px;
  font-size: 12px;
  font-family: monospace;
  color: #f1f5f9;
  background: #3b1d2b;
  border: 1px solid #b45369;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  /* why: a high z-index keeps the panel reachable above any game overlay —
     the hollow effect it reports may itself be tied to a stuck overlay. */
  z-index: 9998;
}

.hollow-effects-title {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 700;
}

.hollow-effects-summary {
  margin-left: 6px;
  font-weight: 400;
  opacity: 0.75;
}

.hollow-effects-table {
  border-collapse: collapse;
  width: 100%;
  font-variant-numeric: tabular-nums;
}

.hollow-effects-table th,
.hollow-effects-table td {
  padding: 1px 6px 1px 0;
  text-align: left;
  white-space: nowrap;
}

/* why: a hollow card played every turn has a long turn list; wrap it instead of
   widening the panel past the play surface. */
.hollow-effects-table td.hollow-effects-turns {
  white-space: normal;
  min-width: 6rem;
}

.hollow-effects-table th {
  border-bottom: 1px solid #b45369;
}
</style>
