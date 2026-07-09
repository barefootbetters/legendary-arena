/**
 * resolvePutAnyNumberBottomHQ move — resolves a pending put-any-number-bottom-HQ
 * player choice (D-24132).
 *
 * Called by the active player (or the deterministic bot) after a put-any-number-bottom-hq
 * hero ability parked a PendingPutAnyNumberBottomHQ on G.pendingPutAnyNumberBottomHQ (FIFO).
 * This realizes the printed "Choose any number of cards/Heroes from the HQ. Put them on the
 * bottom of the Hero Deck. (Then you get Empowered by [classes].)" text (Wonder Man's 8th
 * Wonder of the World, Sunspot's Empyreal Force, Star-Lord (T'Challa)'s Colliding Dreams).
 *
 * The MULTI-select sibling of resolveOptionalPutBottomHQ: the player submits an array of HQ
 * card ids (possibly empty — "any number" includes zero). Each selected card that is present
 * in the HQ NOW is moved to the BOTTOM of the shared Hero Deck (G.heroDeck), and its vacated
 * HQ slot is refilled from the top of the Hero Deck (exactly the recruitHero refill path).
 * After all moves resolve, any trailing "Then you get Empowered by [classes]" grant recorded
 * on the pending entry is applied — printed order: the HQ is reshaped first, then counted.
 *
 * why: the printed ability moves cards from the shared central supply's HQ to the bottom of
 * the shared Hero Deck (G.heroDeck), NOT the player's personal deck, and the HQ must never be
 * left with a permanent null gap. The Empowered grant fires AFTER the moves so the class count
 * reflects the reshaped HQ (the strategic point of putting cards away first).
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { refillHqSlot } from '../board/city.logic.js';
import { interpretHeroPrimitiveEffect } from '../hero/effectPrimitive.interpret.js';
import { buildEmpoweredComposition } from '../rules/heroCompositions.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolvePutAnyNumberBottomHQ move.
 *
 * `cardIds` is the set of HQ card instance ids the player chose to move to the bottom of the
 * Hero Deck. An empty array is a valid "put none" selection ("Choose any number" includes
 * zero) — the trailing Empowered grant (if any) still applies. Stale/absent ids are skipped.
 */
export interface ResolvePutAnyNumberBottomHQArgs {
  cardIds: CardExtId[];
}

/**
 * Whether any put-any-number-bottom-hq choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the getLegalMoves
 * short-circuit. `undefined` and `[]` both mean no pending choice (mirrors
 * hasPendingOptionalPutBottomHQ).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending put-any-number-bottom-hq queue holds at least one entry.
 */
export function hasPendingPutAnyNumberBottomHQ(G: LegendaryGameState): boolean {
  // why: D-24132 — pendingPutAnyNumberBottomHQ is lazy-init; undefined and [] both mean no pending choice
  return (G.pendingPutAnyNumberBottomHQ?.length ?? 0) > 0;
}

/**
 * Moves one HQ card (if present) to the bottom of the shared Hero Deck and refills the vacated
 * slot from the top of the Hero Deck. Returns whether the move happened.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param playerID - Active player ID (for the log line only).
 * @param targetCardId - The HQ card instance id to move.
 * @returns true when the card was found in the HQ and moved; false (silent no-op) otherwise.
 */
function moveOneHqCardToBottom(
  G: LegendaryGameState,
  playerID: string,
  targetCardId: CardExtId,
): boolean {
  const hqZone = G.hq;
  let foundIndex = -1;
  for (let i = 0; i < hqZone.length; i++) {
    if (hqZone[i] === targetCardId) {
      foundIndex = i;
      break;
    }
  }
  if (foundIndex === -1) {
    // why: an invalid/stale/duplicate target (already moved earlier this call) is a silent
    // skip — it does not abort the remaining selections. Mirrors the single-card stale no-op.
    return false;
  }
  // why: heroDeck[0] is the top (drawn first), so the bottom is the END of the array (push);
  // refillHqSlot pops heroDeck[0] into the vacated slot — exactly the recruitHero refill path,
  // keeping the HQ full (never a permanent null gap) and the card in the shared central supply.
  G.heroDeck.push(targetCardId);
  const refillResult = refillHqSlot(G.hq, foundIndex, G.heroDeck);
  G.hq = refillResult.hq;
  G.heroDeck = refillResult.heroDeck;
  pushLog(G,
    `Player ${playerID} put ${formatCardRef(G.cardDisplayData, targetCardId)} from the HQ on the bottom of the Hero Deck; HQ slot ${String(foundIndex)} refilled.`,
  );
  return true;
}

