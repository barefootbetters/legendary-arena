/**
 * Mastermind logic helpers for the Legendary Arena game engine.
 *
 * Pure functions for tactics deck manipulation and victory detection.
 * No boardgame.io imports. No .reduce(). No throws.
 *
 * WP-769 / D-24602 adds the generic Mastermind Wound helpers at the end of this file. Two are
 * pure reads; `takeWoundForMastermind`, `takeWoundFromMastermind` and `returnMastermindWounds`
 * MUTATE G in place (the board/wounds.logic.ts shape) and never throw. They always reassign
 * `G.mastermind`, `G.ko` and `G.piles.wounds` from new arrays, never `.push` / `.splice` a held
 * one, so an old and a new MastermindState that share an array through a spread never alias.
 */

import type { MastermindState } from './mastermind.types.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
// why: WP-769 / D-24602 — both are leaf modules (zoneOps imports only types; pilesInit only the
// import-free shuffle module), so these runtime imports add no cycle to economy.resolve, which
// reads countMastermindWounds from here.
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { moveCardFromZone } from '../moves/zoneOps.js';

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
 * Whether the optional Final Blow 5th, final fight is available right now
 * (WP-687 / D-24504).
 *
 * True only when the match is playing the Final Blow rule, every Tactic has been
 * defeated (the deck is empty), and the final blow is still pending — i.e. the
 * Mastermind card has not yet been awarded (`finalBlowPending` is cleared to false
 * the moment the final fight awards the card, so a settled win reads false here).
 *
 * This is the SINGLE source of truth shared by exactly two engine sites — the
 * `fightMastermind` final-fight gate and the `uiState.build` projection — so the
 * engine's "can the final blow happen" decision and the tile's "fight the
 * Mastermind again" affordance can never disagree (the `resolveMastermindFightCost`
 * centralization precedent, D-24348). The client tile consumes the PROJECTED
 * `finalBlowPending` field, never this helper (layer boundary). D-24739 adds the
 * free-defeat path: `isMastermindFreeDefeatTarget` (eligibility) and
 * `dispatchDefeatWithBystanderTarget` (award) read it too, so Pure Fury / Silent
 * Sniper can strike the final blow on exactly the same condition.
 *
 * @param mastermindState - Current mastermind state.
 * @param finalBlow - Whether the match is playing the Final Blow rule (`G.finalBlow`).
 * @returns true when the final, Mastermind-card fight is available.
 */
export function isFinalBlowAvailable(
  mastermindState: MastermindState,
  finalBlow: boolean | undefined,
): boolean {
  return (
    finalBlow === true &&
    mastermindState.tacticsDeck.length === 0 &&
    mastermindState.finalBlowPending === true
  );
}

/**
 * Latches the Final Blow "final fight required" state (WP-687 / D-24504).
 *
 * Sets `finalBlowPending` true — called when the last Tactic is defeated under the
 * Final Blow rule, so the Mastermind stays fightable one final time. Returns a new
 * MastermindState; never mutates the input.
 *
 * @param mastermindState - Current mastermind state.
 * @param pending - The pending value (true to require the final fight, false once it is awarded).
 * @returns New MastermindState with `finalBlowPending` set.
 */
