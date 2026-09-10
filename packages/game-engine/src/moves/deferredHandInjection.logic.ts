/**
 * Deferred specific-card hand injection consume (WP-695 / D-24512).
 *
 * Magneto's "Electromagnetic Bubble" tactic records a chosen in-play X-Men Hero in
 * `G.deferredHandInjections[playerId]`; it is consumed once at that player's next
 * play-phase `onBegin` fill (game.ts), AFTER the normal hand fill, adding each recorded
 * ext_id to the hand as an extra card and then clearing the key. This is the sibling of
 * `handSizeOverrides` (which bumps the fill COUNT and cannot carry WHICH card).
 *
 * The injected card sits, at that fill time, in one of the player's own zones — most
 * commonly their discard (an in-play Hero moves to discard at end-of-turn cleanup), but
 * the helper also checks in-play and deck so a card that never left play is still found.
 * A card not locatable in any of those zones is a logged no-op (never a throw).
 *
 * No boardgame.io import. No .reduce(). Never throws.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId, PlayerZones } from '../state/zones.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { pushLog } from '../log/logPush.js';
import { resolveCardName } from '../log/logDisplay.js';

/**
 * Pulls `cardId` from the player's discard, then in-play, then deck (first match wins)
 * into their hand. Returns whether the card was found and moved.
 *
 * why: explicit per-zone checks (no dynamic key access over a zone-name list) keep the
 * lookup boring and obviously correct (code-style). moveCardFromZone removes the first
 * occurrence and returns new arrays; the matched zone + hand are reassigned in place.
 *
 * @param zones - The player's zones (mutated in place on a hit).
 * @param cardId - The ext_id to pull into the hand.
 * @returns true when the card was found and added to the hand.
 */
function pullCardIntoHand(zones: PlayerZones, cardId: CardExtId): boolean {
  const fromDiscard = moveCardFromZone(zones.discard, zones.hand, cardId);
  if (fromDiscard.found) {
    zones.discard = fromDiscard.from;
    zones.hand = fromDiscard.to;
    return true;
  }
  const fromInPlay = moveCardFromZone(zones.inPlay, zones.hand, cardId);
  if (fromInPlay.found) {
    zones.inPlay = fromInPlay.from;
    zones.hand = fromInPlay.to;
    return true;
  }
  const fromDeck = moveCardFromZone(zones.deck, zones.hand, cardId);
  if (fromDeck.found) {
    zones.deck = fromDeck.from;
    zones.hand = fromDeck.to;
    return true;
  }
  return false;
}

/**
 * Consumes the player's deferred hand injections at their onBegin fill: adds each
 * recorded ext_id to the hand as an extra card (a logged no-op when a card is not
 * locatable), then clears the per-player key. A no-op when nothing is recorded.
 *
 * @param G - The game state, mutated in place (zones, messages, deferredHandInjections).
 * @param playerId - The player whose next hand receives the injected cards.
 * @param zones - That player's zones (the same object stored in G.playerZones[playerId]).
 */
export function consumeDeferredHandInjections(
  G: LegendaryGameState,
  playerId: string,
  zones: PlayerZones,
): void {
  const injections = G.deferredHandInjections?.[playerId];
  if (injections === undefined || injections.length === 0) {
    // why: nothing recorded — leave the field exactly as it was (an absent key stays
    // absent) so an untriggered turn is byte-identical.
    return;
  }
  for (const injectCardId of injections) {
    const pulled = pullCardIntoHand(zones, injectCardId);
    if (pulled) {
      pushLog(G,
        `${resolveCardName(G.cardDisplayData, injectCardId)} (${injectCardId}) was added to Player ${playerId}'s hand as an extra card (Electromagnetic Bubble).`,
        'applied',
        injectCardId,
      );
    } else {
      // why: card not locatable in the player's discard / in-play / deck — a logged
      // no-op (never a throw); the injection is still cleared below so it cannot re-fire.
      pushLog(G,
        `Player ${playerId}'s Electromagnetic Bubble card (${injectCardId}) could not be found to add to their hand; no effect.`,
        'blocked',
        injectCardId,
      );
    }
  }
  // why: clear the per-player key so this injection raises exactly this one fill and no
  // later turn (mirrors the handSizeOverrides consume). delete keeps an untriggered game
  // byte-identical (an absent key never serializes).
  delete G.deferredHandInjections![playerId];
}
