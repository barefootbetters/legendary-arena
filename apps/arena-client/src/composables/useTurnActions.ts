/**
 * Per-stage affordance gating for the WP-129 3-step turn-actions panel.
 *
 * Owns the disabled-state tooltip precedence (stage → resource → structural)
 * for every stage-gated affordance in `<TurnActionBar>` and the play-surface
 * children. Components consume the returned `reason` directly — they do
 * NOT compose tooltips ad-hoc per EC-132 §3.
 *
 * The 3-step turn structure per `DESIGN-BOARD-LAYOUT.md §5.1`:
 *   Step 1 (`play.start`)   → reveal villain
 *   Step 2 (`play.main`)    → play / recruit / fight
 *   Step 3 (`play.cleanup`) → pass priority (advanceStage) / end turn
 *
 * @see WP-129 §Acceptance Criteria — stage gating
 * @see EC-132 §2 3-step turn structure + move-name table
 * @see EC-132 §3 disabled-state tooltip precedence
 * @see DESIGN-BOARD-LAYOUT.md §5.1
 */

import type { GatingResult } from './useCardCostGating';

export type TurnStage = 'start' | 'main' | 'cleanup';
export type TurnStep = 1 | 2 | 3;

const ALLOWED: GatingResult = { allowed: true, reason: null };

const STAGE_DISPLAY_NAMES: Record<TurnStage, string> = {
  start: 'Start (Reveal)',
  main: 'Main (Play / Recruit / Fight)',
  cleanup: 'Cleanup (End Turn)',
};

/**
 * Resolve the active turn step from the engine's `currentStage`. Used by
 * `<TurnActionBar>` to render only the active step at full prominence.
 *
 * // why: stage-to-step mapping is locked at EC-132 §2 and at
 * `DESIGN-BOARD-LAYOUT.md §5.1`. Returning a `TurnStep` rather than a
 * raw stage avoids template branches re-deriving the mapping.
 */
export function activeStepFor(currentStage: string): TurnStep {
  if (currentStage === 'start') {
    return 1;
  }
  if (currentStage === 'main') {
    return 2;
  }
  return 3;
}

function stageGateReason(currentStage: string, allowedStage: TurnStage): string {
  const allowedDisplay = STAGE_DISPLAY_NAMES[allowedStage];
  return `Only available during the ${allowedDisplay} step (current: ${currentStage}).`;
}

const NOT_YOUR_TURN: GatingResult = {
  allowed: false,
  reason: 'It is not your turn.',
};

