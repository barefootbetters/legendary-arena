<script lang="ts">
import { computed, defineComponent, ref } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';

import { useOperatorBoard, buildOperatorFileName } from '../../composables/useOperatorBoard';
import type { OperatorBotDecisionWire } from '../../lib/api/operatorMatchApi';
import { useUiStateStore } from '../../stores/uiState';
import { downloadTextFile } from '../../lib/downloadTextFile';

/** One effect trace from the unfiltered board UIState. */
type EffectTraceEntry = NonNullable<UIState['effectTraces']>[number];

/** How many of the most recent effect traces the panel lists. */
const RECENT_EFFECT_TRACE_COUNT = 10;

/**
 * Operator board panel (WP-804 / EC-841 / D-24689 §5–§6).
 *
 * The reveal-all read of an operator match for an admin: every seat's zones,
 * the decks top-first, the piles and supplies, the engine counters, the last
 * effect traces and the bot's decisions, refreshed from the admin board route
 * while the panel is open, plus two JSON downloads.
 *
 * It renders the server projection only — it runs no rule and edits no state —
 * and labels cards by NAME (`operatorView.cardDisplay`, raw id as fallback),
 * never card text, so no marker syntax can reach the screen.
 *
 * Loaded only through `defineAsyncComponent` in `PlayViewport.vue`, so normal
 * play never downloads it. Uses `defineComponent({ setup })` per D-6512.
 */
export default defineComponent({
  name: 'OperatorBoardPanel',
  props: {
    matchId: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const isExpanded = ref(true);
    const { board, errorMessage, refreshNow } = useOperatorBoard(props.matchId, isExpanded);
    const uiStateStore = useUiStateStore();

    const operatorView = computed(() => board.value?.operatorView ?? null);

    /**
     * The display name of a card, or its raw id when the view has no entry.
     *
     * @param cardId The card's ext id.
     * @returns The card name or the raw id.
     */
    function cardLabel(cardId: string): string {
      return operatorView.value?.cardDisplay[cardId]?.name ?? cardId;
    }

    /**
     * A zone as its card count followed by its card names, in stored order.
     *
     * @param cardIds The zone's card ids (index 0 is the top).
     * @returns `"(N) name, name, …"`, or `"(0) —"` when empty.
     */
    function formatZone(cardIds: readonly string[]): string {
      if (cardIds.length === 0) {
        return '(0) —';
      }
      const names: string[] = [];
      for (const cardId of cardIds) {
        names.push(cardLabel(cardId));
      }
      return `(${cardIds.length}) ${names.join(', ')}`;
    }

    const counterEntries = computed<[string, number][]>(() =>
      Object.entries(operatorView.value?.counters ?? {}),
    );

    // why: read from the server's unfiltered board UIState, never from
    // useUiStateStore — the player's own snapshot is audience-filtered.
    const recentEffectTraces = computed<EffectTraceEntry[]>(() => {
      const traces = board.value?.operatorView.board.effectTraces ?? [];
      return traces.slice(-RECENT_EFFECT_TRACE_COUNT);
    });

    // why: decisions are shown as-is, newest first. The server records the
    // display turn (D-24697), so "Turn N" matches the game log's prefix with no
    // client-side adjustment.
    const decisionsNewestFirst = computed<OperatorBotDecisionWire[]>(() =>
      [...(board.value?.botDecisions ?? [])].reverse(),
    );

    /** Collapse or expand the panel; collapsing stops the board poll. */
    function toggleExpanded(): void {
      isExpanded.value = !isExpanded.value;
    }

    /** Download the current board and bot decisions as a JSON snapshot. */
    function downloadSnapshot(): void {
      const current = board.value;
      if (current === null) {
        return;
      }
      const capturedAtMs = Date.now();
      const body = {
        matchId: props.matchId,
        capturedAtMs,
        operatorView: current.operatorView,
        botDecisions: current.botDecisions,
      };
      const fileName = buildOperatorFileName('operator', props.matchId, capturedAtMs);
      downloadTextFile(fileName, JSON.stringify(body, null, 2), 'application/json');
    }

    /** Download the play surface's current UIState in the fixture shape. */
    function downloadFixture(): void {
      const capturedAtMs = Date.now();
      const fileName = buildOperatorFileName('fixture', props.matchId, capturedAtMs);
      downloadTextFile(fileName, JSON.stringify(uiStateStore.snapshot, null, 2), 'application/json');
    }

    return {
      isExpanded,
      board,
      operatorView,
      errorMessage,
      refreshNow,
      cardLabel,
      formatZone,
      counterEntries,
      recentEffectTraces,
      decisionsNewestFirst,
      toggleExpanded,
      downloadSnapshot,
      downloadFixture,
    };
  },
});
</script>

