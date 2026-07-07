/**
 * resolveVictoryPileCardPick move — resolves a pending victory-pile villain-pick
 * player choice (WP-285 / D-24067).
 *
 * Called by the active player after a victory-villain-attack hero ability parked a
 * PendingVictoryPileCardPick on G.pendingVictoryPileCardPick (FIFO). The player
 * picks one villain from their victory pile by cardId; the move grants attack equal
 * to that villain's printed fight cost from G.cardStats[cardId].fightCost.
 * Note: villain cards store the "printed [icon:attack]" as fightCost (the fight
 * requirement). The .attack field is always 0 for villain cards.
 *
 * Resolution-time eligibility is authoritative — the victory pile may have changed
 * between park time and resolve time. The move re-filters the victory pile at
 * resolve time; a stale or absent target is a silent no-op (queue intact, no attack
 * granted, player resubmits with a valid target).
 *
 * Atomicity: attack is granted ONLY after the cardId passes all eligibility checks.
 * No partial mutation on any failure path.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { formatCardRef } from '../log/logDisplay.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveVictoryPileCardPick move.
 *
 * The player must supply the ext_id of the villain they want to claim attack from.
 */
export interface ResolveVictoryPileCardPickArgs {
  /** The CardExtId of the villain in the player's victory pile to claim attack from. */
  cardId: CardExtId;
}

/**
 * Whether any victory-pile villain-pick is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the
 * getLegalMoves short-circuit. `undefined` and `[]` both mean no pending pick
 * (mirrors hasPendingOptionalKoReward, D-24007).
 *
 * // why: pendingVictoryPileCardPick is lazy-init (D-24067); undefined and [] both mean no pending pick
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending victory-pile pick queue holds at least one entry.
 */
export function hasPendingVictoryPileCardPick(G: LegendaryGameState): boolean {
  return (G.pendingVictoryPileCardPick?.length ?? 0) > 0;
}

/**
 * Returns the villain CardExtIds currently eligible for a victory-pile pick.
 *
 * Eligibility: card must be present in G.playerZones[playerID].victory AND
 * G.villainDeckCardTypes[cardId] must equal 'villain' (not henchman, bystander,
 * scheme-twist, mastermind-strike, or tactic).
 *
 * // why: filter reads setup-time villain-deck type map (WP-014B); tactics are in G.mastermind, never in this map, so === 'villain' cleanly excludes them
 *
 * Called at resolve time (not park time) so the eligibility list is always
 * authoritative — victory pile contents may have changed since the pick was parked.
 *
 * @param G - The game state to read (not mutated).
 * @param playerID - The player whose victory pile to inspect.
 * @returns Array of eligible villain CardExtIds, in victory pile order.
 */
export function getEligibleVictoryVillains(
  G: LegendaryGameState,
  playerID: string,
): CardExtId[] {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return [];
  }
  const eligible: CardExtId[] = [];
  for (const cardId of playerZones.victory) {
    // why: filter reads setup-time villain-deck type map (WP-014B); tactics are in G.mastermind, never in this map, so === 'villain' cleanly excludes them
    if (G.villainDeckCardTypes[cardId] === 'villain') {
      eligible.push(cardId);
    }
  }
  return eligible;
}

/**
 * Resolves the FRONT pending victory-pile villain-pick choice.
 *
 * Atomic sequence (HARD — exact order, mirrors optionalKoReward.resolve.ts):
 *   1. Validate args — cardId must be a non-empty string; invalid → silent no-op.
 *   2. Validate the front pending entry — non-empty queue, front.playerID match.
 *   3. Re-filter eligible villains from G at resolve time (victory pile may have
 *      changed since park time). Empty eligible list → silent no-op, queue intact.
 *   4. Confirm cardId is in the eligible list. Absent/stale → silent no-op, queue
 *      intact (player resubmits with a valid target).
 *   5. Read villain fight cost from G.cardStats[cardId].fightCost (villain's printed attack value).
 *   6. Grant attack → G.turnEconomy.attack += attack.
 *   7. Front-pop (queue.shift()) LAST, mirroring WP-248.
 *
 * Any failure before step 6 ABORTS the attack grant (no partial mutation).
 * Moves never throw.
 *
 * // why: block-all guard — no other move may fire while a pending victory-pile pick is outstanding (D-24067)
 *
 * @param context - boardgame.io move context with G and playerID.
 * @param args - the cardId to claim attack from.
 */
export function resolveVictoryPileCardPick(
  { G, playerID }: MoveContext,
  args: ResolveVictoryPileCardPickArgs,
): void {
  // why: block-all guard — no other move may fire while a pending victory-pile pick is outstanding (D-24067)

  // Step 1: Validate args — cardId must be a non-empty string.
  const cardId = (args as { cardId?: unknown }).cardId;
  if (typeof cardId !== 'string' || cardId.length === 0) {
    return;
  }
  const typedCardId = cardId as CardExtId;

  // Step 2: Validate the front pending entry.
  const queue = G.pendingVictoryPileCardPick;
  // why: pendingVictoryPileCardPick is lazy-init (D-24067); undefined and [] both mean no pending pick
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }

  // Step 3: Re-filter at resolve time — the victory pile may have changed since park.
  const eligibleVillains = getEligibleVictoryVillains(G, playerID);
  if (eligibleVillains.length === 0) {
    return;
  }

  // Step 4: Confirm the chosen card is in the eligible list right now.
  let isEligible = false;
  for (const eligibleId of eligibleVillains) {
    if (eligibleId === typedCardId) {
      isEligible = true;
      break;
    }
  }
  if (!isEligible) {
    return;
  }

  // Step 5: Read the villain's printed fight cost from G.cardStats.
  // why: villain cards store the "printed [icon:attack]" as fightCost (the fight requirement),
  // not .attack (which is 0 for all villain cards — only heroes carry an .attack stat).
  // D-24067 specifies ".attack" but that field is always 0 for villains; fightCost is the
  // correct semantic match for the Ebony Blade's "printed Attack of a Villain" mechanic.
  if (!G.turnEconomy) {
    return;
  }
  const cardStat = G.cardStats[typedCardId];
  const attack = cardStat !== undefined ? cardStat.fightCost : 0;

  // Step 6: Grant attack — the ONLY G mutation on the success path.
  G.turnEconomy.attack += attack;
  G.messages.push(
    `Player ${playerID} claimed +${attack} attack from ${formatCardRef(G.cardDisplayData, typedCardId)} in their victory pile (Ebony Blade).`,
  );

  // Step 7: Front-pop LAST (front-pop = Array.shift), mirroring WP-248.
  queue.shift();
}