/**
 * Composable exposing per-button gating predicates for `<TurnActionBar>`.
 * The returned object's keys map 1:1 to the locked move table in
 * EC-132 §2:
 *
 *   - `canRevealVillain`   → `revealVillainCard` at `play.start`
 *   - `canPlayCard`        → `playCard` at `play.main`
 *   - `canFightVillain`    → `fightVillain` at `play.main`
 *   - `canRecruitHero`     → `recruitHero` at `play.main`
 *   - `canFightMastermind` → `fightMastermind` at `play.main`
 *   - `canPassPriority`    → `advanceStage` at any stage (canonical
 *                             stage-advance per D-10011)
 *   - `canEndTurn`         → `endTurn` at `play.cleanup`
 *
 * Each predicate returns a {@link GatingResult}; resource and structural
 * conditions compose on top of the stage-gating reason via the locked
 * precedence (turn → stage → resource → structural).
 *
 * @param currentStage The engine's G.currentStage value.
 * @param isViewerTurn Whether it is currently the viewing player's turn.
 *   When false, all action gates return disabled. Defaults to true for
 *   backwards compatibility with callers that don't pass it.
 * @param hasPendingChoice Whether the viewer has an unresolved hero choice
 *   (derived from `UIState.pendingHeroChoice !== undefined` at the call site).
 *   When true and `currentStage === 'cleanup'`, blocks `canEndTurn` and
 *   `canPassPriority`. Defaults to false — existing callers unaffected.
 * @param hasPendingKoChoice Whether the viewer has an unresolved KO-a-Hero choice
 *   (derived from `UIState.pendingKoHeroChoice !== undefined` at the call site).
 *   When true, blocks `canEndTurn` and `canPassPriority` at ANY stage. Defaults
 *   to false. When both pending choices are active, KO gate reason takes precedence.
 * @param hasPendingOptionalKoReward Whether the viewer has an unresolved
 *   optional-KO-then-reward choice (derived from
 *   `UIState.pendingOptionalKoReward !== undefined` at the call site). When true,
 *   blocks `canEndTurn` and `canPassPriority` at ANY stage (the choice freezes the
 *   board, mirroring `hasPendingKoChoice`). Defaults to false. WP-248's block-all
 *   guard guarantees at most one pending-choice type is active at a time.
 * @param hasPendingDrawOrEmpowered Whether the viewer has an unresolved
 *   draw-or-empowered choice (derived from `UIState.pendingDrawOrEmpowered !== undefined`
 *   at the call site). When true, blocks `canEndTurn` and `canPassPriority` at ANY stage
 *   (WP-286's block-all guard freezes the board, mirroring `hasPendingOptionalKoReward`).
 *   Defaults to false. WP-286's block-all guard guarantees at most one pending-choice
 *   type is active at a time.
 * @param hasPendingVictoryPileCardPick Whether the viewer has an unresolved
 *   victory-pile villain-pick choice (derived from
 *   `UIState.pendingVictoryPileCardPick !== undefined`). When true, blocks
 *   `canEndTurn` and `canPassPriority` at ANY stage. Defaults to false.
 * @param hasPendingOptionalPutBottomHQ Whether the viewer has an unresolved
 *   optional-put-bottom-hq choice (derived from
 *   `UIState.pendingOptionalPutBottomHQ !== undefined` at the call site). When true,
 *   blocks `canEndTurn` and `canPassPriority` at ANY stage (the engine's advanceStage
 *   block-all guard freezes the board, mirroring `hasPendingVictoryPileCardPick`).
 *   Defaults to false. The block-all guard guarantees at most one pending-choice type
 *   is active at a time.
 * @param hasPendingPutAnyNumberBottomHQ Whether the viewer has an unresolved
 *   put-any-number-bottom-hq choice (derived from
 *   `UIState.pendingPutAnyNumberBottomHQ !== undefined` at the call site). When true,
 *   blocks `canEndTurn` and `canPassPriority` at ANY stage (D-24132 — the engine's advanceStage
 *   block-all guard freezes the board, mirroring `hasPendingOptionalPutBottomHQ`). Defaults to
 *   false. The block-all guard guarantees at most one pending-choice type is active at a time.
 * @param hasPendingReturnZeroCostDiscard Whether the viewer has an unresolved
 *   return-zero-cost-discard choice (derived from
 *   `UIState.pendingReturnZeroCostDiscard !== undefined` at the call site). When true,
 *   blocks `canEndTurn` and `canPassPriority` at ANY stage (D-24139 — the engine's full
 *   block-all guard set freezes the board, mirroring `hasPendingKoChoice`). Defaults to
 *   false. The choice is mandatory, so the reason names no decline exit.
 * @param hasWoundInHand Whether the viewer holds at least one Wound in hand
 *   (derived client-side by scanning `viewer.handCards` for the Wound ext_id).
 *   Gates `canHealWounds`. Defaults to false. WP-380.
 * @param hasActedThisTurn Whether the viewer has recruited or fought this turn
 *   (from `UIState.game.hasActedThisTurn`). Bars `canHealWounds`. Defaults to false. WP-380.
 * @param hasHealedThisTurn Whether the viewer has already used Healing this turn
 *   (from `UIState.game.hasHealedThisTurn`). Bars `canHealWounds`. Defaults to false. WP-380.
 */
