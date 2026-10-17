/**
 * Clash of the Monsters Unleashed — the Monster Pit (D-24736).
 *
 * The scheme prints:
 * - "Setup: 10 Twists. 6 Wounds per player in the Wound Stack. Shuffle 8
 *   Monsters Unleashed Villains into a face-down 'Monster Pit' deck."
 * - "Twist 3-10: Each player chooses a Villain from their Victory Pile as their
 *   'Gladiator.' Then the top card of the Monster Pit enters the city. Each
 *   player whose Gladiator has a lower printed Attack than that Monster gains a
 *   Wound."
 * - "Evil Wins: When the Wound Stack or Monster Pit Deck runs out."
 *
 * This module holds the pure pieces: which villain group feeds the Pit, how the
 * Pit is split out of the built villain deck at setup, and the Gladiator /
 * printed-Attack reads the twist resolver uses. The Wound Stack sizing lives in
 * setup/schemeSetupSizing.ts with the Legacy Virus branch.
 *
 * No boardgame.io import. No registry import. No I/O. No .reduce().
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { VillainDeckState } from '../villainDeck/villainDeck.types.js';

/** The Clash of the Monsters Unleashed scheme ext_id. */
export const CLASH_SCHEME_ID = 'chmp/clash-of-the-monsters-unleashed';

/** The villain group whose cards form the Monster Pit. */
export const MONSTER_PIT_VILLAIN_GROUP_ID = 'chmp/monsters-unleashed';

// why: the instance ext_id grammar is `{setAbbr}-villain-{groupSlug}-{cardSlug}-{NN}`
// (villainCardInstanceExtIds), so every Monster Pit card starts with this prefix.
const MONSTER_PIT_EXT_ID_PREFIX = 'chmp-villain-monsters-unleashed-';

/** The scheme prints "Shuffle 8 Monsters Unleashed Villains" into the Pit. */
export const MONSTER_PIT_SETUP_SIZE = 8;

/** The first twist that opens the Monster Pit ("Twist 3-10"). */
export const FIRST_MONSTER_PIT_TWIST = 3;

/**
 * Returns the villain group ids setup builds cards for.
 *
 * For Clash, the Monsters Unleashed group is added (when the loadout did not
 * already pick it) so every per-card builder — the villain deck, cardStats,
 * display data, VP, ability hooks, defeat requirements — registers the 8
 * Monsters. The Pit is then split back out of the deck. Every other scheme gets
 * its ids back unchanged.
 *
 * @param schemeId - The selected scheme ext_id.
 * @param villainGroupIds - The loadout's villain group ids.
 * @returns The villain group ids to build.
 */
export function resolveEffectiveVillainGroupIds(
  schemeId: string,
  villainGroupIds: readonly string[],
): string[] {
  const effectiveIds = [...villainGroupIds];
  if (schemeId === CLASH_SCHEME_ID && !effectiveIds.includes(MONSTER_PIT_VILLAIN_GROUP_ID)) {
    effectiveIds.push(MONSTER_PIT_VILLAIN_GROUP_ID);
  }
  return effectiveIds;
}

/**
 * Reports whether a card instance belongs to the Monster Pit's villain group.
 *
 * @param cardId - A card instance ext_id.
 * @returns True for a Monsters Unleashed villain instance.
 */
export function isMonsterPitCard(cardId: CardExtId): boolean {
  return cardId.startsWith(MONSTER_PIT_EXT_ID_PREFIX);
}

/**
 * Splits the Monster Pit out of the built villain deck, for Clash only.
 *
 * The villain deck was shuffled with the Monsters in it, so keeping their
 * relative order gives a shuffled Pit without another random draw. Returns
 * `monsterPit: undefined` for every other scheme, so their G keeps no Pit key.
 *
 * @param schemeId - The selected scheme ext_id.
 * @param villainDeckState - The built (shuffled) villain deck.
 * @returns The villain deck without the Monsters, and the Pit (Clash only).
 */
export function splitMonsterPitFromVillainDeck(
  schemeId: string,
  villainDeckState: VillainDeckState,
): { villainDeckState: VillainDeckState; monsterPit: CardExtId[] | undefined } {
  if (schemeId !== CLASH_SCHEME_ID) {
    return { villainDeckState, monsterPit: undefined };
  }
  const remainingDeck: CardExtId[] = [];
  const monsterPit: CardExtId[] = [];
  for (const cardId of villainDeckState.deck) {
    if (isMonsterPitCard(cardId)) {
      monsterPit.push(cardId);
    } else {
      remainingDeck.push(cardId);
    }
  }
  return {
    villainDeckState: { deck: remainingDeck, discard: villainDeckState.discard },
    monsterPit,
  };
}

/**
 * Reads a villain card's printed Attack.
 *
 * A static villain prints its fightCost; an "N+" villain prints N (its
 * fightCostBase). Modifiers such as Dark Portals are not printed, so they are
 * ignored here.
 *
 * @param gameState - The game state (read-only).
 * @param cardId - The villain instance.
 * @returns The printed Attack, or 0 when the card has no stats entry.
 */
export function readPrintedVillainAttack(
  gameState: LegendaryGameState,
  cardId: CardExtId,
): number {
  const stats = gameState.cardStats[cardId];
  if (!stats) {
    return 0;
  }
  if (stats.fightCostMode === 'dynamic') {
    return stats.fightCostBase;
  }
  return stats.fightCost;
}

/**
 * Chooses a player's Gladiator: the Villain in their Victory Pile with the
 * highest printed Attack.
 *
 * why: the Gladiator only matters as "a lower printed Attack than that
 * Monster", and the Monster is face down when it is chosen, so the highest
 * printed Attack is never a worse choice than any other. The engine picks it for
 * every player rather than asking (pending choices are active-player-only,
 * D-24284). Ties keep the earliest Victory Pile card.
 *
 * @param gameState - The game state (read-only).
 * @param playerId - The player choosing.
 * @returns The Gladiator and its printed Attack, or null when the Victory Pile
 *   holds no Villain.
 */
export function chooseGladiator(
  gameState: LegendaryGameState,
  playerId: string,
): { cardId: CardExtId; printedAttack: number } | null {
  const victoryPile = gameState.playerZones[playerId]?.victory ?? [];
  let gladiator: { cardId: CardExtId; printedAttack: number } | null = null;
  for (const cardId of victoryPile) {
    // why: the same Villain test as getEligibleVictoryVillains (moves/, which this
    // pure rules/ module may not import): Villains and Henchmen count (rules v23
    // "Henchmen Are Villains", D-24608); a defeated Killbot counts as a Bystander.
    const cardType = gameState.villainDeckCardTypes[cardId];
    const isVillain = cardType === 'villain' || cardType === 'henchman';
    if (!isVillain || gameState.convertedVillainOrigins?.[cardId] === 'killbot') {
      continue;
    }
    const printedAttack = readPrintedVillainAttack(gameState, cardId);
    if (gladiator === null || printedAttack > gladiator.printedAttack) {
      gladiator = { cardId, printedAttack };
    }
  }
  return gladiator;
}
