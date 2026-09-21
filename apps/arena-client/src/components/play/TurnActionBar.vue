<script lang="ts">
import { defineComponent, ref, watch, type PropType } from 'vue';
import { useTurnActions } from '../../composables/useTurnActions';
import type { GatingResult } from '../../composables/useCardCostGating';
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
    // why: WP-700 / D-24519 — true while a put-a-hand-card-on-deck-top choice is pending
    // (Gambit's Stack the Deck + siblings); blocks End Turn / Pass Priority / Heal at ANY
    // stage (the engine's full block-all guard freezes the board). Mandatory (no decline).
    hasPendingPutHandOnDeckTop: {
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
    // why: WP-702 / D-24521 — true while a reveal-top discard-or-keep choice is pending;
    // blocks End Turn / Pass Priority at ANY stage (the engine's full block-all guard freezes
    // the board, mirroring hasPendingMelterKoChoice).
    hasPendingRevealTopDispose: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-719 / D-24541 — derived from UIState.pendingCoveringFireChoice !== undefined at
    // the page level; passed down so TurnActionBar blocks end-turn / pass-priority / heal at
    // EVERY stage while a Hawkeye Covering Fire choose-one is pending (the engine's block-all
    // guard set freezes the board).
    hasPendingCoveringFireChoice: {
      type: Boolean,
      required: false,
      default: false,
    },
    // why: WP-682 / D-24544 — derived at the page level from
    // UIState.pendingSeatChoice !== undefined. Passed down so TurnActionBar (a) blocks
    // End Turn / Pass Priority / Heal while a WP-684 seat choice (Diving Block reveal/decline,
    // Random Acts, Monarch's Decree) is open, and — load-bearing — (b) is included in
    // anyPendingChoice() so the reveal auto-advance WAITS for the seat choice instead of
    // firing into the engine's block-all (which latched isAutoAdvancing and froze the turn
    // at 'start' after a start-stage Diving Block until reload).
    hasPendingSeatChoice: {
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

    // why (Jeff feedback): whether the viewer has ANY unresolved pending choice —
    // the OR of every pending-* prop the page derives from UIState. The reveal /
    // end-turn watchers below read this so they never auto-advance the stage while a
    // choice (a Master Strike KO, an ambush pick, …) is still on the board.
    function anyPendingChoice(): boolean {
      return (
        props.hasPendingChoice ||
        props.hasPendingKoChoice ||
        props.hasPendingOptionalKoReward ||
        props.hasPendingDrawOrEmpowered ||
        props.hasPendingPlayVillainTop ||
        props.hasPendingSmashDiscard ||
        props.hasPendingDoOver ||
        props.hasPendingKoDiscardChoice ||
        props.hasPendingRuthlessDictatorChoice ||
        props.hasPendingElectromagneticBubbleChoice ||
        props.hasPendingVictoryPileCardPick ||
        props.hasPendingOptionalPutBottomHQ ||
        props.hasPendingPutAnyNumberBottomHQ ||
        props.hasPendingReturnZeroCostDiscard ||
        props.hasPendingDiscardToPlay ||
        props.hasPendingScryKoChoice ||
        props.hasPendingMelterKoChoice ||
        props.hasPendingRevealTopDispose ||
        props.hasPendingDiscardChoice ||
        props.hasPendingReorderChoice ||
        props.hasPendingDefeatChoice ||
        props.hasPendingReturnOnDiscard ||
        props.hasPendingGiveHqHeroChoice ||
        props.hasPendingCopyPowersChoice ||
        props.hasPendingPutCardsOnDeckChoice ||
        props.hasPendingPutHandOnDeckTop ||
        // why: WP-719 / D-24541 — a pending Covering Fire choose-one must also block auto-advance.
        props.hasPendingCoveringFireChoice ||
        // why: WP-682 / D-24544 — a pending WP-684 seat choice (Diving Block reveal/decline,
        // Random Acts, Monarch's Decree) MUST block the reveal auto-advance. Without this the
        // start-stage reveal watcher fired advanceStage into the engine's block-all while a
        // start-stage Diving Block was open, latched isAutoAdvancing, and never re-advanced
        // once the choice cleared — freezing the turn at 'start' until reload.
        props.hasPendingSeatChoice
      );
    }

    // why (Jeff feedback): "End turn" is the single terminator for the whole play
    // part of the turn — there is no "Pass priority" or "Play Hand" button. The
    // engine canEndTurn predicate (allows the main stage as well as cleanup, blocked
    // at start) carries the turn + stage + pending-choice gating. No play-your-hand-
    // first gate: End turn is a plain one-click action whenever it is legal.
    // why: the positional list reaches every pending-choice param canEndTurn reads;
    // the heal trio (positions 13–15) only gate canHealWounds and are harmless here.
    function endTurnGate(): GatingResult {
      return useTurnActions(props.currentStage, props.isViewerTurn, props.hasPendingChoice, props.hasPendingKoChoice, props.hasPendingOptionalKoReward, props.hasPendingDrawOrEmpowered, props.hasPendingVictoryPileCardPick, props.hasPendingOptionalPutBottomHQ, props.hasPendingPutAnyNumberBottomHQ, props.hasPendingReturnZeroCostDiscard, props.hasPendingDiscardToPlay, props.hasPendingScryKoChoice, props.hasWoundInHand, props.hasActedThisTurn, props.hasHealedThisTurn, props.hasPendingDiscardChoice, props.hasPendingReorderChoice, props.hasPendingDefeatChoice, props.hasPendingReturnOnDiscard, props.hasPendingGiveHqHeroChoice, props.hasPendingCopyPowersChoice, props.hasPendingPutCardsOnDeckChoice, props.hasPendingMelterKoChoice, props.hasPendingPlayVillainTop, props.hasPendingSmashDiscard, props.hasPendingDoOver, props.hasPendingKoDiscardChoice, props.hasPendingRuthlessDictatorChoice, props.hasPendingElectromagneticBubbleChoice, props.hasRevealedVillain, props.hasPendingPutHandOnDeckTop, props.hasPendingRevealTopDispose, props.hasPendingCoveringFireChoice, props.hasPendingSeatChoice).canEndTurn();
    }

    // why (Jeff feedback): highlight is STAGE-BASED — exactly one Step box is active
    // at a time, matching where the turn is (Step 1 at start, Step 2 at main, Step 3
    // at cleanup). So right after the reveal only Step 2 is active and Step 3 is
    // grayed, even though End turn is already usable from main (it stays a plain
    // enabled button in the grayed Step 3 box, not an accented one — see the template).
    // `activeStep()` above already returns the stage's step number.

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
      return useTurnActions(props.currentStage, props.isViewerTurn, props.hasPendingChoice, props.hasPendingKoChoice, props.hasPendingOptionalKoReward, props.hasPendingDrawOrEmpowered, props.hasPendingVictoryPileCardPick, props.hasPendingOptionalPutBottomHQ, props.hasPendingPutAnyNumberBottomHQ, props.hasPendingReturnZeroCostDiscard, props.hasPendingDiscardToPlay, props.hasPendingScryKoChoice, props.hasWoundInHand, props.hasActedThisTurn, props.hasHealedThisTurn, props.hasPendingDiscardChoice, props.hasPendingReorderChoice, props.hasPendingDefeatChoice, props.hasPendingReturnOnDiscard, props.hasPendingGiveHqHeroChoice, props.hasPendingCopyPowersChoice, props.hasPendingPutCardsOnDeckChoice, props.hasPendingMelterKoChoice, props.hasPendingPlayVillainTop, props.hasPendingSmashDiscard, props.hasPendingDoOver, props.hasPendingKoDiscardChoice, props.hasPendingRuthlessDictatorChoice, props.hasPendingElectromagneticBubbleChoice, props.hasRevealedVillain, props.hasPendingPutHandOnDeckTop, props.hasPendingRevealTopDispose, props.hasPendingCoveringFireChoice, props.hasPendingSeatChoice).canHealWounds();
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

    // why (Jeff feedback): Reveal and End turn are driven by STATE WATCHERS, not a
    // synchronous two-move chain. The old onReveal fired revealVillainCard +
    // advanceStage back-to-back; over the network that second move could be judged
    // against un-committed state (the reveal-first guard) and be dropped, leaving the
    // player stuck at 'start' and needing a second click. Instead onReveal fires only
    // the reveal, and a watcher fires advanceStage once the reveal — and any forced
    // choice it parked (a Master Strike KO) — is CONFIRMED in state. Same idea for
    // End turn from main. isAutoAdvancing latches the auto-advance so it fires once
    // per start; wantEndTurn records that the viewer asked to end from main.
    const isAutoAdvancing = ref(false);
    const wantEndTurn = ref(false);

    function onReveal(event: Event): void {
      // why: empty-object payload — revealVillainCard takes no arguments by engine
      // design (villainDeck.reveal.ts). Pops the top villain-deck card into the City;
      // gated to play.start. The watcher below advances start → main once this (and
      // any choice it parks) is confirmed — one click, no separate "Continue".
      props.submitMove('revealVillainCard', {});
      blurAfterClick(event);
    }

    function onEndTurn(event: Event): void {
      blurAfterClick(event);
      // why: guard against a double-click re-firing the advance while the first is
      // still in flight; cleared when the turn returns to 'start' (watch below).
      if (wantEndTurn.value) {
        return;
      }
      if (props.currentStage === 'cleanup') {
        // already at cleanup — end directly (empty payload; EndTurnArgs is
        // Record<string, never> per coreMoves.types.ts).
        props.submitMove('endTurn', {});
        return;
      }
      // from main: advance to cleanup; the watcher fires endTurn once cleanup is
      // confirmed and nothing is pending (endTurn is gated to cleanup in the engine).
      wantEndTurn.value = true;
      props.submitMove('advanceStage', {});
    }

    function onHealWounds(event: Event): void {
      // why: WP-380 — empty-object payload; the healWounds move takes no arguments
      // (healWounds.ts). KOs every Wound from the viewer's hand; the next server
      // frame reflects the shrunk hand + grown KO pile + the WP-379 log line.
      props.submitMove('healWounds', {});
      blurAfterClick(event);
    }

    // why (Jeff feedback): one-click Reveal. Advance start → main automatically once
    // the villain is revealed AND no choice is pending. On a plain turn this fires
    // right after the reveal; on a Master-Strike turn the reveal parks a "KO a Hero"
    // choice, the player resolves it, and THEN this fires — no second button. Reacts
    // to confirmed state, so it is reliable where the old synchronous chain was not.
    function maybeAutoAdvanceReveal(): void {
      if (
        props.isViewerTurn &&
        props.currentStage === 'start' &&
        props.hasRevealedVillain &&
        !anyPendingChoice() &&
        !isAutoAdvancing.value
      ) {
        isAutoAdvancing.value = true;
        props.submitMove('advanceStage', {});
      }
    }

    // why (Jeff feedback): one-click End turn from main — once the advance to cleanup
    // is confirmed and nothing is pending, fire endTurn. If a card parked a choice at
    // cleanup, this waits until it is resolved.
    function maybeCompleteEndTurn(): void {
      if (
        props.isViewerTurn &&
        wantEndTurn.value &&
        props.currentStage === 'cleanup' &&
        !anyPendingChoice()
      ) {
        wantEndTurn.value = false;
        props.submitMove('endTurn', {});
      }
    }

    // why: run the auto-advance / auto-complete whenever the stage, the reveal flag,
    // or the pending-choice set changes — and immediately on mount so a reconnect
    // into a revealed-but-stuck 'start' recovers on its own. Reset the latches when
    // the turn opens ('start') / leaves 'start' so each turn re-arms cleanly.
    watch(
      [
        () => props.currentStage,
        () => props.hasRevealedVillain,
        () => anyPendingChoice(),
      ],
      () => {
        if (props.currentStage !== 'start') {
          isAutoAdvancing.value = false;
        }
        if (props.currentStage === 'start') {
          wantEndTurn.value = false;
        }
        maybeAutoAdvanceReveal();
        maybeCompleteEndTurn();
      },
      { immediate: true },
    );

    return {
      activeStep,
      revealGate,
      endTurnGate,
      healGate,
      onReveal,
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
          <!-- why (Jeff feedback): one click. revealVillainCard is gated to
               play.start; a watcher advances start → main automatically once the
               reveal (and any Master-Strike choice it parks) is confirmed — no
               second "Continue"/"Pass priority" click. The start-of-turn hand is
               drawn automatically by the engine onBegin (WP-236). -->
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
          Play cards from your hand, recruit heroes, and fight villains — tap them
          on the board. Then End turn.
        </p>
        <!-- why (Jeff feedback): the "Play Hand" button was removed — it duplicated
             clicking the cards in your hand. why: Heal Wounds is shown only when it
             is actually usable (healGate), so the active Step-2 box never carries a
             dim, dead button. -->
        <button
          v-if="healGate().allowed"
          type="button"
          data-testid="play-action-heal-wounds"
          @click="onHealWounds($event)"
        >
          <!-- why: WP-380 / D-24181 — the printed Wound "Healing" ability (engine
               healWounds: KO all Wounds from hand). Shown only when usable. -->
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
          :disabled="!endTurnGate().allowed"
          :aria-disabled="!endTurnGate().allowed ? 'true' : undefined"
          :title="endTurnGate().reason ?? undefined"
          @click="onEndTurn($event)"
        >
          <!-- why (Jeff feedback): End turn is the single forward action and works in
               one click from the main stage — a watcher advances main → cleanup then
               ends once confirmed, so there is no "Pass priority" step. Highlight is
               stage-based (Step 3's header is grayed until the cleanup stage), so this
               is a plain enabled button during main rather than an accented one — that
               is why Step 2 alone reads as active right after the reveal. Disabled-
               tooltip precedence per EC-132 §3 binds the reason from endTurnGate. -->
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

/* why (Jeff feedback): the CURRENT step's box goes white so the live action stands
   out from the gray turn-bar ground — after Step 1 finishes and it's Step 2's turn,
   the Step 2 box turns white ("act here now"). Inactive step boxes stay transparent
   (they show the gray bar behind them). arena-client v1 is a light surface, so a
   literal white reads correctly. */
.turn-action-bar__step--active {
  border-color: var(--color-foreground, #333);
  background-color: #ffffff;
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
</style>
