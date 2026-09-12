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

    // why: WP-477 — hasPendingDiscardChoice is useTurnActions' position-16 (last) param, so
    // reaching it requires passing the heal trio (positions 13–15) too, even though
    // canPassPriority / canEndTurn do not read them. Passing them is harmless (they only gate
    // canHealWounds) and threads the discard gate so the buttons disable while a Magneto
    // discard choice is pending.
    // why (Jeff feedback): on top of the engine-parity gate, Pass priority is held
    // disabled at the main stage while playable cards remain in hand, so "Play Hand"
    // is the obvious next action and Pass priority lights up once the hand is played.
    // Only main is gated this way — start (reveal-first) and cleanup keep their own
    // rules — and a genuine board-frozen pending choice still takes precedence.
    function passPriorityGate(): GatingResult {
      const base = useTurnActions(props.currentStage, props.isViewerTurn, props.hasPendingChoice, props.hasPendingKoChoice, props.hasPendingOptionalKoReward, props.hasPendingDrawOrEmpowered, props.hasPendingVictoryPileCardPick, props.hasPendingOptionalPutBottomHQ, props.hasPendingPutAnyNumberBottomHQ, props.hasPendingReturnZeroCostDiscard, props.hasPendingDiscardToPlay, props.hasPendingScryKoChoice, props.hasWoundInHand, props.hasActedThisTurn, props.hasHealedThisTurn, props.hasPendingDiscardChoice, props.hasPendingReorderChoice, props.hasPendingDefeatChoice, props.hasPendingReturnOnDiscard, props.hasPendingGiveHqHeroChoice, props.hasPendingCopyPowersChoice, props.hasPendingPutCardsOnDeckChoice, props.hasPendingMelterKoChoice, props.hasPendingPlayVillainTop, props.hasPendingSmashDiscard, props.hasPendingDoOver, props.hasPendingKoDiscardChoice, props.hasPendingRuthlessDictatorChoice, props.hasPendingElectromagneticBubbleChoice, props.hasRevealedVillain).canPassPriority();
      if (!base.allowed) {
        return base;
      }
      if (props.currentStage === 'main' && playableHandCardIds().length > 0) {
        return {
          allowed: false,
          reason: 'Play your hand (or Heal Wounds) before you pass priority.',
        };
      }
      return base;
    }

    // why (Jeff feedback): highlight the CURRENT recommended Step-2 action so the
    // player's eye lands on the button to click, instead of every Step-2 button
    // reading the same. After the reveal auto-advances into main the hand is full,
    // so Play Hand is primary; once the hand is played it greys out (playHandGate
    // fails) and Pass priority becomes primary. Heal Wounds is situational and is
    // never the primary — it only offers itself via its own enabled state. Returns
    // null when neither is the forward action (e.g. a pending choice is blocking, or
    // it is not the viewer's turn), so nothing is falsely highlighted.
    function primaryStepTwoAction(): 'play-hand' | 'pass-priority' | null {
      if (playHandGate().allowed) {
        return 'play-hand';
      }
      if (passPriorityGate().allowed) {
        return 'pass-priority';
      }
      return null;
    }

    function endTurnGate(): { allowed: boolean; reason: string | null } {
      return useTurnActions(props.currentStage, props.isViewerTurn, props.hasPendingChoice, props.hasPendingKoChoice, props.hasPendingOptionalKoReward, props.hasPendingDrawOrEmpowered, props.hasPendingVictoryPileCardPick, props.hasPendingOptionalPutBottomHQ, props.hasPendingPutAnyNumberBottomHQ, props.hasPendingReturnZeroCostDiscard, props.hasPendingDiscardToPlay, props.hasPendingScryKoChoice, props.hasWoundInHand, props.hasActedThisTurn, props.hasHealedThisTurn, props.hasPendingDiscardChoice, props.hasPendingReorderChoice, props.hasPendingDefeatChoice, props.hasPendingReturnOnDiscard, props.hasPendingGiveHqHeroChoice, props.hasPendingCopyPowersChoice, props.hasPendingPutCardsOnDeckChoice, props.hasPendingMelterKoChoice, props.hasPendingPlayVillainTop, props.hasPendingSmashDiscard, props.hasPendingDoOver, props.hasPendingKoDiscardChoice, props.hasPendingRuthlessDictatorChoice, props.hasPendingElectromagneticBubbleChoice).canEndTurn();
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
    // in that state is Pass priority, not another reveal.
    watch(
      () => props.currentStage,
      () => {
        isAutoAdvancing.value = false;
      },
    );

    function onPassPriority(event: Event): void {
      // why: D-10011 — Pass-priority fires advanceStage, the canonical
      // stage-advance vocabulary. NOT a no-op. Cycles G.currentStage
      // through start → main → cleanup; from cleanup it advances and
      // ends the turn per turnLoop.ts.
      props.submitMove('advanceStage', {});
      blurAfterClick(event);
    }

    function onEndTurn(event: Event): void {
      // why: empty-object payload — EndTurnArgs is `Record<string, never>`
      // per coreMoves.types.ts:57. The move takes no arguments.
      props.submitMove('endTurn', {});
      blurAfterClick(event);
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
      revealGate,
      playHandGate,
      passPriorityGate,
      primaryStepTwoAction,
      endTurnGate,
      healGate,
      onReveal,
      onPlayHand,
      onPassPriority,
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
          :disabled="!revealGate().allowed"
          :aria-disabled="!revealGate().allowed ? 'true' : undefined"
          :title="revealGate().reason ?? undefined"
          @click="onReveal($event)"
        >
          <!-- why: stage gating per D-10012 — revealVillainCard is gated
               to play.start. Disabled-tooltip precedence per EC-132 §3
               binds the reason from useTurnActions. The start-of-turn hand
               is drawn automatically by the engine onBegin (WP-236); the
               former "Draw to 6" scaffold button is retired. -->
          ▶ Reveal top of Villain Deck
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
          tile — or tap a single hand card to play it on its own.
        </p>
        <!-- why (Jeff feedback): "Play Hand" plays the whole hand in one click.
             It greys out once no playable cards remain (playHandGate); Pass priority
             stays disabled at main until then, so the Step-2 flow reads
             Play Hand → (grey) → Pass priority. Individual hand tiles (HandRow)
             still work for playing one card at a time. -->
        <button
          type="button"
          data-testid="play-action-play-hand"
          :class="{ 'turn-action-bar__action--primary': primaryStepTwoAction() === 'play-hand' }"
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
        <button
          type="button"
          data-testid="play-action-pass-priority"
          :class="{ 'turn-action-bar__action--primary': primaryStepTwoAction() === 'pass-priority' }"
          :disabled="!passPriorityGate().allowed"
          :aria-disabled="!passPriorityGate().allowed ? 'true' : undefined"
          :title="passPriorityGate().reason ?? undefined"
          @click="onPassPriority($event)"
        >
          <!-- why: D-10011 — Pass-priority fires advanceStage, the canonical
               stage-advance vocabulary. Disabled-tooltip precedence per EC-132 §3
               binds the reason from passPriorityGate (engine-parity pending gates +
               the Jeff-feedback play-your-hand-first gate at main). -->
          Pass priority
        </button>
      </li>
      <li
        class="turn-action-bar__step"
        :class="{ 'turn-action-bar__step--active': activeStep() === 3 }"
        data-testid="play-turn-step-3"
      >
        <header>Step 3 — End turn (play.cleanup)</header>
        <button
          type="button"
          data-testid="play-action-end-turn"
          :disabled="!endTurnGate().allowed"
          :aria-disabled="!endTurnGate().allowed ? 'true' : undefined"
          :title="endTurnGate().reason ?? undefined"
          @click="onEndTurn($event)"
        >
          <!-- why: stage gating per WP-100 §Locked contract values —
               endTurn is gated to play.cleanup. Disabled-tooltip
               precedence per EC-132 §3 binds the reason from
               useTurnActions.canEndTurn. -->
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

/* why (Jeff feedback): the CURRENT recommended Step-2 action gets a filled accent
   so the player's eye lands on the button to click — Play Hand right after the
   reveal, then Pass priority once the hand is played. The plain siblings and the
   greyed disabled button recede beside it. Uses --color-active-player (the brand
   bright-blue, mode-stable) with white text; :not(:disabled) guarantees the accent
   never sits on an un-clickable button. */
.turn-action-bar__step button.turn-action-bar__action--primary:not(:disabled) {
  background: var(--color-active-player, #1d4ed8);
  color: #ffffff;
  border: 1px solid var(--color-active-player, #1d4ed8);
  border-radius: 0.25rem;
  font-weight: 700;
}
</style>
