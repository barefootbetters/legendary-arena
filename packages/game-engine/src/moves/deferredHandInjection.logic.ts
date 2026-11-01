/**
 * Deferred specific-card hand injection consume (WP-695 / D-24512).
 *
 * Magneto's "Electromagnetic Bubble" tactic records a chosen X-Men Hero in
 * `G.deferredHandInjections[playerId]`; it is consumed once at that player's next
 * play-phase `onBegin` fill (game.ts), AFTER the normal hand fill, adding each recorded
 * ext_id to the hand as an extra card and then clearing the key. This is the sibling of
 * `handSizeOverrides` (which bumps the fill COUNT and cannot carry WHICH card).
 *
 * The injected card sits, after the cleanup discard, in the player's discard (a played or
 * held Hero is swept there). setAsideDeferredHandInjections lifts it out BEFORE the fill
 * (D-24797), so a short deck's reshuffle can neither shuffle it in nor draw it as one of
 * the six; consumeDeferredHandInjections then adds it AFTER the fill. A card the set-aside
 * did not find is still looked up in discard, in-play and deck at consume time. A card not
 * locatable anywhere is a logged no-op (never a throw).
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
 * Lifts each recorded injection card out of the player's discard before the cleanup fill,
 * returning the cards set aside (D-24797). Cards not in the discard are left where they are
 * for consumeDeferredHandInjections to look up after the fill. A no-op returning [] when
 * nothing is recorded.
 *
 * why: Electromagnetic Bubble adds the Hero "as a seventh card" — it is never part of the
 * six-card draw. Left in the discard, a short deck's reshuffle shuffled it into the deck and
 * the fill could draw it as one of the six, after which the consume found nothing and the
 * seventh card was lost (live match bujIOIX4wLk, turn 7).
 *
 * @param G - The game state (read only: deferredHandInjections).
 * @param playerId - The player whose turn is ending.
 * @param zones - That player's zones (discard mutated in place on a hit).
 * @returns The injection cards removed from the discard, in recorded order.
 */
export function setAsideDeferredHandInjections(
  G: LegendaryGameState,
  playerId: string,
  zones: PlayerZones,
): CardExtId[] {
  const injections = G.deferredHandInjections?.[playerId];
  const setAside: CardExtId[] = [];
  if (injections === undefined) {
    return setAside;
  }
  for (const injectCardId of injections) {
    const fromDiscard = moveCardFromZone(zones.discard, [], injectCardId);
    if (fromDiscard.found) {
      zones.discard = fromDiscard.from;
      setAside.push(injectCardId);
    }
  }
  return setAside;
}

/**
 * Consumes the player's deferred hand injections after the cleanup fill: adds each recorded
 * ext_id to the hand as an extra card — from the cards set aside before the fill, else from
 * discard / in-play / deck (a logged no-op when not locatable) — then clears the per-player
 * key. A no-op when nothing is recorded.
 *
 * @param G - The game state, mutated in place (zones, messages, deferredHandInjections).
 * @param playerId - The player whose next hand receives the injected cards.
 * @param zones - That player's zones (the same object stored in G.playerZones[playerId]).
 * @param setAside - The cards setAsideDeferredHandInjections lifted out before the fill.
 */
export function consumeDeferredHandInjections(
  G: LegendaryGameState,
  playerId: string,
  zones: PlayerZones,
  setAside: readonly CardExtId[] = [],
): void {
  const injections = G.deferredHandInjections?.[playerId];
  if (injections === undefined || injections.length === 0) {
    // why: nothing recorded — leave the field exactly as it was (an absent key stays
    // absent) so an untriggered turn is byte-identical.
    return;
  }
  const remainingSetAside = [...setAside];
  for (const injectCardId of injections) {
    const setAsideIndex = remainingSetAside.indexOf(injectCardId);
    let pulled = false;
    if (setAsideIndex !== -1) {
      remainingSetAside.splice(setAsideIndex, 1);
      zones.hand = [...zones.hand, injectCardId];
      pulled = true;
    } else {
      pulled = pullCardIntoHand(zones, injectCardId);
    }
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
