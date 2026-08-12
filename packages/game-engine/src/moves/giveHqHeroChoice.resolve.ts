/**
 * resolveGiveHqHeroChoice move — resolves a pending give-HQ-Hero player choice
 * (WP-532 / D-24343).
 *
 * Parked by the `give-hq-hero-each-player` villain-effect handler (Paibok the Power
 * Skrull Fight) when the CURRENT (fighting) player reaches ≥ 2 HQ Heroes to choose
 * from. The player picks which HQ Hero to gain; this move moves that Hero from the HQ
 * into the chooser's discard pile (D-24327 gain-routing), refills the vacated HQ slot
 * from `G.heroDeck`, and front-pops the queue. Every other player (and a bot-driven
 * current player, via ai.legalMoves) auto-gains the highest-cost HQ Hero, so only the
 * current human player ever parks an entry here.
 *
 * Atomicity is exact: the chosen `cardId` must be a Hero present in `G.hq` NOW (the
 * block-all guards freeze the board between park and resolve). A stale/absent/wrong
 * target is a silent no-op that leaves the queue intact so the player can resubmit.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { refillHqSlot } from '../board/city.logic.js';
import { selectHighestCostHqIndex } from '../villain/villainEffects.execute.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveGiveHqHeroChoice move.
 *
 * cardId — the HQ Hero ext_id the player chooses to gain (must be in `G.hq` now).
 */
export interface ResolveGiveHqHeroChoiceArgs {
  cardId: CardExtId;
}

/**
 * Whether any give-HQ-Hero choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the
 * getLegalMoves short-circuit. Undefined and [] both mean no pending choice.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending give-HQ-Hero queue holds at least one entry.
 */
export function hasPendingGiveHqHeroChoice(G: LegendaryGameState): boolean {
  return (G.pendingGiveHqHeroChoices?.length ?? 0) > 0;
}

/**
 * The HQ Heroes the given player may gain for the FRONT pending choice — the
 * non-null `G.hq` occupants (in slot order) when the front entry belongs to the
 * player, else `[]`.
 *
 * // why: the eligibility source shared by the UIState projection and the resolve
 * validation (the round-trip rule) so the client can only submit a Hero the resolve
 * move accepts. The HQ is PUBLIC, so no hand-leak redaction — but still gated on the
 * front chooser so only the active chooser's list projects.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose front pending choice is inspected.
 * @returns The gainable HQ Hero ids in HQ slot order, or [] when not this player's choice.
 */
export function getEligibleGiveHqHeroCards(
  G: LegendaryGameState,
  playerID: string,
): CardExtId[] {
  const queue = G.pendingGiveHqHeroChoices;
  if (queue === undefined || queue.length === 0) {
    return [];
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return [];
  }
  const eligible: CardExtId[] = [];
  for (let hqIndex = 0; hqIndex < G.hq.length; hqIndex++) {
    const slot = G.hq[hqIndex];
    if (slot !== null && slot !== undefined) {
      eligible.push(slot);
    }
  }
  return eligible;
}

/**
 * The deterministic bot/auto default HQ Hero to gain for the FRONT pending choice —
 * the highest-cost HQ Hero (ties → rightmost index), matching the handler's
 * non-current auto-gain selector. Returns null when it is not this player's choice or
 * the HQ is empty.
 *
 * // why: the bot picks the highest-cost Hero (the operator-locked "for the bot, just
 * choose the highest cost"); ai.legalMoves returns exactly this as the single legal
 * move so a bot-driven chooser never blocks the board.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose front pending choice is inspected.
 * @returns The highest-cost gainable HQ Hero id, or null.
 */
export function selectDefaultGiveHqHeroCard(
  G: LegendaryGameState,
  playerID: string,
): CardExtId | null {
  const queue = G.pendingGiveHqHeroChoices;
  if (queue === undefined || queue.length === 0) {
    return null;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return null;
  }
  const hqIndex = selectHighestCostHqIndex(G);
  if (hqIndex === null) {
    return null;
  }
  return (G.hq[hqIndex] ?? null) as CardExtId | null;
}

/**
 * Resolves the FRONT pending give-HQ-Hero choice by moving the chosen HQ Hero into
 * the chooser's discard pile.
 *
 * Atomic sequence:
 *   1. Validate args — a non-empty `cardId`; an invalid shape is a silent no-op.
 *   2. Validate the front pending entry — non-empty queue, front.playerID +
 *      choiceType match.
 *   3. The chosen `cardId` must be a Hero present in `G.hq` NOW; absent/stale →
 *      silent no-op, queue intact (resubmit).
 *   4. Vacate the HQ slot, refill it from `G.heroDeck`, push the Hero onto the
 *      chooser's discard (D-24327), log, then front-pop LAST.
 *
 * Any failure before step 4 ABORTS the move (no zone change). Moves never throw.
 *
 * @param context - boardgame.io move context with G and playerID.
 * @param args - the selected { cardId } to gain from the HQ.
 */
export function resolveGiveHqHeroChoice(
  { G, playerID }: MoveContext,
  args: ResolveGiveHqHeroChoiceArgs,
): void {
  // Step 1: Validate args — empty / non-string cardId is a no-op.
  if (typeof args.cardId !== 'string' || args.cardId.length === 0) {
    return;
  }

  // Step 2: Validate the front pending entry — front-only resolution.
  const queue = G.pendingGiveHqHeroChoices;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }
  if (front.choiceType !== 'give-hq-hero') {
    return;
  }

  // Step 3: Resolve against CURRENT G — the chosen cardId must be an HQ occupant now
  // (no eligible snapshot is stored; eligibility is recomputed fresh, the round-trip rule).
  let hqIndex = -1;
  for (let slotIndex = 0; slotIndex < G.hq.length; slotIndex++) {
    if (G.hq[slotIndex] === args.cardId) {
      hqIndex = slotIndex;
      break;
    }
  }
  if (hqIndex === -1) {
    // why: invalid/stale target (not in the HQ) is a no-op that leaves the queue intact so
    // the player resubmits; the block-all guard guarantees a valid HQ Hero still exists.
    return;
  }

  // Step 4: Mutate — vacate the slot, refill from G.heroDeck, gain to the chooser's discard.
  const heroId = G.hq[hqIndex] as CardExtId;
  G.hq[hqIndex] = null;
  const refillResult = refillHqSlot(G.hq, hqIndex, G.heroDeck);
  G.hq = refillResult.hq;
  G.heroDeck = refillResult.heroDeck;
  // why: D-24327 — "gain" routes to the recipient's discard pile, never the victory pile.
  const playerZones = G.playerZones[playerID];
  if (playerZones) {
    playerZones.discard.push(heroId);
  }
  pushLog(
    G,
    `Player ${playerID} gained ${formatCardRef(G.cardDisplayData, heroId)} from the HQ into their discard pile.`,
  );

  // Step 5: Front-pop LAST — each entry owes exactly one Hero (no `remaining`).
  queue.shift();
}
