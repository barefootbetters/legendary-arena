<script lang="ts">
import { defineComponent, ref, watch, type PropType } from 'vue';
import { useTurnActions } from '../../composables/useTurnActions';
import type { GatingResult } from '../../composables/useCardCostGating';
import { WOUND_EXT_ID } from './woundIdentity';
import type { SubmitMove } from './uiMoveName.types';

/**
 * Turn-actions panel — 3-step structure rewrite per
 * `DESIGN-BOARD-LAYOUT.md §5.1` and EC-132 §2 move table:
 *
 *   Step 1 (`play.start`)   → Reveal villain (revealVillainCard)
 *   Step 2 (`play.main`)    → Play / Recruit / Fight (handled by sibling
 *                              children HandRow / CityRow / HQRow /
 *                              MastermindTile via their own click
 *                              affordances; the panel exposes a
 *                              "Pass priority" affordance that fires
 *                              advanceStage to move to cleanup)
 *   Step 3 (`play.cleanup`) → End turn (endTurn) — discard hand + draw 6
 *
 * Pass-priority button fires `advanceStage` per D-10011 (canonical
 * stage-advance vocabulary; NOT a no-op). Per pre-flight PS-5 2026-05-04.
 *
 * Per the EC-132 §2 SFC authoring whitelist: this is a tested non-leaf
 * composer that USES a composable, so it MUST use
 * `defineComponent({ setup() { return {...} } })` per P6-30 / P6-46 /
 * D-6512.
 *
 * @see WP-129 §Acceptance Criteria — 3-step turn structure
 * @see DESIGN-BOARD-LAYOUT.md §5.1
 * @see EC-132 §2 move table — Pass-priority → advanceStage
 * @see DECISIONS.md D-10011 advanceStage canonical
 */
