/**
 * Haunt keyword helpers for the Legendary Arena game engine (WP-757 / D-24587).
 *
 * Rulebook v23 p.27: a Haunting Villain is tucked beneath an HQ Hero. While it is
 * there, nobody can recruit that Hero (not even for free) and nobody can fight the
 * Haunting Villain. A player exorcises the Hero by paying its cost; the Villain then
 * enters the City, ignoring Ambush. A Hero can have only one haunter at a time. When
 * a Haunted Hero leaves the HQ, the haunter stays in that HQ space and haunts the
 * Hero that refills it.
 *
 * Haunt state lives in `G.hqHaunters`, an array index-aligned with `G.hq`. It is
 * created lazily on the first haunt and is absent in every match that never haunts.
 *
 * Pure helpers over G. No boardgame.io import. No .reduce(). Never throws.
 */

import type { HqHaunter, LegendaryGameState } from '../types.js';

/** Number of HQ slots; `G.hqHaunters` is always created with exactly this length. */
const HQ_SLOT_COUNT = 5;

// why: D-24587 — Patriarch's printed "an unhaunted Hero in the HQ that costs 3 or
// less" is a player choice on the tabletop. v1 resolves it deterministically to the
// lowest-index match (a named fidelity gap recorded in D-24587); 3 is the printed cap.
/** Highest printed cost the `cost-lte-3` selector accepts. */
const COST_LTE_3_MAX_COST = 3;

/** Which unhaunted HQ Hero a Haunt effect targets (WP-757 / D-24587). */
export type HauntSelector = 'rightmost' | 'leftmost' | 'cost-lte-3';

/**
 * Returns whether the HQ slot at `hqIndex` currently has a haunter.
 *
 * An empty (null) HQ slot can still carry a haunter when the Hero deck ran dry; this
 * reports the haunter, not whether a Hero is present.
 *
 * @param G - The game state to inspect (not mutated).
 * @param hqIndex - The 0-based HQ slot.
 * @returns True when `G.hqHaunters[hqIndex]` holds a haunter.
 */
export function isHqSlotHaunted(G: LegendaryGameState, hqIndex: number): boolean {
  const haunters = G.hqHaunters;
  if (haunters === undefined) {
    return false;
  }
  const haunter = haunters[hqIndex];
  return haunter !== null && haunter !== undefined;
}

/**
 * Returns whether the Mastermind is currently haunting an HQ slot.
 *
 * // why: D-24587 — the single predicate behind every "the Mastermind can't be
 * fought while it haunts" check: `fightMastermind`, both free-defeat target builders
 * (defeat-with-Bystander and Pure Fury) and the bot legal intents all read this, so
 * they can never disagree.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns True when any `G.hqHaunters` entry is `{ kind: 'mastermind' }`.
 */
export function isMastermindHaunting(G: LegendaryGameState): boolean {
  const haunters = G.hqHaunters;
  if (haunters === undefined) {
    return false;
  }
  for (const haunter of haunters) {
    if (haunter !== null && haunter !== undefined && haunter.kind === 'mastermind') {
      return true;
    }
  }
  return false;
}

/**
 * Returns whether the HQ slot holds a Hero that can take a new haunter: the slot is
 * occupied and nobody haunts it yet ("an unhaunted Hero").
 *
 * @param G - The game state to inspect (not mutated).
 * @param hqIndex - The 0-based HQ slot.
 * @returns True when the slot is non-null and unhaunted.
 */
function isHqSlotHauntable(G: LegendaryGameState, hqIndex: number): boolean {
  const slot = G.hq[hqIndex];
  if (slot === null || slot === undefined) {
    return false;
  }
  return !isHqSlotHaunted(G, hqIndex);
}

/**
 * Selects the HQ slot a Haunt effect targets, considering only occupied, unhaunted
 * slots (WP-757 / D-24587).
 *
 * - `rightmost`: the highest eligible index.
 * - `leftmost`: the lowest eligible index.
 * - `cost-lte-3`: the lowest eligible index whose Hero costs 3 or less.
 *
 * @param G - The game state to inspect (not mutated).
 * @param selector - Which eligible slot to pick.
 * @returns The selected HQ slot index, or null when no slot is eligible.
 */
export function selectUnhauntedHqIndex(
  G: LegendaryGameState,
  selector: HauntSelector,
): number | null {
  if (selector === 'rightmost') {
    for (let hqIndex = G.hq.length - 1; hqIndex >= 0; hqIndex--) {
      if (isHqSlotHauntable(G, hqIndex)) {
        return hqIndex;
      }
    }
    return null;
  }
  for (let hqIndex = 0; hqIndex < G.hq.length; hqIndex++) {
    if (!isHqSlotHauntable(G, hqIndex)) {
      continue;
    }
    if (selector === 'leftmost') {
      return hqIndex;
    }
    // why: D-24587 — `cost-lte-3` reads the printed cost from G.cardStats, the same
    // cost authority recruitHero uses; this is the deterministic v1 of Patriarch's
    // "an unhaunted Hero that costs 3 or less" (lowest index wins).
    const heroId = G.hq[hqIndex] as string;
    const heroCost = G.cardStats[heroId]?.cost ?? 0;
    if (heroCost <= COST_LTE_3_MAX_COST) {
      return hqIndex;
    }
  }
  return null;
}

/**
 * Records `haunter` on the HQ slot at `hqIndex`, creating `G.hqHaunters` on the first
 * haunt (WP-757 / D-24587).
 *
 * Refuses (returns false, no write) when the index is out of range, the slot holds
 * no Hero, or the slot is already haunted ("a Hero can't be Haunted by two Villains
 * at once"). The caller is responsible for moving a Villain haunter out of the City.
 *
 * @param G - The game state (mutated: `G.hqHaunters`).
 * @param hqIndex - The 0-based HQ slot to haunt.
 * @param haunter - Who haunts the slot.
 * @returns True when the haunter was recorded.
 */
export function hauntHqSlot(
  G: LegendaryGameState,
  hqIndex: number,
  haunter: HqHaunter,
): boolean {
  if (!Number.isInteger(hqIndex) || hqIndex < 0 || hqIndex >= HQ_SLOT_COUNT) {
    return false;
  }
  if (!isHqSlotHauntable(G, hqIndex)) {
    return false;
  }
  // why: D-24587 — lazy creation keeps `hqHaunters` absent in every match that never
  // haunts, so canonical JSON omits it and the hash oracles stay byte-stable. It is
  // created at full length (index-aligned with G.hq) and never written empty.
  if (G.hqHaunters === undefined) {
    const haunters: (HqHaunter | null)[] = [];
    for (let slotIndex = 0; slotIndex < HQ_SLOT_COUNT; slotIndex++) {
      haunters.push(null);
    }
    G.hqHaunters = haunters;
  }
  G.hqHaunters[hqIndex] = haunter;
  return true;
}

/**
 * Removes the haunter from the HQ slot at `hqIndex` and returns it.
 *
 * @param G - The game state (mutated: `G.hqHaunters[hqIndex]` becomes null).
 * @param hqIndex - The 0-based HQ slot.
 * @returns The removed haunter, or null when the slot was not haunted.
 */
export function clearHqHaunter(
  G: LegendaryGameState,
  hqIndex: number,
): HqHaunter | null {
  const haunters = G.hqHaunters;
  if (haunters === undefined) {
    return null;
  }
  const haunter = haunters[hqIndex];
  if (haunter === null || haunter === undefined) {
    return null;
  }
  haunters[hqIndex] = null;
  return haunter;
}
