/**
 * Baron Zemo's rescue on a fight (WP-819 / D-24753).
 *
 * "Whenever you fight a Villain, you may use 2 Recruit to rescue a Bystander."
 * The fightVillain move decides whether to pay the rescue with these helpers;
 * the playerView projection uses the cue helper to tell the client when to
 * offer the control.
 *
 * Pure: reads G and the turn economy, never mutates them, never throws.
 * No boardgame.io imports. No registry imports. No .reduce().
 */

import type { LegendaryGameState } from '../types.js';
import type { TurnEconomy, AttackTargetName } from './economy.types.js';
import { getAvailableRecruit, spendFightCostForTarget } from './economy.logic.js';

/** The Recruit Baron Zemo's passive charges to rescue one Bystander on a fight. */
export const RESCUE_ON_FIGHT_RECRUIT_COST = 2;

// why: the single home of the Baron Zemo mastermind id. The rescue's offer test and the
// cue read it here, and WP-818's fight-cost term and Master Strike import it (whichever of
// the two packets lands second swaps its private copy for this export), so the id is
// declared once rather than three times (code-style: abstract at the third copy).
/** The qualified `set/slug` id of the Baron Heinrich Zemo mastermind. */
export const BARON_ZEMO_MASTERMIND_ID = 'ca75/baron-heinrich-zemo';

/**
 * Returns whether this match offers Baron Zemo's rescue on a fight, which is
 * true only when Baron Zemo is the Mastermind.
 *
 * @param G - The game state (read only; `selection` may be absent on partial test states).
 * @returns True when the selected Mastermind is Baron Heinrich Zemo.
 */
export function isRescueOnFightOffered(G: LegendaryGameState): boolean {
  return G.selection?.mastermindId === BARON_ZEMO_MASTERMIND_ID;
}

/**
 * Returns whether the fighter can still pay the rescue's Recruit after the
 * fight's own cost is debited.
 *
 * // why: under the WP-580 recruit-as-attack conversion the fight itself can
 * spend Recruit, so the rescue is judged against a SIMULATED fight debit (the
 * pure spendFightCostForTarget on a copy). The caller folds an open Excessive
 * Violence +1 into `fightDebit`, so a paid rescue never makes the fight or the
 * Excessive Violence extra unaffordable.
 *
 * @param economy - The current turn economy (not mutated).
 * @param fightDebit - The fight cost to simulate, including any open Excessive Violence +1.
 * @param fightTarget - The fought City space, for restricted-attack eligibility.
 * @returns True when at least RESCUE_ON_FIGHT_RECRUIT_COST Recruit remain after the debit.
 */
export function canPayRescueOnFight(
  economy: TurnEconomy,
  fightDebit: number,
  fightTarget: AttackTargetName,
): boolean {
  const economyAfterFight = spendFightCostForTarget(economy, fightDebit, fightTarget);
  return getAvailableRecruit(economyAfterFight) >= RESCUE_ON_FIGHT_RECRUIT_COST;
}

/**
 * Returns whether the active player's economy cue for the rescue is on: Baron
 * Zemo is the Mastermind, the Bystander supply has a card, and the player has
 * at least RESCUE_ON_FIGHT_RECRUIT_COST unspent Recruit.
 *
 * The cue only says the option exists. The per-villain affordability (the fight
 * cost plus the rescue) is the client's mirror and the move's own check.
 *
 * @param G - The game state (read only).
 * @returns True when the client should offer the rescue control.
 */
export function isRescueOnFightCueOn(G: LegendaryGameState): boolean {
  return (
    isRescueOnFightOffered(G) &&
    G.piles.bystanders.length > 0 &&
    getAvailableRecruit(G.turnEconomy) >= RESCUE_ON_FIGHT_RECRUIT_COST
  );
}