export default defineComponent({
  name: 'TurnActionBar',
  props: {
    currentStage: {
      type: String,
      required: true,
    },
    isViewerTurn: {
      type: Boolean,
      required: false,
      default: true,
    },
    submitMove: {
      type: Function as PropType<SubmitMove>,
      required: true,
    },
    // why (Jeff feedback): the viewer's own hand (CardExtId strings). Feeds the
    // "Play Hand" convenience button — one click plays every playable (non-Wound)
    // card — and gates Pass priority at the main stage until the hand is emptied of
    // playable cards. Defaults to [] so display-only / non-viewer mounts add no
    // play affordance and never block Pass priority.
    handCards: {
      type: Array as PropType<readonly string[]>,
      required: false,
      default: () => [],
    },
    // why: D-22203 — derived from UIState.pendingHeroChoice !== undefined at
    // the page level; passed down so TurnActionBar can block end-turn and
    // pass-priority at cleanup while the player has an unresolved choice.
    hasPendingChoice: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: D-24012 — derived from UIState.pendingKoHeroChoice !== undefined at
    // the page level; passed down so TurnActionBar blocks end-turn and
    // pass-priority at EVERY stage while a KO-a-Hero choice is pending (the KO
    // choice freezes the board, unlike the cleanup-only hero-reveal gate).
    hasPendingKoChoice: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: D-24020 — derived from UIState.pendingOptionalKoReward !== undefined at
    // the page level; passed down so TurnActionBar blocks end-turn and
    // pass-priority at EVERY stage while an optional-KO-then-reward choice is
    // pending (mirrors hasPendingKoChoice — WP-248's block-all guard freezes the
    // board until the player KOs a card or Declines).
    hasPendingOptionalKoReward: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: D-24071 — derived from UIState.pendingDrawOrEmpowered !== undefined at the
    // page level; passed down so TurnActionBar blocks end-turn and pass-priority at EVERY
    // stage while a draw-or-empowered choice is pending (WP-286's block-all guard freezes
    // the board, mirroring hasPendingOptionalKoReward).
    hasPendingDrawOrEmpowered: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-663 / D-24474 — derived from UIState.pendingPlayVillainTop !== undefined at
    // the page level; passed down so TurnActionBar blocks end-turn and pass-priority at
    // EVERY stage while a Shadowed Thoughts play-top-Villain-Deck choice is pending (the
    // engine block-all guard freezes the board, mirroring hasPendingDrawOrEmpowered).
    hasPendingPlayVillainTop: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-676 / D-24492 — derived from UIState.pendingSmashDiscard !== undefined at the
    // page level; passed down so TurnActionBar blocks end-turn and pass-priority at EVERY
    // stage while a Smash discard-for-attack choice is pending (the engine block-all guard
    // freezes the board, mirroring hasPendingPlayVillainTop).
    hasPendingSmashDiscard: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-681 / D-24498 — derived from UIState.pendingDoOver !== undefined at the page
    // level; passed down so TurnActionBar blocks end-turn and pass-priority at EVERY stage
    // while a Do-Over accept/decline choice is pending (the engine block-all guard freezes
    // the board, mirroring hasPendingSmashDiscard).
    hasPendingDoOver: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-693 / D-24510 — derived from UIState.pendingKoDiscardChoice !== undefined at
    // the page level; passed down so TurnActionBar blocks end-turn and pass-priority at
    // EVERY stage while a Loki Maniacal Tyrant KO-from-discard choice is pending (the
    // engine's block-all guard set freezes the board, mirroring hasPendingDefeatChoice).
    hasPendingKoDiscardChoice: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-695 / D-24512 — derived from UIState.pendingRuthlessDictatorChoice !== undefined
    // at the page level; passed down so TurnActionBar blocks end-turn / pass-priority at EVERY
    // stage while a Ruthless Dictator scry-3 choice is pending (the engine's full block-all
    // guard set freezes the board). Threaded LAST into the useTurnActions calls.
    hasPendingRuthlessDictatorChoice: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-695 / D-24512 — derived from UIState.pendingElectromagneticBubbleChoice !==
    // undefined at the page level; passed down so TurnActionBar blocks end-turn / pass-priority
    // at EVERY stage while an Electromagnetic Bubble X-Men pick is pending. Threaded LAST into
    // the useTurnActions calls (after hasPendingRuthlessDictatorChoice).
    hasPendingElectromagneticBubbleChoice: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-313 / D-24099 — derived from UIState.pendingVictoryPileCardPick !== undefined
    // at the page level; passed down so TurnActionBar blocks end-turn and pass-priority at
    // EVERY stage while a victory-pile villain pick is pending (WP-285's block-all guard
    // freezes the board, mirroring hasPendingDrawOrEmpowered).
    hasPendingVictoryPileCardPick: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: derived from UIState.pendingOptionalPutBottomHQ !== undefined at the page
    // level; passed down so TurnActionBar blocks end-turn and pass-priority at EVERY
    // stage while an optional-put-bottom-hq choice is pending (the engine's advanceStage
    // block-all guard freezes the board, mirroring hasPendingVictoryPileCardPick).
    hasPendingOptionalPutBottomHQ: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: D-24132 — derived from UIState.pendingPutAnyNumberBottomHQ !== undefined at the page
    // level; passed down so TurnActionBar blocks end-turn and pass-priority at EVERY stage while
    // a put-any-number-bottom-hq multi-select choice is pending (the engine's advanceStage
    // block-all guard freezes the board, mirroring hasPendingOptionalPutBottomHQ).
    hasPendingPutAnyNumberBottomHQ: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: D-24139 — derived from UIState.pendingReturnZeroCostDiscard !== undefined at the
    // page level; passed down so TurnActionBar blocks end-turn and pass-priority at EVERY
    // stage while a return-zero-cost-discard choice is pending (the engine's full block-all
    // guard set freezes the board, mirroring hasPendingKoChoice).
    hasPendingReturnZeroCostDiscard: {
      type: Boolean,
      required: false,
      default: false,
    },
    hasPendingDiscardToPlay: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-470 / D-24282 — true while a Doombot scry-KO choice is pending; blocks End
    // Turn / Pass Priority at ANY stage (the engine's full block-all guard freezes the
    // board, mirroring hasPendingKoChoice).
    hasPendingScryKoChoice: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-603 / D-24413 — true while a Melter Fight KO/keep choice is pending; blocks
    // End Turn / Pass Priority at ANY stage (the engine's full block-all guard freezes the
    // board, mirroring hasPendingScryKoChoice).
    hasPendingMelterKoChoice: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-380 — derived at the page level: hasWoundInHand from scanning the
    // viewer's handCards for the Wound ext_id (Healing KOs Wounds from hand
    // specifically); hasActedThisTurn / hasHealedThisTurn read from UIState.game.
    // Passed down so TurnActionBar can gate the Heal-Wounds button.
    hasWoundInHand: {
      type: Boolean,
      required: false,
      default: false,
    },
    hasActedThisTurn: {
      type: Boolean,
      required: false,
      default: false,
    },
    hasHealedThisTurn: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-477 / WP-476 — completes WP-476's deferred discard-gate wiring. True while a
    // Magneto discard-to-limit choice is pending; blocks End Turn / Pass Priority at ANY stage
    // (the engine's full block-all guard freezes the board, mirroring hasPendingScryKoChoice).
    // Threaded into the useTurnActions calls at its position-16 slot (last param, after the
    // heal trio) — the slot WP-476 appended it at to keep positional callers stable.
    hasPendingDiscardChoice: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-480 / D-24286 — completes WP-479's deferred reorder-gate wiring. True while a
    // reveal-remainder reorder choice is pending; blocks End Turn / Pass Priority at ANY stage
    // (the engine's full block-all guard freezes the board, mirroring hasPendingDiscardChoice).
    // Threaded into the useTurnActions calls at its position-17 slot (last param, after the
    // discard gate).
    hasPendingReorderChoice: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-486 / D-24291 — true while a Silent Sniper defeat-with-a-Bystander choice is
    // pending; blocks End Turn / Pass Priority at ANY stage (the engine's full block-all guard
    // freezes the board, mirroring hasPendingReorderChoice). Threaded into the useTurnActions
    // calls at its position-18 slot (last param, after the reorder gate).
    hasPendingDefeatChoice: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-498 / D-24301 — true while an OPTIONAL return-on-discard choice is pending;
    // blocks End Turn / Pass Priority at ANY stage (the engine's full block-all guard
    // freezes the board, mirroring hasPendingDefeatChoice).
    hasPendingReturnOnDiscard: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-532 / D-24343 — true while a Paibok Fight give-HQ-Hero choice is pending;
    // blocks End Turn / Pass Priority at ANY stage (the engine's full block-all guard
    // freezes the board, mirroring hasPendingReturnOnDiscard). Threaded into the
    // useTurnActions calls at its position-20 slot (last param, after the return-on-discard gate).
    hasPendingGiveHqHeroChoice: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-535 / D-24345 — true while a Rogue Copy Powers copy-a-Hero choice is pending;
    // blocks End Turn / Pass Priority at ANY stage (the engine's full block-all guard
    // freezes the board, mirroring hasPendingGiveHqHeroChoice). Threaded into the
    // useTurnActions calls at its position-21 slot (last param, after the give-HQ-Hero gate).
    hasPendingCopyPowersChoice: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-538 / D-24347 — True while a core Dr. Doom put-cards-on-deck choice is
    // pending; blocks End Turn / Pass Priority at ANY stage (the engine's full block-all
    // guard freezes the board). Threaded LAST into the useTurnActions calls (after
    // hasPendingCopyPowersChoice) to keep positional callers stable.
    hasPendingPutCardsOnDeckChoice: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: derived from UIState.game.villainRevealedThisTurn at the page level. Passed
    // down so TurnActionBar can (a) disable the Reveal button once the mandatory reveal
    // is spent, and (b) block "Pass priority" at the start stage until the villain is
    // revealed — matching the engine advanceStage reveal-first guard (game.ts) so a
    // premature Pass-priority shows a tooltip instead of a silent no-op.
    hasRevealedVillain: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  setup(props) {
    function activeStep(): 1 | 2 | 3 {
      return useTurnActions(props.currentStage, props.isViewerTurn, props.hasPendingChoice, props.hasPendingKoChoice, props.hasPendingOptionalKoReward, props.hasPendingDrawOrEmpowered, props.hasPendingVictoryPileCardPick, props.hasPendingOptionalPutBottomHQ, props.hasPendingPutAnyNumberBottomHQ, props.hasPendingReturnZeroCostDiscard, props.hasPendingDiscardToPlay).activeStep;
    }

    // why: canRevealVillain reads hasRevealedVillain, the LAST useTurnActions param, so
    // this call must pass the full intermediate positional list to reach it (the pending
    // flags in between only gate other predicates and are harmless here).
    function revealGate(): { allowed: boolean; reason: string | null } {
      return useTurnActions(props.currentStage, props.isViewerTurn, props.hasPendingChoice, props.hasPendingKoChoice, props.hasPendingOptionalKoReward, props.hasPendingDrawOrEmpowered, props.hasPendingVictoryPileCardPick, props.hasPendingOptionalPutBottomHQ, props.hasPendingPutAnyNumberBottomHQ, props.hasPendingReturnZeroCostDiscard, props.hasPendingDiscardToPlay, props.hasPendingScryKoChoice, props.hasWoundInHand, props.hasActedThisTurn, props.hasHealedThisTurn, props.hasPendingDiscardChoice, props.hasPendingReorderChoice, props.hasPendingDefeatChoice, props.hasPendingReturnOnDiscard, props.hasPendingGiveHqHeroChoice, props.hasPendingCopyPowersChoice, props.hasPendingPutCardsOnDeckChoice, props.hasPendingMelterKoChoice, props.hasPendingPlayVillainTop, props.hasPendingSmashDiscard, props.hasPendingDoOver, props.hasPendingKoDiscardChoice, props.hasPendingRuthlessDictatorChoice, props.hasPendingElectromagneticBubbleChoice, props.hasRevealedVillain).canRevealVillain();
    }

    // why (Jeff feedback): the playable subset of the viewer's hand — every card
    // except Wounds, which carry no play value and cannot be played (woundIdentity /
    // wounds.md). This is both what "Play Hand" plays and what gates Pass priority:
    // a hand of only Wounds counts as "nothing left to play", so it never traps the
    // player behind an un-emptiable hand.
    function playableHandCardIds(): string[] {
      return props.handCards.filter((cardId) => cardId !== WOUND_EXT_ID);
    }

    // why (Jeff feedback): the "Play Hand" button gate. Turn + stage come from the
    // shared canPlayCard predicate (a Wound-free 2-arg call, like HandRow); on top
    // of that the button is disabled once no playable cards remain, so it greys out
    // after the hand is played and reads as consumed.
    function playHandGate(): GatingResult {
      const stageGate = useTurnActions(props.currentStage, props.isViewerTurn).canPlayCard();
      if (!stageGate.allowed) {
        return stageGate;
      }
      if (playableHandCardIds().length === 0) {
        return {
          allowed: false,
          reason: 'Your hand has no more cards to play.',
        };
      }
      return { allowed: true, reason: null };
    }

    // why (Jeff feedback): one click plays the whole hand. Fires a playCard for each
    // playable card in order — the same move HandRow submits per tile, just batched.
    // A card that parks a pending choice mid-batch stops the rest via the engine's
    // block-all guards (exactly as fast-clicking hand tiles does today); the leftover
    // cards stay in hand and the button re-enables so the player resolves the choice
    // and clicks again.
    function onPlayHand(event: Event): void {
      for (const cardId of playableHandCardIds()) {
        props.submitMove('playCard', { cardId });
      }
      blurAfterClick(event);
    }

    // why (Jeff feedback): the "Continue to Play" recovery. Normally the reveal
    // auto-advances into main (onReveal fires advanceStage). But if the revealed
    // villain parked a pending choice for the active player, the engine's block-all
    // guards refuse that advance and the turn stays at 'start' until the choice is
    // resolved. With the "Pass priority" button removed, this is the forward action
    // out of that (rare) stuck state — it fires the advanceStage the reveal could
    // not. Uses its own latch (isContinuing) rather than the reveal's isAutoAdvancing,
    // which is left set by the parked reveal; both clear on the next stage change.
    function onContinueFromStart(event: Event): void {
      blurAfterClick(event);
      if (isContinuing.value) {
        return;
      }
      props.submitMove('advanceStage', {});
      isContinuing.value = true;
    }

    // why (Jeff feedback): the Step-1 button is a single adaptive control — "Reveal
    // top of Villain Deck" until the villain is revealed, then (only in the rare
    // parked-choice stuck state) "Continue to Play". Both keep the flow inside
    // Step 1 → Step 2 with no "Pass priority".
    function onStartStep(event: Event): void {
      if (props.hasRevealedVillain) {
        onContinueFromStart(event);
      } else {
        onReveal(event);
      }
    }

    // why: the Step-1 button label follows its mode (reveal vs continue-to-play).
    function startStepLabel(): string {
      return props.hasRevealedVillain && props.currentStage === 'start'
        ? '▶ Continue to Play'
        : '▶ Reveal top of Villain Deck';
    }

    // why: continue-to-play mode is enabled for the active player whenever the
    // villain is revealed but the turn is still at 'start'; otherwise the button
    // is the reveal, gated by revealGate (turn / stage / already-revealed).
    function startStepGate(): GatingResult {
      if (props.isViewerTurn && props.hasRevealedVillain && props.currentStage === 'start') {
        return { allowed: true, reason: null };
      }
      return revealGate();
    }

    // why (Jeff feedback): "Play Hand" is the ONE highlighted call-to-action while
    // there are cards to play. Once the hand is played it greys out and the accent
    // moves to "End turn" (Step 3), which is now the single forward action — the
    // confusing "Pass priority" button is gone (see endTurnGate / onEndTurn).
    function isPlayHandPrimary(): boolean {
      return playHandGate().allowed;
    }

    // why (Jeff feedback): "End turn" is now the single terminator for the whole
    // play part of the turn — the "Pass priority" button was removed. The engine
    // canEndTurn predicate (updated to allow the main stage as well as cleanup)
    // carries the turn + stage + pending-choice gating; on top of it this wrapper
    // holds End turn disabled at the main stage while playable cards remain in hand,
    // so the flow reads Reveal → Play Hand → End turn (a hand of only Wounds counts
    // as nothing-left-to-play and does not trap the player).
    // why: the positional list reaches every pending-choice param canEndTurn reads;
    // the heal trio (positions 13–15) only gate canHealWounds and are harmless here.
    function endTurnGate(): GatingResult {
      const base = useTurnActions(props.currentStage, props.isViewerTurn, props.hasPendingChoice, props.hasPendingKoChoice, props.hasPendingOptionalKoReward, props.hasPendingDrawOrEmpowered, props.hasPendingVictoryPileCardPick, props.hasPendingOptionalPutBottomHQ, props.hasPendingPutAnyNumberBottomHQ, props.hasPendingReturnZeroCostDiscard, props.hasPendingDiscardToPlay, props.hasPendingScryKoChoice, props.hasWoundInHand, props.hasActedThisTurn, props.hasHealedThisTurn, props.hasPendingDiscardChoice, props.hasPendingReorderChoice, props.hasPendingDefeatChoice, props.hasPendingReturnOnDiscard, props.hasPendingGiveHqHeroChoice, props.hasPendingCopyPowersChoice, props.hasPendingPutCardsOnDeckChoice, props.hasPendingMelterKoChoice, props.hasPendingPlayVillainTop, props.hasPendingSmashDiscard, props.hasPendingDoOver, props.hasPendingKoDiscardChoice, props.hasPendingRuthlessDictatorChoice, props.hasPendingElectromagneticBubbleChoice).canEndTurn();
      if (!base.allowed) {
        return base;
      }
      if (props.currentStage === 'main' && playableHandCardIds().length > 0) {
        return {
          allowed: false,
          reason: 'Play your hand (or Heal Wounds) before you end your turn.',
        };
      }
      return base;
    }

    // why (Jeff feedback): once the hand is played, "End turn" becomes the
    // highlighted next action (Play Hand has greyed out). This is the accent moving
    // to the genuine forward action, NOT the old confusing blue "Pass priority" —
    // that button is gone. Primary only when End turn is actually clickable.
    function isEndTurnPrimary(): boolean {
      return !isPlayHandPrimary() && endTurnGate().allowed;
    }

    // why: WP-380 — threads the three new props (hasWoundInHand from the page-level
    // hand scan; hasActedThisTurn / hasHealedThisTurn from UIState.game) as the
    // trailing useTurnActions params so canHealWounds gates the Heal-Wounds button.
    // WP-470 — hasPendingScryKoChoice is threaded before them (position 12) so the heal
    // pending-cluster gate also fires while a Doombot scry-KO choice is pending.
    // EC-565 — hasPendingReturnOnDiscard (position 19) MUST be threaded too: canHealWounds
    // now mirrors the engine's full block-all guard set, so every pending-choice prop the
    // gate reads has to reach it — omitting this one let Healing stay a live-but-dead click
    // while a return-on-discard choice (D-24301) was unresolved.
    function healGate(): { allowed: boolean; reason: string | null } {
      return useTurnActions(props.currentStage, props.isViewerTurn, props.hasPendingChoice, props.hasPendingKoChoice, props.hasPendingOptionalKoReward, props.hasPendingDrawOrEmpowered, props.hasPendingVictoryPileCardPick, props.hasPendingOptionalPutBottomHQ, props.hasPendingPutAnyNumberBottomHQ, props.hasPendingReturnZeroCostDiscard, props.hasPendingDiscardToPlay, props.hasPendingScryKoChoice, props.hasWoundInHand, props.hasActedThisTurn, props.hasHealedThisTurn, props.hasPendingDiscardChoice, props.hasPendingReorderChoice, props.hasPendingDefeatChoice, props.hasPendingReturnOnDiscard, props.hasPendingGiveHqHeroChoice, props.hasPendingCopyPowersChoice, props.hasPendingPutCardsOnDeckChoice, props.hasPendingMelterKoChoice, props.hasPendingPlayVillainTop, props.hasPendingSmashDiscard, props.hasPendingDoOver, props.hasPendingKoDiscardChoice, props.hasPendingRuthlessDictatorChoice, props.hasPendingElectromagneticBubbleChoice).canHealWounds();
    }

    // why: a turn-action button that fires a move keeps native DOM focus after the
    // click, so its focus ring lingers as if the click had not registered. This is
    // most misleading at play.start, where revealVillainCard leaves G.currentStage
    // on 'start' (the reveal → advanceStage two-move contract the engine keeps for
    // autoplay/sim parity), so the revealed-and-done button stays visibly focused
    // and the player reads the turn as stuck. Drop focus after dispatch so the
    // button reads as consumed. Guarded: the event target is only an HTMLElement in
    // the browser; in a headless test trigger it may be absent.
    function blurAfterClick(event: Event): void {
      const target = event.currentTarget;
      if (target instanceof HTMLElement) {
        target.blur();
      }
    }

    // why: the reveal is the player's ONLY action at play.start, and the board
    // layout always intended step 1 to flow straight into main
    // (DESIGN-BOARD-LAYOUT.md §5.1 — "auto-advance into play.main after
    // resolution"). The ENGINE keeps its two-move contract untouched:
    // revealVillainCard never advances the stage, because the autoplay bot
    // (autoplay.mjs) and the sim / PAR harness (ai.legalMoves.ts) issue their own
    // advanceStage after revealing and would desync if the engine did it for them.
    // So the auto-advance is CLIENT-ONLY — after the human reveals, the client
    // fires the same advanceStage the bot does. A reveal that parks a pending
    // choice for this player is refused by the engine's advanceStage block-all
    // guards (a harmless no-op; the reveal frame still advanced _stateID, so the
    // move-ack watchdog is satisfied and no resync fires), leaving the player on
    // start to resolve the choice and then Pass priority manually.
    const isAutoAdvancing = ref(false);
    // why (Jeff feedback): declared here (beside isAutoAdvancing, before the
    // currentStage watch that resets them) so the watch closures capture already-
    // initialized refs. isEndingTurn latches the End-turn chain against a double-
    // click; isContinuing latches the "Continue to Play" recovery (below) — a
    // SEPARATE latch from isAutoAdvancing, which stays set through a parked reveal.
    const isEndingTurn = ref(false);
    const isContinuing = ref(false);

    function onReveal(event: Event): void {
      blurAfterClick(event);
      // why: latch against a fast double/triple-click firing advanceStage more
      // than once before the post-reveal frame flips currentStage to 'main' —
      // without it two quick clicks would advance start → main → cleanup and skip
      // the main stage entirely. The latch clears on the next currentStage change
      // (watch below), including the cleanup → start transition that opens the
      // next turn.
      if (isAutoAdvancing.value) {
        return;
      }
      // why: empty-object payload — revealVillainCard takes no arguments
      // by engine design (see villainDeck.reveal.ts). Pops a card from
      // the villain deck into the City; gated to play.start.
      props.submitMove('revealVillainCard', {});
      // why: D-10011 — advanceStage is the canonical start → main advance. Fired
      // immediately after the reveal so the player lands in their main stage in one
      // click (see the isAutoAdvancing block comment above).
      props.submitMove('advanceStage', {});
      isAutoAdvancing.value = true;
    }

    // why: reset the reveal auto-advance latch on every currentStage change. The
    // common start → main advance clears it (the reveal button is disabled at main
    // regardless), and the cleanup → start transition that begins the next turn
    // re-arms a fresh reveal. A reveal that parked a pending choice leaves the
    // stage on 'start' (no change fires here), so the latch stays set and blocks a
    // redundant re-reveal until the next turn — correct, since the forward action
    // in that state is End turn, not another reveal.
    // why (Jeff feedback): the End-turn chain latch resets here too, so a click that
    // advanced main → cleanup but had endTurn refused (a pending choice) re-arms once
    // the stage change lands, letting the player resolve and click End turn again.
    watch(
      () => props.currentStage,
      () => {
        isAutoAdvancing.value = false;
        isEndingTurn.value = false;
        isContinuing.value = false;
      },
    );

    // why (Jeff feedback): End turn is the single forward action for the play part
    // of the turn (the "Pass priority" button is gone). From the MAIN stage it
    // chains advanceStage (main → cleanup) then endTurn in one click — the same
    // two-move idiom the reveal auto-advance uses — so the player never has to think
    // about the intermediate cleanup stage. From cleanup it just ends the turn.
    function onEndTurn(event: Event): void {
      blurAfterClick(event);
      // why: latch against a fast double-click firing the chain twice before the
      // post-advance frame lands. Cleared on the next currentStage change (watch
      // below), so a genuine next click (e.g. after a pending choice parked at
      // cleanup) still works.
      if (isEndingTurn.value) {
        return;
      }
      // why: from main, advance to cleanup first (endTurn is gated to cleanup in
      // the engine); from cleanup this step is unnecessary. Mirrors the reveal
      // two-move contract — the engine's block-all guards refuse the advance if a
      // pending choice is outstanding, a harmless no-op that leaves the player to
      // resolve it and click End turn again.
      if (props.currentStage === 'main') {
        props.submitMove('advanceStage', {});
      }
      // why: empty-object payload — EndTurnArgs is `Record<string, never>`
      // per coreMoves.types.ts:57. The move takes no arguments.
      props.submitMove('endTurn', {});
      isEndingTurn.value = true;
    }

    function onHealWounds(event: Event): void {
      // why: WP-380 — empty-object payload; the healWounds move takes no arguments
      // (healWounds.ts). KOs every Wound from the viewer's hand; the next server
      // frame reflects the shrunk hand + grown KO pile + the WP-379 log line.
      props.submitMove('healWounds', {});
      blurAfterClick(event);
    }

    return {
      activeStep,
      startStepGate,
      startStepLabel,
      playHandGate,
      isPlayHandPrimary,
      endTurnGate,
      isEndTurnPrimary,
      healGate,
      onStartStep,
      onPlayHand,
      onEndTurn,
      onHealWounds,
    };
  },
});
</script>

<template>
  <section
    class="turn-action-bar"
    data-testid="play-turn-action-bar"
    aria-label="Turn actions"
    :data-active-step="activeStep()"
  >
    <ol class="turn-action-bar__steps">
      <li
        class="turn-action-bar__step"
        :class="{ 'turn-action-bar__step--active': activeStep() === 1 }"
        data-testid="play-turn-step-1"
      >
        <header>Step 1 — Reveal villain (play.start)</header>
        <button
          type="button"
          data-testid="play-action-reveal"
          :disabled="!startStepGate().allowed"
          :aria-disabled="!startStepGate().allowed ? 'true' : undefined"
          :title="startStepGate().reason ?? undefined"
          @click="onStartStep($event)"
        >
          <!-- why: stage gating per D-10012 — revealVillainCard is gated to
               play.start; the reveal auto-advances into main (onReveal). why (Jeff
               feedback): this is a single adaptive control — its label is "Continue
               to Play" in the rare state where the villain is revealed but a parked
               choice held the turn at 'start' (startStepLabel), so the player is
               never stranded without a forward action now that "Pass priority" is
               gone. The start-of-turn hand is drawn automatically by the engine
               onBegin (WP-236); the former "Draw to 6" scaffold button is retired. -->
          {{ startStepLabel() }}
        </button>
      </li>
      <li
        class="turn-action-bar__step"
        :class="{ 'turn-action-bar__step--active': activeStep() === 2 }"
        data-testid="play-turn-step-2"
      >
        <header>Step 2 — Play / Recruit / Fight (play.main)</header>
        <p class="turn-action-bar__hint">
          Play your hand, then tap a city villain, an HQ hero, or the mastermind
          tile — or tap a single hand card to play it on its own. Finish with
          End turn.
        </p>
        <!-- why (Jeff feedback): "Play Hand" plays the whole hand in one click.
             It greys out once no playable cards remain (playHandGate); the accent
             then moves to End turn (Step 3), which is the single forward action —
             the old "Pass priority" button was removed. Individual hand tiles
             (HandRow) still work for playing one card at a time. -->
        <button
          type="button"
          data-testid="play-action-play-hand"
          :class="{ 'turn-action-bar__action--primary': isPlayHandPrimary() }"
          :disabled="!playHandGate().allowed"
          :aria-disabled="!playHandGate().allowed ? 'true' : undefined"
          :title="playHandGate().reason ?? undefined"
          @click="onPlayHand($event)"
        >
          ▶ Play Hand
        </button>
        <button
          type="button"
          data-testid="play-action-heal-wounds"
          :disabled="!healGate().allowed"
          :aria-disabled="!healGate().allowed ? 'true' : undefined"
          :title="healGate().reason ?? undefined"
          @click="onHealWounds($event)"
        >
          <!-- why: WP-380 / D-24181 — the printed Wound "Healing" ability (engine
               healWounds: KO all Wounds from hand). Disabled-tooltip precedence per
               EC-132 §3 binds the reason from useTurnActions.canHealWounds (turn →
               main → no pending → wound-in-hand → not-acted → not-healed). -->
          Heal Wounds
        </button>
      </li>
      <li
        class="turn-action-bar__step"
        :class="{ 'turn-action-bar__step--active': activeStep() === 3 }"
        data-testid="play-turn-step-3"
      >
        <header>Step 3 — End turn</header>
        <button
          type="button"
          data-testid="play-action-end-turn"
          :class="{ 'turn-action-bar__action--primary': isEndTurnPrimary() }"
          :disabled="!endTurnGate().allowed"
          :aria-disabled="!endTurnGate().allowed ? 'true' : undefined"
          :title="endTurnGate().reason ?? undefined"
          @click="onEndTurn($event)"
        >
          <!-- why (Jeff feedback): End turn is the single forward action — it fires
               from the main stage too (onEndTurn chains advanceStage → endTurn), so
               the flow is Reveal → Play Hand → End turn with no "Pass priority"
               button. It carries the primary accent once the hand is played
               (isEndTurnPrimary). Disabled-tooltip precedence per EC-132 §3 binds the
               reason from endTurnGate (engine canEndTurn + the play-your-hand gate). -->
          ✓ End turn — discard hand and draw 6
        </button>
      </li>
    </ol>
    <!-- why (Jeff feedback): the "End Game for everyone" escape hatch moved out of
         this bar and into the top ribbon beside the Mastermind (EndGameControl in
         TopHudBar) — ending the match is a table-level concern, not a turn step. -->
  </section>
</template>

<style scoped>
.turn-action-bar {
  position: sticky;
  bottom: 0;
  z-index: 100;
  background: var(--color-background, #fff);
  border-top: 2px solid var(--color-foreground, #333);
  padding: 0.35rem 0.75rem;
  margin: 0 -0.75rem;
}

.turn-action-bar__steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  align-items: flex-start;
}

.turn-action-bar__step {
  flex: 1;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-foreground, #999);
  font-size: 0.8rem;
}

/* why: an inactive step is de-emphasized by muting its DESCRIPTIVE text and
   softening its border — NOT by a whole-subtree `opacity`. A container opacity
   composites the step's BUTTONS along with everything else, so the always-legal
   "Pass priority" advance control (enabled at every stage per D-10011, and the
   only way out of play.start) rendered faded-to-grey inside the inactive step-2
   box and read as disabled — the turn looked stuck. Buttons now keep their true
   enabled/disabled appearance regardless of which step is active; the disabled
   rule below is what makes a genuinely-blocked button look grey. */
.turn-action-bar__step:not(.turn-action-bar__step--active) {
  border-color: var(--color-foreground, #bbb);
}

.turn-action-bar__step:not(.turn-action-bar__step--active) header,
.turn-action-bar__step:not(.turn-action-bar__step--active) .turn-action-bar__hint {
  opacity: 0.55;
}

.turn-action-bar__step--active {
  border-color: var(--color-foreground, #333);
}

.turn-action-bar__step header {
  font-weight: 600;
  font-size: 0.75rem;
  margin-bottom: 0.15rem;
}

.turn-action-bar__hint {
  margin: 0 0 0.25rem 0;
  font-style: italic;
  opacity: 0.85;
  font-size: 0.75rem;
}

.turn-action-bar__step button {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  cursor: pointer;
}

/* why: "grey" must mean "disabled", never "not the current step". With the
   step-level opacity gone (above), a disabled button needs its own faded,
   not-allowed styling so the enabled/disabled distinction is carried by the
   button itself — an enabled Pass priority at play.start now reads as clickable,
   a stage-blocked button reads as blocked. */
.turn-action-bar__step button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* why (Jeff feedback): Play Hand is the ONE highlighted call-to-action in Step 2 —
   a filled accent so the player's eye lands on it right after the reveal. Pass
   priority and Heal Wounds stay plain and never take this accent (a blue Pass
   priority read as "the button to click", which Jeff flagged as confusing). Uses
   --color-active-player (the brand bright-blue, mode-stable) with white text;
   :not(:disabled) guarantees the accent never sits on an un-clickable button. */
.turn-action-bar__step button.turn-action-bar__action--primary:not(:disabled) {
  background: var(--color-active-player, #1d4ed8);
  color: #ffffff;
  border: 1px solid var(--color-active-player, #1d4ed8);
  border-radius: 0.25rem;
  font-weight: 700;
}
</style>