/**
 * Resolves the FRONT pending put-any-number-bottom-hq choice.
 *
 * Atomic sequence:
 *   1. Validate args — `cardIds` must be an array (possibly empty); anything else is a silent
 *      no-op (queue intact).
 *   2. Validate the front pending entry — non-empty queue, front.playerID match.
 *   3. Move each selected card that is present in the HQ NOW to the bottom of G.heroDeck,
 *      refilling each vacated slot (recomputed fresh per card — no snapshot). Absent/stale
 *      ids are skipped silently.
 *   4. Apply any trailing Empowered grant (front.empoweredClasses) AFTER the moves, one
 *      buildEmpoweredComposition per class (printed order).
 *   5. Front-pop LAST.
 *
 * Any failure before step 3 ABORTS the move (no zone change, no grant, no shift). Moves never
 * throw.
 *
 * // why: D-24132 — block-all guard — no other move may fire while a put-any-number-bottom-hq
 * choice is outstanding.
 *
 * @param context - boardgame.io move context with G, playerID, and the rest (ctx, events,
 *   random, log) spread into `context` so the Empowered composition interpreter has access.
 * @param args - the selected HQ card ids (possibly empty).
 */
export function resolvePutAnyNumberBottomHQ(
  { G, playerID, ...context }: MoveContext,
  args: ResolvePutAnyNumberBottomHQArgs,
): void {
  // Step 1: Validate args — cardIds must be an array (empty is a valid "put none").
  const cardIds = (args as { cardIds?: unknown }).cardIds;
  if (!Array.isArray(cardIds)) {
    return;
  }

  // Step 2: Validate the front pending entry — front-only resolution.
  // why: D-24132 — pendingPutAnyNumberBottomHQ is lazy-init; undefined and [] both mean no pending choice
  const queue = G.pendingPutAnyNumberBottomHQ;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }

  // Step 3: Move each selected HQ card to the bottom of the shared Hero Deck, in submitted
  // order. Each card's HQ index is recomputed fresh (a prior refill in this loop refilled the
  // SAME slot, so other slots are unaffected, but re-finding is the safe, obvious rule). A
  // non-string entry or a stale/duplicate id is skipped silently.
  let movedCount = 0;
  for (const rawCardId of cardIds) {
    if (typeof rawCardId !== 'string' || rawCardId.length === 0) {
      continue;
    }
    if (moveOneHqCardToBottom(G, playerID, rawCardId as CardExtId)) {
      movedCount++;
    }
  }

  // Step 4: Apply the trailing Empowered grant AFTER the moves — printed order ("Then you get
  // Empowered by [classes]"), so the class count reflects the reshaped HQ. One composition per
  // class, reusing the WP-256 substrate (no re-implementation of the count), mirroring the
  // draw-or-empowered resolve path. Absent/empty empoweredClasses grants nothing.
  if (front.empoweredClasses !== undefined) {
    for (const empoweredClass of front.empoweredClasses) {
      interpretHeroPrimitiveEffect(G, context, playerID, buildEmpoweredComposition(empoweredClass), front.sourceCardId);
    }
  }

  if (movedCount === 0) {
    pushLog(G, `Player ${playerID} put no cards from the HQ on the bottom of the Hero Deck.`);
  }

  // Step 5: Front-pop LAST.
  queue.shift();
}
