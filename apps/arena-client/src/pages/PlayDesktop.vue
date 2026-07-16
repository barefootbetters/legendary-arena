<script lang="ts">
import { computed, defineComponent, onMounted, ref, type PropType } from 'vue';
import { storeToRefs } from 'pinia';
import type {
  UICardDisplay,
  UIDisplayEntry,
  UIPlayerState,
} from '@legendary-arena/game-engine';
import { useUiStateStore } from '../stores/uiState';
import { useNotableEventStream } from '../composables/useNotableEventStream';
import type { NotableEventCardLookup } from '../components/play/NotableEventOverlay.vue';
import {
  getStatus,
  resolveAutoplayGating,
  STATUS_RETRY_DELAY_MS,
  type AutoplayControlResponse,
} from '../services/autoplayPlayback';

import AutoplayControls from '../components/AutoplayControls.vue';
import EndgameSummary from '../components/hud/EndgameSummary.vue';
import TopHudBar from '../components/play/TopHudBar.vue';
import OpponentPanel from '../components/play/OpponentPanel.vue';
import MastermindTile from '../components/play/MastermindTile.vue';
import MasterStrikePile from '../components/play/MasterStrikePile.vue';
import SchemeTile from '../components/play/SchemeTile.vue';
import SchemeTwistPile from '../components/play/SchemeTwistPile.vue';
import CityRow from '../components/play/CityRow.vue';
import HQRow from '../components/play/HQRow.vue';
import SharedDecks from '../components/play/SharedDecks.vue';
import KOPile from '../components/play/KOPile.vue';
import HandRow from '../components/play/HandRow.vue';
import PlayedCardsRow from '../components/play/PlayedCardsRow.vue';
import EconomyBar from '../components/play/EconomyBar.vue';
import YourDeckDiscardZone from '../components/play/YourDeckDiscardZone.vue';
import YourVictoryPile from '../components/play/YourVictoryPile.vue';
import TurnActionBar from '../components/play/TurnActionBar.vue';
import { handHasWound } from '../components/play/woundIdentity';
import LobbyControls from '../components/play/LobbyControls.vue';
import NotableEventOverlay from '../components/play/NotableEventOverlay.vue';
import GameLogPanel from '../components/log/GameLogPanel.vue';
import PileBrowseModal from '../components/play/PileBrowseModal.vue';
import CardReaderModal from '../components/play/CardReaderModal.vue';
import PendingHeroChoicePrompt from '../components/play/PendingHeroChoicePrompt.vue';
import PendingKoHeroChoicePrompt from '../components/play/PendingKoHeroChoicePrompt.vue';
import OptionalKoRewardPrompt from '../components/play/OptionalKoRewardPrompt.vue';
import DrawOrEmpoweredPrompt from '../components/play/DrawOrEmpoweredPrompt.vue';
import VictoryPileCardPickPrompt from '../components/play/VictoryPileCardPickPrompt.vue';
import OptionalPutBottomHQPrompt from '../components/play/OptionalPutBottomHQPrompt.vue';
import PutAnyNumberBottomHQPrompt from '../components/play/PutAnyNumberBottomHQPrompt.vue';
import ReturnZeroCostDiscardPrompt from '../components/play/ReturnZeroCostDiscardPrompt.vue';
import DiscardToPlayPrompt from '../components/play/DiscardToPlayPrompt.vue';
import type { SubmitMove } from '../components/play/uiMoveName.types';

interface ActivePile {
  pileLabel: string;
  cards: readonly UIDisplayEntry[];
}

interface ActiveCard {
  title: string;
  display: UICardDisplay;
  gameText: readonly string[];
}

