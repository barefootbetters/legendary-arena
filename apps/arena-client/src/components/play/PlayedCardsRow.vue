<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { UICardDisplay, UIDisplayEntry } from '@legendary-arena/game-engine';
import { useTurnActions } from '../../composables/useTurnActions';
import type { SubmitMove } from './uiMoveName.types';
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
 * WP-858 / D-24794 — the Ritual Artifacts the viewer controls (kept in front of
 * them at end of turn, rules v23 p.17) render as a labelled "Artifacts" group
 * after the played cards. A Use button appears on any played or controlled card
 * the engine lists in `economy.ritualArtifactOptions`; it dispatches
 * `useRitualArtifact`, and the engine re-validates.
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
    /**
     * The viewer's controlled Ritual Artifacts (WP-858 / D-24794), from
     * `players[ownIndex].controlledArtifacts` (public; omitted by the engine when
     * empty). They are not counted in "Played This Turn — N".
     */
    controlledArtifacts: {
      type: Array as PropType<readonly UIDisplayEntry[]>,
      required: false,
      default: () => [],
    },
    /**
     * The card ids the viewer may use as a Ritual right now, from
     * `economy.ritualArtifactOptions` (active player only; the engine's single
     * legality predicate). Each listed played or controlled card gets a Use button.
     */
    ritualCardIds: {
      type: Array as PropType<readonly string[]>,
      required: false,
      default: () => [],
    },
    /**
     * Whether the viewer may attempt a Heist right now, from `economy.heistAvailable`
     * (WP-865 / D-24808; active player only, the engine's single legality predicate).
     */
    heistAvailable: {
      type: Boolean,
      required: false,
      default: false,
    },
    /**
     * The viewer's current Heist Count, from `economy.heistCount`, shown on the
     * Attempt Heist button. Present only with `heistAvailable`.
     */
    heistCount: {
      type: Number as PropType<number | undefined>,
      required: false,
      default: undefined,
    },
    /**
     * Move submitter for the Use and Attempt Heist buttons. Optional: without it no
     * button renders (the row stays read-only, as before WP-858).
     */
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: false,
      default: undefined,
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

    function isUsableRitual(cardId: string): boolean {
      // why: WP-858 / D-24794 — the engine's ritualArtifactOptions is the only legality source;
      // the client never re-derives a Ritual condition, it only shows Use for listed cards.
      return props.submitMove !== undefined && props.ritualCardIds.includes(cardId);
    }

    function onUseRitual(cardId: string): void {
      if (props.submitMove === undefined) {
        return;
      }
      props.submitMove('useRitualArtifact', { cardId });
    }

    function canAttemptHeist(): boolean {
      // why: WP-865 / D-24808 — the engine's heistAvailable is the only legality source; the
      // client never re-derives the Heist Count or the readied crew.
      return props.submitMove !== undefined && props.heistAvailable;
    }

    function onAttemptHeist(): void {
      if (props.submitMove === undefined) {
        return;
      }
      props.submitMove('attemptHeist', {});
    }

    return {
      resolveDisplay,
      resolveOutOfTimeDisplay,
      canLandPlay,
      isUsableRitual,
      onUseRitual,
      canAttemptHeist,
      onAttemptHeist,
    };
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
      <!-- why: WP-865 / D-24808 — the once-per-turn Heist attempt sits in the played-cards
           heading (the readied Heist cards are in this row), so no new layout slot is added. -->
      <button
        v-if="canAttemptHeist()"
        type="button"
        class="played-row__heist"
        data-testid="attempt-heist"
        @click="onAttemptHeist()"
      >
        Attempt Heist (Heist Count {{ heistCount ?? 0 }})
      </button>
    </header>
    <!-- why: WP-685 / D-24502 lock 5 — the empty in-play well is a dashed "play
         here" landing target, disabled off-turn / off-main; it signals where a
         played hand card lands. No move is submitted from this zone. -->
    <div
      v-if="inPlayCards.length === 0 && outOfTimeCards.length === 0 && controlledArtifacts.length === 0"
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
        <button
          v-if="isUsableRitual(cardId)"
          type="button"
          class="played-row__use"
          data-testid="use-ritual-artifact"
          :data-card-id="cardId"
          :aria-label="`Use ${resolveDisplay(cardId, index).name}'s Ritual`"
          @click="onUseRitual(cardId)"
        >
          Use
        </button>
      </li>
      <!-- why: WP-858 / D-24794 — the viewer's controlled Ritual Artifacts sit in the SAME
           well, after the played cards (no new layout slot), as the Out of Time group does. -->
      <li
        v-if="controlledArtifacts.length > 0"
        class="played-row__artifacts"
        data-testid="play-controlled-artifacts"
        aria-label="Artifacts you control"
      >
        <span class="played-row__artifacts-heading">Artifacts — {{ controlledArtifacts.length }}</span>
        <ul class="played-row__artifacts-cards">
          <li
            v-for="(entry, index) in controlledArtifacts"
            :key="`${entry.extId}-${index}`"
            class="played-row__card"
            data-testid="play-controlled-artifact"
            :data-card-id="entry.extId"
          >
            <CardTile
              :display="resolveOutOfTimeDisplay(entry)"
              size="sm"
              :show-label="true"
            />
            <button
              v-if="isUsableRitual(entry.extId)"
              type="button"
              class="played-row__use"
              data-testid="use-ritual-artifact"
              :data-card-id="entry.extId"
              :aria-label="`Use ${resolveOutOfTimeDisplay(entry).name}'s Ritual`"
              @click="onUseRitual(entry.extId)"
            >
              Use
            </button>
          </li>
        </ul>
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

/* why: WP-858 / D-24794 — a column so a Ritual Use button can sit under its tile. */
.played-row__card {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
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

/* why: WP-858 / D-24794 — the controlled Artifacts group: the Out of Time group's caption
   and small tiles, set off from the played cards by a dashed divider on its left. */
.played-row__artifacts {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding-left: 0.5rem;
  border-left: 2px dashed var(--color-foreground, #666);
}

.played-row__artifacts-heading {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.85;
  white-space: nowrap;
}

.played-row__artifacts-cards {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.35rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

/* why: WP-858 / D-24794 — the Ritual Use button, under its tile (the Phase button's colours). */
.played-row__use {
  min-width: 24px;
  min-height: 24px;
  padding: 0.15rem 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 0.3rem;
  background: rgba(40, 24, 88, 0.92);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
}

.played-row__use:hover,
.played-row__use:focus-visible {
  background: rgba(88, 56, 176, 0.95);
}

/* why: WP-865 / D-24808 — the Attempt Heist button, inline in the heading (the Use button's
   colours, so the player-initiated card actions read as one family). */
.played-row__heist {
  margin-left: 0.5rem;
  min-height: 24px;
  padding: 0.15rem 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 0.3rem;
  background: rgba(40, 24, 88, 0.92);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: none;
  cursor: pointer;
}

.played-row__heist:hover,
.played-row__heist:focus-visible {
  background: rgba(88, 56, 176, 0.95);
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
