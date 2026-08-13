<script lang="ts">
import { defineComponent, ref, watch, type PropType } from 'vue';
import { useTurnActions } from '../../composables/useTurnActions';
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
  },
  setup(props) {
    function activeStep(): 1 | 2 | 3 {
      return useTurnActions(props.currentStage, props.isViewerTurn, props.hasPendingChoice, props.hasPendingKoChoice, props.hasPendingOptionalKoReward, props.hasPendingDrawOrEmpowered, props.hasPendingVictoryPileCardPick, props.hasPendingOptionalPutBottomHQ, props.hasPendingPutAnyNumberBottomHQ, props.hasPendingReturnZeroCostDiscard, props.hasPendingDiscardToPlay).activeStep;
    }

    function revealGate(): { allowed: boolean; reason: string | null } {
      return useTurnActions(props.currentStage, props.isViewerTurn, props.hasPendingChoice, props.hasPendingKoChoice, props.hasPendingOptionalKoReward, props.hasPendingDrawOrEmpowered, props.hasPendingVictoryPileCardPick, props.hasPendingOptionalPutBottomHQ, props.hasPendingPutAnyNumberBottomHQ, props.hasPendingReturnZeroCostDiscard, props.hasPendingDiscardToPlay).canRevealVillain();
    }

    // why: WP-477 — hasPendingDiscardChoice is useTurnActions' position-16 (last) param, so
    // reaching it requires passing the heal trio (positions 13–15) too, even though
    // canPassPriority / canEndTurn do not read them. Passing them is harmless (they only gate
    // canHealWounds) and threads the discard gate so the buttons disable while a Magneto
    // discard choice is pending.
    function passPriorityGate(): { allowed: boolean; reason: string | null } {
      return useTurnActions(props.currentStage, props.isViewerTurn, props.hasPendingChoice, props.hasPendingKoChoice, props.hasPendingOptionalKoReward, props.hasPendingDrawOrEmpowered, props.hasPendingVictoryPileCardPick, props.hasPendingOptionalPutBottomHQ, props.hasPendingPutAnyNumberBottomHQ, props.hasPendingReturnZeroCostDiscard, props.hasPendingDiscardToPlay, props.hasPendingScryKoChoice, props.hasWoundInHand, props.hasActedThisTurn, props.hasHealedThisTurn, props.hasPendingDiscardChoice, props.hasPendingReorderChoice, props.hasPendingDefeatChoice, props.hasPendingReturnOnDiscard, props.hasPendingGiveHqHeroChoice, props.hasPendingCopyPowersChoice).canPassPriority();
    }

    function endTurnGate(): { allowed: boolean; reason: string | null } {
      return useTurnActions(props.currentStage, props.isViewerTurn, props.hasPendingChoice, props.hasPendingKoChoice, props.hasPendingOptionalKoReward, props.hasPendingDrawOrEmpowered, props.hasPendingVictoryPileCardPick, props.hasPendingOptionalPutBottomHQ, props.hasPendingPutAnyNumberBottomHQ, props.hasPendingReturnZeroCostDiscard, props.hasPendingDiscardToPlay, props.hasPendingScryKoChoice, props.hasWoundInHand, props.hasActedThisTurn, props.hasHealedThisTurn, props.hasPendingDiscardChoice, props.hasPendingReorderChoice, props.hasPendingDefeatChoice, props.hasPendingReturnOnDiscard, props.hasPendingGiveHqHeroChoice, props.hasPendingCopyPowersChoice).canEndTurn();
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
      return useTurnActions(props.currentStage, props.isViewerTurn, props.hasPendingChoice, props.hasPendingKoChoice, props.hasPendingOptionalKoReward, props.hasPendingDrawOrEmpowered, props.hasPendingVictoryPileCardPick, props.hasPendingOptionalPutBottomHQ, props.hasPendingPutAnyNumberBottomHQ, props.hasPendingReturnZeroCostDiscard, props.hasPendingDiscardToPlay, props.hasPendingScryKoChoice, props.hasWoundInHand, props.hasActedThisTurn, props.hasHealedThisTurn, props.hasPendingDiscardChoice, props.hasPendingReorderChoice, props.hasPendingDefeatChoice, props.hasPendingReturnOnDiscard, props.hasPendingGiveHqHeroChoice, props.hasPendingCopyPowersChoice).canHealWounds();
    }

    function onReveal(): void {
      // why: empty-object payload — revealVillainCard takes no arguments
      // by engine design (see villainDeck.reveal.ts). Pops a card from
      // the villain deck into the City; gated to play.start.
      props.submitMove('revealVillainCard', {});
    }

    function onPassPriority(): void {
      // why: D-10011 — Pass-priority fires advanceStage, the canonical
      // stage-advance vocabulary. NOT a no-op. Cycles G.currentStage
      // through start → main → cleanup; from cleanup it advances and
      // ends the turn per turnLoop.ts.
      props.submitMove('advanceStage', {});
    }

    function onEndTurn(): void {
      // why: empty-object payload — EndTurnArgs is `Record<string, never>`
      // per coreMoves.types.ts:57. The move takes no arguments.
      props.submitMove('endTurn', {});
    }

    function onHealWounds(): void {
      // why: WP-380 — empty-object payload; the healWounds move takes no arguments
      // (healWounds.ts). KOs every Wound from the viewer's hand; the next server
      // frame reflects the shrunk hand + grown KO pile + the WP-379 log line.
      props.submitMove('healWounds', {});
    }

    // why: WP-502 / D-24306 — End Game is a two-click affordance (request →
    // confirm) rather than a native window.confirm, so the confirmation is part of
    // the component's own DOM (testable, styleable, and consistent with the rest of
    // the bar). Ending the match is irreversible and closes it out for every seat,
    // so it must never fire on a single stray click.
    const isConfirmingEndGame = ref(false);

    function requestEndGame(): void {
      isConfirmingEndGame.value = true;
    }

    function cancelEndGame(): void {
      isConfirmingEndGame.value = false;
    }

    function confirmEndGame(): void {
      // why: WP-502 / D-24306 — empty-object payload; the endMatchEarly move takes
      // no arguments. It latches MATCH_ENDED_EARLY so the engine's endIf ends the
      // match (an endedEarly tie) for ALL seats on the next frame, and every
      // client's UIState projects the endgame panel. Only the current player's
      // move applies, which is why this control is shown only on the viewer's turn.
      props.submitMove('endMatchEarly', {});
      isConfirmingEndGame.value = false;
    }

    // why: WP-502 — the confirm affordance is hidden (not unmounted) between the
    // viewer's turns via `v-if="isViewerTurn"`, so a confirm left un-actioned would
    // survive to the viewer's NEXT turn and render the armed "Yes, end it" button
    // first — a single stray click could then end the match. Re-arm to the safe
    // (un-confirming) state whenever it stops being the viewer's turn.
    watch(
      () => props.isViewerTurn,
      (isViewerTurn) => {
        if (!isViewerTurn) {
          isConfirmingEndGame.value = false;
        }
      },
    );

    return {
      activeStep,
      revealGate,
      passPriorityGate,
      endTurnGate,
      healGate,
      onReveal,
      onPassPriority,
      onEndTurn,
      onHealWounds,
      isConfirmingEndGame,
      requestEndGame,
      cancelEndGame,
      confirmEndGame,
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
          @click="onReveal"
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
          Tap a card in hand, a city villain, an HQ hero, or the mastermind tile.
        </p>
        <button
          type="button"
          data-testid="play-action-pass-priority"
          :disabled="!passPriorityGate().allowed"
          :aria-disabled="!passPriorityGate().allowed ? 'true' : undefined"
          :title="passPriorityGate().reason ?? undefined"
          @click="onPassPriority"
        >
          <!-- why: D-10011 — Pass-priority fires advanceStage, the
               canonical stage-advance vocabulary. Disabled-tooltip
               precedence per EC-132 §3 binds the reason from
               useTurnActions.canPassPriority (always allowed; the gate
               is here for the precedence-pattern uniformity). -->
          Pass priority
        </button>
        <button
          type="button"
          data-testid="play-action-heal-wounds"
          :disabled="!healGate().allowed"
          :aria-disabled="!healGate().allowed ? 'true' : undefined"
          :title="healGate().reason ?? undefined"
          @click="onHealWounds"
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
        <header>Step 3 — End turn (play.cleanup)</header>
        <button
          type="button"
          data-testid="play-action-end-turn"
          :disabled="!endTurnGate().allowed"
          :aria-disabled="!endTurnGate().allowed ? 'true' : undefined"
          :title="endTurnGate().reason ?? undefined"
          @click="onEndTurn"
        >
          <!-- why: stage gating per WP-100 §Locked contract values —
               endTurn is gated to play.cleanup. Disabled-tooltip
               precedence per EC-132 §3 binds the reason from
               useTurnActions.canEndTurn. -->
          ✓ End turn — discard hand and draw 6
        </button>
      </li>
    </ol>
    <!-- why: WP-502 / D-24306 — the "End Game" escape hatch closes out an
         in-progress match for EVERY seat (e.g. a co-op table that ran out of
         time). Shown only on the viewer's turn because only the current player's
         move applies (boardgame.io gates top-level moves to the active player).
         Two-click confirm: the first click reveals the confirm/cancel pair so an
         irreversible match-end never fires on a single stray click. -->
    <div
      v-if="isViewerTurn"
      class="turn-action-bar__end-game"
      data-testid="play-end-game"
    >
      <template v-if="!isConfirmingEndGame">
        <span class="turn-action-bar__end-game-label">Out of time?</span>
        <button
          type="button"
          class="turn-action-bar__end-game-request"
          data-testid="play-action-end-game"
          title="End the match now for every player (e.g. your group ran out of time). This closes the game out for everyone."
          @click="requestEndGame"
        >
          ⏹ End Game for everyone
        </button>
      </template>
      <template v-else>
        <span class="turn-action-bar__end-game-prompt">End the match for everyone?</span>
        <button
          type="button"
          class="turn-action-bar__end-game-confirm"
          data-testid="play-action-end-game-confirm"
          @click="confirmEndGame"
        >
          Yes, end it
        </button>
        <button
          type="button"
          class="turn-action-bar__end-game-cancel"
          data-testid="play-action-end-game-cancel"
          @click="cancelEndGame"
        >
          Keep playing
        </button>
      </template>
    </div>
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
  opacity: 0.4;
  font-size: 0.8rem;
}

.turn-action-bar__step--active {
  opacity: 1;
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
}

/* why: WP-502 (discoverability follow-up) — the End Game control sits below the
   three steps. It must be de-emphasized relative to the primary turn actions but
   still clearly a button a player can find when their group runs out of time — the
   first cut was faded to 75% opacity at 0.75rem and was effectively invisible on a
   busy board. It now reads as a real outlined button with a lead-in label; the
   confirm button is tinted danger-red to signal irreversibility. */
.turn-action-bar__end-game {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--color-foreground, #999);
  font-size: 0.8rem;
}

.turn-action-bar__end-game button {
  padding: 0.3rem 0.7rem;
  font-size: 0.8rem;
  cursor: pointer;
}

.turn-action-bar__end-game-label {
  font-weight: 600;
  opacity: 0.85;
}

.turn-action-bar__end-game-request {
  border: 1px solid rgba(160, 60, 60, 0.8);
  border-radius: 0.3rem;
  background: rgba(120, 40, 40, 0.12);
  color: var(--color-foreground, #7a2828);
  font-weight: 600;
}

.turn-action-bar__end-game-request:hover {
  background: rgba(120, 40, 40, 0.22);
}

.turn-action-bar__end-game-prompt {
  font-weight: 700;
}

.turn-action-bar__end-game-confirm {
  background: rgba(120, 40, 40, 0.94);
  color: #f4f4f5;
  border: 1px solid rgba(160, 60, 60, 0.9);
  border-radius: 0.3rem;
}

.turn-action-bar__end-game-cancel {
  border-radius: 0.3rem;
}
</style>
