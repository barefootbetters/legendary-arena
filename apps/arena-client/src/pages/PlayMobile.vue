<script lang="ts">
import { computed, defineComponent, ref, type PropType } from 'vue';
import { storeToRefs } from 'pinia';
import type {
  UICardDisplay,
  UIDisplayEntry,
  UIPlayerState,
} from '@legendary-arena/game-engine';
import { useUiStateStore } from '../stores/uiState';

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
import PileBrowseModal from '../components/play/PileBrowseModal.vue';
import CardReaderModal from '../components/play/CardReaderModal.vue';
import PendingHeroChoicePrompt from '../components/play/PendingHeroChoicePrompt.vue';
import PendingKoHeroChoicePrompt from '../components/play/PendingKoHeroChoicePrompt.vue';
import PendingScryKoChoicePrompt from '../components/play/PendingScryKoChoicePrompt.vue';
import PendingDiscardChoicePrompt from '../components/play/PendingDiscardChoicePrompt.vue';
import PendingReorderChoicePrompt from '../components/play/PendingReorderChoicePrompt.vue';
import PendingDefeatChoicePrompt from '../components/play/PendingDefeatChoicePrompt.vue';
import OptionalKoRewardPrompt from '../components/play/OptionalKoRewardPrompt.vue';
import DrawOrEmpoweredPrompt from '../components/play/DrawOrEmpoweredPrompt.vue';
import VictoryPileCardPickPrompt from '../components/play/VictoryPileCardPickPrompt.vue';
import OptionalPutBottomHQPrompt from '../components/play/OptionalPutBottomHQPrompt.vue';
import ReturnOnDiscardPrompt from '../components/play/ReturnOnDiscardPrompt.vue';
import PutAnyNumberBottomHQPrompt from '../components/play/PutAnyNumberBottomHQPrompt.vue';
import ReturnZeroCostDiscardPrompt from '../components/play/ReturnZeroCostDiscardPrompt.vue';
import DiscardToPlayPrompt from '../components/play/DiscardToPlayPrompt.vue';
import PendingGiveHqHeroChoicePrompt from '../components/play/PendingGiveHqHeroChoicePrompt.vue';
import PendingCopyPowersChoicePrompt from '../components/play/PendingCopyPowersChoicePrompt.vue';
import GameLogPanel from '../components/log/GameLogPanel.vue';
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
 * Mobile portrait page (375×667 to 414×896) per
 * `DESIGN-BOARD-LAYOUT.md §3.2`. Vertically stacked. Sticky top HUD +
 * sticky bottom turn-actions panel; the middle scrolls vertically; wide
 * rows (city, HQ, hand) scroll horizontally within their zone.
 *
 * Per the EC-132 §2 SFC authoring whitelist: this page is a tested
 * non-leaf composer that uses the Pinia store, has computed state, and
 * imports children whose templates need binding via _ctx — so it MUST
 * use `defineComponent({ setup() { return {...} } })` per P6-30 / P6-46
 * / D-6512.
 *
 * @see WP-129 §Acceptance Criteria — mobile portrait viewport
 * @see WP-171 §Acceptance Criteria — Pile Browse Modal page wiring
 * @see DESIGN-BOARD-LAYOUT.md §3.2
 */
