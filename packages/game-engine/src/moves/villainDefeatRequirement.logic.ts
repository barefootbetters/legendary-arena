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
import type { VillainDefeatRequirement } from '../rules/villainAbility.types.js';
import { offPlayCardTraits, playedCardIdsStillInPlay } from '../hero/splitCard.logic.js';
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
