<script lang="ts">
import { defineComponent, computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { createSpeculativePrng } from '@legendary-arena/preplan';
import type { UIDeckCardStat } from '@legendary-arena/game-engine';
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
import {
  projectNextHand,
  seedFromPool,
  type HandProjection,
} from './handProjection';

/**
 * Collapsible play-surface panel — Phase-1 MVP of the Deck Probability Panel
 * (the plain card counter). It reads the WP-606 / D-24417 UIState projection and
 * shows, for the viewing player:
 *
 * - the VILLAIN deck's remaining make-up (public `decks.villainDeckComposition`),
 *   categorized by ext_id prefix into an "upcoming risk" breakdown with each
 *   type's next-draw odds; and
 * - the viewer's OWN draw-pool count + a best-effort by-name tally (owner-only
 *   `deckComposition`); and
 * - (WP-609 / D-24420) a "Next hand" projection — the expected recruit/attack of
 *   the next hand (exact two-stage mean) plus a p10/p90 range (a Monte Carlo
 *   seeded STABLY from the pool so it does not jitter), from the owner-only
 *   `deckCardStats` (WP-608) over `deckComposition` + `discardCards`.
 *
 * It is CLIENT-SIDE ADVISORY and purely presentational: engine TYPES only (no
 * runtime import), no `ctx.random`, no game-state write. All math lives in the
 * pure `deckProbability.ts`. Mounted once at the shared viewport root
 * (`HollowEffectsPanel` fixed-overlay idiom); self-hides when its data is absent.
 * `defineComponent({ setup })` per the vue-sfc-loader separate-compile pipeline
 * (D-6512).
 *
 * @see WP-607 / EC-642 (Phase-1); WP-609 / EC-644 (Next hand); D-24418; D-24420;
 * wiki/deck-probability-panel.md
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

    // why: the viewer's discard pile (owner-only, WP-243) + the owner-only
    // per-card recruit/attack/cost map (WP-608). Both are needed for the next-hand
    // projection; either being absent (a pre-populate frame, or a spectator) drops
    // the projection to null so the section self-hides.
    const ownDiscard = computed<string[] | undefined>(
      () => viewer.value?.discardCards,
    );

    const deckCardStats = computed<Record<string, UIDeckCardStat> | undefined>(
      () => viewer.value?.deckCardStats,
    );

    // why: the next hand's expected recruit/attack (exact two-stage mean) + a
    // p10/p90 range. The range's Monte Carlo is seeded from a STABLE function of
    // the current pool (seedFromPool) so it does not jitter between recomputes of
    // the same state, yet moves as the pool changes each draw. Null (→ self-hide)
    // whenever the owner-only stats are absent or the whole draw pool is empty.
    const handProjection = computed<HandProjection | null>(() => {
      const deck = ownDeckComposition.value;
      const discard = ownDiscard.value;
      const stats = deckCardStats.value;
      if (stats === undefined || deck === undefined) {
        return null;
      }
      const discardPile = discard ?? [];
      if (deck.length === 0 && discardPile.length === 0) {
        return null;
      }
      const rng = createSpeculativePrng(seedFromPool(deck, discardPile));
      return projectNextHand({ deck, discard: discardPile, stats }, rng);
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

    /**
     * Formats an expected (fractional) stat value to one decimal place for the
     * projection rows — e.g. an expected 5.33 recruit renders as "5.3".
     */
    function formatExpected(value: number): string {
      return value.toFixed(1);
    }

    return {
      isExpanded,
      hasData,
      villainRows,
      villainSummary,
      ownDeckTotal,
      ownDeckTally,
      handProjection,
      formatPercent,
      formatExpected,
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

      <div
        v-if="handProjection !== null"
        class="deck-probability-section"
        data-testid="hand-projection-section"
      >
        <h3 class="deck-probability-heading">Next hand</h3>
        <table class="deck-probability-table">
          <tbody>
            <tr data-testid="hand-projection-recruit">
              <td class="deck-probability-label">Recruit</td>
              <td
                class="deck-probability-count"
                data-testid="hand-projection-recruit-ev"
              >
                ~{{ formatExpected(handProjection.expectedRecruit) }}
              </td>
              <td
                class="deck-probability-odds"
                data-testid="hand-projection-recruit-range"
              >
                {{ handProjection.recruitRange.low }}–{{ handProjection.recruitRange.high }}
              </td>
            </tr>
            <tr data-testid="hand-projection-attack">
              <td class="deck-probability-label">Attack</td>
              <td
                class="deck-probability-count"
                data-testid="hand-projection-attack-ev"
              >
                ~{{ formatExpected(handProjection.expectedAttack) }}
              </td>
              <td
                class="deck-probability-odds"
                data-testid="hand-projection-attack-range"
              >
                {{ handProjection.attackRange.low }}–{{ handProjection.attackRange.high }}
              </td>
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
  /* why: WP-610 — the bottom-left corner already stacks two fixed utility
     overlays: DiagnosticExportButton (bottom: 8px) and ViewLoadoutButton
     (bottom: 40px), both z-index 9999. WP-607 pinned this panel to bottom: 8px
     too — the SAME slot as the diagnostics button but a lower z-index — so the
     collapsed toggle rendered hidden behind it. Continue the buttons' 32px
     stride into the next free slot (8 → 40 → 72) so the toggle clears both and
     the panel expands upward into open space. */
  bottom: 72px;
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
