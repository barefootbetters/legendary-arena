/**
 * Fortify keyword helpers for the Legendary Arena game engine (WP-873 / D-24818).
 *
 * Rules v23 L1454-1466: a Villain that fortifies a place sits on or near it; while it is
 * there the place carries the listed effect, and any player can fight that Villain as
 * normal to end the effect. A place holds at most one fortifying Villain.
 *
 * Fortify state lives in `G.fortifications`, keyed by place. It is created lazily by the
 * first Fortify and deleted when the last fortification ends, so it is absent in every
 * match that never fortifies. These helpers are the ONLY writers of that table and the
 * only readers of it: every lock reads `isSidekickStackFortified` / `isMastermindFortified`.
 *
 * Pure helpers over G. No boardgame.io import. No .reduce(). Never throws.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { Fortification, FortifyLock, FortifyPlace } from './fortify.types.js';
import { FORTIFY_PLACES, FORTIFY_PLACE_LABELS } from './fortify.types.js';

/** The outcome of an attempt to fortify a place with an escaped Villain. */
export type FortifyOutcome = 'fortified' | 'already-fortified' | 'not-in-escape-pile';

/**
 * Returns whether a value is one of the places a Villain can fortify.
 *
 * @param value - Any value (a move argument, a marker token).
 * @returns True when the value is a member of FORTIFY_PLACES.
 */
export function isFortifyPlace(value: unknown): value is FortifyPlace {
  if (typeof value !== 'string') {
    return false;
  }
  for (const place of FORTIFY_PLACES) {
    if (place === value) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the fortification at a place, or null when nobody fortifies it.
 *
 * @param G - The game state to inspect (not mutated).
 * @param place - The place to read.
 * @returns The fortification, or null.
 */
export function getFortification(G: LegendaryGameState, place: FortifyPlace): Fortification | null {
  const fortifications = G.fortifications;
  if (fortifications === undefined) {
    return null;
  }
  return fortifications[place] ?? null;
}

/**
 * Returns whether the Sidekick Stack is fortified with the no-recruit-or-gain lock.
 *
 * // why: WP-873 / D-24818 — the single predicate behind the Sidekick lock: the
 * recruitSidekick move, the gainSidekickToDiscard helper, the gain-sidekick hero handler
 * and the projection all read this, so they can never disagree.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns True while a Villain fortifies the Sidekick Stack.
 */
export function isSidekickStackFortified(G: LegendaryGameState): boolean {
  return placeHasLock(G, 'sidekick-stack', 'no-recruit-or-gain');
}

/**
 * Returns whether the Mastermind is fortified with the no-fight lock.
 *
 * // why: WP-873 / D-24818 — the single predicate behind the Mastermind lock: the
 * fightMastermind move, its getLegalMoves mirror and the projection all read this.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns True while a Villain fortifies the Mastermind.
 */
export function isMastermindFortified(G: LegendaryGameState): boolean {
  return placeHasLock(G, 'mastermind', 'no-fight');
}

/**
 * Returns whether a place is fortified with a specific lock.
 *
 * @param G - The game state to inspect (not mutated).
 * @param place - The place to read.
 * @param lock - The lock to look for.
 * @returns True when the place's fortification carries that lock.
 */
function placeHasLock(G: LegendaryGameState, place: FortifyPlace, lock: FortifyLock): boolean {
  const fortification = getFortification(G, place);
  if (fortification === null) {
    return false;
  }
  return fortification.lock === lock;
}

/**
 * Lists every fortification, in FORTIFY_PLACES order.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns One entry per fortified place; empty when nothing is fortified.
 */
export function listFortifications(
  G: LegendaryGameState,
): { place: FortifyPlace; fortification: Fortification }[] {
  const entries: { place: FortifyPlace; fortification: Fortification }[] = [];
  for (const place of FORTIFY_PLACES) {
    const fortification = getFortification(G, place);
    if (fortification !== null) {
      entries.push({ place, fortification });
    }
  }
  return entries;
}

/**
 * Fortifies a place with a Villain that has just escaped, pulling it back out of the
 * Escape Pile.
 *
 * Checked in order: a place that is already fortified → `'already-fortified'`, no write;
 * a Villain that is not in `G.escapedPile` → `'not-in-escape-pile'`, no write; otherwise
 * its last index leaves `G.escapedPile` and the place records it → `'fortified'`.
 *
 * @param G - The game state (mutated under the Immer draft on `'fortified'` only).
 * @param place - The place to fortify.
 * @param lock - The lock the fortification applies.
 * @param villainCardId - The escaped Villain.
 * @returns The outcome.
 */
export function fortifyWithEscapedVillain(
  G: LegendaryGameState,
  place: FortifyPlace,
  lock: FortifyLock,
  villainCardId: CardExtId,
): FortifyOutcome {
  // why: rules v23 L1465-1466 — "If a card would fortify a place, don't do anything if
  // there's already a Villain fortifying that place": one Villain per place, and the second
  // one stays in the Escape Pile.
  if (getFortification(G, place) !== null) {
    return 'already-fortified';
  }
  const pileIndex = G.escapedPile.lastIndexOf(villainCardId);
  if (pileIndex === -1) {
    return 'not-in-escape-pile';
  }
  // why: rules v23 L3182-3184 — a Villain that escapes and is put somewhere besides the
  // Escape Pile is not in it, so schemes that count escaped Villains (which all read
  // G.escapedPile) no longer count it. Only that one index leaves, so the Bystanders it
  // carried in stay. G.counters is NOT touched: the counter is the escape-event count behind
  // the score penalty and the HUD, and rules L3265 scores every Villain that escaped.
  G.escapedPile = [...G.escapedPile.slice(0, pileIndex), ...G.escapedPile.slice(pileIndex + 1)];
  G.fortifications = { ...(G.fortifications ?? {}), [place]: { villainCardId, lock } };
  return 'fortified';
}

/**
 * Ends the fortification at a place.
 *
 * @param G - The game state (mutated under the Immer draft when an entry exists).
 * @param place - The place to clear.
 * @returns The fortifying Villain's id, or null when nobody fortified the place.
 */
export function removeFortification(G: LegendaryGameState, place: FortifyPlace): CardExtId | null {
  const fortification = getFortification(G, place);
  if (fortification === null || G.fortifications === undefined) {
    return null;
  }
  const villainCardId = fortification.villainCardId;
  delete G.fortifications[place];
  // why: hash posture — the key is deleted when the last fortification ends, so a match
  // whose fortifications were all fought returns to canonical JSON without the key.
  if (Object.keys(G.fortifications).length === 0) {
    delete G.fortifications;
  }
  return villainCardId;
}

/**
 * Builds the player-facing reason a fortified place is locked.
 *
 * @param G - The game state to inspect (not mutated).
 * @param place - The place to describe.
 * @returns `<name> fortifies <place>. Fight <name> first.`, or null when the place is
 *   not fortified.
 */
export function buildFortifyBlockReason(G: LegendaryGameState, place: FortifyPlace): string | null {
  const fortification = getFortification(G, place);
  if (fortification === null) {
    return null;
  }
  const villainCardId = fortification.villainCardId;
  const display = G.cardDisplayData?.[villainCardId];
  let name: string = villainCardId;
  if (display !== undefined && typeof display.name === 'string' && display.name.length > 0) {
    name = display.name;
  }
  return `${name} fortifies ${FORTIFY_PLACE_LABELS[place]}. Fight ${name} first.`;
}
