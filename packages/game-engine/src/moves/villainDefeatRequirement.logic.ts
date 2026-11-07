/**
 * Villain defeat-requirement gate logic (WP-292 / D-24076).
 *
 * Pure, boardgame.io-free helpers that answer "may this player defeat this
 * villain?" for the fightVillain precondition gate. A defeat requirement is the
 * printed restriction "You can't defeat X unless you have a [class/team] Hero";
 * these helpers are the SINGLE authority for that test — fightVillain derives
 * its gate decision from them and never re-implements zone/trait matching.
 *
 * Deterministic, side-effect free, independently testable; no boardgame.io
 * import, no I/O, no `.reduce()`.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type {
  VillainDefeatRequirement,
  VillainFightDiscardCost,
  VillainFightRestriction,
  VillainFightRestrictionKind,
} from '../rules/villainAbility.types.js';
import {
  offPlayCardStats,
  offPlayCardTraits,
  playedCardIdsStillInPlay,
  playedCardIdsThisTurn,
} from '../hero/splitCard.logic.js';
import { cardHasClassWhenPlayed } from '../hero/sizeChanging.logic.js';
import { cardHasTeamWhenPlayed } from '../hero/effectiveTeams.logic.js';
import type { CardTraitEntry } from '../state/cardTraits.types.js';

/**
 * Returns the defeat requirement for a villain instance, or null when it has
 * none (the common case — only Blob / Venom / Zombie Venom are marked).
 *
 * @param state - The runtime game state.
 * @param cardId - The villain instance ext_id being fought.
 * @returns The requirement, or null.
 */
export function getDefeatRequirement(
  state: LegendaryGameState,
  cardId: CardExtId,
): VillainDefeatRequirement | null {
  // why: D-24076 — villainDefeatRequirements is omitted entirely when no marked
  // villain is in the match, so a missing table OR a missing entry both mean
  // "no requirement". Defensive access keeps the gate a no-op for those matches.
  const requirement = state.villainDefeatRequirements?.[cardId];
  return requirement ?? null;
}

/**
 * Returns whether a player satisfies a villain defeat requirement.
 *
 * Scans the player's hand and in-play zones (and ONLY those — discard and deck
 * do not count, per D-24076) for a card whose trait matches: a `team`
 * requirement needs a card of that team; a `hero-class` requirement needs a
 * card of that hero class.
 *
 * @param state - The runtime game state.
 * @param playerId - The player attempting the fight.
 * @param requirement - The villain's defeat requirement.
 * @returns True when the player holds a qualifying Hero in hand or in play.
 */
