<script lang="ts">
import { defineComponent, computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useUiStateStore } from '../../stores/uiState';
import {
  summarizeVillainDeck,
  nextDrawOdds,
  harvestCardNames,
  tallyOwnDeck,
  VILLAIN_DECK_TYPE_ORDER,
  VILLAIN_DECK_TYPE_LABELS,
  type OwnDeckTallyEntry,
} from './deckProbability';

/**
 * Collapsible play-surface panel — Phase-1 MVP of the Deck Probability Panel
 * (the plain card counter). It reads the WP-606 / D-24417 UIState projection and
 * shows, for the viewing player:
 *
 * - the VILLAIN deck's remaining make-up (public `decks.villainDeckComposition`),
 *   categorized by ext_id prefix into an "upcoming risk" breakdown with each
 *   type's next-draw odds; and
 * - the viewer's OWN draw-pool count + a best-effort by-name tally (owner-only
 *   `deckComposition`).
 *
 * It is CLIENT-SIDE ADVISORY and purely presentational: engine TYPES only (no
 * runtime import), no `ctx.random`, no game-state write. All math lives in the
 * pure `deckProbability.ts`. Mounted once at the shared viewport root
 * (`HollowEffectsPanel` fixed-overlay idiom); self-hides when its data is absent.
 * `defineComponent({ setup })` per the vue-sfc-loader separate-compile pipeline
 * (D-6512).
 *
 * @see WP-607 / EC-642; D-24418; wiki/deck-probability-panel.md
 */
interface VillainRow {
  type: string;
  label: string;
  count: number;
  odds: number;
}

export default defineComponent({
  name: 'DeckProbabilityPanel',
  setup() {
    const store = useUiStateStore();
    const { snapshot } = storeToRefs(store);
    const isExpanded = ref(false);

    // why: public villain-deck composition (WP-606). `undefined` when absent
    // (e.g. a pre-populate frame) → the panel's own-deck-only or no-data path.
    const villainComposition = computed<string[] | undefined>(
      () => snapshot.value?.decks.villainDeckComposition,
    );

    const villainSummary = computed(() =>
      villainComposition.value === undefined
        ? null
        : summarizeVillainDeck(villainComposition.value),
    );

    // why: the viewing player is the one whose private fields survived the
    // audience filter — `handCards !== undefined` is the redaction marker, and
    // `deckComposition` is redacted in lockstep with it (WP-606).
    const viewer = computed(
      () => snapshot.value?.players.find((player) => player.handCards !== undefined) ?? null,
    );

    const ownDeckComposition = computed<string[] | undefined>(
      () => viewer.value?.deckComposition,
    );

    const ownDeckTotal = computed(() => ownDeckComposition.value?.length ?? 0);

    const ownDeckTally = computed<OwnDeckTallyEntry[]>(() => {
      if (viewer.value === null || ownDeckComposition.value === undefined) {
        return [];
      }
      return tallyOwnDeck(ownDeckComposition.value, harvestCardNames(viewer.value));
    });

    const villainRows = computed<VillainRow[]>(() => {
      const summary = villainSummary.value;
      if (summary === null) {
        return [];
      }
      const rows: VillainRow[] = [];
      for (const type of VILLAIN_DECK_TYPE_ORDER) {
        const count = summary.counts[type];
        if (count > 0) {
          rows.push({
            type,
            label: VILLAIN_DECK_TYPE_LABELS[type],
            count,
            odds: nextDrawOdds(count, summary.total),
          });
        }
      }
      return rows;
    });

    // why: render nothing at all when neither field is present — the panel is a
    // read-only aid, so it must add no DOM when there is nothing to show.
    const hasData = computed(
      () => villainSummary.value !== null || ownDeckComposition.value !== undefined,
    );

    /**
     * Formats a 0..1 probability as a whole-percent string for the row labels.
     */
    function formatPercent(odds: number): string {
      return `${Math.round(odds * 100)}%`;
    }

    return {
      isExpanded,
      hasData,
      villainRows,
      villainSummary,
      ownDeckTotal,
      ownDeckTally,
      formatPercent,
    };
  },
});
</script>

<template>
  <section
    v-if="hasData"
    class="deck-probability-panel"
    data-testid="deck-probability-panel"
    aria-label="Deck probability"
  >
    <button
      type="button"
      class="deck-probability-toggle"
      data-testid="deck-probability-toggle"
      :aria-expanded="isExpanded"
      @click="isExpanded = !isExpanded"
    >
      Deck odds {{ isExpanded ? '▾' : '▸' }}
    </button>

    <div v-if="isExpanded" class="deck-probability-body">
      <div v-if="villainSummary !== null" class="deck-probability-section">
        <h3 class="deck-probability-heading">
          Villain deck — {{ villainSummary.total }} left
        </h3>
        <table class="deck-probability-table">
          <tbody>
            <tr
              v-for="row in villainRows"
              :key="row.type"
              :data-type="row.type"
              data-testid="villain-row"
            >
              <td class="deck-probability-label" data-testid="villain-row-label">
                {{ row.label }}
              </td>
              <td class="deck-probability-count" data-testid="villain-row-count">
                {{ row.count }}
              </td>
              <td class="deck-probability-odds" data-testid="villain-row-odds">
                {{ formatPercent(row.odds) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="ownDeckTotal > 0" class="deck-probability-section">
        <h3 class="deck-probability-heading">
          Your draw pool —
          <span data-testid="own-deck-total">{{ ownDeckTotal }}</span> cards
        </h3>
        <table class="deck-probability-table">
          <tbody>
            <tr
              v-for="entry in ownDeckTally"
              :key="entry.name"
              data-testid="own-deck-row"
            >
              <td class="deck-probability-label">{{ entry.name }}</td>
              <td class="deck-probability-count">{{ entry.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.deck-probability-panel {
  position: fixed;
  bottom: 8px;
  left: 8px;
  max-width: 20rem;
  max-height: 18rem;
  overflow-y: auto;
  font-size: 12px;
  font-family: monospace;
  color: #e2e8f0;
  /* why: a high z-index keeps the advisory panel reachable above the play
     surface without colliding with the bottom-right HollowEffectsPanel. */
  z-index: 9997;
}

.deck-probability-toggle {
  padding: 4px 10px;
  font: inherit;
  color: #e2e8f0;
  background: #1e293b;
  border: 1px solid #475569;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.deck-probability-body {
  margin-top: 4px;
  padding: 6px 10px;
  background: #1e293b;
  border: 1px solid #475569;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.deck-probability-section + .deck-probability-section {
  margin-top: 8px;
}

.deck-probability-heading {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 700;
}

.deck-probability-table {
  border-collapse: collapse;
  width: 100%;
  font-variant-numeric: tabular-nums;
}

.deck-probability-table td {
  padding: 1px 6px 1px 0;
  white-space: nowrap;
}

.deck-probability-count,
.deck-probability-odds {
  text-align: right;
}
</style>
