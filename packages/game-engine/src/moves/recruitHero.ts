/**
 * Recruit hero move for the Legendary Arena game engine.
 *
 * recruitHero removes a hero from an HQ slot and places it in the current
 * player's discard pile. Follows the three-step validation contract:
 * validate args, check stage gate, mutate G.
 *
 * This is a non-core move that gates internally (same pattern as
 * revealVillainCard from WP-014A). It is NOT added to CoreMoveName,
 * CORE_MOVE_NAMES, or MOVE_ALLOWED_STAGES.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { getAvailableRecruit, spendRecruit } from '../economy/economy.logic.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/** Arguments for the recruitHero move. */
interface RecruitHeroArgs {
  /** 0-based index of the HQ slot to recruit from (0-4). */
  hqIndex: number;
}

/**
 * Recruits a hero from the HQ.
 *
 * Removes the card from the specified HQ slot and places it in the
 * current player's discard pile.
 *
 * @param context - boardgame.io move context with G, ctx.
 * @param args - The HQ slot index to recruit from.
 */
export function recruitHero(
  { G, ctx }: MoveContext,
  { hqIndex }: RecruitHeroArgs,
): void {
  // Step 1: Validate args
  if (
    typeof hqIndex !== 'number' ||
    !Number.isFinite(hqIndex) ||
    !Number.isInteger(hqIndex) ||
    hqIndex < 0 ||
    hqIndex > 4
  ) {
    return;
  }

  const cardId = G.hq[hqIndex];
  if (cardId === null || cardId === undefined) {
    return;
  }

  // why: silent failure preserves deterministic move contract — insufficient
  // recruit points means the recruit cannot proceed
  const requiredCost = G.cardStats[cardId]?.cost ?? 0;
  const availableRecruit = getAvailableRecruit(G.turnEconomy);
  if (availableRecruit < requiredCost) {
    return;
  }

  // Step 2: Stage gate (non-core move, internal gating)
  // why: recruiting happens during the main action window; non-core moves
  // gate internally per the WP-014A precedent
  if (G.currentStage !== 'main') return;

  // Step 3: Mutate G
  // why: MVP has no recruit point check; WP-018 adds the economy. Any
  // player can recruit any occupied HQ slot without spending recruit points.
  G.hq[hqIndex] = null;
  G.playerZones[ctx.currentPlayer]!.discard.push(cardId);
  G.turnEconomy = spendRecruit(G.turnEconomy, requiredCost);
  G.messages.push(
    `Player ${ctx.currentPlayer} recruited "${cardId}" from HQ slot ${hqIndex}.`,
  );
}