export function playerMeetsDefeatRequirement(
  state: LegendaryGameState,
  playerId: string,
  requirement: VillainDefeatRequirement,
): boolean {
  const zones = state.playerZones[playerId];
  if (zones === undefined) {
    return false;
  }

  // why: D-24076 — "have" is hand OR in play only. Scan both zones; the deck,
  // discard, and victory piles are intentionally excluded (operator decision).
  // why: WP-772 / D-24604 — the zones are scanned separately because only the HAND is off
  // play: a split card in hand counts as both halves' classes (rules v23 p.49, via the
  // split-face map), while a played split card counts only as its chosen face.
  for (const handCardId of zones.hand) {
    if (traitMeetsDefeatRequirement(offPlayCardTraits(state, handCardId), requirement)) {
      return true;
    }
  }
  // why: WP-780 / D-24619 — a rules-facing Hero trait / count read, so a card Penumbra played both-sides counts as both faces.
  // why: WP-803 / D-24692 — a "Heroes you have" read (hand + still in play), so a card that went Out of Time is excluded: rules v23 L3443-3447 (a played card that moved elsewhere doesn't count as "Your Heroes" or "Heroes you Have") + L3457-3470 ("Reveal a Hero" / "KO one of your Heroes" can't pick it).
  for (const playedCardId of playedCardIdsStillInPlay(state, zones.inPlay)) {
    // why: D-24724 — a played card meets a hero-class requirement on its effective class
    // (printed hc / hc2 OR a class granted on play by Copy Powers / Size-Changing, D-24074).
    if (requirement.kind === 'hero-class' && cardHasClassWhenPlayed(state, playedCardId, requirement.value)) {
      return true;
    }
    // why: D-24726 — and a team requirement on its effective team (printed team OR the
    // copied Hero's team that Copy Powers grants on play, D-24391).
    if (requirement.kind === 'team' && cardHasTeamWhenPlayed(state, playedCardId, requirement.value)) {
      return true;
    }
    if (traitMeetsDefeatRequirement(state.cardTraits[playedCardId], requirement)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns whether one card's trait entry satisfies a villain defeat requirement.
 *
 * @param trait - The card's trait entry (off-play view for a hand card), or undefined.
 * @param requirement - The villain's defeat requirement.
 * @returns True when the trait matches the requirement's team or hero class.
 */
function traitMeetsDefeatRequirement(
  trait: CardTraitEntry | undefined,
  requirement: VillainDefeatRequirement,
): boolean {
  if (trait === undefined) {
    return false;
  }
  if (requirement.kind === 'team' && trait.team === requirement.value) {
    return true;
  }
  // why: WP-703 / D-24523 — a dual-class card matches a hero-class requirement on either printed class.
  return requirement.kind === 'hero-class' && (trait.heroClass === requirement.value || trait.heroClass2 === requirement.value);
}

// ---------------------------------------------------------------------------
// Fight discard cost (WP-817 / D-24750)
// ---------------------------------------------------------------------------

/**
 * Returns the fight discard cost for a villain instance, or null when it has
 * none (the common case — only Primus is marked).
 *
 * @param state - The runtime game state.
 * @param cardId - The villain instance ext_id being fought.
 * @returns The fight discard cost, or null.
 */
export function getFightDiscardCost(
  state: LegendaryGameState,
  cardId: CardExtId,
): VillainFightDiscardCost | null {
  // why: D-24750 — villainFightDiscardCosts is omitted entirely when no marked
  // villain is in the match, so a missing table OR a missing entry both mean
  // "no discard cost".
  return state.villainFightDiscardCosts?.[cardId] ?? null;
}

/**
 * Returns whether a hand card's cost is one of the listed costs.
 *
 * @param state - The runtime game state.
 * @param cardId - The hand card to test.
 * @param eligibleCosts - The costs the card may have.
 * @returns True when the card has a cost and it is one of `eligibleCosts`.
 */
// why: D-24750 — the ONE eligibility predicate for both "discard a card that costs …"
// (Primus's fight) and "discards a Hero that costs …" (Primus's Escape). The only hand
// cards that are not Heroes are Wounds, which have no cost entry and so never qualify;
// Officers and Sidekicks are Heroes and carry costs. The off-play stat view gives a split
// card in hand its printed (face a) cost.
export function isHandCardCostOneOf(
  state: LegendaryGameState,
  cardId: CardExtId,
  eligibleCosts: readonly number[],
): boolean {
  const cost = offPlayCardStats(state, cardId)?.cost;
  if (cost === undefined) {
    return false;
  }
  return eligibleCosts.includes(cost);
}

/**
 * Lists a player's hand cards whose cost is one of the listed costs, in hand order.
 *
 * @param state - The runtime game state.
 * @param playerId - The player whose hand is scanned.
 * @param eligibleCosts - The costs a card may have.
 * @returns The eligible hand card ids in hand order; `[]` when the player has no zones.
 */
export function listEligibleHandCardsByCost(
  state: LegendaryGameState,
  playerId: string,
  eligibleCosts: readonly number[],
): CardExtId[] {
  const zones = state.playerZones[playerId];
  if (zones === undefined) {
    return [];
  }
  const eligibleCardIds: CardExtId[] = [];
  for (const handCardId of zones.hand) {
    if (isHandCardCostOneOf(state, handCardId, eligibleCosts)) {
      eligibleCardIds.push(handCardId);
    }
  }
  return eligibleCardIds;
}

/**
 * Lists a player's hand cards that match a Hero-trait requirement, in hand order
 * (WP-837 / D-24770 — the each-player trait discards of co2e Mystique and Frost
 * Giant Warrior).
 *
 * A card matches through the same predicate the defeat gate uses, over the
 * off-play trait view: a split card counts as its Hero's team and both faces'
 * Hero Classes (rules v23 L2773-2778). A Wound or any card with no trait entry
 * never matches.
 *
 * @param state - The runtime game state.
 * @param playerId - The seat whose hand is read.
 * @param requirement - The team or Hero Class to match.
 * @returns The matching hand card ids in hand order, or `[]` when the seat has no zones.
 */
export function listEligibleHandCardsByTrait(
  state: LegendaryGameState,
  playerId: string,
  requirement: VillainDefeatRequirement,
): CardExtId[] {
  const zones = state.playerZones[playerId];
  if (zones === undefined) {
    return [];
  }
  const eligibleCardIds: CardExtId[] = [];
  for (const handCardId of zones.hand) {
    if (traitMeetsDefeatRequirement(offPlayCardTraits(state, handCardId), requirement)) {
      eligibleCardIds.push(handCardId);
    }
  }
  return eligibleCardIds;
}

/**
 * Picks the default card to discard for a cost-filtered discard: the lowest-cost
 * eligible hand card, keeping the earliest in hand order on a tie.
 *
 * @param state - The runtime game state.
 * @param playerId - The player whose hand is scanned.
 * @param eligibleCosts - The costs a card may have.
 * @returns The chosen card id, or null when no hand card is eligible.
 */
export function selectDefaultCostDiscardCard(
  state: LegendaryGameState,
  playerId: string,
  eligibleCosts: readonly number[],
): CardExtId | null {
  let selectedCardId: CardExtId | null = null;
  let selectedCost = Number.POSITIVE_INFINITY;
  for (const cardId of listEligibleHandCardsByCost(state, playerId, eligibleCosts)) {
    // why: every listed card has a cost (isHandCardCostOneOf rejected the rest).
    const cost = offPlayCardStats(state, cardId)!.cost;
    // why: strict `<` keeps the earliest card in hand order on a cost tie.
    if (cost < selectedCost) {
      selectedCardId = cardId;
      selectedCost = cost;
    }
  }
  return selectedCardId;
}

/**
 * Formats a cost list for a log line: `2`, `2 or 3`, `2, 3, 5, or 7`.
 *
 * @param eligibleCosts - The costs, in order.
 * @returns The English list with `or` before the last cost.
 */
export function formatEligibleCostList(eligibleCosts: readonly number[]): string {
  if (eligibleCosts.length <= 1) {
    return eligibleCosts.map((cost) => String(cost)).join('');
  }
  if (eligibleCosts.length === 2) {
    return `${eligibleCosts[0]} or ${eligibleCosts[1]}`;
  }
  const leadingCosts = eligibleCosts.slice(0, -1).map((cost) => String(cost)).join(', ');
  return `${leadingCosts}, or ${eligibleCosts[eligibleCosts.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Fight restriction (WP-871 / D-24816)
// ---------------------------------------------------------------------------

/**
 * Returns the fight restriction for a villain instance, or null when it has none
 * (the common case — only Orrgo, Squirrel Girl and Doop are marked).
 *
 * @param state - The runtime game state.
 * @param cardId - The villain instance ext_id being fought.
 * @returns The fight restriction, or null.
 */
export function getFightRestriction(
  state: LegendaryGameState,
  cardId: CardExtId,
): VillainFightRestriction | null {
  // why: D-24816 — villainFightRestrictions is omitted entirely when no marked villain
  // is in the match, so a missing table OR a missing entry both mean "no restriction".
  return state.villainFightRestrictions?.[cardId] ?? null;
}

/**
 * Returns whether any villain in the match carries a fight restriction of a kind.
 *
 * @param state - The runtime game state.
 * @param kind - The restriction kind to look for.
 * @returns True when any entry of G.villainFightRestrictions has that kind.
 */
export function matchHasFightRestrictionKind(
  state: LegendaryGameState,
  kind: VillainFightRestrictionKind,
): boolean {
  const restrictions = state.villainFightRestrictions;
  if (restrictions === undefined) {
    return false;
  }
  for (const restriction of Object.values(restrictions)) {
    if (restriction.kind === kind) {
      return true;
    }
  }
  return false;
}

/**
 * Returns whether a villain's printed fight restriction blocks a player's fight
 * of the villain at a City index right now.
 *
 * The SINGLE authority for the three restriction predicates: fightVillain,
 * getLegalMoves and the UIState City projection all call it, and none re-tests
 * adjacency, a played-card count or the defeat flag inline.
 *
 * @param state - The runtime game state.
 * @param playerId - The player attempting the fight (`ctx.currentPlayer`).
 * @param cityIndex - The City index of the restricted villain.
 * @param restriction - The villain's fight restriction.
 * @returns True when the fight is blocked.
 */
export function isFightRestrictionBlocking(
  state: LegendaryGameState,
  playerId: string,
  cityIndex: number,
  restriction: VillainFightRestriction,
): boolean {
  switch (restriction.kind) {
    case 'requires-villain-defeated-this-turn':
      // why: D-24816 — the flag is set only by defeatCityVillainCore (a fought OR a
      // free-defeated City Villain); a Mastermind defeat never sets it, because the
      // Mastermind is not a Villain ("defeated another Villain").
      return state.turnEconomy.hasDefeatedVillainThisTurn !== true;
    case 'at-most-one-card-played':
      // why: D-24776 / D-24794 — "played more than one card this turn" reads the one
      // played-this-turn authority, not inPlay.length: a returned Sidekick, an Out of Time
      // card or a used Ritual Artifact still counts as played. Inherited residual (D-24692):
      // a played card that left play another way (e.g. a self-KO) stops counting.
      return playedCardIdsThisTurn(state, state.playerZones[playerId]?.inPlay ?? []).length > 1;
    case 'no-adjacent-villain':
      return isAdjacentCitySpaceOccupied(state, cityIndex);
    default: {
      // why: compile-time exhaustiveness — a future kind added to
      // VillainFightRestrictionKind without its arm here fails `tsc` on this
      // assignment instead of silently never blocking. Intentionally unused (no
      // tsconfig sets noUnusedLocals).
      const unhandledKind: never = restriction.kind;
      return false;
    }
  }
}

/**
 * Returns whether either neighbouring City space of an index holds a Villain.
 *
 * @param state - The runtime game state.
 * @param cityIndex - The City index whose neighbours are read.
 * @returns True when the space at `cityIndex - 1` or `cityIndex + 1` is occupied.
 */
function isAdjacentCitySpaceOccupied(state: LegendaryGameState, cityIndex: number): boolean {
  // why: WP-831 / D-24764 — the City may be longer than five spaces; adjacency is
  // index ± 1 bounded inside G.city.length, so a read past either end never counts.
  if (cityIndex > 0) {
    const leftCardId = state.city[cityIndex - 1];
    if (leftCardId !== null && leftCardId !== undefined) {
      return true;
    }
  }
  if (cityIndex + 1 < state.city.length) {
    const rightCardId = state.city[cityIndex + 1];
    if (rightCardId !== null && rightCardId !== undefined) {
      return true;
    }
  }
  return false;
}

// why: D-24816 — engine-owned public copy: every predicate input (cards played, the
// City, Villains defeated) is public, so the engine projects the reason to every
// audience and the client renders it verbatim (D-24574: gate on projected data).
/** The player-facing reason shown while each fight restriction blocks. */
export const FIGHT_RESTRICTION_REASONS: Readonly<Record<VillainFightRestrictionKind, string>> = {
  'requires-villain-defeated-this-turn': 'Defeat another Villain first this turn',
  'at-most-one-card-played': 'You played more than one card this turn',
  'no-adjacent-villain': 'A Villain is in an adjacent city space',
};

/**
 * Returns the reason a player can't fight the City card at an index right now,
 * or null when its fight restriction does not block.
 *
 * @param state - The runtime game state.
 * @param playerId - The player attempting the fight (`ctx.currentPlayer`).
 * @param cityIndex - The City index to read.
 * @returns The locked reason string while the restriction blocks; null for an
 *   empty space, an unrestricted villain, or a restriction that does not block.
 */
export function getFightRestrictionBlockReason(
  state: LegendaryGameState,
  playerId: string,
  cityIndex: number,
): string | null {
  const cardId = state.city[cityIndex];
  if (cardId === null || cardId === undefined) {
    return null;
  }
  const restriction = getFightRestriction(state, cardId);
  if (restriction === null) {
    return null;
  }
  if (!isFightRestrictionBlocking(state, playerId, cityIndex, restriction)) {
    return null;
  }
  return FIGHT_RESTRICTION_REASONS[restriction.kind];
}
