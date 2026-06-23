/**
 * Send a card face-down from a source zone to the face-down store (WP-282 / EC-313).
 *
 * Moves a card from hand, HQ, or revealed zone to the current player's
 * face-down card store. The card's identity is stored but hidden from opponent
 * projections. Follows the Move Validation Contract: validate args, check stage gate,
 * mutate G via helpers. Moves never throw; invalid state causes an early return (void).
 *
 * All randomness uses ctx.random exclusively — never Math.random().
 *
 * // IC-282-01: All zone operations use instanceId (the zone reference),
 * // never cardId. The move validates and mutates by instanceId.
 * // IC-282-06: Zone transfers are atomic — remove from source and add to target
 * // happen in a single state update tick.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { moveCardFromZone } from './zoneOps.js';
import type { FaceDownCard } from '../state/zones.types.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/** Arguments for the sendUndercover move. */
interface SendUndercoverArgs {
  /** The ext_id (instanceId) of the card to send face-down from the source zone. */
  instanceId: string;
  /** The source zone: 'hand', 'hq', or 'revealed'. Reserved for future expansion. */
  sourceZone: 'hand' | 'hq' | 'revealed';
}

/**
 * Sends a card face-down from a source zone to the player's face-down store.
 *
 * The card is atomically removed from the source zone and added to faceDownCards
 * with its identity stored but hidden. Returns silently on invalid state
 * (Move Validation Contract IC-282-01, IC-282-06).
 *
 * Currently supports 'hand' source zone. 'hq' and 'revealed' are reserved for
 * future WPs that add those as per-player zones.
 *
 * @param context - boardgame.io move context with G, ctx.
 * @param args - The instanceId and sourceZone.
 */
export function sendUndercover({ G, ctx }: MoveContext, args: SendUndercoverArgs): void {
  // Step 1: Validate args — non-empty string instanceId and valid sourceZone
  if (typeof args.instanceId !== 'string' || args.instanceId.length === 0) {
    return;
  }
  if (!args.sourceZone || !['hand', 'hq', 'revealed'].includes(args.sourceZone)) {
    return;
  }

  // Step 2: Get player zones
  const pid = ctx.currentPlayer;
  const playerZones = G.playerZones[pid];
  if (!playerZones) {
    return;
  }

  // Step 3: Resolve source zone and check if card exists
  // Currently only 'hand' is implemented. 'hq' and 'revealed' are reserved
  // for future WPs that define these as per-player zones (D-24059).
  let sourceZoneArray: string[];
  if (args.sourceZone === 'hand') {
    sourceZoneArray = playerZones.hand;
  } else {
    // why: hq and revealed are not per-player zones in the current architecture.
    // Return silently per Move Validation Contract.
    return;
  }

  // Step 4: Check if card exists in source zone
  if (!sourceZoneArray.includes(args.instanceId)) {
    return;
  }

  // Step 5: Check for double-send guard (IC-282-05: no duplicate instanceIds)
  if (playerZones.faceDownCards.some((card) => card.instanceId === args.instanceId)) {
    return;
  }

  // Step 6: Atomic zone transfer — remove from source zone
  const moveResult = moveCardFromZone(sourceZoneArray, [], args.instanceId);
  if (!moveResult.found) {
    return;
  }

  // Step 7: Update source zone with the removal
  if (args.sourceZone === 'hand') {
    playerZones.hand = moveResult.from;
  }

  // Step 8: Add to faceDownCards (IC-282-01: use instanceId as zone reference)
  const faceDownCard: FaceDownCard = {
    instanceId: args.instanceId,
    cardId: args.instanceId, // Redundantly store the same value for validation
    ownerPlayerId: pid,
  };
  playerZones.faceDownCards = [...playerZones.faceDownCards, faceDownCard];

  // Step 9: Log the move (deterministic, replay-visible)
  G.messages.push(
    `Player ${pid} sent ${args.instanceId} face-down from ${args.sourceZone}`,
  );
}