export default defineComponent({
  name: 'PlayMobile',
  components: {
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
    PileBrowseModal,
    CardReaderModal,
    GameLogPanel,
    PendingHeroChoicePrompt,
    PendingKoHeroChoicePrompt,
    PendingScryKoChoicePrompt,
    PendingDiscardChoicePrompt,
    PendingReorderChoicePrompt,
    PendingDefeatChoicePrompt,
    OptionalKoRewardPrompt,
    DrawOrEmpoweredPrompt,
    VictoryPileCardPickPrompt,
    OptionalPutBottomHQPrompt,
    ReturnOnDiscardPrompt,
    PutAnyNumberBottomHQPrompt,
    ReturnZeroCostDiscardPrompt,
    DiscardToPlayPrompt,
    PendingGiveHqHeroChoicePrompt,
    PendingCopyPowersChoicePrompt,
  },
  props: {
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
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
  setup() {
    const store = useUiStateStore();
    const { snapshot } = storeToRefs(store);

    // why: WP-171 / EC-189 — single page-level modal-state ref mirrors the
    // `OpponentPanel.vue:30-43` precedent (local ref, no Pinia, no composable).
    // PlayMobile reuses the identical wiring as PlayDesktop so behavior is
    // viewport-symmetric.
    const activePile = ref<ActivePile | null>(null);

    function onPileOpen(payload: ActivePile): void {
      activePile.value = payload;
    }

    function onPileClose(): void {
      activePile.value = null;
    }

    // why: mirrors PlayDesktop — the Mastermind / Scheme tiles emit `read`;
    // the page holds the active card and feeds one CardReaderModal.
    const activeCard = ref<ActiveCard | null>(null);

    function onCardRead(payload: ActiveCard): void {
      activeCard.value = payload;
    }

    function onCardReadClose(): void {
      activeCard.value = null;
    }

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

    const isGameOver = computed<boolean>(
      () => snapshot.value?.gameOver !== undefined,
    );

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

    // why: WP-313 / D-24099 — derived from UIState.pendingVictoryPileCardPick !== undefined;
    // blocks end-turn / pass-priority at EVERY stage while a victory-pile pick is pending.
    const hasPendingVictoryPileCardPick = computed<boolean>(
      () => snapshot.value?.pendingVictoryPileCardPick !== undefined,
    );

    // why: derived from UIState.pendingOptionalPutBottomHQ !== undefined; blocks
    // end-turn / pass-priority at EVERY stage while an optional-put-bottom-hq choice
    // is pending (board frozen, mirrors hasPendingVictoryPileCardPick).
    const hasPendingOptionalPutBottomHQ = computed<boolean>(
      () => snapshot.value?.pendingOptionalPutBottomHQ !== undefined,
    );

    // why: D-24132 — derived from UIState.pendingPutAnyNumberBottomHQ !== undefined; blocks
    // end-turn / pass-priority at EVERY stage while a put-any-number-bottom-hq multi-select
    // choice is pending (board frozen, mirrors hasPendingOptionalPutBottomHQ).
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
    // why: WP-498 / D-24301 — derived from UIState.pendingReturnOnDiscard !== undefined;
    // blocks end-turn / pass-priority at EVERY stage while the OPTIONAL return-on-discard
    // choice is pending (board frozen).
    const hasPendingReturnOnDiscard = computed<boolean>(
      () => snapshot.value?.pendingReturnOnDiscard !== undefined,
    );
    // why: WP-470 / D-24282 — derived from UIState.pendingScryKoChoice !== undefined.
    // Passed to TurnActionBar to block end-turn and pass-priority at EVERY stage while a
    // Doombot scry-KO choice is pending (board frozen, mirrors hasPendingKoChoice).
    const hasPendingScryKoChoice = computed<boolean>(
      () => snapshot.value?.pendingScryKoChoice !== undefined,
    );
    // why: WP-477 / WP-476 — derived from UIState.pendingDiscardChoice !== undefined. Passed to
    // TurnActionBar to block end-turn and pass-priority at EVERY stage while a Magneto
    // discard-to-limit choice is pending (board frozen, mirrors hasPendingScryKoChoice).
    // why: WP-480 / D-24286 — derived from UIState.pendingReorderChoice !== undefined. Passed to
    // TurnActionBar to block end-turn and pass-priority at EVERY stage while a reveal-remainder
    // reorder choice is pending (board frozen, mirrors hasPendingDiscardChoice).
    const hasPendingReorderChoice = computed<boolean>(
      () => snapshot.value?.pendingReorderChoice !== undefined,
    );
    // why: WP-486 / D-24291 — derived from UIState.pendingDefeatChoice !== undefined. Passed to
    // TurnActionBar to block end-turn and pass-priority at EVERY stage while a Silent Sniper
    // defeat-with-a-Bystander choice is pending (board frozen, mirrors hasPendingReorderChoice).
    const hasPendingDefeatChoice = computed<boolean>(
      () => snapshot.value?.pendingDefeatChoice !== undefined,
    );
    const hasPendingDiscardChoice = computed<boolean>(
      () => snapshot.value?.pendingDiscardChoice !== undefined,
    );
    // why: WP-532 / D-24343 — derived from UIState.pendingGiveHqHeroChoice !== undefined. Passed
    // to TurnActionBar to block end-turn and pass-priority at EVERY stage while a Paibok Fight
    // give-HQ-Hero choice is pending (board frozen, mirrors hasPendingDefeatChoice).
    const hasPendingGiveHqHeroChoice = computed<boolean>(
      () => snapshot.value?.pendingGiveHqHeroChoice !== undefined,
    );
    // why: WP-535 / D-24345 — derived from UIState.pendingCopyPowersChoice !== undefined. Passed
    // to TurnActionBar to block end-turn and pass-priority at EVERY stage while a Rogue Copy
    // Powers copy-a-Hero choice is pending (board frozen, mirrors hasPendingGiveHqHeroChoice).
    const hasPendingCopyPowersChoice = computed<boolean>(
      () => snapshot.value?.pendingCopyPowersChoice !== undefined,
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
      isGameOver,
      isViewerTurn,
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
      hasPendingReturnOnDiscard,
      hasPendingScryKoChoice,
      hasPendingDiscardChoice,
      hasPendingReorderChoice,
      hasPendingDefeatChoice,
      hasPendingGiveHqHeroChoice,
      hasPendingCopyPowersChoice,
      hasWoundInHand,
    };
  },
});
</script>

<template>
  <div class="play-mobile" data-testid="play-mobile">
    <p
      v-if="snapshot === null"
      class="play-empty-match"
      data-testid="play-empty-match"
    >
      No match is currently loaded.
    </p>
    <template v-else>
      <header class="play-mobile__sticky-top" data-testid="play-mobile-sticky-top">
        <TopHudBar
          :snapshot="snapshot"
          :mastermind-tactics-total="4"
          :scheme-twist-threshold="8"
          :villain-group-ids="villainGroupIds"
          :henchman-group-ids="henchmanGroupIds"
          :hero-deck-ids="heroDeckIds"
        />
      </header>
      <EndgameSummary
        v-if="isGameOver && snapshot.gameOver"
        :game-over="snapshot.gameOver"
      />
      <LobbyControls v-if="isLobbyPhase" :submit-move="submitMove" />
      <main v-if="isPlayPhase && viewer !== null" class="play-mobile__scroll">
        <section class="play-mobile__band">
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
        </section>
        <section class="play-mobile__band">
          <SchemeTile :scheme="snapshot.scheme" :twist-threshold="8" @read="onCardRead" />
          <SchemeTwistPile
            :pile="snapshot.scheme.twistPile"
            @open="onPileOpen"
          />
        </section>
        <section class="play-mobile__band play-mobile__band--scroll-x">
          <CityRow
            :city="snapshot.city"
            :decks="snapshot.decks"
            :current-stage="snapshot.game.currentStage"
            :is-viewer-turn="isViewerTurn"
            :economy="snapshot.economy"
            :submit-move="submitMove"
          />
        </section>
        <section class="play-mobile__band play-mobile__band--scroll-x">
          <HQRow
            :hq="snapshot.hq"
            :decks="snapshot.decks"
            :current-stage="snapshot.game.currentStage"
            :is-viewer-turn="isViewerTurn"
            :economy="snapshot.economy"
            :submit-move="submitMove"
          />
        </section>
        <SharedDecks :piles="snapshot.piles" />
        <KOPile :ko-pile="snapshot.koPile" @open="onPileOpen" />
        <section
          class="play-mobile__band"
          data-testid="play-mobile-opponents"
        >
          <OpponentPanel
            v-for="opponent in opponents"
            :key="opponent.playerId"
            :player="opponent"
          />
        </section>
        <EconomyBar :economy="snapshot.economy" />
        <YourDeckDiscardZone
          :deck-count="viewer.deckCount"
          :discard-count="viewer.discardCount"
          :discard-top-card="viewer.discardTopCard"
          :discard-cards="viewer.discardCards"
          :discard-display="viewer.discardDisplay"
        />
        <YourVictoryPile
          :victory-cards="viewer.victoryCards ?? []"
          :victory-vp="viewer.victoryVP ?? 0"
          @open="onPileOpen"
        />
        <!-- why: the mat labels the card lifecycle explicitly — played
             cards sit above the unplayed hand; endTurn sweeps both to
             the discard pile and next turn's onBegin draws back to 6. -->
        <section class="play-mobile__band play-mobile__band--scroll-x">
          <PlayedCardsRow
            :in-play-cards="viewer.inPlayCards ?? []"
            :in-play-display="viewer.inPlayDisplay"
          />
        </section>
        <section class="play-mobile__band play-mobile__band--scroll-x">
          <HandRow
            :hand-cards="viewer.handCards ?? []"
            :hand-display="viewer.handDisplay"
            :current-stage="snapshot.game.currentStage"
            :is-viewer-turn="isViewerTurn"
            :submit-move="submitMove"
          />
        </section>
        <!-- why: WP-318 — the persistent game log (G.messages -> UIState.log)
             in the live HUD, so Fight/Ambush/Escape effect lines (WP-316),
             Empowered/Berserk grants (WP-317), and every engine log line are
             visible during play, not only in the replay inspector. Read-only
             projection — the engine owns log authorship (D-20002). -->
        <section class="play-mobile__log" data-testid="play-mobile-log">
          <h2 class="play-mobile__log-heading">Game Log</h2>
          <GameLogPanel :log="snapshot.log" />
        </section>
      </main>
      <footer
        v-if="isPlayPhase"
        class="play-mobile__sticky-bottom"
        data-testid="play-mobile-sticky-bottom"
      >
        <!-- why: WP-166 — viewer is typed nullable; the pending-choice prompt needs
             an identified viewer to read viewer.playerId, matching the <main> guard
             above. (WP-236 retired the TurnActionBar handCount prop, but the viewer
             guard remains for the prompt.) Mobile never produces a viewer-less play
             frame (PlayViewport forwards matchId to PlayDesktop only, D-16501), so
             this is a type-safety guard, not the EC-183 board-ungating restructure
             (which deliberately scoped mobile out). The footer and preplan-affordance
             slot stay on isPlayPhase. -->
        <template v-if="viewer !== null">
          <!-- why: D-24012 + WP-243 — the KO prompt renders ABOVE the hero-choice
               prompt (higher urgency — full board freeze) and both render above
               TurnActionBar. Appears only for the choosing player when
               pendingKoHeroChoice is set. -->
          <PendingKoHeroChoicePrompt
            :pending-ko-hero-choice="snapshot.pendingKoHeroChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-470 / D-24282 — the Doombot scry-KO prompt renders above
               TurnActionBar; appears only for the choosing player when
               pendingScryKoChoice is set. The block-all guard guarantees at most one
               pending-choice type is set. -->
          <PendingScryKoChoicePrompt
            :pending-scry-ko-choice="snapshot.pendingScryKoChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-476 / D-24284 — the Magneto discard-to-limit prompt renders above
               TurnActionBar; appears only for the choosing player when
               pendingDiscardChoice is set. The block-all guard guarantees at most one
               pending-choice type is set. -->
          <PendingDiscardChoicePrompt
            :pending-discard-choice="snapshot.pendingDiscardChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-479 / D-24286 — the reveal-remainder reorder prompt renders above
               TurnActionBar; appears only for the choosing player when
               pendingReorderChoice is set. The block-all guard guarantees at most one
               pending-choice type is set. -->
          <PendingReorderChoicePrompt
            :pending-reorder-choice="snapshot.pendingReorderChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-486 / D-24291 — the Silent Sniper defeat-with-a-Bystander prompt renders
               above TurnActionBar; appears only for the choosing player when pendingDefeatChoice
               is set. The block-all guard guarantees at most one pending-choice type is set. -->
          <PendingDefeatChoicePrompt
            :pending-defeat-choice="snapshot.pendingDefeatChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: D-24020 + WP-249 — the optional-KO-reward prompt renders above
               TurnActionBar; appears only for the choosing player when
               pendingOptionalKoReward is set. WP-248's block-all guard guarantees
               at most one pending-choice type is set. -->
          <OptionalKoRewardPrompt
            :pending-optional-ko-reward="snapshot.pendingOptionalKoReward"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: D-24071 + WP-287 — the draw-or-empowered prompt renders above
               TurnActionBar; appears only for the choosing player when
               pendingDrawOrEmpowered is set. WP-286's block-all guard guarantees at
               most one pending-choice type is set. -->
          <DrawOrEmpoweredPrompt
            :pending-draw-or-empowered="snapshot.pendingDrawOrEmpowered"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-313 / D-24099 — victory-pile villain-pick prompt (The Ebony Blade);
               appears only for the choosing player when pendingVictoryPileCardPick is set. -->
          <VictoryPileCardPickPrompt
            :pending-victory-pile-card-pick="snapshot.pendingVictoryPileCardPick"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: optional-put-bottom-hq prompt (Wonder Man's Ionic Energy); appears
               only for the choosing player when pendingOptionalPutBottomHQ is set. -->
          <OptionalPutBottomHQPrompt
            :pending-optional-put-bottom-h-q="snapshot.pendingOptionalPutBottomHQ"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-498 / D-24301 — optional return-on-discard prompt (Cyclops Unending
               Energy); appears only for the choosing player when pendingReturnOnDiscard is set. -->
          <ReturnOnDiscardPrompt
            :pending-return-on-discard="snapshot.pendingReturnOnDiscard"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: D-24132 — put-any-number-bottom-hq multi-select prompt (Wonder Man's 8th
               Wonder of the World et al.); appears only for the choosing player when
               pendingPutAnyNumberBottomHQ is set. -->
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
          <!-- why: D-22201 + WP-222 — prompt renders above TurnActionBar; appears
               only for the choosing player when pendingHeroChoice is set. -->
          <PendingHeroChoicePrompt
            :pending-hero-choice="snapshot.pendingHeroChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-532 / D-24343 — the Paibok Fight give-HQ-Hero prompt renders above
               TurnActionBar; appears only for the choosing player when pendingGiveHqHeroChoice
               is set. The block-all guard guarantees at most one pending-choice type is set. -->
          <PendingGiveHqHeroChoicePrompt
            :pending-give-hq-hero-choice="snapshot.pendingGiveHqHeroChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-535 / D-24345 — the Rogue Copy Powers copy-a-Hero prompt renders above
               TurnActionBar; appears only for the choosing player when pendingCopyPowersChoice
               is set. The block-all guard guarantees at most one pending-choice type is set. -->
          <PendingCopyPowersChoicePrompt
            :pending-copy-powers-choice="snapshot.pendingCopyPowersChoice"
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
            :has-pending-return-on-discard="hasPendingReturnOnDiscard"
            :has-pending-scry-ko-choice="hasPendingScryKoChoice"
            :has-pending-discard-choice="hasPendingDiscardChoice"
            :has-pending-reorder-choice="hasPendingReorderChoice"
            :has-pending-defeat-choice="hasPendingDefeatChoice"
            :has-pending-give-hq-hero-choice="hasPendingGiveHqHeroChoice"
            :has-pending-copy-powers-choice="hasPendingCopyPowersChoice"
            :has-wound-in-hand="hasWoundInHand"
            :has-acted-this-turn="snapshot.game.hasActedThisTurn"
            :has-healed-this-turn="snapshot.game.hasHealedThisTurn"
            :submit-move="submitMove"
          />
        </template>
        <!-- why: D-12908 — pre-plan affordance slot reserved for WP-059
             at the bottom-edge zone. WP-059 owns the integration shape. -->
        <slot name="preplan-affordance" />
      </footer>
    </template>
    <!-- why: WP-171 / EC-189 — exactly one pile-browse-modal instance per
         page; identical wiring to PlayDesktop so behavior is
         viewport-symmetric. The modal teleports under `document.body` so it
         escapes the sticky-top/sticky-bottom zones; ESC keydown + backdrop
         click clear `activePile` via the page's `onPileClose` handler. -->
    <PileBrowseModal
      :is-open="activePile !== null"
      :pile-label="activePile?.pileLabel ?? ''"
      :cards="activePile?.cards ?? []"
      @close="onPileClose"
    />
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
.play-mobile {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.play-mobile__sticky-top {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--color-background, #fff);
}

.play-mobile__sticky-bottom {
  position: sticky;
  bottom: 0;
  z-index: 10;
  background: var(--color-background, #fff);
  border-top: 1px solid var(--color-foreground, #999);
}

.play-mobile__scroll {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem;
}

.play-mobile__band {
  display: flex;
  gap: 0.5rem;
}

.play-mobile__log {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.play-mobile__log-heading {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
}

.play-mobile__band--scroll-x {
  overflow-x: auto;
}

.play-empty-match {
  padding: 0.75rem 1rem;
  border: 1px dashed var(--color-foreground, #666);
}
</style>
