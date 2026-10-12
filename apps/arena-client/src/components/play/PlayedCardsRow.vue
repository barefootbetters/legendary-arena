<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { UICardDisplay, UIDisplayEntry } from '@legendary-arena/game-engine';
import { useTurnActions } from '../../composables/useTurnActions';
import CardTile from './CardTile.vue';

/**
 * Active player's played-cards zone — renders one tile per CardExtId in
 * `players[ownIndex].inPlayCards` under a visible "Played This Turn"
 * heading, so the mat shows where hand cards go after being played and
 * before `endTurn` sweeps them to the discard pile.
 *
 * Read-only: cards already in play cannot be un-played, so tiles are
 * non-interactive (no buttons, no move submission). The projection fields
 * (`inPlayCards` / `inPlayDisplay`, WP-128 / D-12803) are own-player-only;
 * opponents see the count via OpponentPanel instead.
 *
 * WP-803 / D-24692 — cards the viewer set aside Out of Time (Man / Woman Out
 * of Time) left play but return at the start of the viewer's next turn; they
 * render as a labelled "Out of Time" group inside the same well, before the
 * played cards. Render-only: the engine decides when a card goes and returns.
 *
 * Per the EC-132 §2 SFC authoring whitelist: tested composer, so it uses
 * `defineComponent({ setup() { return {...} } })` per P6-30 / P6-46 /
 * D-6512.
 */
export default defineComponent({
  name: 'PlayedCardsRow',
  components: { CardTile },
  props: {
    inPlayCards: {
      type: Array as PropType<readonly string[]>,
      required: true,
    },
    /**
     * Parallel display payload for `inPlayCards`; populated by WP-128's
     * `players[ownIndex].inPlayDisplay`. Length must match `inPlayCards`
     * exactly when present. Undefined when redacted (other audiences) —
     * but for the active-player surface the field is always present.
     */
    inPlayDisplay: {
      type: Array as PropType<readonly UICardDisplay[] | undefined>,
      required: false,
      default: undefined,
    },
    /**
     * The current turn stage and whether it is the viewer's turn — used ONLY to
     * enable/disable the empty in-play well's "play here" landing affordance
     * (WP-685 / D-24502 lock 5). Cards are never played from this zone; playing
     * happens in HandRow. Defaults keep the target enabled for existing callers.
     */
    currentStage: {
      type: String,
      required: false,
      default: 'main',
    },
    isViewerTurn: {
      type: Boolean,
      required: false,
      default: true,
    },
    /**
     * The viewer's cards set aside Out of Time (WP-803 / D-24692), from
     * `players[ownIndex].outOfTimeCards` (public; omitted by the engine when
     * empty). They are not counted in "Played This Turn — N".
     */
    outOfTimeCards: {
      type: Array as PropType<readonly UIDisplayEntry[]>,
      required: false,
      default: () => [],
    },
  },
  setup(props) {
    // why: WP-685 / D-24502 — the empty in-play well shows a dashed "play here"
    // landing target, disabled off-turn / off-main, mirroring HandRow's play
    // gate (useTurnActions.canPlayCard). This is display-only — no move is
    // submitted from this zone; the affordance signals where a played hand card
    // lands.
    function canLandPlay(): boolean {
      return useTurnActions(props.currentStage, props.isViewerTurn).canPlayCard().allowed;
    }

    function humanizeCardId(cardId: string): string {
      // why: produce a readable label from a CardExtId when the engine's
      // cardDisplayData lookup misses (returns the WP-111
      // UNKNOWN_DISPLAY_PLACEHOLDER with name '<unknown>'). Same gap and
      // same formatting-only fallback as HandRow — the engine-synthetic
      // starter cards land in this zone the moment they are played.
      return cardId.replace(/-/g, ' ');
    }

    function resolveDisplay(cardId: string, index: number): UICardDisplay {
      if (props.inPlayDisplay !== undefined && index < props.inPlayDisplay.length) {
        const entry = props.inPlayDisplay[index]!;
        if (entry.name !== '<unknown>') {
          return entry;
        }
      }
      return {
        extId: cardId,
        name: humanizeCardId(cardId),
        imageUrl: '',
        cost: null,
      };
    }

    function resolveOutOfTimeDisplay(entry: UIDisplayEntry): UICardDisplay {
      // why: same '<unknown>' fallback as resolveDisplay — the set-aside entry carries its
      // own display payload (UIDisplayEntry), so no parallel array is needed.
      if (entry.display.name !== '<unknown>') {
        return entry.display;
      }
      return {
        extId: entry.extId,
        name: humanizeCardId(entry.extId),
        imageUrl: '',
        cost: null,
      };
    }

    return { resolveDisplay, resolveOutOfTimeDisplay, canLandPlay };
  },
});
</script>