<template>
  <section
    class="operator-board-panel"
    data-testid="operator-board-panel"
    aria-label="Operator board"
  >
    <header class="operator-board-header">
      <button
        type="button"
        class="operator-board-toggle"
        data-testid="operator-board-toggle"
        :aria-expanded="isExpanded ? 'true' : 'false'"
        @click="toggleExpanded"
      >
        Operator board
      </button>
      <template v-if="isExpanded">
        <button type="button" data-testid="operator-board-refresh" @click="refreshNow">Refresh</button>
        <button
          type="button"
          data-testid="operator-download-snapshot"
          :disabled="board === null"
          @click="downloadSnapshot"
        >
          Download operator snapshot
        </button>
        <button type="button" data-testid="operator-download-fixture" @click="downloadFixture">
          Download as fixture
        </button>
      </template>
    </header>

    <div v-if="isExpanded" class="operator-board-body">
      <p v-if="errorMessage !== null" class="operator-board-error" data-testid="operator-board-error">
        {{ errorMessage }}
      </p>
      <p v-if="operatorView === null" class="operator-board-muted">Loading the board…</p>
      <template v-else>
        <section data-testid="operator-seats" class="operator-board-section">
          <h3>Seats</h3>
          <div v-for="seat in operatorView.seats" :key="seat.playerId" class="operator-seat">
            <h4>Seat {{ seat.playerId }}</h4>
            <dl>
              <dt>Hand</dt><dd>{{ formatZone(seat.hand) }}</dd>
              <dt>Deck (top first)</dt><dd>{{ formatZone(seat.deckTopFirst) }}</dd>
              <dt>Discard</dt><dd>{{ formatZone(seat.discard) }}</dd>
              <dt>In play</dt><dd>{{ formatZone(seat.inPlay) }}</dd>
              <dt>Victory</dt><dd>{{ formatZone(seat.victory) }}</dd>
              <dt>Wounds</dt>
              <dd>
                deck {{ seat.woundsByZone.deck }} · hand {{ seat.woundsByZone.hand }} ·
                discard {{ seat.woundsByZone.discard }} · in play {{ seat.woundsByZone.inPlay }} ·
                victory {{ seat.woundsByZone.victory }}
              </dd>
            </dl>
          </div>
        </section>

        <section data-testid="operator-decks" class="operator-board-section">
          <h3>Decks (top first)</h3>
          <dl>
            <dt>Villain deck</dt><dd>{{ formatZone(operatorView.villainDeckTopFirst) }}</dd>
            <dt>Hero deck</dt><dd>{{ formatZone(operatorView.heroDeckTopFirst) }}</dd>
            <dt>Mastermind tactics</dt><dd>{{ formatZone(operatorView.mastermindTacticsTopFirst) }}</dd>
          </dl>
        </section>

        <section data-testid="operator-piles" class="operator-board-section">
          <h3>Piles</h3>
          <dl>
            <dt>Supplies</dt>
            <dd>
              wounds {{ operatorView.supplyCounts.wounds }} · bystanders {{ operatorView.supplyCounts.bystanders }} ·
              officers {{ operatorView.supplyCounts.officers }} · sidekicks {{ operatorView.supplyCounts.sidekicks }}
            </dd>
            <dt>KO</dt><dd>{{ formatZone(operatorView.koPile) }}</dd>
            <dt>Escaped</dt><dd>{{ formatZone(operatorView.escapedPile) }}</dd>
          </dl>
        </section>

        <section data-testid="operator-engine" class="operator-board-section">
          <h3>Engine</h3>
          <p>Stage: {{ operatorView.currentStage }}</p>
          <ul class="operator-board-list">
            <li v-for="[counterName, counterValue] in counterEntries" :key="counterName">
              {{ counterName }}: {{ counterValue }}
            </li>
          </ul>
          <h4>Recent effect traces</h4>
          <ol class="operator-board-list">
            <li v-for="(trace, index) in recentEffectTraces" :key="index">
              {{ cardLabel(trace.cardId) }} — {{ trace.status }}
            </li>
          </ol>
        </section>

        <section data-testid="operator-bot-decisions" class="operator-board-section">
          <h3>Bot decisions (newest first)</h3>
          <p v-if="decisionsNewestFirst.length === 0" class="operator-board-muted">No bot decisions recorded.</p>
          <ol class="operator-board-list">
            <li v-for="(decision, index) in decisionsNewestFirst" :key="index" class="operator-decision">
              <span class="operator-decision-turn">Turn {{ decision.turn }}</span>
              · seat {{ decision.seat }} · {{ decision.isForced ? 'forced' : 'policy' }} ·
              {{ decision.move.name }} · {{ decision.legalMoveCount }} legal
              <ul class="operator-board-list">
                <li v-for="(line, lineIndex) in decision.decisionLog" :key="lineIndex">{{ line }}</li>
              </ul>
            </li>
          </ol>
        </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
.operator-board-panel {
  position: fixed;
  top: 4.5rem;
  right: 8px;
  width: min(28rem, calc(100vw - 16px));
  max-height: calc(100vh - 9rem);
  overflow-y: auto;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--la-color-text-primary);
  background: var(--la-color-surface);
  border: 1px solid var(--la-color-border-strong);
  border-radius: 6px;
  /* why: above the board and the playmat overlays, just under the hollow-effects
     panel (9998) and the diagnostics dock (9999). */
  z-index: 9997;
}

.operator-board-header {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.operator-board-header button {
  font-size: 12px;
  color: var(--la-color-text-primary);
  background: var(--la-color-bg-secondary);
  border: 1px solid var(--la-color-border-subtle);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
}

.operator-board-header .operator-board-toggle {
  font-weight: 700;
  color: var(--la-color-gold);
}

.operator-board-section {
  margin-top: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--la-color-border-subtle);
}

.operator-board-section h3,
.operator-board-section h4 {
  margin: 2px 0;
  font-size: 12px;
  color: var(--la-color-gold);
}

.operator-board-section dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 8px;
  margin: 0;
}

.operator-board-section dt {
  color: var(--la-color-text-secondary);
}

.operator-board-section dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.operator-board-list {
  margin: 2px 0;
  padding-left: 1.2rem;
}

.operator-board-muted {
  color: var(--la-color-text-muted);
}

.operator-board-error {
  color: var(--la-color-error);
}

.operator-decision-turn {
  font-weight: 700;
}
</style>