/**
 * Desktop landscape page (1280×800 to 1920×1080) per
 * `DESIGN-BOARD-LAYOUT.md §3.1`. Mounts the full component tree against
 * the WP-128-extended UIState. Per D-12901 the Mastermind sits top-left;
 * per D-12902 opponents sit on the top edge for 3-4 player counts (the
 * default for MVP).
 *
 * Per the EC-132 §2 SFC authoring whitelist: this page is a tested
 * non-leaf composer that uses the Pinia store, has computed state, and
 * imports children whose templates need binding via _ctx — so it MUST
 * use `defineComponent({ setup() { return {...} } })` per P6-30 / P6-46
 * / D-6512.
 *
 * @see WP-129 §Acceptance Criteria — desktop viewport
 * @see WP-171 §Acceptance Criteria — Pile Browse Modal page wiring
 * @see DESIGN-BOARD-LAYOUT.md §3.1
 */
export default defineComponent({
  name: 'PlayDesktop',
  components: {
    AutoplayControls,
    EndgameSummary,
    TopHudBar,
    OpponentPanel,
    MastermindTile,
    MasterStrikePile,
    SchemeTile,
    SchemeTwistPile,
    CityRow,
    HQRow,
    SharedDecks,
    KOPile,
    HandRow,
    PlayedCardsRow,
    EconomyBar,
    YourDeckDiscardZone,
    YourVictoryPile,
    TurnActionBar,
    LobbyControls,
    NotableEventOverlay,
    GameLogPanel,
    PileBrowseModal,
    CardReaderModal,
    PendingHeroChoicePrompt,
    PendingKoHeroChoicePrompt,
    OptionalKoRewardPrompt,
    DrawOrEmpoweredPrompt,
    VictoryPileCardPickPrompt,
    OptionalPutBottomHQPrompt,
    PutAnyNumberBottomHQPrompt,
    ReturnZeroCostDiscardPrompt,
    DiscardToPlayPrompt,
  },
  props: {
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
    // why: matchId is prop-drilled App.vue → PlayViewport.vue → here (no store
    // carries it); it gates the autoplay status probe (D-16501). Defaults to ''
    // so non-live mounts (fixtures, tests) probe nothing and render no bar.
    matchId: {
      type: String,
      default: '',
    },
    villainGroupIds: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    henchmanGroupIds: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    heroDeckIds: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
  },
  setup(props) {
    const store = useUiStateStore();
    const { snapshot } = storeToRefs(store);
    const { currentEvent: notableEvent, dismiss: dismissNotableEvent } =
      useNotableEventStream(snapshot);

    // why: the engine's `cardDisplayData` lives on G and is NOT projected as
    // a top-level UIState field (pre-flight inspection of `uiState.types.ts`
    // on `main @ 52d64e2`); it surfaces only through per-zone embedded
    // `display: UICardDisplay` entries. The overlay needs an ext_id → name
    // lookup for the notable-event card; this computed walks every visible
    // display-bearing projection in the snapshot and folds them into a
    // single keyed map. Cards that have already left every visible zone
    // (e.g., a defeated villain pre-rendered into the active player's
    // victory pile) still resolve through the same map. Cards that the
    // viewer cannot see fall back to the raw ext_id per the WP-201
    // §Scope (In) overlay fallback rule.
    const notableEventCardLookup = computed<NotableEventCardLookup>(() => {
      const result: Record<string, UICardDisplay> = {};
      const current = snapshot.value;
      if (current === null) return result;

      function store(extId: string | undefined, value: UICardDisplay | undefined): void {
        if (extId === undefined || value === undefined) return;
        if (result[extId] === undefined) result[extId] = value;
      }

      for (const spaceCard of current.city.spaces) {
        if (spaceCard !== null) store(spaceCard.extId, spaceCard.display);
      }
      for (const entry of current.city.escapedPile) {
        store(entry.extId, entry.display);
      }
      store(current.mastermind.display?.extId, current.mastermind.display);
      for (const entry of current.mastermind.attachedBystanders) {
        store(entry.extId, entry.display);
      }
      for (const entry of current.mastermind.strikePile) {
        store(entry.extId, entry.display);
      }
      if (current.scheme.display !== undefined) {
        store(current.scheme.display.extId, current.scheme.display);
      }
      for (const entry of current.scheme.twistPile) {
        store(entry.extId, entry.display);
      }
      const slotDisplay = current.hq.slotDisplay;
      if (slotDisplay !== undefined) {
        for (const slot of slotDisplay) {
          if (slot !== null) store(slot.extId, slot.display);
        }
      }
      for (const player of current.players) {
        const handDisplay = player.handDisplay;
        const handCards = player.handCards;
        if (handDisplay !== undefined && handCards !== undefined) {
          for (let index = 0; index < handDisplay.length; index += 1) {
            store(handCards[index], handDisplay[index]);
          }
        }
        const inPlayDisplay = player.inPlayDisplay;
        const inPlayCards = player.inPlayCards;
        if (inPlayDisplay !== undefined && inPlayCards !== undefined) {
          for (let index = 0; index < inPlayDisplay.length; index += 1) {
            store(inPlayCards[index], inPlayDisplay[index]);
          }
        }
        const discardTop = player.discardTopCard;
        if (discardTop !== null && discardTop !== undefined) {
          store(discardTop.extId, discardTop.display);
        }
        if (player.victoryCards !== undefined) {
          for (const entry of player.victoryCards) {
            store(entry.extId, entry.display);
          }
        }
      }
      for (const entry of current.koPile.cards) {
        store(entry.extId, entry.display);
      }
      const koTop = current.koPile.topCard;
      if (koTop !== null) store(koTop.extId, koTop.display);

      return result;
    });

    // why: the autoplay control bar renders ONLY when the WP-165 status probe
    // confirms an autoplay match (D-16501); a normal PvP match returns 404 and
    // leaves this null so the bar stays hidden.
    const autoplayStatus = ref<AutoplayControlResponse | null>(null);

    // why: WP-171 / EC-189 — single page-level modal-state ref mirrors the
    // `OpponentPanel.vue:30-43` precedent (local ref, no Pinia, no composable).
    // The discriminator is `null` (not an optional field) so the modal's
    // `isOpen` binding is a clean `activePile !== null` boolean check.
    const activePile = ref<ActivePile | null>(null);

    function onPileOpen(payload: ActivePile): void {
      activePile.value = payload;
    }

    function onPileClose(): void {
      activePile.value = null;
    }

    // why: the Mastermind / Scheme tiles emit `read` with the card + its
    // gameText; the page holds the active card and feeds one CardReaderModal,
    // mirroring the activePile/PileBrowseModal pattern.
    const activeCard = ref<ActiveCard | null>(null);

    function onCardRead(payload: ActiveCard): void {
      activeCard.value = payload;
    }

    function onCardReadClose(): void {
      activeCard.value = null;
    }

    // why: game-over is engine truth, read PASSIVELY from the live snapshot and
    // passed to the control bar as a prop; never computed/inferred here.
    const isGameOver = computed<boolean>(
      () => snapshot.value?.gameOver !== undefined,
    );

    onMounted(() => {
      // why: bounded single retry — an initial 404 may be the WP-165
      // transient-init race (controller momentarily unregistered after
      // autoplay-create); one retry after STATUS_RETRY_DELAY_MS absorbs it, a
      // second null is final (no loop). A thrown non-404 fault is surfaced and
      // leaves the bar hidden — it is never read as "not an autoplay match".
      void (async () => {
        try {
          const resolved = await resolveAutoplayGating(
            props.matchId,
            getStatus,
            () =>
              new Promise<void>((resolve) => {
                setTimeout(resolve, STATUS_RETRY_DELAY_MS);
              }),
          );
          if (resolved !== null) {
            autoplayStatus.value = resolved;
          }
        } catch (statusError) {
          console.error('Autoplay status probe failed; bar stays hidden.', statusError);
        }
      })();
    });

    const viewer = computed<UIPlayerState | null>(() => {
      const current = snapshot.value;
      if (current === null) {
        return null;
      }
      for (const player of current.players) {
        if (player.handCards !== undefined) {
          return player;
        }
      }
      return null;
    });

    const opponents = computed<UIPlayerState[]>(() => {
      const current = snapshot.value;
      if (current === null) {
        return [];
      }
      const own = viewer.value;
      if (own === null) {
        return [...current.players];
      }
      return current.players.filter((player) => player.playerId !== own.playerId);
    });

    const isLobbyPhase = computed<boolean>(
      () => snapshot.value?.game.phase === 'lobby',
    );

    const isPlayPhase = computed<boolean>(
      () => snapshot.value?.game.phase === 'play',
    );

    // why: gameover transitions `phase` from 'play' → 'end' (or in some
    // boardgame.io v0.50 codepaths nulls it out), which would collapse the
    // shared board if we kept the outer template gated on `isPlayPhase`
    // alone — leaving an autoplay viewer stranded on TopHudBar with no way
    // to click the opponents' `Victory: N ▼` buttons to inspect final
    // piles. `boardVisible` extends the EC-183 spectator-frame fix to the
    // post-game frame: render the same shared board (mastermind, scheme,
    // city, HQ, shared decks, KO, opponent panels) so the final state is
    // inspectable. The personal `viewer !== null` gate inside still hides
    // the "your" zone for spectator / autoplay frames; this gate only
    // controls whether the board renders AT ALL.
    const boardVisible = computed<boolean>(
      () => isPlayPhase.value || isGameOver.value,
    );

    // why: actions must be disabled when it's another player's turn —
    // otherwise clicks submit moves as the wrong player and boardgame.io
    // silently rejects them, making buttons appear broken on alternating turns.
    const isViewerTurn = computed<boolean>(() => {
      const own = viewer.value;
      if (own === null) return false;
      return snapshot.value?.game.activePlayerId === own.playerId;
    });

    // why: D-22203 — derived from UIState.pendingHeroChoice !== undefined so
    // the composable does not read UIState internally (separation of concerns).
    // Passed to TurnActionBar to block end-turn and pass-priority at cleanup.
    const hasPendingChoice = computed<boolean>(
      () => snapshot.value?.pendingHeroChoice !== undefined,
    );

    // why: D-24012 — derived from UIState.pendingKoHeroChoice !== undefined.
    // Passed to TurnActionBar to block end-turn and pass-priority at EVERY
    // stage while a KO-a-Hero choice is pending (board frozen).
    const hasPendingKoChoice = computed<boolean>(
      () => snapshot.value?.pendingKoHeroChoice !== undefined,
    );

    // why: D-24020 — derived from UIState.pendingOptionalKoReward !== undefined.
    // Passed to TurnActionBar to block end-turn and pass-priority at EVERY stage
    // while an optional-KO-then-reward choice is pending (board frozen, mirrors
    // hasPendingKoChoice).
    const hasPendingOptionalKoReward = computed<boolean>(
      () => snapshot.value?.pendingOptionalKoReward !== undefined,
    );

    // why: D-24071 — derived from UIState.pendingDrawOrEmpowered !== undefined.
    // Passed to TurnActionBar to block end-turn and pass-priority at EVERY stage while
    // a draw-or-empowered choice is pending (board frozen, mirrors hasPendingOptionalKoReward).
    const hasPendingDrawOrEmpowered = computed<boolean>(
      () => snapshot.value?.pendingDrawOrEmpowered !== undefined,
    );

    // why: WP-313 / D-24099 — derived from UIState.pendingVictoryPileCardPick !== undefined.
    // Passed to TurnActionBar to block end-turn and pass-priority at EVERY stage while a
    // victory-pile villain pick is pending (board frozen, mirrors hasPendingDrawOrEmpowered).
    const hasPendingVictoryPileCardPick = computed<boolean>(
      () => snapshot.value?.pendingVictoryPileCardPick !== undefined,
    );

    // why: derived from UIState.pendingOptionalPutBottomHQ !== undefined. Passed to
    // TurnActionBar to block end-turn and pass-priority at EVERY stage while an
    // optional-put-bottom-hq choice is pending (board frozen, mirrors
    // hasPendingVictoryPileCardPick).
    const hasPendingOptionalPutBottomHQ = computed<boolean>(
      () => snapshot.value?.pendingOptionalPutBottomHQ !== undefined,
    );

    // why: D-24132 — derived from UIState.pendingPutAnyNumberBottomHQ !== undefined. Passed to
    // TurnActionBar to block end-turn and pass-priority at EVERY stage while a put-any-number-
    // bottom-hq multi-select choice is pending (board frozen, mirrors hasPendingOptionalPutBottomHQ).
    const hasPendingPutAnyNumberBottomHQ = computed<boolean>(
      () => snapshot.value?.pendingPutAnyNumberBottomHQ !== undefined,
    );

    // why: D-24139 — derived from UIState.pendingReturnZeroCostDiscard !== undefined. Passed
    // to TurnActionBar to block end-turn and pass-priority at EVERY stage while a mandatory
    // return-zero-cost-discard choice is pending (board frozen, mirrors hasPendingKoChoice).
    const hasPendingReturnZeroCostDiscard = computed<boolean>(
      () => snapshot.value?.pendingReturnZeroCostDiscard !== undefined,
    );
    // why: WP-383 / D-24184 — derived from UIState.pendingDiscardToPlay !== undefined.
    // Passed to TurnActionBar to gate End Turn / Pass Priority while the discard-to-play
    // cost is pending.
    const hasPendingDiscardToPlay = computed<boolean>(
      () => snapshot.value?.pendingDiscardToPlay !== undefined,
    );

    // why: WP-380 — Healing KOs Wounds from HAND specifically, so scan the viewer's
    // own handCards (UIPlayerState.woundCount counts every zone and cannot answer
    // this). handHasWound tolerates a redacted / absent hand (spectator) as false.
    const hasWoundInHand = computed<boolean>(() => handHasWound(viewer.value?.handCards));

    return {
      snapshot,
      viewer,
      opponents,
      isLobbyPhase,
      isPlayPhase,
      boardVisible,
      isViewerTurn,
      notableEvent,
      dismissNotableEvent,
      notableEventCardLookup,
      matchId: props.matchId,
      autoplayStatus,
      isGameOver,
      activePile,
      onPileOpen,
      onPileClose,
      activeCard,
      onCardRead,
      onCardReadClose,
      hasPendingChoice,
      hasPendingKoChoice,
      hasPendingOptionalKoReward,
      hasPendingDrawOrEmpowered,
      hasPendingVictoryPileCardPick,
      hasPendingOptionalPutBottomHQ,
      hasPendingPutAnyNumberBottomHQ,
      hasPendingReturnZeroCostDiscard,
      hasPendingDiscardToPlay,
      hasWoundInHand,
    };
  },
});
</script>

