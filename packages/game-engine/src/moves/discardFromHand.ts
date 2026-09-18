/**
 * Forced-discard chokepoint + return-on-discard reaction (WP-498 / D-24301).
 *
 * `discardFromHand` is the SINGLE owner of the hand→discard mutation for every
 * card-effect discard (the discard-to-play cost, mastermind strikes, scheme
 * twists, the generic discard-hand rule effect, and the Dodge move). Routing
 * every such site through one helper guarantees the reactive
 * `return-on-discard` ability (Cyclops Unending Energy) fires uniformly no
 * matter which effect caused the discard — a new discard source inherits the
 * reaction for free simply by calling this helper. A drift-guard test
 * (`discardFromHand.test.ts`) asserts no other hand→discard zoneOps mutation
 * exists outside this module (the normal end-of-turn cleanup discard in
 * coreMoves.impl.ts is deliberately excluded — cleanup is turn structure, not
 * "a card effect", so it must NOT trigger the return).
 *
 * NOT a boardgame.io move — a plain G-mutating helper called from moves,
 * strike handlers, and rule-effect resolvers. It never throws. No registry
 * imports. No .reduce(). No ctx / ctx.random (parking a pending choice needs
 * only G).
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { getHooksForCard } from '../rules/heroAbility.types.js';
import { moveCardFromZone } from './zoneOps.js';

/**
 * Whether a card carries the reactive `return-on-discard` keyword.
 *
 * // why: WP-498 / D-24301 — the reaction keys on the KEYWORD, not the hook's
 * `onDiscard` timing (the timing label is declarative-only). The Array.isArray
 * guard covers minimal test states that omit G.heroAbilityHooks (getHooksForCard
 * would otherwise iterate undefined), mirroring the dodgeCard guard.
 *
 * @param G - The game state to inspect (not mutated).
 * @param cardId - The card whose hooks are scanned.
 * @returns true when the card has a `return-on-discard` hook.
 */
export function cardCarriesReturnOnDiscard(
  G: LegendaryGameState,
  cardId: CardExtId,
): boolean {
  if (!Array.isArray(G.heroAbilityHooks)) {
    return false;
  }
  for (const hook of getHooksForCard(G.heroAbilityHooks, cardId)) {
    if (hook.keywords.includes('return-on-discard')) {
      return true;
    }
  }
  return false;
}

/**
 * Parks an optional return-on-discard choice when a just-discarded card carries
 * the keyword. G-only (no ctx); the choice is resolved later by
 * resolveReturnOnDiscard.
 *
 * The card must already be in the player's discard pile (this runs AFTER the
 * hand→discard move) — the printed text lets the player return "this card" from
 * where the effect put it. Lazy-initializes the FIFO queue at the park site
 * (never in Game.setup) so canonical JSON omits it from the empty-replay final
 * state (no hash-oracle re-pin).
 *
 * @param G - The game state, mutated in place (pending queue appended).
 * @param playerID - The player who owns the discarded card.
 * @param cardId - The just-discarded card that may be returned to hand.
 */
export function checkReturnOnDiscard(
  G: LegendaryGameState,
  playerID: string,
  cardId: CardExtId,
): void {
  if (!cardCarriesReturnOnDiscard(G, cardId)) {
    return;
  }
  // why: WP-498 / D-24301 — lazy-init the FIFO queue at the park site, NEVER in
  // Game.setup, so an untriggered match leaves the field undefined and the
  // empty-replay PRE_WP080_HASH / hashGameState oracles do not re-pin.
  if (G.pendingReturnOnDiscard === undefined) {
    G.pendingReturnOnDiscard = [];
  }
  G.pendingReturnOnDiscard.push({ playerID, cardId });
}

/**
 * Whether a card carries the reactive `teleport-on-discard` keyword (WP-705 / D-24526).
 *
 * // why: the reaction keys on the KEYWORD, not the hook's `onDiscard` timing (the timing
 * label is declarative-only). The Array.isArray guard covers minimal test states that omit
 * G.heroAbilityHooks, mirroring cardCarriesReturnOnDiscard.
 *
 * @param G - The game state to inspect (not mutated).
 * @param cardId - The card whose hooks are scanned.
 * @returns true when the card has a `teleport-on-discard` hook.
 */