<template>
  <section
    class="played-row"
    data-testid="play-played-row"
    aria-label="Played this turn"
  >
    <header class="played-row__heading" data-testid="play-played-heading">
      Played This Turn — {{ inPlayCards.length }}
    </header>
    <!-- why: WP-685 / D-24502 lock 5 — the empty in-play well is a dashed "play
         here" landing target, disabled off-turn / off-main; it signals where a
         played hand card lands. No move is submitted from this zone. -->
    <div
      v-if="inPlayCards.length === 0 && outOfTimeCards.length === 0"
      class="played-row__target"
      data-testid="play-played-empty"
      :data-can-play="canLandPlay() ? 'true' : 'false'"
      :aria-disabled="canLandPlay() ? undefined : 'true'"
    >
      <span class="played-row__target-title">Play here</span>
      <span class="played-row__target-hint">{{ canLandPlay() ? 'tap a hand card' : 'not your main step' }}</span>
    </div>
    <ul v-else class="played-row__cards">
      <!-- why: WP-803 / D-24692 — the viewer's Out of Time cards sit in the SAME well,
           before the played cards (no new layout slot, so the cockpit does not grow). -->
      <li
        v-if="outOfTimeCards.length > 0"
        class="played-row__out-of-time"
        data-testid="play-out-of-time"
        aria-label="Out of Time"
      >
        <span class="played-row__out-of-time-heading">Out of Time — returns next turn</span>
        <ul class="played-row__out-of-time-cards">
          <li
            v-for="(entry, index) in outOfTimeCards"
            :key="`${entry.extId}-${index}`"
            class="played-row__card"
            data-testid="play-out-of-time-card"
            :data-card-id="entry.extId"
          >
            <CardTile
              :display="resolveOutOfTimeDisplay(entry)"
              size="sm"
              :show-label="true"
            />
          </li>
        </ul>
      </li>
      <li
        v-for="(cardId, index) in inPlayCards"
        :key="`${cardId}-${index}`"
        class="played-row__card"
        data-testid="play-played-card"
        :data-card-id="cardId"
      >
        <CardTile
          :display="resolveDisplay(cardId, index)"
          size="md"
          :show-label="true"
        />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.played-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.played-row__heading {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.85;
}

/* why: WP-685 / D-24502 — the in-play zone is a horizontally-scrolling WELL. The
   full inPlayCards array is bound (never sliced); a long turn's played cards
   scroll in-zone here rather than wrapping and crowding the City / HQ rows. */
.played-row__cards {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.5rem;
  list-style: none;
  padding: 0 0 0.25rem;
  margin: 0;
  overflow-x: auto;
}

.played-row__card {
  flex: 0 0 auto;
}

/* why: WP-803 / D-24692 — the Out of Time group: a small caption over smaller tiles,
   set off from the played cards by a dashed divider, inside the same scrolling well. */
.played-row__out-of-time {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding-right: 0.5rem;
  border-right: 2px dashed var(--color-foreground, #666);
}

.played-row__out-of-time-heading {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.85;
  white-space: nowrap;
}

.played-row__out-of-time-cards {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.35rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

/* why: WP-685 / D-24502 lock 5 — the empty-well landing target: a dashed frame
   that reads as "play a card here", dimmed when it is not the viewer's main step. */
.played-row__target {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  min-height: 4.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px dashed var(--color-foreground, #666);
  border-radius: 0.5rem;
  text-align: center;
}

.played-row__target[data-can-play='false'] {
  opacity: 0.5;
}

.played-row__target-title {
  font-weight: 700;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.played-row__target-hint {
  font-size: 0.72rem;
  opacity: 0.75;
}
</style>
