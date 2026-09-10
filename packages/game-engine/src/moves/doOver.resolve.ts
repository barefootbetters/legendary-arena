/**
 * resolveDoOver move — resolves a pending Do-Over accept/decline choice
 * (WP-681 / D-24498).
 *
 * Called by the active player after a `do-over` hero ability parked a PendingDoOver
 * on G.pendingDoOverChoices (FIFO). Per Deadpool's "Hey, Can I Get a Do-Over?" the
 * choice is "you may discard the rest of your hand and draw four cards" — so the
 * player either declines (no discard, no draw) or accepts, in which case the ENTIRE
 * current hand is discarded through the single forced-discard chokepoint and then a
 * FIXED 4 cards are drawn (not one-per-discard).
 *
 * The first-hero-played-this-turn condition already gated the park, so this move never
 * re-checks it (the choice would not exist otherwise). Discard order: the whole hand is
 * discarded FIRST, then the 4 cards are drawn — so a within-turn reshuffle draws from a
 * pool that includes the just-discarded cards (the standard Legendary rule).
 *
 * The move is server-only (registered `client: false` in game.ts): the client submits
 * intent ({ accept: true } or { decline: true }); the ENGINE performs the discard/draw.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import { discardFromHand } from './discardFromHand.js';
import { drawCardsIntoHand } from './drawCards.logic.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveDoOver move.
 *
 * Exactly one shape is valid per call:
 * - { decline: true } — decline the Do-Over (no discard, no draw).
 * - { accept: true } — discard the entire current hand, then draw a fixed 4.
 */
export type ResolveDoOverArgs =
  | { decline: true }
  | { accept: true };

/**
 * The fixed number of cards Do-Over draws on accept.
 *
 * // why: D-24498 — "draw four cards" is a FIXED count (not one-per-discard). Named
 * so the value is not re-hardcoded and the printed text is cited at the constant.
 */
export const DO_OVER_DRAW_COUNT = 4;

/**
 * Whether any Do-Over accept/decline choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the getLegalMoves
 * short-circuit. `undefined` and `[]` both mean no pending choice (mirrors
 * hasPendingSmashDiscard, D-24492).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending Do-Over queue holds at least one entry.
 */
export function hasPendingDoOver(G: LegendaryGameState): boolean {
  return (G.pendingDoOverChoices?.length ?? 0) > 0;
}

/**
 * Resolves the FRONT pending Do-Over accept/decline choice.
 *
 * Atomic sequence (HARD — exact order, mirrors resolveSmashDiscard):
 *   1. Validate args — exactly { decline: true } XOR { accept: true }; an invalid
 *      shape is a silent no-op (queue intact).
 *   2. Validate the front pending entry — non-empty queue, front.playerID match.
 *   3. { decline } → log the no-op, then front-pop. No discard, no draw.
 *   4. { accept } → discard the ENTIRE current hand through the discardFromHand
 *      chokepoint (fires any return-on-discard reaction), THEN draw a fixed 4.
 *   5. Front-pop (queue.shift()) LAST.
 *
 * Moves never throw.
 *
 * @param context - boardgame.io move context; ctx (spread into context) carries
 *   random for the draw's deterministic reshuffle.
 * @param args - the decline or accept flag.
 */
export function resolveDoOver(
  { G, playerID, ...context }: MoveContext,
  args: ResolveDoOverArgs,
): void {
  // Step 1: Validate args — exactly one of { decline: true } / { accept: true }.
  const isDecline = (args as { decline?: unknown }).decline === true;
  const isAccept = (args as { accept?: unknown }).accept === true;
  // why: exactly-one-shape — both present or neither present is a malformed payload
  // and a silent no-op (mirrors resolveSmashDiscard's exactly-one-shape guard).
  if (isDecline === isAccept) { return; }

  // Step 2: Validate the front pending entry — front-only resolution.
  const queue = G.pendingDoOverChoices;
  if (queue === undefined || queue.length === 0) { return; }
  const front = queue[0]!;
  if (front.playerID !== playerID) { return; }

  // Step 3: Decline → log the no-op, then front-pop. No discard, no draw.
  // why: D-24498 — a voluntary decline is logged for parity with other pending
  // choices (Smash), so it is observable in the game log instead of a silent skip.
  if (isDecline) {
    pushLog(G,
      `Player ${playerID} declined the Do-Over — chose not to discard their hand, so no cards were redrawn.`,
    );
    queue.shift();
    return;
  }

  // Step 4a: Accept → discard the ENTIRE current hand through the single forced-discard
  // chokepoint (WP-498 / D-24301), so a return-on-discard card discarded here offers to
  // return and the enforced hand→discard invariant holds. Snapshot the hand first
  // (discardFromHand mutates it in place). Mirrors the private applyDiscardHand loop.
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { queue.shift(); return; }
  let discardedCount = 0;
  for (const cardId of [...playerZones.hand]) {
    if (discardFromHand(G, playerID, cardId)) {
      discardedCount += 1;
    }
  }

  // Step 4b: THEN draw a FIXED 4 cards (not one-per-discard). ctx.random rides
  // `context` (the FnContext spread) as the deterministic ShuffleProvider for a
  // mid-draw reshuffle.
  // why: D-24498 — the printed text is "draw four cards", a fixed count independent of
  // how many cards were discarded.
  const zonesBeforeDraw = playerZones.hand.length;
  drawCardsIntoHand(playerZones, DO_OVER_DRAW_COUNT, context as unknown as ShuffleProvider);
  const drawnCount = playerZones.hand.length - zonesBeforeDraw;
  pushLog(G,
    `Player ${playerID} took the Do-Over — discarded ${discardedCount} card(s) from their hand and drew ${drawnCount} card(s).`,
    'applied',
  );

  // Step 5: Front-pop LAST (front-pop = Array.shift).
  queue.shift();
}
