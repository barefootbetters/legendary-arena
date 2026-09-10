/**
 * Effective-team helper for the Legendary Arena game engine.
 *
 * A card in `inPlay` counts as each of its *effective* teams — its printed
 * `G.cardTraits[id].team` PLUS any team in `G.cardCopiedTeams[id]`. The copied-team
 * grant is realized here at team-read time. Today the only writer of
 * `G.cardCopiedTeams` is Rogue's Copy Powers (D-24391 / WP-582 — a full duplicate of
 * the copied Hero, so the Copy Powers card counts as the copied Hero's team).
 *
 * This module is the SINGLE effective-team source for hero team-synergy. The
 * `requiresTeam` read in heroConditions.evaluate.ts derives team membership from these
 * functions rather than comparing `cardTraits.team` directly. This mirrors the
 * sizeChanging.logic.ts class helper exactly.
 *
 * Pure: deterministic functions of exactly `G.cardTraits[id].team` and
 * `G.cardCopiedTeams[id]`. No mutation, no caching/memoization, recomputed each call.
 * `G.cardTraits` is never written — the grant is an additive second team source.
 *
 * No boardgame.io imports. No registry imports. No .reduce().
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  SHIELD_OFFICER_EXT_ID,
  SHIELD_AGENT_EXT_ID,
  SHIELD_TROOPER_EXT_ID,
} from '../setup/pilesInit.js';

// why: D-24391 — a frozen shared empty result so the no-grant path (the common case)
// allocates nothing and callers can iterate it safely without a null check.
const NO_GRANTED_TEAMS: readonly string[] = Object.freeze([]);

/**
 * Returns the teams a card gains when played (its Copy-Powers grant).
 *
 * @param G - Current game state (read-only).
 * @param cardId - The CardExtId to look up.
 * @returns The card's granted-team list, or an empty list when it grants none.
 */
export function getGrantedTeams(
  G: LegendaryGameState,
  cardId: CardExtId,
): readonly string[] {
  const grantedByCard = G.cardCopiedTeams;
  if (grantedByCard === undefined) {
    return NO_GRANTED_TEAMS;
  }
  const granted = grantedByCard[cardId];
  if (granted === undefined) {
    return NO_GRANTED_TEAMS;
  }
  return granted;
}

/**
 * Returns whether a played card counts as a given team.
 *
 * A card in `inPlay` has team `T` iff `T` is its printed `team` OR `T` is in its
 * Copy-Powers granted list. Presence, not count: a card whose printed team equals a
 * granted team still simply "has" that team.
 *
 * @param G - Current game state (read-only).
 * @param cardId - The CardExtId of the played card.
 * @param teamSlug - The team slug to test for.
 * @returns Whether the card counts as that team.
 */
// why: D-24391 — Copy Powers grants the copied Hero's team on play; a card in inPlay has team T iff printed cardTraits.team OR granted (cardCopiedTeams). The single effective-team source; cardTraits is never mutated
export function cardHasTeamWhenPlayed(
  G: LegendaryGameState,
  cardId: CardExtId,
  teamSlug: string,
): boolean {
  const traitEntry = G.cardTraits[cardId];
  if (traitEntry !== undefined && traitEntry.team === teamSlug) {
    return true;
  }
  for (const grantedTeam of getGrantedTeams(G, cardId)) {
    if (grantedTeam === teamSlug) {
      return true;
    }
  }
  return false;
}

// why: WP-681 / D-24498 — the well-known basic S.H.I.E.L.D. Hero tokens (the Officer
// supply token, the starting Agent and Trooper) carry NO G.cardTraits row (buildCardTraits
// only fans out hero-deck cards), so cardHasTeamWhenPlayed cannot see them as team 'shield'.
// They ARE S.H.I.E.L.D. Heroes by identity, and Battlefield Promotion's rule text explicitly
// counts the S.H.I.E.L.D. Officer as a S.H.I.E.L.D. Hero, so the shield-Hero predicate below
// treats these three tokens as shield in addition to the trait/copied-team read.
const WELL_KNOWN_SHIELD_HERO_TOKENS: ReadonlySet<CardExtId> = new Set<CardExtId>([
  SHIELD_OFFICER_EXT_ID,
  SHIELD_AGENT_EXT_ID,
  SHIELD_TROOPER_EXT_ID,
]);

/**
 * Returns whether a card counts as a S.H.I.E.L.D. Hero for a KO-target / Undercover
 * eligibility check, regardless of which zone it currently sits in.
 *
 * A card counts as a S.H.I.E.L.D. Hero iff its printed/copied team is `shield`
 * (cardHasTeamWhenPlayed) OR it is one of the well-known basic S.H.I.E.L.D. Hero tokens
 * (Officer / Agent / Trooper), which are S.H.I.E.L.D. Heroes by identity but carry no
 * G.cardTraits row.
 *
 * // why: WP-681 / D-24498 — Battlefield Promotion KOs "a [team:shield] Hero from your
 * hand or discard pile", and its rule text counts the S.H.I.E.L.D. Officer itself. The
 * hand/discard copy-suffixed ids the resolve validates against never carry an in-play
 * copied-team grant, so the read is effectively the printed team plus the token carve-out.
 *
 * @param G - Current game state (read-only).
 * @param cardId - The CardExtId to test.
 * @returns Whether the card is a S.H.I.E.L.D. Hero.
 */
export function cardCountsAsShieldHero(G: LegendaryGameState, cardId: CardExtId): boolean {
  if (WELL_KNOWN_SHIELD_HERO_TOKENS.has(cardId)) {
    return true;
  }
  return cardHasTeamWhenPlayed(G, cardId, 'shield');
}
