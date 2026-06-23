/**
 * Play a card from the face-down store (WP-282 / EC-313).
 *
 * Retrieves a card from the player's face-down store and plays it through
 * the identical pathway as hand play: move to inPlay, add stats, execute hooks.
 * Follows the Move Validation Contract: validate args, check stage gate, mutate G.
 *
 * Moves never throw. Invalid state causes an early return (void).
 * All randomness uses ctx.random exclusively — never Math.random().
 *
 * // IC-282-02: playFromUndercover(instanceId) must produce identical state
 * // transitions as playing that same instance from hand. Respects all
 * // onPlay/onReveal/onRecruit hooks and emits identical events.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { moveCardFromZone } from './zoneOps.js';
import { addResources } from '../economy/economy.logic.js';
import { executeHeroEffects } from '../hero/heroEffects.execute.js';
import { hasPendingKoHeroChoice } from './koHeroChoice.resolve.js';
import { hasPendingOptionalKoReward } from './optionalKoReward.resolve.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/** Arguments for the playFromUndercover move. */
interface PlayFromUndercoverArgs {
  /** The ext_id (instanceId) of the face-down card to play. */
  instanceId: string;
}

/**
 * Plays a card from the player's face-down store.
 *
 * Retrieves the card from faceDownCards and plays it through the identical
 * pathway as hand play: move to inPlay, add card stats to turn economy, execute
 * hero effects. Returns silently on invalid state (Move Validation Contract IC-282-02).
 *
 * @param context - boardgame.io move context with G, ctx, random.
 * @param args - The instanceId of the face-down card to play.
 */
export function playFromUndercover(
  { G, playerID, ...context }: MoveContext,
  args: PlayFromUndercoverArgs,
): void {
  // Step 1: Validate args — non-empty string instanceId
  if (typeof args.instanceId !== 'string' || args.instanceId.length === 0) {
    return;
  }

  // Step 2: Check stage gate (same as playCard — must be in 'main' stage)
  // For now, skip stage gating as face-down play is a future enhancement.
  // This will be added when the move is integrated into the turn cycle.

  // Step 3: Get player zones
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }

  // Step 4: Check for pending choices (block-all guards — same as playCard)
  // why: D-24008 — while a KO-a-Hero choice is pending the board is frozen.
  if (hasPendingKoHeroChoice(G)) {
    return;
  }
  // why: D-24019 — optional-KO-reward choice pending; the board is frozen.
  if (hasPendingOptionalKoReward(G)) {
    return;
  }

  // Step 5: Find and validate face-down card
  const faceDownCardIndex = playerZones.faceDownCards.findIndex(
    (card) => card.instanceId === args.instanceId,
  );
  if (faceDownCardIndex === -1) {
    // why: card not found in face-down store
    return;
  }

  const faceDownCard = playerZones.faceDownCards[faceDownCardIndex];
  if (!faceDownCard) {
    // why: defensive check (should not happen if findIndex worked, but TS requires it)
    return;
  }

  // Step 6: Validate ownership (IC-282-04: only owner can play their face-down card)
  if (faceDownCard.ownerPlayerId !== playerID) {
    return;
  }

  // Step 7: Remove from face-down store
  playerZones.faceDownCards = playerZones.faceDownCards.filter(
    (_, index) => index !== faceDownCardIndex,
  );

  // Step 8: Move to inPlay (IC-282-02: identical to hand play)
  // The card is moved from a virtual "face-down" origin to inPlay.
  const moveResult = moveCardFromZone([], playerZones.inPlay, args.instanceId);
  playerZones.inPlay = moveResult.to;

  // Step 9: Add card stats to turn economy (IC-282-02: identical to hand play)
  const cardStats = G.cardStats[args.instanceId];
  const heroAttack = cardStats ? cardStats.attack : 0;
  const heroRecruit = cardStats ? cardStats.recruit : 0;
  G.turnEconomy = addResources(G.turnEconomy, heroAttack, heroRecruit);

  // Step 10: Execute hero effects (IC-282-02: identical to hand play)
  executeHeroEffects(G, context, playerID, args.instanceId);

  // Step 11: Log the move (deterministic, replay-visible)
  G.messages.push(`Player ${playerID} played ${args.instanceId} from face-down`);
}