export function cardCarriesTeleportOnDiscard(
  G: LegendaryGameState,
  cardId: CardExtId,
): boolean {
  if (!Array.isArray(G.heroAbilityHooks)) {
    return false;
  }
  for (const hook of getHooksForCard(G.heroAbilityHooks, cardId)) {
    if (hook.keywords.includes('teleport-on-discard')) {
      return true;
    }
  }
  return false;
}

/**
 * Sets a just-discarded `teleport-on-discard` card aside (WP-705 / D-24526). G-only.
 *
 * The card has already moved hand→discard (this runs AFTER the move). Because the printed
 * text is MANDATORY ("Teleport it instead" / "set it aside" — no "you may"), the reaction is
 * automatic: it REMOVES the card from the discard pile so it is truly set aside (in no zone,
 * protected from discard-pile effects for the rest of the turn) and records it on
 * G.pendingTeleportReturns. consumeTeleportReturns re-adds it to its owner's hand at the
 * current turn's end. Lazy-initializes the FIFO queue at the park site (never in Game.setup)
 * so an untriggered match omits the field from canonical JSON (no hash-oracle re-pin).
 *
 * @param G - The game state, mutated in place (card removed from discard, queue appended).
 * @param playerID - The player who owns the discarded card.
 * @param cardId - The just-discarded card to set aside and return at end of turn.
 */
export function checkTeleportOnDiscard(
  G: LegendaryGameState,
  playerID: string,
  cardId: CardExtId,
): void {
  if (!cardCarriesTeleportOnDiscard(G, cardId)) {
    return;
  }
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }
  // why: WP-705 / D-24526 — remove the card from discard (the throwaway [] "to" zone is
  // discarded) so it is set aside in no zone; it is held only on the pending queue until it
  // returns. Guarded on `found` in case a later chokepoint caller mutated discard first.
  const removeResult = moveCardFromZone(playerZones.discard, [], cardId);
  if (!removeResult.found) {
    return;
  }
  playerZones.discard = removeResult.from;
  // why: WP-705 / D-24526 — lazy-init the FIFO queue at the park site, NEVER in Game.setup,
  // so an untriggered match leaves the field undefined (no empty-replay oracle re-pin).
  if (G.pendingTeleportReturns === undefined) {
    G.pendingTeleportReturns = [];
  }
  G.pendingTeleportReturns.push({ playerID, cardId });
}

/**
 * Moves one card from a player's hand to their discard pile (the SINGLE
 * card-effect hand→discard chokepoint), then fires the return-on-discard
 * reaction. Mutates G.playerZones in place.
 *
 * Returns whether the card was found in hand so callers can preserve their own
 * control flow — notably dodgeCard, which early-returns on a not-found target
 * before its reshuffle-then-draw.
 *
 * @param G - The game state, mutated in place.
 * @param playerID - The player whose hand card is discarded.
 * @param cardId - The card to move from hand to discard.
 * @returns true when the card was found in hand and moved.
 */
export function discardFromHand(
  G: LegendaryGameState,
  playerID: string,
  cardId: CardExtId,
): boolean {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return false;
  }
  const moveResult = moveCardFromZone(playerZones.hand, playerZones.discard, cardId);
  if (!moveResult.found) {
    return false;
  }
  playerZones.hand = moveResult.from;
  playerZones.discard = moveResult.to;
  checkReturnOnDiscard(G, playerID, cardId);
  // why: WP-705 / D-24526 — a second reactive on-discard keyword at the same chokepoint;
  // a card carries at most one (Cyclops = return-on-discard, Guerrilla Warfare =
  // teleport-on-discard), so only the matching reaction fires.
  checkTeleportOnDiscard(G, playerID, cardId);
  return true;
}
