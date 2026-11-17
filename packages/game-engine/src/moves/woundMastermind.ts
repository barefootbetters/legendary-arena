/**
 * Wound the Mastermind move for the Legendary Arena game engine (WP-769 / D-24602).
 *
 * bkpt Killmonger: "While Killmonger has more than 0[icon:attack], you cannot fight him. Instead,
 * you may spend [icon:attack] equal to his [icon:attack] to [keyword:Wound him] and get
 * +1[icon:recruit]." Each call spends his current Attack, puts one Wound on him (−1 Attack) and
 * grants +1 Recruit. Repeatable any number of times per turn (rules v23 L2230-2240).
 *
 * // why: wounding "does not count as a Fight" (rules v23 L2240-2244): it rescues no
 * Bystanders, and Healing is still allowed that turn. So it checks none of the fight-only locks
 * (Haunt, guard, Enigma guess, the Healing lock), does not set hasActedThisTurn, fires no Diamond
 * Form edge and no Excessive Violence. It does respect every pending choice (hasAnyPendingChoice),
 * as every action does.
 *
 * This is a non-core move that gates internally (the attemptHeist precedent). It is NOT added to
 * CoreMoveName, CORE_MOVE_NAMES, or MOVE_ALLOWED_STAGES. Its name does not start with `resolve…`,
 * so server autoplay offers it to the policy (D-24591).
 *
 * No registry imports. No .reduce(). Moves never throw. Imported bindings are read only inside
 * the function body (killmonger.logic and phaseCard sit in runtime-safe import cycles).
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { hasAnyPendingChoice } from './phaseCard.js';
import {
  addResources,
  getSpendableAttackForTarget,
  spendFightCostForTarget,
} from '../economy/economy.logic.js';
import { resolveMastermindFightCost } from '../economy/economy.resolve.js';
import { countMastermindWounds, takeWoundForMastermind } from '../mastermind/mastermind.logic.js';
import { canWoundMastermind } from '../mastermind/killmonger.logic.js';
import { resolveCardName } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

// why: "and get +1[icon:recruit]" — printed on Killmonger, once per Wound.
/** Recruit granted for each Wound put on the Mastermind. */
const WOUND_MASTERMIND_RECRUIT = 1;

/**
 * Spends Attack equal to Killmonger's Attack to put a Wound on him and gain +1 Recruit.
 *
 * Validation (silent returns, in order): the board gates (`canWoundMastermind`: Killmonger, a
 * Tactic or the Final Blow left, his Attack above 0, a Wound in the KO pile or Wound Stack);
 * enough spendable Attack; the `main` stage; no pending choice.
 *
 * @param context - boardgame.io move context with G and ctx.
 */
// why: an `export function` declaration (hoisted), because the MOVE_MAPs read this binding at
// module top level and its import chain reaches the transitive economy.resolve cycle.
export function woundMastermind({ G, ctx }: MoveContext): void {
  const currentPlayer = ctx.currentPlayer;
  // Step 1: Validate.
  if (!canWoundMastermind(G, currentPlayer)) {
    return;
  }
  // why: "spend [attack] equal to his [attack]" — his Attack from the single cost authority
  // (Dark Portal, reductions and Wounds included), not the Size-Changing FIGHT price (D-24802):
  // wounding is not a fight.
  const woundCost = resolveMastermindFightCost(G, currentPlayer);
  // why: WP-790 / D-24652 + WP-580 / D-24389 — the same per-target spendable figure the fight
  // gates on (Mastermind-restricted Attack counts; unspent Recruit under the conversion).
  if (getSpendableAttackForTarget(G.turnEconomy, 'mastermind') < woundCost) {
    return;
  }
  // Step 2: Stage gate and pending choices.
  if (G.currentStage !== 'main') {
    return;
  }
  if (hasAnyPendingChoice(G)) {
    return;
  }

  // Step 3: Mutate G.
  G.turnEconomy = spendFightCostForTarget(G.turnEconomy, woundCost, 'mastermind');
  // why: canWoundMastermind guaranteed a Wound in the KO pile or the Wound Stack; the KO pile
  // goes first (operator default, D-24602).
  takeWoundForMastermind(G);
  G.turnEconomy = addResources(G.turnEconomy, 0, WOUND_MASTERMIND_RECRUIT);
  const mastermindName = resolveCardName(G.cardDisplayData, G.mastermind.baseCardId);
  pushLog(G,
    `Player ${currentPlayer} spent ${String(woundCost)} Attack to Wound ${mastermindName} and got +${String(WOUND_MASTERMIND_RECRUIT)} Recruit; he has ${String(countMastermindWounds(G.mastermind))} Wound(s) and ${String(resolveMastermindFightCost(G, currentPlayer))} Attack now.`,
    'applied',
  );
}
