/**
 * Villains to the left of the Mastermind (WP-840 / D-24773).
 *
 * co2e The Blob: "Ambush: Put The Blob to the left of the Mastermind space. Nothing moves The
 * Blob. While he's there, you can't fight the Mastermind. (You can still fight The Blob.)"
 *
 * Such a Villain is outside the City, in the lazy `G.villainsBesideMastermind` list (arrival
 * order; both Blob copies can be there at once), so no City mover, push, escape or Guard
 * reaches it. It is fought through the WP-873 Fortify fight path (`moves/fortifyFight.ts`),
 * and `isMastermindGuarded` is the one predicate behind every "the Mastermind can't be
 * fought" check (a Villain fortifying the Mastermind, or one to its left).
 *
 * These helpers are the ONLY readers and writers of `G.villainsBesideMastermind`. The list is
 * created by the first put and deleted when the last Villain leaves, so it is absent from
 * every match in which no Blob ambushed.
 *
 * Pure helpers over G. No boardgame.io import. No .reduce(). Never throws.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { isMastermindFortified } from './fortify.logic.js';

// why: a shared empty list for the absent field, frozen so a caller can never write into it
// and create a phantom entry outside G.
const NO_VILLAINS_BESIDE_MASTERMIND: readonly CardExtId[] = Object.freeze([]);

/**
 * Lists the Villains to the left of the Mastermind, in arrival order.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns The listed Villains; empty when the field is absent.
 */
export function listVillainsBesideMastermind(G: LegendaryGameState): readonly CardExtId[] {
  if (G.villainsBesideMastermind === undefined) {
    return NO_VILLAINS_BESIDE_MASTERMIND;
  }
  return G.villainsBesideMastermind;
}

/**
 * Returns the Villain at a position to the left of the Mastermind.
 *
 * @param G - The game state to inspect (not mutated).
 * @param besideIndex - The 0-based position (an untrusted move argument).
 * @returns The Villain's id, or null unless the index is an integer within the list.
 */
export function getVillainBesideMastermind(G: LegendaryGameState, besideIndex: unknown): CardExtId | null {
  if (typeof besideIndex !== 'number' || !Number.isInteger(besideIndex)) {
    return null;
  }
  const villains = listVillainsBesideMastermind(G);
  if (besideIndex < 0 || besideIndex >= villains.length) {
    return null;
  }
  const cardId = villains[besideIndex];
  if (cardId === undefined) {
    return null;
  }
  return cardId;
}

/**
 * Puts a Villain to the left of the Mastermind, after any already there.
 *
 * @param G - The game state (mutated under the Immer draft when the Villain is added).
 * @param cardId - The Villain to put there.
 * @returns False (no write) when the Villain is already listed; true when it was added.
 */
export function putVillainBesideMastermind(G: LegendaryGameState, cardId: CardExtId): boolean {
  const villains = listVillainsBesideMastermind(G);
  if (villains.includes(cardId)) {
    return false;
  }
  if (G.villainsBesideMastermind === undefined) {
    G.villainsBesideMastermind = [cardId];
    return true;
  }
  G.villainsBesideMastermind.push(cardId);
  return true;
}

/**
 * Takes the Villain at a position to the left of the Mastermind out of the list.
 *
 * @param G - The game state (mutated under the Immer draft when an entry is taken).
 * @param besideIndex - The 0-based position.
 * @returns The Villain's id, or null when nothing is at that position (no write).
 */
export function takeVillainBesideMastermind(G: LegendaryGameState, besideIndex: number): CardExtId | null {
  const cardId = getVillainBesideMastermind(G, besideIndex);
  if (cardId === null || G.villainsBesideMastermind === undefined) {
    return null;
  }
  G.villainsBesideMastermind.splice(besideIndex, 1);
  // why: hash posture — the key is deleted when the last Villain leaves, so a match whose
  // Blobs were all fought returns to canonical JSON without the key (never `[]` in G).
  if (G.villainsBesideMastermind.length === 0) {
    delete G.villainsBesideMastermind;
  }
  return cardId;
}

/**
 * Returns whether the Mastermind can't be fought because a Villain guards it.
 *
 * // why: WP-840 / D-24773 — the single predicate behind the Mastermind lock: the
 * fightMastermind move, its getLegalMoves mirror (D-24364) and the projected
 * `mastermind.fortifiedReason` all read this, so they can never disagree. It covers a
 * Villain fortifying the Mastermind (WP-873, Colleen Wing) and one to its left (The Blob).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns True while a Villain fortifies the Mastermind or is to its left.
 */
export function isMastermindGuarded(G: LegendaryGameState): boolean {
  if (isMastermindFortified(G)) {
    return true;
  }
  return listVillainsBesideMastermind(G).length > 0;
}

/**
 * Builds the player-facing reason the Mastermind can't be fought while a Villain is to its
 * left, naming the first one listed.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns `<name> is to the left of the Mastermind. Fight <name> first.`, or null when no
 *   Villain is there.
 */
export function buildBesideMastermindBlockReason(G: LegendaryGameState): string | null {
  const firstVillain = getVillainBesideMastermind(G, 0);
  if (firstVillain === null) {
    return null;
  }
  const display = G.cardDisplayData?.[firstVillain];
  let name: string = firstVillain;
  if (display !== undefined && typeof display.name === 'string' && display.name.length > 0) {
    name = display.name;
  }
  return `${name} is to the left of the Mastermind. Fight ${name} first.`;
}
