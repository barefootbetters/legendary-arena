/**
 * endOfTurnCleanup.logic.ts
 *
 * The single end-of-turn cleanup site (WP-701 / D-24520). At the end of a
 * player's turn — the tabletop rule — that player discards their in-play cards
 * and their remaining hand, then draws a fresh hand of HAND_SIZE. Doing this at
 * END of turn (rather than the former start-of-turn `turn.onBegin` auto-draw,
 * D-10003/D-23605) restores the between-turns state: a player holds HAND_SIZE
 * cards during opponents' turns, so Master Strikes and every "each player
 * discards / reveals" effect act on real hands instead of the empty hand a
 * player was left with under the onBegin-draw model.
 *
 * This helper bundles what were two separate steps under the old model — the
 * `endTurn` move's discard sweep and the `onBegin` fill block — into one
 * function, so BOTH D-22002 turn-end paths (the `endTurn` move and the
 * `advanceStage` -> `advanceTurnStage` cleanup branch) and all three
 * bgio-bypassing harnesses run identical cleanup and replays stay consistent.
 *
 * Pure helper: no boardgame.io import, no I/O, deterministic (the draw's
 * reshuffle uses the caller's ShuffleProvider = `ctx.random`). Never throws.
 */

import type { LegendaryGameState } from '../types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import { moveAllCards } from './zoneOps.js';
import { HAND_SIZE, drawCardsIntoHand } from './drawCards.logic.js';
import { consumeDeferredHandInjections } from './deferredHandInjection.logic.js';
import { composeDeckReshuffledNarrative } from '../events/notableEvents.compose.js';

/**
 * Runs the end-of-turn cleanup for one player: discard in-play + hand, then
 * draw a fresh hand to HAND_SIZE (or the player's one-shot handSizeOverride),
 * announcing a reshuffle and consuming the override / deferred-hand injection.
 *
 * Exact order (locked, EC-738):
 *   1. Discard in-play -> discard, then hand -> discard.
 *   2. Fill hand to `handSizeOverrides?.[playerID] ?? HAND_SIZE` from the deck
 *      (reshuffling the discard on exhaustion via the ShuffleProvider).
 *   3. Push a `deckReshuffled` notable event iff a reshuffle actually occurred.
 *   4. Consume the one-shot `handSizeOverrides` entry (Doc Ock, D-24300).
 *   5. Consume the deferred hand injection (Electromagnetic Bubble, D-24512) —
 *      it runs AFTER the discard so an in-play X-Men Hero has already moved to
 *      discard where the injection helper can find it, and AFTER the fill so it
 *      lands as the extra (seventh) card on top of the fresh hand.
 *
 * // why: D-24520 — the draw is at END of turn (this function), not the former
 * start-of-turn onBegin auto-draw, so a player holds their hand during
 * opponents' turns. hasDrawnThisTurn is NOT set here — it is an onBegin reset
 * flag guarding the scaffold `drawCards` move, meaningful only within a turn.
 *
 * @param G - Game state, mutated in place.
 * @param playerID - The player whose turn is ending (draws their own new hand).
 * @param shuffleProvider - Deterministic shuffle source (`ctx.random`), for the
 *   reshuffle-on-exhaustion inside the draw.
 */
export function applyEndOfTurnCleanup(
  G: LegendaryGameState,
  playerID: string,
  shuffleProvider: ShuffleProvider,
): void {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }
  // Step 1: discard in-play, then the remaining hand.
  const inPlayResult = moveAllCards(playerZones.inPlay, playerZones.discard);
  playerZones.inPlay = inPlayResult.from;
  playerZones.discard = inPlayResult.to;

  const handResult = moveAllCards(playerZones.hand, playerZones.discard);
  playerZones.hand = handResult.from;
  playerZones.discard = handResult.to;

  // Step 2: draw the new hand. // why: WP-497 / D-24300 — a tactic Fight resolver
  // (Doc Ock's "Octet of Valence Electrons") may have recorded a one-shot next-hand
  // override; fill to it, else HAND_SIZE. After the discard the hand is empty, so
  // cardsToDraw is the full fill target; the Math.max keeps it non-negative defensively.
  const fillTarget = G.handSizeOverrides?.[playerID] ?? HAND_SIZE;
  const cardsToDraw = Math.max(0, fillTarget - playerZones.hand.length);
  const reshuffleCount = drawCardsIntoHand(playerZones, cardsToDraw, shuffleProvider);

  // Step 3: announce a realized empty-deck reshuffle (WP-642 / D-24454). Minimal
  // payload, no card id. Array.isArray guard tolerates a legacy state literal that
  // predates the field.
  if (reshuffleCount > 0 && Array.isArray(G.notableEvents)) {
    G.notableEvents.push({
      type: 'deckReshuffled',
      playerId: playerID,
      narrative: composeDeckReshuffledNarrative(),
    });
  }

  // Step 4: consume the one-shot handSizeOverride (delete so it raises exactly this fill).
  if (G.handSizeOverrides?.[playerID] !== undefined) {
    delete G.handSizeOverrides[playerID];
  }

  // Step 5: consume the deferred hand injection (Electromagnetic Bubble) — after the
  // discard + fill, adds each recorded card as an extra card and clears the key.
  consumeDeferredHandInjections(G, playerID, playerZones);

  // why: WP-705 / D-24526 — Step 6: return every teleport-on-discard card set aside this
  // turn to its OWNER's hand (Guerrilla Warfare). All-owners (not just the ending player),
  // so a card set aside during a non-active player's discard also returns now. Placed AFTER
  // the ending player's fill so their own returned card is an EXTRA on top of the fresh hand;
  // a non-active owner's return adds to their existing hand. applyEndOfTurnCleanup runs once
  // per turn-end at EVERY path (both live turn-end sub-paths + all bgio-bypassing harnesses),
  // so this single co-located drain covers them all — no per-harness replication needed.
  consumeTeleportReturns(G);
}

/**
 * Returns every teleport-on-discard card set aside this turn to its owner's hand (WP-705 /
 * D-24526). Drains the whole G.pendingTeleportReturns queue — each card was removed from
 * discard at set-aside time (held in no zone), so it is appended directly to its owner's
 * hand as an extra card. Drain-idempotent: an empty/undefined queue is an early no-op, which
 * is what makes calling it at the single per-turn-end cleanup site correct and safe.
 *
 * // why: G-only, no ctx — both printed branches ("your turn → Teleport it" / "not your turn
 * → set aside, add at end of this turn") collapse to this one end-of-current-turn return, so
 * no turn-owner distinction is needed.
 *
 * @param G - Game state, mutated in place (cards appended to hands, queue emptied).
 */
export function consumeTeleportReturns(G: LegendaryGameState): void {
  const queue = G.pendingTeleportReturns;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  for (const entry of queue) {
    const ownerZones = G.playerZones[entry.playerID];
    if (!ownerZones) {
      continue;
    }
    ownerZones.hand = [...ownerZones.hand, entry.cardId];
  }
  G.pendingTeleportReturns = [];
}
