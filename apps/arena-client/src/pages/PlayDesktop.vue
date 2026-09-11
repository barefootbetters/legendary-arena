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
import { useScaleToFit } from '../composables/useScaleToFit';
import type { NotableEventCardLookup } from '../components/play/NotableEventOverlay.vue';
import {
  getStatus,
  resolveAutoplayGating,
  STATUS_RETRY_DELAY_MS,
  type AutoplayControlResponse,
} from '../services/autoplayPlayback';

import AutoplayControls from '../components/AutoplayControls.vue';
import EndgameSummary from '../components/hud/EndgameSummary.vue';
import type { MyCompetitiveScore } from '../lib/api/competitionApi';
import TopHudBar from '../components/play/TopHudBar.vue';
import OpponentPanel from '../components/play/OpponentPanel.vue';
import MastermindTile from '../components/play/MastermindTile.vue';
import MasterStrikePile from '../components/play/MasterStrikePile.vue';
import SchemeTile from '../components/play/SchemeTile.vue';
import SchemeTwistPile from '../components/play/SchemeTwistPile.vue';
import CityRow from '../components/play/CityRow.vue';
import HQRow from '../components/play/HQRow.vue';
import TransformDeck from '../components/play/TransformDeck.vue';
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
import PendingScryKoChoicePrompt from '../components/play/PendingScryKoChoicePrompt.vue';
import PendingMelterKoChoicePrompt from '../components/play/PendingMelterKoChoicePrompt.vue';
import PendingRuthlessDictatorChoicePrompt from '../components/play/PendingRuthlessDictatorChoicePrompt.vue';
import PendingElectromagneticBubbleChoicePrompt from '../components/play/PendingElectromagneticBubbleChoicePrompt.vue';
import PendingDiscardChoicePrompt from '../components/play/PendingDiscardChoicePrompt.vue';
import PendingPutCardsOnDeckChoicePrompt from '../components/play/PendingPutCardsOnDeckChoicePrompt.vue';
import PendingReorderChoicePrompt from '../components/play/PendingReorderChoicePrompt.vue';
import PendingDefeatChoicePrompt from '../components/play/PendingDefeatChoicePrompt.vue';
import PendingKoDiscardChoicePrompt from '../components/play/PendingKoDiscardChoicePrompt.vue';
import OptionalKoRewardPrompt from '../components/play/OptionalKoRewardPrompt.vue';
import SmashDiscardPrompt from '../components/play/SmashDiscardPrompt.vue';
import DoOverPrompt from '../components/play/DoOverPrompt.vue';
import DrawOrEmpoweredPrompt from '../components/play/DrawOrEmpoweredPrompt.vue';
import CountScaledChoicePrompt from '../components/play/CountScaledChoicePrompt.vue';
import UndercoverChoicePrompt from '../components/play/UndercoverChoicePrompt.vue';
import PendingSeatChoicePrompt from '../components/play/PendingSeatChoicePrompt.vue';
import PlayVillainTopPrompt from '../components/play/PlayVillainTopPrompt.vue';
import VictoryPileCardPickPrompt from '../components/play/VictoryPileCardPickPrompt.vue';
import OptionalPutBottomHQPrompt from '../components/play/OptionalPutBottomHQPrompt.vue';
import ReturnOnDiscardPrompt from '../components/play/ReturnOnDiscardPrompt.vue';
import PutAnyNumberBottomHQPrompt from '../components/play/PutAnyNumberBottomHQPrompt.vue';
import ReturnZeroCostDiscardPrompt from '../components/play/ReturnZeroCostDiscardPrompt.vue';
import DiscardToPlayPrompt from '../components/play/DiscardToPlayPrompt.vue';
import PendingGiveHqHeroChoicePrompt from '../components/play/PendingGiveHqHeroChoicePrompt.vue';
import PendingCopyPowersChoicePrompt from '../components/play/PendingCopyPowersChoicePrompt.vue';
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
    TransformDeck,
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
    PendingScryKoChoicePrompt,
    PendingMelterKoChoicePrompt,
    PendingRuthlessDictatorChoicePrompt,
    PendingElectromagneticBubbleChoicePrompt,
    PendingDiscardChoicePrompt,
    PendingPutCardsOnDeckChoicePrompt,
    PendingKoDiscardChoicePrompt,
    PendingReorderChoicePrompt,
    PendingDefeatChoicePrompt,
    OptionalKoRewardPrompt,
    SmashDiscardPrompt,
    DoOverPrompt,
    DrawOrEmpoweredPrompt,
    CountScaledChoicePrompt,
    UndercoverChoicePrompt,
    PendingSeatChoicePrompt,
    PlayVillainTopPrompt,
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
    // why: WP-578 — prop-drilled PlayViewport → here → EndgameSummary so the
    // endgame panel shows the server-computed competitive score. Null for
    // guests / pending / non-scoring matches.
    competitiveScore: {
      type: Object as PropType<MyCompetitiveScore | null>,
      default: null,
    },
    // why: prop-drilled PlayViewport → here → EndgameSummary so the endgame panel
    // shows a sign-in conversion prompt in the (empty) competitive-score slot when
    // the viewer played as a guest.
    showGuestSignIn: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const store = useUiStateStore();
    const { snapshot } = storeToRefs(store);
    const { currentEvent: notableEvent, dismiss: dismissNotableEvent } =
      useNotableEventStream(snapshot);

    // why: WP-688 / D-24502 lock 1 — the board is authored at a fixed width (the
    // 1280×720 floor) inside `fitStageRef` and scaled to fit `fitContainerRef`
    // (the viewport box), so the whole board fits the smallest supported desktop
    // viewport with no page scroll and scales up (never rewraps) on wider / taller
    // screens. The composable owns only the geometry math; the template binds the
    // returned scale to a `transform: scale()` on the stage and reserves the
    // *scaled* height so the page itself never scrolls.
    const fitContainerRef = ref<HTMLElement | null>(null);
    const fitStageRef = ref<HTMLElement | null>(null);
    // why: Jeff feedback (D-24505 carve-out) — the pending-choice prompt block is
    // measured so useScaleToFit can EXCLUDE its height from the fit: a response
    // prompt that temporarily grows the board is reached by scrolling at the
    // resting scale, not by shrinking (or clipping) the whole board.
    const fitPromptsRef = ref<HTMLElement | null>(null);
    const { scale: fitScale, scaledHeight: fitScaledHeight } = useScaleToFit({
      containerRef: fitContainerRef,
      stageRef: fitStageRef,
      promptsRef: fitPromptsRef,
    });
    // why: bind the computed scale as a CSS custom property so the stage's own
    // scoped CSS owns the `transform: scale()` string + `transform-origin`.
    const fitStageStyle = computed<Record<string, string>>(() => ({
      '--play-fit-scale': String(fitScale.value),
    }));
    // why: Jeff feedback (D-24505 carve-out) — reserve the FULL scaled board height
    // as the fit container's min-height, so a response prompt that grows the board
    // grows the PAGE and the whole page scrolls to reach the prompt (not an inner
    // container scroll). In normal play the scaled board is ≤ the play area, so the
    // reservation ≤ the flex height and the page does not scroll.
    const fitContainerStyle = computed<Record<string, string>>(() =>
      fitScaledHeight.value > 0
        ? { 'min-height': `${fitScaledHeight.value}px` }
        : {},
    );

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

    // why (Jeff feedback): at game over the outcome/score panel is the primary
    // view — the huge scoring breakdown, not the now-inert board. So the shared
    // board is COLLAPSED by default at game over and revealed on demand via the
    // "View final board" toggle (isBoardExpandedAtGameOver). This does NOT undo
    // the EC-183 inspectability contract: the board is one click away, not gone,
    // so a viewer who watched an autoplay match to completion can still open it
    // and click the opponents' `Victory: N ▼` buttons to read the final piles.
    // During the play phase the board always renders (never collapsed).
    //
    // (gameover transitions `phase` from 'play' → 'end' — or nulls it in some
    // boardgame.io v0.50 codepaths — so the gate keys off isGameOver, not phase.)
    const isBoardExpandedAtGameOver = ref<boolean>(false);
    const boardVisible = computed<boolean>(
      () =>
        isPlayPhase.value ||
        (isGameOver.value && isBoardExpandedAtGameOver.value),
    );

    /** Flip the game-over board between collapsed (outcome-primary) and open. */
    function toggleGameOverBoard(): void {
      isBoardExpandedAtGameOver.value = !isBoardExpandedAtGameOver.value;
    }

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

    // why: WP-663 / D-24474 — derived from UIState.pendingPlayVillainTop !== undefined.
    // Passed to TurnActionBar to block end-turn and pass-priority at EVERY stage while a
    // Shadowed Thoughts play-top-Villain-Deck choice is pending (board frozen, mirrors
    // hasPendingDrawOrEmpowered).
    const hasPendingPlayVillainTop = computed<boolean>(
      () => snapshot.value?.pendingPlayVillainTop !== undefined,
    );

    // why: WP-676 / D-24492 — derived from UIState.pendingSmashDiscard !== undefined.
    // Passed to TurnActionBar to block end-turn and pass-priority at EVERY stage while a
    // Smash discard-for-attack choice is pending (board frozen, mirrors hasPendingPlayVillainTop).
    // why: WP-681 / D-24498 — derived from UIState.pendingDoOver !== undefined.
    const hasPendingDoOver = computed<boolean>(
      () => snapshot.value?.pendingDoOver !== undefined,
    );
    const hasPendingSmashDiscard = computed<boolean>(
      () => snapshot.value?.pendingSmashDiscard !== undefined,
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
    // why: WP-498 / D-24301 — derived from UIState.pendingReturnOnDiscard !== undefined.
    // Passed to TurnActionBar to gate End Turn / Pass Priority while the OPTIONAL
    // return-on-discard choice is pending (board frozen).
    const hasPendingReturnOnDiscard = computed<boolean>(
      () => snapshot.value?.pendingReturnOnDiscard !== undefined,
    );
    // why: WP-470 / D-24282 — derived from UIState.pendingScryKoChoice !== undefined.
    // Passed to TurnActionBar to block end-turn and pass-priority at EVERY stage while a
    // Doombot scry-KO choice is pending (board frozen, mirrors hasPendingKoChoice).
    const hasPendingScryKoChoice = computed<boolean>(
      () => snapshot.value?.pendingScryKoChoice !== undefined,
    );
    // why: WP-603 / D-24413 — derived from UIState.pendingMelterKoChoice !== undefined.
    // Passed to TurnActionBar to block end-turn and pass-priority at EVERY stage while a
    // Melter Fight KO/keep choice is pending (board frozen, mirrors hasPendingScryKoChoice).
    const hasPendingMelterKoChoice = computed<boolean>(
      () => snapshot.value?.pendingMelterKoChoice !== undefined,
    );
    // why: WP-695 / D-24512 — derived from UIState.pendingRuthlessDictatorChoice !== undefined.
    // Passed to TurnActionBar to block end-turn / pass-priority at EVERY stage while a Ruthless
    // Dictator scry-3 choice is pending (board frozen, mirrors hasPendingMelterKoChoice).
    const hasPendingRuthlessDictatorChoice = computed<boolean>(
      () => snapshot.value?.pendingRuthlessDictatorChoice !== undefined,
    );
    // why: WP-695 / D-24512 — derived from UIState.pendingElectromagneticBubbleChoice !== undefined.
    // Passed to TurnActionBar to block end-turn / pass-priority at EVERY stage while an
    // Electromagnetic Bubble X-Men pick is pending (board frozen, mirrors hasPendingScryKoChoice).
    const hasPendingElectromagneticBubbleChoice = computed<boolean>(
      () => snapshot.value?.pendingElectromagneticBubbleChoice !== undefined,
    );
    // why: WP-477 / WP-476 — derived from UIState.pendingDiscardChoice !== undefined. Passed to
    // TurnActionBar to block end-turn and pass-priority at EVERY stage while a Magneto
    // discard-to-limit choice is pending (board frozen, mirrors hasPendingScryKoChoice).
    const hasPendingDiscardChoice = computed<boolean>(
      () => snapshot.value?.pendingDiscardChoice !== undefined,
    );
    // why: WP-538 / D-24347 — derived from UIState.pendingPutCardsOnDeckChoice !== undefined.
    // Passed to TurnActionBar to block end-turn and pass-priority at EVERY stage while a core
    // Dr. Doom put-cards-on-deck choice is pending (board frozen, mirrors hasPendingDiscardChoice).
    const hasPendingPutCardsOnDeckChoice = computed<boolean>(
      () => snapshot.value?.pendingPutCardsOnDeckChoice !== undefined,
    );
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
    // why: WP-693 / D-24510 — derived from UIState.pendingKoDiscardChoice !== undefined. Passed to
    // TurnActionBar to block end-turn and pass-priority at EVERY stage while a Loki Maniacal Tyrant
    // KO-from-discard choice is pending (board frozen, mirrors hasPendingDefeatChoice).
    const hasPendingKoDiscardChoice = computed<boolean>(
      () => snapshot.value?.pendingKoDiscardChoice !== undefined,
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
      fitContainerRef,
      fitStageRef,
      fitPromptsRef,
      fitStageStyle,
      fitContainerStyle,
      isLobbyPhase,
      isPlayPhase,
      boardVisible,
      isBoardExpandedAtGameOver,
      toggleGameOverBoard,
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
      hasPendingPlayVillainTop,
      hasPendingSmashDiscard,
      hasPendingDoOver,
      hasPendingVictoryPileCardPick,
      hasPendingOptionalPutBottomHQ,
      hasPendingPutAnyNumberBottomHQ,
      hasPendingReturnZeroCostDiscard,
      hasPendingDiscardToPlay,
      hasPendingReturnOnDiscard,
      hasPendingScryKoChoice,
      hasPendingMelterKoChoice,
      hasPendingRuthlessDictatorChoice,
      hasPendingElectromagneticBubbleChoice,
      hasPendingDiscardChoice,
      hasPendingPutCardsOnDeckChoice,
      hasPendingReorderChoice,
      hasPendingDefeatChoice,
      hasPendingKoDiscardChoice,
      hasPendingGiveHqHeroChoice,
      hasPendingCopyPowersChoice,
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
      <!-- why: WP-688 / D-24502 lock 1 — the fit container is the viewport box;
           the stage is the board authored at the fixed 1280×720 floor and scaled
           to fit (transform: scale in <style>). The container reserves only the
           SCALED height (fitContainerStyle) so the page never scrolls, and the
           stage's board-scoped --card-width-* / gutter override (in <style>)
           compacts the desktop board without touching the shared :root tokens or
           <PlayMobile>. Everything WP-685 shipped lives unchanged inside the stage. -->
      <div class="play-desktop__fit" ref="fitContainerRef" :style="fitContainerStyle">
        <div class="play-desktop__stage" ref="fitStageRef" :style="fitStageStyle">
      <TopHudBar
        :snapshot="snapshot"
        :mastermind-tactics-total="snapshot.mastermind.tacticsRemaining + snapshot.mastermind.tacticsDefeated"
        :villain-group-ids="villainGroupIds"
        :henchman-group-ids="henchmanGroupIds"
        :hero-deck-ids="heroDeckIds"
      />
      <EndgameSummary
        v-if="isGameOver && snapshot.gameOver"
        :game-over="snapshot.gameOver"
        :competitive-score="competitiveScore"
        :show-guest-sign-in="showGuestSignIn"
      />
      <!-- why (Jeff feedback): at game over the outcome panel above is the primary
           view; the now-inert board is collapsed by default and revealed on demand.
           The board stays one click away (EC-183 inspectability preserved) — this
           button only controls whether it renders below the outcome summary. -->
      <div v-if="isGameOver" class="play-desktop__board-toggle">
        <button
          type="button"
          data-testid="play-gameover-board-toggle"
          :aria-expanded="isBoardExpandedAtGameOver ? 'true' : 'false'"
          @click="toggleGameOverBoard"
        >
          {{ isBoardExpandedAtGameOver ? 'Hide final board ▲' : 'View final board ▼' }}
        </button>
      </div>
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
        <!-- why: WP-685 / D-24502 — the spatial board is a two-column grid: the
             shared board + player cockpit in the main column, the opponent panels
             and game log in a right RAIL. Moving opponents + log off the main
             column is what reclaims the vertical height the old flex stack spent,
             so the dense City / HQ / hand rows fit the 1280×720 authoring floor.
             Scale-up across the resolution ladder comes from the fluid --card-width-*
             tokens (WP-430); zones never rewrap into a different arrangement. -->
        <div class="play-desktop__grid">
          <div class="play-desktop__main">
            <!-- why: WP-685 / D-24502 — the adversary band groups the Mastermind,
                 the Scheme, the shared supply decks, and the shared KO pile into one
                 fixed top strip (the physical Legendary mat's adversary row); the
                 shared decks + KO used to drift into the opponent / scheme columns. -->
            <section class="play-desktop__adversary-band">
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
                <SchemeTile :scheme="snapshot.scheme" :twist-threshold="snapshot.progress.schemeTwistThreshold" @read="onCardRead" />
                <SchemeTwistPile
                  :pile="snapshot.scheme.twistPile"
                  @open="onPileOpen"
                />
              </div>
              <SharedDecks
                :piles="snapshot.piles"
                :current-stage="snapshot.game.currentStage"
                :is-viewer-turn="isViewerTurn"
                :economy="snapshot.economy"
                :submit-move="submitMove"
              />
              <KOPile :ko-pile="snapshot.koPile" @open="onPileOpen" />
            </section>
            <CityRow
              :city="snapshot.city"
              :decks="snapshot.decks"
              :current-stage="snapshot.game.currentStage"
              :is-viewer-turn="isViewerTurn"
              :economy="snapshot.economy"
              :submit-move="submitMove"
            />
            <!-- why: WP-664 / D-24475 — the face-up Transform side deck sits to the
                 RIGHT of the HQ (it holds the second-forms some HQ heroes transform
                 into). The deck bounds its own width and scrolls horizontally, so a
                 large side deck never pushes the layout. It hides itself when empty,
                 so this row reads as a plain HQ for non-transform games. -->
            <div class="play-desktop__hq-zone">
              <HQRow
                :hq="snapshot.hq"
                :decks="snapshot.decks"
                :current-stage="snapshot.game.currentStage"
                :is-viewer-turn="isViewerTurn"
                :economy="snapshot.economy"
                :submit-move="submitMove"
              />
              <TransformDeck :transform-deck="snapshot.transformDeck ?? []" />
            </div>
            <!-- why: the personal zone (own hand / economy / deck / victory) and the
                 turn-action bar require an identified viewer. They are hidden for a
                 spectator or rewound-autoplay frame (viewer null) while the shared
                 board above stays visible. -->
            <template v-if="viewer !== null">
              <!-- why: WP-685 / D-24502 — the cockpit is two columns: the card
                   lifecycle (played above hand) on the left, your economy + deck /
                   discard / victory piles on the right; the piles used to drift into
                   the scheme column. -->
              <section class="play-desktop__player-zone">
                <div class="play-desktop__cockpit-main">
                  <PlayedCardsRow
                    :in-play-cards="viewer.inPlayCards ?? []"
                    :in-play-display="viewer.inPlayDisplay"
                    :current-stage="snapshot.game.currentStage"
                    :is-viewer-turn="isViewerTurn"
                  />
                  <HandRow
                    :hand-cards="viewer.handCards ?? []"
                    :hand-display="viewer.handDisplay"
                    :current-stage="snapshot.game.currentStage"
                    :is-viewer-turn="isViewerTurn"
                    :submit-move="submitMove"
                  />
                </div>
                <div class="play-desktop__cockpit-side">
                  <EconomyBar :economy="snapshot.economy" />
                  <div class="play-desktop__victory-deck-stack">
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
          <!-- why: Jeff feedback (D-24505 scale carve-out) — the pending-choice
               prompts are wrapped so useScaleToFit EXCLUDES their height from the
               fit. A response prompt that temporarily grows the board is reached
               by SCROLLING at the resting scale (the fit container is
               overflow-y:auto), instead of the board shrinking to cram it in or
               clipping it out of reach. The engine block-all guarantee means at
               most one prompt renders at a time; DOM order (KO above hero, both
               above TurnActionBar) is preserved by keeping the wrapper here. -->
          <div class="play-desktop__prompts" ref="fitPromptsRef">
          <!-- why: D-24012 + WP-243 — the KO prompt renders ABOVE the hero-choice
               prompt (higher urgency — full board freeze) and both render above
               TurnActionBar in DOM order. Appears only for the choosing player
               when pendingKoHeroChoice is set. NOT a modal; normal document flow. -->
          <PendingKoHeroChoicePrompt
            :pending-ko-hero-choice="snapshot.pendingKoHeroChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-470 / D-24282 — the Doombot scry-KO prompt renders above
               TurnActionBar in DOM order; appears only for the choosing player when
               pendingScryKoChoice is set. NOT a modal; normal document flow. The
               block-all guard guarantees at most one pending-choice type is set. -->
          <PendingScryKoChoicePrompt
            :pending-scry-ko-choice="snapshot.pendingScryKoChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-603 / D-24413 — the Melter Fight KO/keep prompt renders above
               TurnActionBar in DOM order; appears only for the fighting player when
               pendingMelterKoChoice is set. NOT a modal; normal document flow. The
               block-all guard guarantees at most one pending-choice type is set. -->
          <PendingMelterKoChoicePrompt
            :pending-melter-ko-choice="snapshot.pendingMelterKoChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-695 / D-24512 — the Ruthless Dictator scry-3 prompt; appears only for
               the choosing player when pendingRuthlessDictatorChoice is set. Normal flow. -->
          <PendingRuthlessDictatorChoicePrompt
            :pending-ruthless-dictator-choice="snapshot.pendingRuthlessDictatorChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-695 / D-24512 — the Electromagnetic Bubble X-Men pick prompt; appears
               only for the choosing player when pendingElectromagneticBubbleChoice is set. -->
          <PendingElectromagneticBubbleChoicePrompt
            :pending-electromagnetic-bubble-choice="snapshot.pendingElectromagneticBubbleChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-476 / D-24284 — the Magneto discard-to-limit prompt renders above
               TurnActionBar in DOM order; appears only for the choosing player when
               pendingDiscardChoice is set. NOT a modal; normal document flow. The
               block-all guard guarantees at most one pending-choice type is set. -->
          <PendingDiscardChoicePrompt
            :pending-discard-choice="snapshot.pendingDiscardChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-538 / D-24347 — the core Dr. Doom put-cards-on-deck prompt ("put 2
               cards on top of your deck") renders above TurnActionBar in DOM order; appears
               only for the choosing player when pendingPutCardsOnDeckChoice is set. NOT a
               modal; normal document flow. The block-all guard guarantees at most one
               pending-choice type is set. -->
          <PendingPutCardsOnDeckChoicePrompt
            :pending-put-cards-on-deck-choice="snapshot.pendingPutCardsOnDeckChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-479 / D-24286 — the reveal-remainder reorder prompt ("put the rest
               back in any order") renders above TurnActionBar in DOM order; appears only
               for the choosing player when pendingReorderChoice is set. NOT a modal; normal
               document flow. The block-all guard guarantees at most one pending-choice
               type is set. -->
          <PendingReorderChoicePrompt
            :pending-reorder-choice="snapshot.pendingReorderChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-486 / D-24291 — the Silent Sniper defeat-with-a-Bystander prompt
               ("Defeat a Villain or Mastermind that has a Bystander") renders above
               TurnActionBar in DOM order; appears only for the choosing player when
               pendingDefeatChoice is set. NOT a modal; normal document flow. The block-all
               guard guarantees at most one pending-choice type is set. -->
          <PendingDefeatChoicePrompt
            :pending-defeat-choice="snapshot.pendingDefeatChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-693 / D-24510 — the KO-from-discard prompt (Loki's Maniacal Tyrant)
               renders above TurnActionBar; appears only for the choosing player when
               pendingKoDiscardChoice is set. NOT a modal; normal document flow. -->
          <PendingKoDiscardChoicePrompt
            :pending-ko-discard-choice="snapshot.pendingKoDiscardChoice"
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
          <!-- why: WP-676 / D-24492 — the Smash discard-for-attack prompt; appears only for
               the choosing player when pendingSmashDiscard is set. Same block-all posture as
               the optional-KO-reward prompt above. NOT a modal; normal document flow. -->
          <SmashDiscardPrompt
            :pending-smash-discard="snapshot.pendingSmashDiscard"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-681 / D-24498 — the Do-Over accept/decline prompt; appears only for
               the choosing player when pendingDoOver is set. Same block-all posture as the
               Smash prompt above. NOT a modal; normal document flow. -->
          <DoOverPrompt
            :pending-do-over="snapshot.pendingDoOver"
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
          <!-- why: WP-675 / D-24490 — the count-scaled choose-one prompt (vnom Symbiotic
               Adaptation); appears only for the choosing player when pendingCountScaledChoice
               is set. Same block-all posture as the draw-or-empowered prompt above. -->
          <CountScaledChoicePrompt
            :pending-count-scaled-choice="snapshot.pendingCountScaledChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-678/679 / D-24494/D-24495 — the Undercover target pick (send which
               [team:shield] Hero); appears only for the choosing player when
               pendingUndercoverChoice is set (≥2 eligible), incl. the nested pick from the
               shld mixed choose-one's Undercover option. Same block-all posture. -->
          <UndercoverChoicePrompt
            :pending-undercover-choice="snapshot.pendingUndercoverChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-684 / D-24501 — the non-active/multi-seat pending-choice prompt
               (foundational scaffold; the concrete card renderers ship with WP-682 / WP-683).
               Appears for an addressed, still-outstanding seat — INCLUDING a NON-ACTIVE seat —
               because the engine per-seat audience filter redacts the projection to only this
               seat's own prompt. Same block-all posture as the prompts above. -->
          <PendingSeatChoicePrompt
            :pending-seat-choice="snapshot.pendingSeatChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-663 / D-24474 — the Shadowed Thoughts play-top-Villain-Deck prompt
               renders above TurnActionBar in DOM order; appears only for the choosing player
               when pendingPlayVillainTop is set. NOT a modal; normal document flow. The
               engine block-all guard guarantees at most one pending-choice type is set. -->
          <PlayVillainTopPrompt
            :pending-play-villain-top="snapshot.pendingPlayVillainTop"
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
          <!-- why: WP-498 / D-24301 — the optional return-on-discard prompt (Cyclops
               Unending Energy) renders above TurnActionBar in DOM order; appears only for
               the choosing player when pendingReturnOnDiscard is set. Normal doc flow. -->
          <ReturnOnDiscardPrompt
            :pending-return-on-discard="snapshot.pendingReturnOnDiscard"
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
          <!-- why: WP-532 / D-24343 — the Paibok Fight give-HQ-Hero prompt renders above
               TurnActionBar in DOM order; appears only for the choosing player when
               pendingGiveHqHeroChoice is set. NOT a modal; normal document flow. The
               block-all guard guarantees at most one pending-choice type is set. -->
          <PendingGiveHqHeroChoicePrompt
            :pending-give-hq-hero-choice="snapshot.pendingGiveHqHeroChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          <!-- why: WP-535 / D-24345 — the Rogue Copy Powers copy-a-Hero prompt renders above
               TurnActionBar in DOM order; appears only for the choosing player when
               pendingCopyPowersChoice is set. NOT a modal; normal document flow. The
               block-all guard guarantees at most one pending-choice type is set. -->
          <PendingCopyPowersChoicePrompt
            :pending-copy-powers-choice="snapshot.pendingCopyPowersChoice"
            :viewer-player-id="viewer.playerId"
            :submit-move="submitMove"
          />
          </div><!-- /.play-desktop__prompts (Jeff feedback — excluded from the fit; scrolls) -->
          <TurnActionBar
            :current-stage="snapshot.game.currentStage"
            :is-viewer-turn="isViewerTurn"
            :has-pending-choice="hasPendingChoice"
            :has-pending-ko-choice="hasPendingKoChoice"
            :has-pending-optional-ko-reward="hasPendingOptionalKoReward"
            :has-pending-draw-or-empowered="hasPendingDrawOrEmpowered"
            :has-pending-play-villain-top="hasPendingPlayVillainTop"
            :has-pending-smash-discard="hasPendingSmashDiscard"
            :has-pending-do-over="hasPendingDoOver"
            :has-pending-victory-pile-card-pick="hasPendingVictoryPileCardPick"
            :has-pending-optional-put-bottom-h-q="hasPendingOptionalPutBottomHQ"
            :has-pending-put-any-number-bottom-h-q="hasPendingPutAnyNumberBottomHQ"
            :has-pending-return-zero-cost-discard="hasPendingReturnZeroCostDiscard"
            :has-pending-discard-to-play="hasPendingDiscardToPlay"
            :has-pending-return-on-discard="hasPendingReturnOnDiscard"
            :has-pending-scry-ko-choice="hasPendingScryKoChoice"
            :has-pending-melter-ko-choice="hasPendingMelterKoChoice"
            :has-pending-ruthless-dictator-choice="hasPendingRuthlessDictatorChoice"
            :has-pending-electromagnetic-bubble-choice="hasPendingElectromagneticBubbleChoice"
            :has-pending-discard-choice="hasPendingDiscardChoice"
            :has-pending-put-cards-on-deck-choice="hasPendingPutCardsOnDeckChoice"
            :has-pending-reorder-choice="hasPendingReorderChoice"
            :has-pending-defeat-choice="hasPendingDefeatChoice"
            :has-pending-ko-discard-choice="hasPendingKoDiscardChoice"
            :has-pending-give-hq-hero-choice="hasPendingGiveHqHeroChoice"
            :has-pending-copy-powers-choice="hasPendingCopyPowersChoice"
            :has-wound-in-hand="hasWoundInHand"
            :has-acted-this-turn="snapshot.game.hasActedThisTurn"
            :has-healed-this-turn="snapshot.game.hasHealedThisTurn"
            :has-revealed-villain="snapshot.game.villainRevealedThisTurn"
            :submit-move="submitMove"
          />
        </template>
            <!-- why: D-12908 — pre-plan affordance slot reserved for WP-059;
                 this page declares the slot only. WP-059 owns the integration
                 shape. -->
            <slot name="preplan-affordance" />
          </div>
          <!-- why: WP-685 / D-24502 — the right rail holds the opponent panels and
               the game log, off the main board column. Both render for spectators
               (outside the viewer!==null gate) so a rewound/audience frame still
               shows opponents + the log. Moving them here is what reclaims the
               vertical height the old flex stack spent. -->
          <aside class="play-desktop__rail" data-testid="play-desktop-rail">
            <div class="play-desktop__opponents" data-testid="play-desktop-opponents">
              <OpponentPanel
                v-for="opponent in opponents"
                :key="opponent.playerId"
                :player="opponent"
              />
            </div>
            <!-- why: WP-318 — the persistent game log (G.messages -> UIState.log)
                 rendered live; previously replay-only. Read-only projection — the
                 engine owns log authorship (D-20002). -->
            <section class="play-desktop__log" data-testid="play-desktop-log">
              <h2 class="play-desktop__log-heading">Game Log</h2>
              <GameLogPanel :log="snapshot.log" />
            </section>
          </aside>
        </div>
      </template>
        </div><!-- /.play-desktop__stage (WP-688) -->
      </div><!-- /.play-desktop__fit (WP-688) -->
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
  /* why: WP-688 / D-24502 lock 1 — fill the play area (the flex gap the desktop
     .play-viewport now occupies between the brand header and footer) so the fit
     container below gets a definite height to scale the board into, instead of
     the board's own content height overflowing the page. min-height:0 lets it
     shrink inside the flex parent. */
  flex: 1 1 auto;
  min-height: 0;
  /* why: WP-688 — as a flex-column item whose only in-flow descendant (the stage)
     is absolutely positioned, the column has no intrinsic width; pin it to the
     full container width so the fit box keeps its width (the cap + auto margins
     below still center it). */
  width: 100%;
  /* why: WP-430 / D-24251 (retained by WP-685) — cap the desktop play area at
     --play-max-width and center it so ultra-wide / 4K monitors gain margin, not
     oversized cards. The fluid --play-gutter sits INSIDE the cap. */
  max-width: var(--play-max-width);
  margin-inline: auto;
  padding-inline: var(--play-gutter);
  /* why: minimal padding — the sticky TurnActionBar overlaps the bottom of the
     page; this just keeps the last content line from being fully hidden. */
  padding-bottom: 0.25rem;
}

/* why: WP-688 / D-24502 lock 1 — the fit container is the viewport-sized box the
   board is scaled to fit. Its height is set inline to the SCALED stage height
   (fitContainerStyle) so the page reserves only the scaled box — the stage is
   taken out of flow (absolute), so without this the page would reserve the full
   unscaled height and still scroll. position: relative anchors the absolute stage. */
.play-desktop__fit {
  position: relative;
  width: 100%;
  /* why: WP-688 — fill the play-desktop column so clientHeight is the real space
     the board has; useScaleToFit measures this box directly (no viewport math). */
  flex: 1 1 auto;
  min-height: 0;
  /* why: Jeff feedback (D-24505 carve-out) — overflow:visible + the min-height
     reservation (:style="fitContainerStyle" = the full scaled board height) means a
     pending-choice prompt that grows the board grows the PAGE, so the whole page
     scrolls to reach it (not an inner container scroll), at the resting scale. In
     normal play the reserved height ≤ the play area, so the page does not scroll.
     The board is width-fit, so it never overflows sideways. */
  overflow: visible;
}

/* why (Jeff feedback): the game-over "View final board" toggle. Centered under the
   outcome summary; a quiet control since the outcome panel is the focus. */
.play-desktop__board-toggle {
  display: flex;
  justify-content: center;
  padding: 0.35rem 0;
}

.play-desktop__board-toggle button {
  padding: 0.3rem 0.9rem;
  border-radius: 0.4rem;
  border: 1px solid var(--color-foreground, #999);
  background: transparent;
  color: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.play-desktop__board-toggle button:hover {
  background: rgba(128, 128, 128, 0.15);
}

/* why: Jeff feedback — the pending-choice prompt block. Empty (no prompt) it is 0
   height and invisible; its height is excluded from the scale-to-fit so an active
   response prompt scrolls into view at the resting scale rather than shrinking the
   board. Keep the prompts spaced as before (they were direct flex children). */
.play-desktop__prompts {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

/* why: WP-688 / D-24502 lock 1 — the authoring stage. The board is laid out at a
   FIXED width (--play-authoring-width, the 1280 floor) and scaled by --play-fit-scale
   (computed live by useScaleToFit) about its top-center, so it fits the viewport
   with no page scroll and scales UP (never rewraps) on wider / taller screens —
   the JS fit supersedes the per-width scale media queries the fluid model used.
   left:50% + translateX(-50%) centers it; transform-origin keeps it top-anchored
   and centered as it scales. It is absolutely positioned so its unscaled layout
   height never reaches page flow (the container reserves the scaled height).
   why the --card-width-* / --play-gutter override: the desktop board is DENSER
   than the shared D-12909 mobile tokens (the real tiles are ~2× the Rev-4 mock),
   so compact them here — scoped to the stage, this cascades by CSS-variable
   inheritance only to the desktop board's descendants; the shared :root token
   values and the entire <PlayMobile> subtree (a sibling, never a descendant) are
   byte-unchanged. Moderate compaction keeps the live scale readable (~0.75× at 1280). */
.play-desktop__stage {
  position: absolute;
  top: 0;
  left: 50%;
  width: var(--play-authoring-width);
  transform: translateX(-50%) scale(var(--play-fit-scale, 1));
  transform-origin: top center;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  /* Board-scoped compaction (authoring-space constants; scaled visually above). */
  --card-width-sm: 54px;
  --card-width-md: 80px;
  --card-width-lg: 108px;
  --play-gutter: 10px;
}

/* why: WP-689 / D-24506 — the TurnActionBar is `position: sticky; bottom: 0`
   (TurnActionBar.vue). Inside this scaled, absolutely-positioned stage a
   `transform` ancestor becomes the sticky containing block, so `bottom: 0` pins
   the bar mid-stage and it overlaps the cockpit (played row / economy / victory
   pile) — the WP-688 regression the full-res 1280×720 shot caught. The fitted
   board never page-scrolls, so sticky has no job here: pin the bar to normal flow
   so it sits at the bottom of the cockpit. Stage-scoped via :deep() so
   TurnActionBar.vue is untouched and keeps its sticky behaviour on <PlayMobile>
   and any non-fit surface. */
.play-desktop__stage :deep(.turn-action-bar) {
  position: static;
}

/* why: WP-685 / D-24502 — the spatial board is a two-column grid: the shared
   board + player cockpit in the main column, the opponent panels + game log in a
   fixed-width right RAIL. The rail reclaims the vertical height the old vertical
   flex stack spent, so the dense City / HQ / hand rows fit the 1280×720 authoring
   floor. Scale-up across the resolution ladder comes from the fluid --card-width-*
   tokens (WP-430); zones never rewrap into a different arrangement. */
.play-desktop__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--play-rail-width);
  gap: 0.5rem;
  align-items: start;
}

.play-desktop__main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

/* why: the rail scrolls its OWN overflow (a long opponent list or log) in-zone
   rather than growing the board past the viewport — in-zone scroll, never page
   scroll (D-24502 lock 1). It sticks so it stays in view as the main column
   scrolls during a tall pending-choice prompt. */
.play-desktop__rail {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  position: sticky;
  top: 0.25rem;
  max-height: 100vh;
  overflow-y: auto;
}

/* why: WP-685 / D-24502 — the adversary band groups Mastermind + Scheme + shared
   supply + KO into one fixed top strip (the physical mat's adversary row).
   why: nowrap (Jeff feedback) — keep all four clusters on ONE line so the shared
   supply decks + KO fill the space to the RIGHT of the Scheme rather than wrapping
   to a second row below it. Removing that wrapped row makes the board shorter, so
   useScaleToFit (WP-688 / D-24505) scales the whole board a touch larger. The
   SharedDecks flex-fills the gap between the Scheme and the KO pile. */
.play-desktop__adversary-band {
  display: flex;
  gap: 0.5rem;
  flex-wrap: nowrap;
  align-items: flex-start;
}

.play-desktop__adversary-band > .shared-decks {
  flex: 1 1 auto;
  min-width: 0;
}

/* why: keep each tile/pile at its own height rather than stretching it to the
   tallest neighbour in the band. */
.play-desktop__mastermind-zone,
.play-desktop__scheme-zone {
  display: flex;
  gap: 0.35rem;
  align-items: flex-start;
}

/* why: WP-664 — HQ on the left, the Transform side deck to its right; the deck
   takes the remaining space and scrolls horizontally within it (min-width:0 lets
   the flex child shrink below its content so its own overflow-x engages). */
.play-desktop__hq-zone {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.play-desktop__hq-zone > .transform-deck {
  min-width: 0;
  flex: 1 1 auto;
}

/* why: WP-685 / D-24502 — the cockpit is two columns: the played + hand wells on
   the left, the economy + your deck/discard/victory piles on the right (the piles
   used to drift into the scheme column). */
.play-desktop__player-zone {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: start;
  border-top: 1px solid var(--color-foreground, #999);
  padding-top: 0.25rem;
}

.play-desktop__cockpit-main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.play-desktop__cockpit-side {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.play-desktop__victory-deck-stack {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.play-desktop__log {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-height: 0;
}

.play-desktop__log-heading {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
}

/* why: WP-685 — in the rail the opponent panels stack vertically (the rail is a
   narrow column), not the old wrapping row. */
.play-desktop__opponents {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.play-empty-match {
  padding: 0.75rem 1rem;
  border: 1px dashed var(--color-foreground, #666);
}

/* why: WP-430 / D-24502 scale-up checkpoints — more inter-zone breathing room as
   the surface widens. Spacing tuning only; zones keep their D-24502 grid
   arrangement (no rewrap). */
@media (min-width: 1440px) {
  .play-desktop__grid { gap: 0.6rem; }
}

@media (min-width: 1920px) {
  .play-desktop__grid { gap: 0.75rem; }
}
</style>