<template>
  <div class="play-desktop" data-testid="play-desktop">
    <!-- why: D-16501 — the bar mounts only after the getStatus probe confirms
         an autoplay match (autoplayStatus non-null); a normal PvP match never
         renders it. -->
    <AutoplayControls
      v-if="autoplayStatus !== null"
      :match-id="matchId"
      :initial-status="autoplayStatus"
      :is-game-over="isGameOver"
    />
    <p
      v-if="snapshot === null"
      class="play-empty-match"
      data-testid="play-empty-match"
    >
      No match is currently loaded. Wait for the server to push a frame, or
      return to the lobby.
    </p>
    <template v-else>
      <TopHudBar
        :snapshot="snapshot"
        :mastermind-tactics-total="4"
        :scheme-twist-threshold="8"
        :villain-group-ids="villainGroupIds"
        :henchman-group-ids="henchmanGroupIds"
        :hero-deck-ids="heroDeckIds"
      />
      <EndgameSummary
        v-if="isGameOver && snapshot.gameOver"
        :game-over="snapshot.gameOver"
      />
      <LobbyControls v-if="isLobbyPhase" :submit-move="submitMove" />
      <!-- why: the shared board renders for the whole play phase regardless of
           viewer. A spectator or rewound-autoplay frame is audience-filtered
           (D-16303) and exposes no own hand, so `viewer` is null; gating the
           board on `viewer !== null` (the prior behavior) blanked the screen on
           rewind (WP-163/164, EC-183). Only the personal "your" zone below
           depends on a viewer.
           why: `boardVisible` extends the gate to include gameover so the
           final frame still renders the opponent panels (with the
           `Victory: N ▼` button) for post-match inspection — without this,
           a viewer who watched an autoplay match to completion lost the
           board the moment `phase` flipped to 'end' and had no way to read
           the final piles. -->
      <template v-if="boardVisible">
        <NotableEventOverlay
          :event="notableEvent"
          :card-display-data="notableEventCardLookup"
          :duration-ms="2500"
          @dismiss="dismissNotableEvent"
        />
        <section class="play-desktop__info-row">
          <div class="play-desktop__opponents" data-testid="play-desktop-opponents">
            <OpponentPanel
              v-for="opponent in opponents"
              :key="opponent.playerId"
              :player="opponent"
            />
          </div>
          <SharedDecks :piles="snapshot.piles" />
        </section>
        <section class="play-desktop__top-row">
          <div class="play-desktop__mastermind-zone">
            <!-- why: D-12901 — Mastermind sits top-left of the board. -->
            <MastermindTile
              :mastermind="snapshot.mastermind"
              :current-stage="snapshot.game.currentStage"
              :is-viewer-turn="isViewerTurn"
              :economy="snapshot.economy"
              :submit-move="submitMove"
              @read="onCardRead"
            />
            <MasterStrikePile
              :pile="snapshot.mastermind.strikePile"
              @open="onPileOpen"
            />
          </div>
          <div class="play-desktop__scheme-zone">
            <SchemeTile :scheme="snapshot.scheme" :twist-threshold="8" @read="onCardRead" />
            <SchemeTwistPile
              :pile="snapshot.scheme.twistPile"
              @open="onPileOpen"
            />
            <KOPile :ko-pile="snapshot.koPile" @open="onPileOpen" />
            <div v-if="viewer !== null" class="play-desktop__victory-deck-stack">
              <YourVictoryPile
                :victory-cards="viewer.victoryCards ?? []"
                :victory-vp="viewer.victoryVP ?? 0"
                @open="onPileOpen"
              />
              <YourDeckDiscardZone
                :deck-count="viewer.deckCount"
                :discard-count="viewer.discardCount"
                :discard-top-card="viewer.discardTopCard"
                :discard-cards="viewer.discardCards"
                :discard-display="viewer.discardDisplay"
              />
            </div>
          </div>
        </section>
        <CityRow
          :city="snapshot.city"
          :decks="snapshot.decks"
          :current-stage="snapshot.game.currentStage"
          :is-viewer-turn="isViewerTurn"
          :economy="snapshot.economy"
          :submit-move="submitMove"
        />
        <HQRow
          :hq="snapshot.hq"
          :decks="snapshot.decks"
          :current-stage="snapshot.game.currentStage"
          :is-viewer-turn="isViewerTurn"
          :economy="snapshot.economy"
          :submit-move="submitMove"
        />
        <!-- why: the personal zone (own hand / economy / deck / victory) and the
             turn-action bar require an identified viewer. They are hidden for a
             spectator or rewound-autoplay frame (viewer null) while the shared
             board above stays visible. -->
        <template v-if="viewer !== null">
          <section class="play-desktop__player-zone">
            <!-- why: the mat labels the card lifecycle explicitly — played
                 cards sit above the unplayed hand; endTurn sweeps both to
                 the discard pile and next turn's onBegin draws back to 6. -->
            <PlayedCardsRow
              :in-play-cards="viewer.inPlayCards ?? []"
              :in-play-display="viewer.inPlayDisplay"
            />
            <HandRow
              :hand-cards="viewer.handCards ?? []"
              :hand-display="viewer.handDisplay"
              :current-stage="snapshot.game.currentStage"
              :is-viewer-turn="isViewerTurn"
              :submit-move="submitMove"
            />
            <EconomyBar :economy="snapshot.economy" />
          </section>
          <!-- why: D-24012 + WP-243 — the KO prompt renders ABOVE the hero-choice
               prompt (higher urgency — full board freeze) and both render above
               TurnActionBar in DOM order. Appears only for the choosing player
               when pendingKoHeroChoice is set. NOT a modal; normal document flow. -->
          <PendingKoHeroChoicePrompt
            :pending-ko-hero-choice="snapshot.pendingKoHeroChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: D-24020 + WP-249 — the optional-KO-reward prompt renders above
               TurnActionBar in DOM order; appears only for the choosing player
               when pendingOptionalKoReward is set. NOT a modal; normal document
               flow. WP-248's block-all guard guarantees at most one pending-choice
               type is set, so no client-side precedence is needed. -->
          <OptionalKoRewardPrompt
            :pending-optional-ko-reward="snapshot.pendingOptionalKoReward"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: D-24071 + WP-287 — the draw-or-empowered prompt renders above
               TurnActionBar in DOM order; appears only for the choosing player when
               pendingDrawOrEmpowered is set. NOT a modal; normal document flow. WP-286's
               block-all guard guarantees at most one pending-choice type is set, so no
               client-side precedence is needed. -->
          <DrawOrEmpoweredPrompt
            :pending-draw-or-empowered="snapshot.pendingDrawOrEmpowered"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-313 / D-24099 — the victory-pile villain-pick prompt renders above
               TurnActionBar in DOM order; appears only for the choosing player when
               pendingVictoryPileCardPick is set (The Ebony Blade). Normal document flow. -->
          <VictoryPileCardPickPrompt
            :pending-victory-pile-card-pick="snapshot.pendingVictoryPileCardPick"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: the optional-put-bottom-hq prompt (Wonder Man's Ionic Energy)
               renders above TurnActionBar in DOM order; appears only for the choosing
               player when pendingOptionalPutBottomHQ is set. Normal document flow. -->
          <OptionalPutBottomHQPrompt
            :pending-optional-put-bottom-h-q="snapshot.pendingOptionalPutBottomHQ"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: D-24132 — the put-any-number-bottom-hq multi-select prompt (Wonder Man's 8th
               Wonder of the World et al.) renders above TurnActionBar in DOM order; appears only
               for the choosing player when pendingPutAnyNumberBottomHQ is set. Normal doc flow. -->
          <PutAnyNumberBottomHQPrompt
            :pending-put-any-number-bottom-h-q="snapshot.pendingPutAnyNumberBottomHQ"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: D-24139 — the return-zero-cost-discard prompt (Black Knight's Defend the
               Weak) renders above TurnActionBar in DOM order; appears only for the choosing
               player when pendingReturnZeroCostDiscard is set. Normal document flow. -->
          <ReturnZeroCostDiscardPrompt
            :pending-return-zero-cost-discard="snapshot.pendingReturnZeroCostDiscard"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-383 / D-24184 — the discard-to-play cost prompt (Cyclops
               Determination/Optic Blast + siblings) renders above TurnActionBar in DOM
               order; appears only for the choosing player when pendingDiscardToPlay is
               set. Normal document flow. -->
          <DiscardToPlayPrompt
            :pending-discard-to-play="snapshot.pendingDiscardToPlay"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: D-22201 + WP-222 — prompt renders above TurnActionBar in DOM
               order; appears only for the choosing player when pendingHeroChoice
               is set. NOT a modal; NOT position:fixed. Normal document flow. -->
          <PendingHeroChoicePrompt
            :pending-hero-choice="snapshot.pendingHeroChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <TurnActionBar
            :current-stage="snapshot.game.currentStage"
            :is-viewer-turn="isViewerTurn"
            :has-pending-choice="hasPendingChoice"
            :has-pending-ko-choice="hasPendingKoChoice"
            :has-pending-optional-ko-reward="hasPendingOptionalKoReward"
            :has-pending-draw-or-empowered="hasPendingDrawOrEmpowered"
            :has-pending-victory-pile-card-pick="hasPendingVictoryPileCardPick"
            :has-pending-optional-put-bottom-h-q="hasPendingOptionalPutBottomHQ"
            :has-pending-put-any-number-bottom-h-q="hasPendingPutAnyNumberBottomHQ"
            :has-pending-return-zero-cost-discard="hasPendingReturnZeroCostDiscard"
            :has-pending-discard-to-play="hasPendingDiscardToPlay"
            :has-wound-in-hand="hasWoundInHand"
            :has-acted-this-turn="snapshot.game.hasActedThisTurn"
            :has-healed-this-turn="snapshot.game.hasHealedThisTurn"
            :submit-move="submitMove"
          />
        </template>
        <!-- why: WP-318 — the persistent game log (G.messages -> UIState.log)
             rendered in the live HUD. Fight/Ambush/Escape effect lines (naming
             the hero, WP-316), Empowered/Berserk grants (WP-317), and every
             other engine log line were previously visible only in the replay
             inspector; mounting GameLogPanel here surfaces them during play.
             Outside the `viewer !== null` block so a spectator sees the log too.
             Read-only projection — the engine owns log authorship (D-20002). -->
        <section class="play-desktop__log" data-testid="play-desktop-log">
          <h2 class="play-desktop__log-heading">Game Log</h2>
          <GameLogPanel :log="snapshot.log" />
        </section>
        <!-- why: D-12908 — pre-plan affordance slot reserved for WP-059;
             this page declares the slot only. WP-059 owns the integration
             shape. -->
        <slot name="preplan-affordance" />
      </template>
    </template>
    <!-- why: WP-171 / EC-189 — exactly one pile-browse-modal instance per
         page; the page-level `activePile` ref discriminates which pile is
         currently open. The modal teleports under `document.body` so it
         escapes the sticky board zones; ESC keydown + backdrop click clear
         `activePile` via the page's `onPileClose` handler. -->
    <PileBrowseModal
      :is-open="activePile !== null"
      :pile-label="activePile?.pileLabel ?? ''"
      :cards="activePile?.cards ?? []"
      @close="onPileClose"
    />
    <!-- why: one CardReaderModal per page; the Mastermind / Scheme tiles emit
         `read` and the page-level `activeCard` ref discriminates which card is
         open. Teleports under document.body like the pile modal. -->
    <CardReaderModal
      :is-open="activeCard !== null"
      :title="activeCard?.title ?? ''"
      :display="activeCard?.display ?? null"
      :game-text="activeCard?.gameText ?? []"
      @close="onCardReadClose"
    />
  </div>
</template>

<style scoped>
.play-desktop {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  position: relative;
  /* why: minimal padding — the sticky TurnActionBar overlaps the bottom
     of the page; this just prevents the last content line from being
     fully hidden behind it */
  padding-bottom: 0.25rem;
}

.play-desktop__info-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.play-desktop__log {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.play-desktop__log-heading {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
}

.play-desktop__opponents {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.play-desktop__top-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  /* why: size each zone to its own content instead of stretching every tile
     to the tallest member of the row. Without this the compact Mastermind /
     Scheme tiles stretch to match the (taller) victory/deck/discard stack,
     re-inflating the exact vertical space this change is meant to reclaim. */
  align-items: flex-start;
}

.play-desktop__mastermind-zone,
.play-desktop__scheme-zone {
  display: flex;
  gap: 0.35rem;
  /* why: keep each tile/pile at its own height rather than stretching the
     Scheme tile to the taller victory/deck/discard stack beside it. */
  align-items: flex-start;
}

.play-desktop__victory-deck-stack {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.play-desktop__player-zone {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border-top: 1px solid var(--color-foreground, #999);
  padding-top: 0.25rem;
}

.play-empty-match {
  padding: 0.75rem 1rem;
  border: 1px dashed var(--color-foreground, #666);
}
</style>