export function useTurnActions(
  currentStage: string,
  isViewerTurn: boolean = true,
  hasPendingChoice: boolean = false,
  hasPendingKoChoice: boolean = false,
  hasPendingOptionalKoReward: boolean = false,
  hasPendingDrawOrEmpowered: boolean = false,
  hasPendingVictoryPileCardPick: boolean = false,
  hasPendingOptionalPutBottomHQ: boolean = false,
  hasPendingPutAnyNumberBottomHQ: boolean = false,
  hasPendingReturnZeroCostDiscard: boolean = false,
  hasWoundInHand: boolean = false,
  hasActedThisTurn: boolean = false,
  hasHealedThisTurn: boolean = false,
): {
  activeStep: TurnStep;
  canRevealVillain: () => GatingResult;
  canPlayCard: () => GatingResult;
  canFightVillain: () => GatingResult;
  canRecruitHero: () => GatingResult;
  canFightMastermind: () => GatingResult;
  canPassPriority: () => GatingResult;
  canEndTurn: () => GatingResult;
  canHealWounds: () => GatingResult;
} {
  return {
    activeStep: activeStepFor(currentStage),
    canRevealVillain: () => {
      if (!isViewerTurn) return NOT_YOUR_TURN;
      return currentStage === 'start'
        ? ALLOWED
        : { allowed: false, reason: stageGateReason(currentStage, 'start') };
    },
    canPlayCard: () => {
      if (!isViewerTurn) return NOT_YOUR_TURN;
      return currentStage === 'main'
        ? ALLOWED
        : { allowed: false, reason: stageGateReason(currentStage, 'main') };
    },
    canFightVillain: () => {
      if (!isViewerTurn) return NOT_YOUR_TURN;
      return currentStage === 'main'
        ? ALLOWED
        : { allowed: false, reason: stageGateReason(currentStage, 'main') };
    },
    canRecruitHero: () => {
      if (!isViewerTurn) return NOT_YOUR_TURN;
      return currentStage === 'main'
        ? ALLOWED
        : { allowed: false, reason: stageGateReason(currentStage, 'main') };
    },
    canFightMastermind: () => {
      if (!isViewerTurn) return NOT_YOUR_TURN;
      return currentStage === 'main'
        ? ALLOWED
        : { allowed: false, reason: stageGateReason(currentStage, 'main') };
    },
    // why: D-10011 — Pass-priority fires `advanceStage`, the canonical
    // stage-advance vocabulary. Allowed at every stage (start advances
    // to main; main advances to cleanup; cleanup advances + ends turn
    // per turnLoop.ts). NOT a no-op.
    // why: D-22203 — blocked at cleanup ONLY when hasPendingChoice is true.
    // Start and main must remain passable so the player can advance through
    // stages to reach the cleanup prompt; blocking all stages would prevent
    // the player from ever reaching the choice.
    // why: D-24012 — blocked at ANY stage when hasPendingKoChoice is true
    // (the KO choice freezes the board completely, unlike the cleanup-only
    // hero-reveal gate). When both pending choices are active, KO gate
    // reason takes precedence.
    canPassPriority: () => {
      if (!isViewerTurn) return NOT_YOUR_TURN;
      if (hasPendingKoChoice) {
        return {
          allowed: false,
          reason: 'Choose a Hero to KO before taking another action.',
        };
      }
      // why: D-24020 — block turn-end while an optional-KO-then-reward choice is
      // pending (the board is frozen by WP-248's block-all guard, like the KO
      // choice); surface a tooltip instead of a silent rejection. Decline is a
      // first-class exit, so the reason names it.
      if (hasPendingOptionalKoReward) {
        return {
          allowed: false,
          reason: 'Choose a card to KO or Decline before taking another action.',
        };
      }
      // why: D-24071 — End Turn / Pass Priority blocked at any stage while a
      // draw-or-empowered choice is pending (WP-286's block-all guard freezes the
      // board, mirroring hasPendingOptionalKoReward).
      if (hasPendingDrawOrEmpowered) {
        return {
          allowed: false,
          reason: 'Choose Draw a card or Empowered before taking another action.',
        };
      }
      // why: WP-313 / D-24099 — End Turn / Pass Priority blocked at any stage while a
      // victory-pile villain pick is pending (WP-285's block-all guard freezes the
      // board, mirroring hasPendingDrawOrEmpowered).
      if (hasPendingVictoryPileCardPick) {
        return {
          allowed: false,
          reason: 'Pick a Villain from your Victory Pile before taking another action.',
        };
      }
      // why: End Turn / Pass Priority blocked at any stage while an optional-put-bottom-hq
      // choice is pending (the engine's advanceStage block-all guard freezes the board,
      // mirroring hasPendingVictoryPileCardPick). Decline is a first-class exit, so the
      // reason names it.
      if (hasPendingOptionalPutBottomHQ) {
        return {
          allowed: false,
          reason: 'Put a card from the HQ on the bottom of the Hero Deck, or Decline, before taking another action.',
        };
      }
      // why: D-24132 — End Turn / Pass Priority blocked at any stage while a put-any-number-
      // bottom-hq multi-select choice is pending (the engine's advanceStage block-all guard
      // freezes the board, mirroring hasPendingOptionalPutBottomHQ). Put None is a first-class
      // exit, so the reason names it.
      if (hasPendingPutAnyNumberBottomHQ) {
        return {
          allowed: false,
          reason: 'Choose any number of cards from the HQ to put on the bottom, or Put None, before taking another action.',
        };
      }
      // why: D-24139 — End Turn / Pass Priority blocked at any stage while a
      // return-zero-cost-discard choice is pending (the engine's full block-all guard
      // set freezes the board). The choice is mandatory — no decline exit to name.
      if (hasPendingReturnZeroCostDiscard) {
        return {
          allowed: false,
          reason: 'Return a 0-cost card from your discard pile to your hand before taking another action.',
        };
      }
      if (currentStage === 'cleanup' && hasPendingChoice) {
        return {
          allowed: false,
          reason: 'Resolve the revealed card choice before ending your turn.',
        };
      }
      return ALLOWED;
    },
    canEndTurn: () => {
      if (!isViewerTurn) return NOT_YOUR_TURN;
      if (hasPendingKoChoice) {
        // why: D-24012 — the engine's dual turn-end guard (WP-242) blocks
        // endTurn when pendingKoHeroChoices queue is non-empty; this
        // client-side gate surfaces the reason so the player sees a tooltip
        // instead of a silent rejection.
        return {
          allowed: false,
          reason: 'Choose a Hero to KO before taking another action.',
        };
      }
      if (hasPendingOptionalKoReward) {
        // why: D-24020 — WP-248's block-all turn-end guard blocks endTurn while
        // pendingOptionalKoRewards is non-empty; this client-side gate surfaces
        // the reason so the player sees a tooltip instead of a silent rejection.
        return {
          allowed: false,
          reason: 'Choose a card to KO or Decline before taking another action.',
        };
      }
      if (hasPendingDrawOrEmpowered) {
        // why: D-24071 — WP-286's block-all turn-end guard blocks endTurn while
        // pendingDrawOrEmpowered is non-empty; this client-side gate surfaces the
        // reason so the player sees a tooltip instead of a silent rejection.
        return {
          allowed: false,
          reason: 'Choose Draw a card or Empowered before taking another action.',
        };
      }
      if (hasPendingVictoryPileCardPick) {
        // why: WP-313 / D-24099 — WP-285's block-all turn-end guard blocks endTurn
        // while pendingVictoryPileCardPick is non-empty; this client-side gate
        // surfaces the reason so the player sees a tooltip instead of a silent rejection.
        return {
          allowed: false,
          reason: 'Pick a Villain from your Victory Pile before taking another action.',
        };
      }
      if (hasPendingOptionalPutBottomHQ) {
        // why: the engine's advanceStage block-all guard blocks endTurn while
        // pendingOptionalPutBottomHQ is non-empty; this client-side gate surfaces the
        // reason so the player sees a tooltip instead of a silent rejection.
        return {
          allowed: false,
          reason: 'Put a card from the HQ on the bottom of the Hero Deck, or Decline, before taking another action.',
        };
      }
      if (hasPendingPutAnyNumberBottomHQ) {
        // why: D-24132 — the engine's advanceStage block-all guard blocks endTurn while
        // pendingPutAnyNumberBottomHQ is non-empty; this client-side gate surfaces the reason
        // so the player sees a tooltip instead of a silent rejection.
        return {
          allowed: false,
          reason: 'Choose any number of cards from the HQ to put on the bottom, or Put None, before taking another action.',
        };
      }
      if (hasPendingReturnZeroCostDiscard) {
        // why: D-24139 — the engine's block-all guards block endTurn while
        // pendingReturnZeroCostDiscard is non-empty; this client-side gate surfaces the
        // reason so the player sees a tooltip instead of a silent rejection.
        return {
          allowed: false,
          reason: 'Return a 0-cost card from your discard pile to your hand before taking another action.',
        };
      }
      if (currentStage === 'cleanup' && hasPendingChoice) {
        // why: D-22203 — the engine's dual turn-end guard (WP-220) blocks
        // endTurn when pendingHeroChoice is set; this client-side gate
        // surfaces the reason so the player sees a tooltip instead of a
        // silent rejection.
        return {
          allowed: false,
          reason: 'Resolve the revealed card choice before ending your turn.',
        };
      }
      return currentStage === 'cleanup'
        ? ALLOWED
        : { allowed: false, reason: stageGateReason(currentStage, 'cleanup') };
    },
    // why: WP-380 / D-24181 — the Wound "Healing" ability (engine healWounds).
    // Precedence: turn → main stage → block-all pending → wound-in-hand →
    // not-acted → not-healed. The pending set mirrors the engine healWounds
    // guards exactly (D-24008 / D-24019 / D-24067 / D-24069 / D-24139 — the same
    // 5-guard cluster as fightVillain), so a grayed button never hides a legal
    // move and a live button never offers an illegal one.
    canHealWounds: () => {
      if (!isViewerTurn) return NOT_YOUR_TURN;
      if (currentStage !== 'main') {
        return { allowed: false, reason: stageGateReason(currentStage, 'main') };
      }
      if (
        hasPendingKoChoice ||
        hasPendingOptionalKoReward ||
        hasPendingVictoryPileCardPick ||
        hasPendingDrawOrEmpowered ||
        hasPendingReturnZeroCostDiscard
      ) {
        return {
          allowed: false,
          reason: 'Resolve the pending choice before you can heal.',
        };
      }
      if (!hasWoundInHand) {
        return {
          allowed: false,
          reason: 'You have no Wounds in hand to heal.',
        };
      }
      if (hasActedThisTurn) {
        return {
          allowed: false,
          reason: 'You cannot heal after recruiting or fighting this turn.',
        };
      }
      if (hasHealedThisTurn) {
        return {
          allowed: false,
          reason: 'You have already healed this turn.',
        };
      }
      return ALLOWED;
    },
  };
}
