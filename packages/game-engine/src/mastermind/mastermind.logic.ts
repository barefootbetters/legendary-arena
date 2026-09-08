/**
 * Mastermind logic helpers for the Legendary Arena game engine.
 *
 * Pure functions for tactics deck manipulation and victory detection.
 * No boardgame.io imports. No .reduce(). No throws.
 */

import type { MastermindState } from './mastermind.types.js';

/**
 * Defeats the top tactic card from the tactics deck.
 *
 * Removes tacticsDeck[0] and appends it to tacticsDefeated.
 * Returns a new MastermindState — never mutates the input.
 *
 * If tacticsDeck is empty, returns the input unchanged.
 *
 * @param mastermindState - Current mastermind state.
 * @returns New MastermindState with the top tactic defeated.
 */
export function defeatTopTactic(
  mastermindState: MastermindState,
): MastermindState {
  if (mastermindState.tacticsDeck.length === 0) {
    return mastermindState;
  }

  const defeatedTactic = mastermindState.tacticsDeck[0]!;
  const remainingDeck = mastermindState.tacticsDeck.slice(1);
  const updatedDefeated = [...mastermindState.tacticsDefeated, defeatedTactic];

  // why: copy the prior state and override only the two deck fields so
  // non-deck fields (strikePile, attachedBystanders, gameText) survive the
  // defeat. An explicit field-by-field rebuild silently dropped gameText
  // when that field was added later (WP-154+); copy-then-override is
  // drift-proof against the next MastermindState field.
  return {
    ...mastermindState,
    tacticsDeck: remainingDeck,
    tacticsDefeated: updatedDefeated,
  };
}

/**
 * Checks whether all tactics have been defeated.
 *
 * Returns true only when the tactics deck is empty AND at least one
 * tactic has been defeated. An empty deck with no defeated tactics
 * (e.g., a mastermind with no tactics) returns false.
 *
 * @param mastermindState - Current mastermind state.
 * @returns true if all tactics are defeated.
 */
export function areAllTacticsDefeated(
  mastermindState: MastermindState,
): boolean {
  return (
    mastermindState.tacticsDeck.length === 0 &&
    mastermindState.tacticsDefeated.length > 0
  );
}

/**
 * Flips a transforming mastermind to its other boss face (WP-669 / D-24483).
 *
 * The active face is `baseCardId`; the inactive one is `alternateFaceId`. This
 * swaps them and sets `gameText` to the newly-active face's ability lines (from
 * `faceGameText`). Both faces' fight costs already live in `G.cardStats` (added at
 * setup), so `fightMastermind` reads the new face's cost with no further work, and
 * the UIState mastermind `display` resolves from the new `baseCardId` automatically.
 *
 * Bidirectional: the swap works from either face, so a later flip (Red Hulk →
 * General Ross, the Sentry ↔ Void loop) restores the original.
 *
 * A mastermind with no `alternateFaceId` — every non-transform mastermind, and any
 * transforming one not yet in the setup allowlist — cannot flip, so this is a no-op
 * that returns the input unchanged. Never mutates the input; never throws.
 *
 * @param mastermindState - Current mastermind state.
 * @returns New MastermindState showing the other face, or the input if it cannot flip.
 */
export function transformMastermind(
  mastermindState: MastermindState,
): MastermindState {
  const currentFace = mastermindState.baseCardId;
  const nextFace = mastermindState.alternateFaceId;
  // why: no alternateFaceId → not a captured transforming mastermind → cannot flip.
  if (nextFace === undefined) {
    return mastermindState;
  }
  // why: fall back to the current text if the map somehow lacks the next face — never
  // leave gameText undefined mid-flip (defensive; setup always populates both faces).
  const nextGameText = mastermindState.faceGameText?.[nextFace] ?? mastermindState.gameText ?? [];
  // why: copy-then-override (the defeatTopTactic precedent) so every unrelated field
  // (tactics, strikePile, attachedBystanders, faceGameText) survives the flip. Swap the
  // two faces so the flip is bidirectional; point gameText at the new active face.
  return {
    ...mastermindState,
    baseCardId: nextFace,
    alternateFaceId: currentFace,
    gameText: nextGameText,
  };
}
