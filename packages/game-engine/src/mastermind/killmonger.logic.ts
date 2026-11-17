/**
 * Killmonger's shared reads (WP-769 / D-24602).
 *
 * bkpt Killmonger prints: "While Killmonger has more than 0[icon:attack], you cannot fight him.
 * Instead, you may spend [icon:attack] equal to his [icon:attack] to [keyword:Wound him] and get
 * +1[icon:recruit]." The fightMastermind lock, the woundMastermind move, its getLegalMoves mirror
 * (D-24364) and the UIState projection all read these helpers, so the move gates, the bot and
 * the board can never disagree. The generic Mastermind Wound helpers live in mastermind.logic.ts.
 *
 * // why: this module imports economy.resolve, which reaches fightMastermind / tacticHandlers /
 * mastermindHandlers transitively, so importing it from those files closes a runtime cycle (the
 * D-24601 item-13 class). It is safe because every binding here is read inside function bodies;
 * no importer may read one at module top level.
 *
 * Pure reads over G. No boardgame.io import. No registry import. No .reduce(). Never throws.
 */

import type { LegendaryGameState } from '../types.js';
import { resolveMastermindFightCost } from '../economy/economy.resolve.js';
import { hasAvailableWound, isFinalBlowAvailable } from './mastermind.logic.js';

/** Killmonger's qualified mastermind id (`G.selection.mastermindId`). */
export const KILLMONGER_MASTERMIND_ID = 'bkpt/killmonger';

// why: every Killmonger card id is `bkpt-mastermind-killmonger-<slug>` (mastermind.setup.ts:279);
// the prefix also matches his base card, which reaches a Victory Pile only on the Final Blow.
/** The ext_id prefix shared by Killmonger's tactics (and his base card). */
export const KILLMONGER_TACTIC_ID_PREFIX = 'bkpt-mastermind-killmonger-';

/** The engine-written reason a plain Fight against Killmonger is refused. */
export const KILLMONGER_ATTACK_LOCK_REASON =
  "Killmonger can't be fought while he has more than 0 Attack. Spend Attack equal to his Attack to Wound him and get +1 Recruit.";

/**
 * Reports whether the match's Mastermind is Killmonger.
 *
 * @param G - The game state (read-only).
 * @returns True when the selected Mastermind is bkpt Killmonger.
 */
export function isKillmonger(G: LegendaryGameState): boolean {
  // why: a narrow test G may omit selection; treat it as any other Mastermind.
  return G.selection?.mastermindId === KILLMONGER_MASTERMIND_ID;
}

/**
 * Reports whether Killmonger's printed lock refuses a fight: he leads and his Attack (with every
 * modifier, his Wounds included) is above 0.
 *
 * @param G - The game state (read-only).
 * @param playerId - The player who would fight (the cost authority takes the fighter).
 * @returns True when a plain fight against Killmonger must be refused.
 */
export function isKillmongerAttackLocked(G: LegendaryGameState, playerId: string): boolean {
  if (!isKillmonger(G)) {
    return false;
  }
  return resolveMastermindFightCost(G, playerId) > 0;
}

/**
 * Reports whether the woundMastermind board gates pass: Killmonger, a Tactic or the Final Blow
 * left, his Attack above 0, and a Wound in the KO pile or the Wound Stack.
 *
 * // why: board gates only. The move adds the attack, stage and pending-choice gates; it does
 * not add the Haunt, guard, Enigma or Healing locks, because wounding "does not count as a
 * Fight" (rules v23 L2240-2244).
 *
 * @param G - The game state (read-only).
 * @param playerId - The player who would wound him.
 * @returns True when Killmonger can be wounded on this board.
 */
export function canWoundMastermind(G: LegendaryGameState, playerId: string): boolean {
  if (!isKillmonger(G)) {
    return false;
  }
  const hasTarget =
    G.mastermind.tacticsDeck.length > 0 || isFinalBlowAvailable(G.mastermind, G.finalBlow);
  if (!hasTarget) {
    return false;
  }
  if (!isKillmongerAttackLocked(G, playerId)) {
    return false;
  }
  return hasAvailableWound(G);
}

/**
 * Reports whether the projection shows Killmonger's lock reason: he is locked and a Tactic or
 * the Final Blow is still left (the reason is dropped once he is vanquished).
 *
 * @param G - The game state (read-only).
 * @param playerId - The active player (the cost authority takes the fighter).
 * @returns True when `fortifiedReason` should carry KILLMONGER_ATTACK_LOCK_REASON.
 */
export function isKillmongerLockShown(G: LegendaryGameState, playerId: string): boolean {
  if (!isKillmongerAttackLocked(G, playerId)) {
    return false;
  }
  return G.mastermind.tacticsDeck.length > 0 || isFinalBlowAvailable(G.mastermind, G.finalBlow);
}
