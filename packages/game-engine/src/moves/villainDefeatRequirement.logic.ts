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
  const candidateCardIds: CardExtId[] = [...zones.hand, ...zones.inPlay];
  for (const candidateCardId of candidateCardIds) {
    const trait = state.cardTraits[candidateCardId];
    if (trait === undefined) {
      continue;
    }
    if (requirement.kind === 'team' && trait.team === requirement.value) {
      return true;
    }
    if (requirement.kind === 'hero-class' && trait.heroClass === requirement.value) {
      return true;
    }
  }
  return false;
}
