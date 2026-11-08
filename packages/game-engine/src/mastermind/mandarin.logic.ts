/**
 * The Mandarin's base-face lines (WP-875 / D-24822).
 *
 * The Mandarin (rvlt, `rvlt/mandarin`) prints three lines:
 *   - "All Mandarin's Rings get +1 Attack."
 *   - "Mandarin gets -1 Attack for each Mandarin's Ring among all players' Victory Piles.
 *     (-3 Attack for each in solo.)"
 *   - "Master Strike: Each player chooses a Mandarin's Ring from their Victory Pile to enter the
 *     city. Any player who didn't have a Ring gains a Wound instead."
 *
 * This module holds the Ring identity test, the two read-time cost terms the single cost
 * authorities (`economy/economy.resolve.ts`) add, the owed-entry queue append the strike arm
 * calls, and the seat-choice apply that records each player's pick. The readers are pure; the
 * queue append and the apply mutate `G` in place. The City entry itself lives in
 * `moves/mandarinRingEntry.logic.ts` (it needs the escape procedure, so it sits on the reveal
 * import graph; this module must not).
 *
 * No boardgame.io import, no registry import, nothing under `villainDeck/`. No `.reduce()`.
 * Never throws.
 */

import type { LegendaryGameState, PendingSeatChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/** The Mandarin's mastermind id (`G.selection.mastermindId`). */
export const MANDARIN_MASTERMIND_ID = 'rvlt/mandarin';

// why: D-24803 — each printed Mandarin's Rings copy is its own card instance,
// `henchman-mandarins-rings-00` … `-09`, so "is this a Ring" is a prefix test on the instance id
// (every Ring copy shares it and no other card does).
/** The instance-id prefix every Mandarin's Rings copy carries. */
export const MANDARIN_RING_ID_PREFIX = 'henchman-mandarins-rings-';

/** "All Mandarin's Rings get +1 Attack." */
export const MANDARIN_RING_ATTACK_BONUS = 1;

/** "-1 Attack for each Mandarin's Ring among all players' Victory Piles." */
export const MANDARIN_RING_VICTORY_REDUCTION = 1;

/** "(-3 Attack for each in solo.)" */
export const MANDARIN_RING_VICTORY_REDUCTION_SOLO = 3;

// why: the kind lives here, not in the opener module, so `seatChoice.resolve.ts` imports only this
// module for WP-875 and never reaches the reveal / escape import graph (no new module cycle).
/** The seat-choice kind for choosing which Mandarin's Ring enters the City. */
export const MANDARIN_RING_ENTRY_SEAT_CHOICE_KIND = 'mandarin-ring-entry';

/**
 * Whether a card instance is a Mandarin's Rings copy.
 *
 * @param cardId - The card instance id.
 * @returns true for a `henchman-mandarins-rings-` instance.
 */
export function isMandarinRingCardId(cardId: CardExtId): boolean {
  return cardId.startsWith(MANDARIN_RING_ID_PREFIX);
}

/**
 * Lists the Mandarin's Rings in one Victory Pile, in pile order.
 *
 * @param victory - A player's Victory Pile.
 * @returns The Ring instance ids, in pile order.
 */
export function listMandarinRingsInVictoryPile(victory: readonly CardExtId[]): CardExtId[] {
  const rings: CardExtId[] = [];
  for (const cardId of victory) {
    if (isMandarinRingCardId(cardId)) {
      rings.push(cardId);
    }
  }
  return rings;
}

/**
 * Counts the Mandarin's Rings across every player's Victory Pile.
 *
 * @param G - Game state (read-only; `playerZones` may be absent on partial test states).
 * @returns The number of Ring instances in all Victory Piles.
 */
export function countMandarinRingsInAllVictoryPiles(G: LegendaryGameState): number {
  if (G.playerZones === undefined) {
    return 0;
  }
  let count = 0;
  for (const seat of Object.keys(G.playerZones)) {
    const zones = G.playerZones[seat];
    if (zones === undefined || !Array.isArray(zones.victory)) {
      continue;
    }
    count += listMandarinRingsInVictoryPile(zones.victory).length;
  }
  return count;
}

/**
 * Whether The Mandarin is the match's Mastermind.
 *
 * @param G - Game state (read-only; `selection` may be absent on partial test states).
 * @returns true when `G.selection.mastermindId` is `rvlt/mandarin`.
 */
export function isMandarinLeading(G: LegendaryGameState): boolean {
  return G.selection?.mastermindId === MANDARIN_MASTERMIND_ID;
}

/**
 * The "All Mandarin's Rings get +1 Attack" term for one Villain or Henchman.
 *
 * @param G - Game state (read-only).
 * @param cardId - The card instance being fought.
 * @returns MANDARIN_RING_ATTACK_BONUS for a Ring while The Mandarin leads, else 0.
 */
export function mandarinRingAttackBonus(G: LegendaryGameState, cardId: CardExtId): number {
  if (!isMandarinLeading(G)) {
    return 0;
  }
  if (!isMandarinRingCardId(cardId)) {
    return 0;
  }
  return MANDARIN_RING_ATTACK_BONUS;
}

/**
 * The "-1 Attack for each Mandarin's Ring among all players' Victory Piles (-3 in solo)" term.
 *
 * @param G - Game state (read-only).
 * @returns The amount The Mandarin's fight cost drops by (0 when another Mastermind leads).
 */
export function mandarinVictoryPileAttackReduction(G: LegendaryGameState): number {
  if (!isMandarinLeading(G)) {
    return 0;
  }
  const ringCount = countMandarinRingsInAllVictoryPiles(G);
  // why: "solo" is a one-seat match. A solo game with a bot ally has two seats, and the bot is a
  // player, so it uses the normal -1 per Ring (D-24822).
  let reductionPerRing = MANDARIN_RING_VICTORY_REDUCTION;
  if (G.playerZones !== undefined && Object.keys(G.playerZones).length === 1) {
    reductionPerRing = MANDARIN_RING_VICTORY_REDUCTION_SOLO;
  }
  return ringCount * reductionPerRing;
}

/**
 * Records one owed Ring entry for a player (the strike arm's queue write).
 *
 * @param G - The game state, mutated in place (queue appended, lazily created).
 * @param playerID - The player who will send a Ring from their Victory Pile into the City.
 */
export function queueMandarinRingEntry(G: LegendaryGameState, playerID: string): void {
  // why: lazily created at the first write, never seeded, so a match without The Mandarin
  // serializes byte-identically (no hash-oracle re-pin).
  if (G.pendingMandarinRingEntries === undefined) {
    G.pendingMandarinRingEntries = [];
  }
  G.pendingMandarinRingEntries.push({ playerID });
}

/**
 * Counts the Ring entries already owed by one player.
 *
 * @param G - Game state (read-only).
 * @param playerID - The player.
 * @returns How many queued entries belong to that player.
 */
export function countQueuedMandarinRingEntries(G: LegendaryGameState, playerID: string): number {
  const queue = G.pendingMandarinRingEntries;
  if (queue === undefined) {
    return 0;
  }
  let count = 0;
  for (const entry of queue) {
    if (entry.playerID === playerID) {
      count += 1;
    }
  }
  return count;
}

/**
 * Applies a fully-submitted `mandarin-ring-entry` seat choice: each answering seat's pick is
 * recorded on that seat's FIRST unchosen queued entry.
 *
 * // why: the apply only records. The City entry can push a Villain out, and its escape needs a
 * RevealContext (the turn) and the implementation map, which the seat-choice apply does not have;
 * the onMove opener (and each rebuilt loop) has both, so it moves the cards on the next pass.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted seat choice.
 */
export function applyMandarinRingEntryResolvedSeatChoice(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
): void {
  const queue = G.pendingMandarinRingEntries;
  if (queue === undefined) {
    return;
  }
  for (const seat of choice.addressedSeats) {
    const submission = choice.submissions[seat];
    if (submission === undefined) {
      continue;
    }
    const cardId = choice.seatPrompts[seat]?.options[submission.optionIndex]?.cardId;
    if (cardId === undefined) {
      continue;
    }
    for (const entry of queue) {
      if (entry.playerID === seat && entry.chosenCardId === undefined) {
        entry.chosenCardId = cardId;
        break;
      }
    }
  }
}