export function setFinalBlowPending(
  mastermindState: MastermindState,
  pending: boolean,
): MastermindState {
  // why: copy-then-override (the defeatTopTactic precedent) so every unrelated
  // field survives; only the one flag changes.
  return {
    ...mastermindState,
    finalBlowPending: pending,
  };
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

/**
 * Counts the Wounds on the Mastermind (WP-769 / D-24602).
 *
 * @param mastermindState - Current mastermind state.
 * @returns How many Wounds are on the Mastermind; 0 when the field is absent.
 */
export function countMastermindWounds(mastermindState: MastermindState): number {
  return mastermindState.wounds?.length ?? 0;
}

/**
 * Reports whether a Wound is available to put on the Mastermind: one in the KO pile or the
 * Wound Stack (keywords "Wound": "from the Wound Stack or KO pile").
 *
 * @param G - Game state (read-only).
 * @returns True when the KO pile or the Wound Stack holds a Wound.
 */
export function hasAvailableWound(G: LegendaryGameState): boolean {
  return G.ko.includes(WOUND_EXT_ID) || G.piles.wounds.length > 0;
}

/**
 * Puts one Wound on the Mastermind: the first Wound in the KO pile, else the top of the
 * Wound Stack (WP-769 / D-24602). Mutates G in place; never throws.
 *
 * // why: operator default (2026-11-16) — rules v23 L2217-2219 give the player "the Wound
 * Stack or the KO pile" with no order. KO-pile-first never hastens a Wound-Stack loss
 * (Legacy Virus, D-24320) and the returned Wounds refill the stack anyway.
 *
 * @param G - Game state (mutated: G.ko or G.piles.wounds, G.mastermind, maybe G.koPileLengthAtTurnStart).
 * @returns The Wound card id put on the Mastermind, or null when none was available.
 */
export function takeWoundForMastermind(G: LegendaryGameState): CardExtId | null {
  const koIndex = G.ko.indexOf(WOUND_EXT_ID);
  let woundCardId: CardExtId;
  if (koIndex >= 0) {
    woundCardId = G.ko[koIndex]!;
    G.ko = moveCardFromZone(G.ko, [], woundCardId).from;
    // why: D-24568 — this is the first removal from the KO pile, whose "KO'd this turn"
    // window is G.ko[koPileLengthAtTurnStart..]. Taking a card from before the snapshot
    // shifts the window left by one, so the snapshot moves with it (never created here).
    if (G.koPileLengthAtTurnStart !== undefined && koIndex < G.koPileLengthAtTurnStart) {
      G.koPileLengthAtTurnStart = G.koPileLengthAtTurnStart - 1;
    }
  } else if (G.piles.wounds.length > 0) {
    woundCardId = G.piles.wounds[0]!;
    G.piles.wounds = G.piles.wounds.slice(1);
  } else {
    return null;
  }
  G.mastermind = { ...G.mastermind, wounds: [...(G.mastermind.wounds ?? []), woundCardId] };
  return woundCardId;
}

/**
 * Takes one Wound off the Mastermind (the first held), deleting the field when it empties
 * (WP-769 / D-24602). Mutates G in place; never throws.
 *
 * @param G - Game state (mutated: G.mastermind).
 * @returns The Wound card id taken, or null when the Mastermind holds none.
 */
export function takeWoundFromMastermind(G: LegendaryGameState): CardExtId | null {
  const heldWounds = G.mastermind.wounds;
  if (heldWounds === undefined || heldWounds.length === 0) {
    return null;
  }
  const woundCardId = heldWounds[0]!;
  const remainingWounds = heldWounds.slice(1);
  if (remainingWounds.length === 0) {
    G.mastermind = copyWithoutWounds(G.mastermind);
  } else {
    G.mastermind = { ...G.mastermind, wounds: remainingWounds };
  }
  return woundCardId;
}

/**
 * Returns every Wound on the Mastermind to the bottom of the Wound Stack and deletes the field
 * (WP-769 / D-24602; rules v23 L2236-2246). Mutates G in place; never throws.
 *
 * @param G - Game state (mutated: G.piles.wounds, G.mastermind).
 * @returns How many Wounds were returned; 0 (and no change) when none were held.
 */
export function returnMastermindWounds(G: LegendaryGameState): number {
  const heldWounds = G.mastermind.wounds;
  if (heldWounds === undefined) {
    return 0;
  }
  // why: rules v23 L2244-2246 — returned Wounds go on the bottom of the stack (index 0 is the top).
  G.piles.wounds = [...G.piles.wounds, ...heldWounds];
  G.mastermind = copyWithoutWounds(G.mastermind);
  return heldWounds.length;
}

/**
 * Copies a MastermindState without its `wounds` key (omit-when-empty, never `[]`).
 *
 * @param mastermindState - The state to copy.
 * @returns A copy with no `wounds` key.
 */
function copyWithoutWounds(mastermindState: MastermindState): MastermindState {
  const copy: MastermindState = { ...mastermindState };
  delete copy.wounds;
  return copy;
}
