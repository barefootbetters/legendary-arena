/**
 * Hero capture helpers for the Legendary Arena game engine (WP-214).
 *
 * Three pure functions for the hero capture lifecycle:
 * - captureHeroFromHq: remove a hero from HQ by selector, attach to villain,
 *   refill HQ slot from hero deck
 * - awardAttachedHeroes: award captured heroes to player's discard on defeat
 * - moveAttachedHeroesToEscapedPile: captured heroes go to the Escaped Villains pile when their captor escapes (D-24657)
 * - attachCapturedHero / captureHeroFromHqSlot: the shared attach and per-slot capture
 *   steps (WP-838 / D-24771: Venom's cheap-HQ capture, the Officer / Sidekick pile capture)
 * - selectCapturedHeroToGain / awardOneAttachedHeroRestToBottom: Venom's Fight gains one
 *   captured card and returns the rest to the bottom of their home decks (WP-838 / D-24771)
 *
 * All functions operate on G directly (not returning new objects) to match
 * the existing villain-effect mutation pattern. No boardgame.io import.
 * No ctx dependency. No randomness. No .reduce().
 */

import type { CardExtId } from '../state/zones.types.js';
import type { LegendaryGameState } from '../types.js';
import { refillHqSlot } from './city.logic.js';
import { SHIELD_OFFICER_EXT_ID, SIDEKICK_EXT_ID } from '../setup/pilesInit.js';

/**
 * Result of a successful hero capture operation.
 *
 * Returned by captureHeroFromHq when a non-null HQ slot is found.
 * null is returned when the HQ has no non-null slots (safe no-op).
 */
export interface CaptureHeroResult {
  /** The hero ext_id removed from the HQ and attached to the villain. */
  capturedHeroId: CardExtId;
  /** The HQ slot index that was vacated (0-4). */
  hqIndex: number;
  /** The hero ext_id that refilled the slot, or null when the deck is empty. */
  refilledHeroId: CardExtId | null;
}

/**
 * Captures a hero from the HQ and attaches it to a villain.
 *
 * Scans HQ slots by the given selector strategy, removes the selected hero,
 * attaches it to G.villainAttachedHeroes[villainCardId], and refills the HQ
 * slot from G.heroDeck. All three steps execute atomically — no intermediate
 * state is observable.
 *
 * Selector strategies:
 * - 'rightmost': scans index 4 → 0, captures first non-null slot.
 * - 'highestCost': scans left→right, captures highest G.cardStats[id].cost;
 *   ties broken by rightmost index.
 * - 'lowestCost': scans left→right, captures lowest G.cardStats[id].cost;
 *   ties broken by rightmost index.
 *
 * @param G - Game state (mutated directly).
 * @param villainCardId - The villain zone-instance ext_id to attach to.
 * @param selector - Which HQ selection strategy to apply.
 * @returns CaptureHeroResult when a hero was captured; null when HQ is empty.
 */
export function captureHeroFromHq(
  G: LegendaryGameState,
  villainCardId: CardExtId,
  selector: 'rightmost' | 'highestCost' | 'lowestCost',
): CaptureHeroResult | null {
  let selectedIndex: number | null = null;

  if (selector === 'rightmost') {
    // why: scan right-to-left (index 4 → 0); capture the first non-null slot
    for (let hqIndex = 4; hqIndex >= 0; hqIndex--) {
      if (G.hq[hqIndex] !== null) {
        selectedIndex = hqIndex;
        break;
      }
    }
  } else if (selector === 'highestCost') {
    // why: scan left-to-right; track highest cost hero; rightmost index wins ties
    let highestCost = -1;
    for (let hqIndex = 0; hqIndex < G.hq.length; hqIndex++) {
      const heroSlot = G.hq[hqIndex];
      if (heroSlot === null || heroSlot === undefined) continue;
      const heroId: CardExtId = heroSlot;
      const heroCost = G.cardStats[heroId]?.cost ?? 0;
      if (heroCost > highestCost || (heroCost === highestCost && hqIndex > (selectedIndex ?? -1))) {
        highestCost = heroCost;
        selectedIndex = hqIndex;
      }
    }
  } else {
    // why: scan left-to-right; track lowest cost hero; rightmost index wins ties
    let lowestCost = Infinity;
    for (let hqIndex = 0; hqIndex < G.hq.length; hqIndex++) {
      const heroSlot = G.hq[hqIndex];
      if (heroSlot === null || heroSlot === undefined) continue;
      const heroId: CardExtId = heroSlot;
      const heroCost = G.cardStats[heroId]?.cost ?? 0;
      if (heroCost < lowestCost || (heroCost === lowestCost && hqIndex > (selectedIndex ?? -1))) {
        lowestCost = heroCost;
        selectedIndex = hqIndex;
      }
    }
  }

  if (selectedIndex === null) {
    // why: all HQ slots are null — safe no-op per zone-exhaustion defence
    return null;
  }

  // why: WP-838 / D-24771 — the remove / attach / refill steps live in captureHeroFromHqSlot,
  // shared with Venom's per-slot capture; the selection above is unchanged.
  return captureHeroFromHqSlot(G, villainCardId, selectedIndex);
}

/**
 * Attaches a captured hero to a villain's capture list (WP-838 / D-24771).
 *
 * Creates the G.villainAttachedHeroes entry or appends to it. Shared by the HQ
 * capture and the Officer / Sidekick pile capture, so every capture path writes
 * the entry the same way.
 *
 * @param G - Game state (mutated directly).
 * @param villainCardId - The villain zone-instance ext_id to attach to.
 * @param heroId - The captured hero ext_id.
 */
export function attachCapturedHero(
  G: LegendaryGameState,
  villainCardId: CardExtId,
  heroId: CardExtId,
): void {
  const existingCaptures = G.villainAttachedHeroes[villainCardId];
  if (existingCaptures === undefined) {
    G.villainAttachedHeroes[villainCardId] = [heroId];
  } else {
    existingCaptures.push(heroId);
  }
}

/**
 * Captures the hero in one HQ slot and attaches it to a villain (WP-838 / D-24771).
 *
 * Removes the hero from the slot, attaches it, and refills the slot from
 * G.heroDeck, atomically. An empty or out-of-range slot is a safe no-op.
 *
 * @param G - Game state (mutated directly).
 * @param villainCardId - The villain zone-instance ext_id to attach to.
 * @param hqIndex - The HQ slot to capture from.
 * @returns CaptureHeroResult when a hero was captured; null for an empty or
 *   out-of-range slot.
 */
export function captureHeroFromHqSlot(
  G: LegendaryGameState,
  villainCardId: CardExtId,
  hqIndex: number,
): CaptureHeroResult | null {
  if (!Number.isInteger(hqIndex) || hqIndex < 0 || hqIndex >= G.hq.length) {
    return null;
  }
  const capturedHeroId = G.hq[hqIndex];
  if (capturedHeroId === null || capturedHeroId === undefined) {
    return null;
  }

  // Step 1: Remove hero from HQ slot (set to null before refill)
  G.hq[hqIndex] = null;

  // Step 2: Attach hero to villain's capture list
  attachCapturedHero(G, villainCardId, capturedHeroId);

  // Step 3: Refill HQ slot from hero deck
  const refillResult = refillHqSlot(G.hq, hqIndex, G.heroDeck);
  G.hq = refillResult.hq;
  G.heroDeck = refillResult.heroDeck;

  const refilledHeroId = G.hq[hqIndex] ?? null;

  return {
    capturedHeroId,
    hqIndex,
    refilledHeroId,
  };
}

/**
 * Picks which captured card a player gains from Venom (WP-838 / D-24771).
 *
 * The highest `G.cardStats[id]?.cost ?? 0`; on a tie a card that is not
 * SIDEKICK_EXT_ID wins over a Sidekick, otherwise the earliest wins.
 *
 * @param G - Game state (read-only).
 * @param heroIds - The captured cards, in capture order.
 * @returns The index of the card to gain, or -1 for an empty list.
 */
// why: D-24771 (Operator fork F4's alternative, adopted at execution) — a beneficial "may"
// auto-takes (D-24350), and the Sidekick ranks at its printed cost 2 now that it has a play
// ability (D-24776: it returns to the Stack and draws two). A Hero of equal cost stays in the
// deck, so it wins the tie.
export function selectCapturedHeroToGain(
  G: LegendaryGameState,
  heroIds: readonly CardExtId[],
): number {
  let selectedIndex = -1;
  let selectedCost = -1;
  let selectedIsSidekick = false;
  for (let heroIndex = 0; heroIndex < heroIds.length; heroIndex++) {
    const heroId = heroIds[heroIndex]!;
    const heroCost = G.cardStats[heroId]?.cost ?? 0;
    const isSidekick = heroId === SIDEKICK_EXT_ID;
    const isHigher = heroCost > selectedCost;
    const winsTieOverSidekick = heroCost === selectedCost && selectedIsSidekick && !isSidekick;
    if (selectedIndex === -1 || isHigher || winsTieOverSidekick) {
      selectedIndex = heroIndex;
      selectedCost = heroCost;
      selectedIsSidekick = isSidekick;
    }
  }
  return selectedIndex;
}

/** A captured card Venom's Fight returned to the bottom of its home deck (WP-838 / D-24771). */
export interface ReturnedCapturedHero {
  heroId: CardExtId;
  deck: 'hero-deck' | 'sidekick-deck' | 'officer-deck';
}

/** The outcome of Venom's split award (WP-838 / D-24771). */
export interface AttachedHeroSplitOutcome {
  /** The card the fighter gained, or null when the villain held nothing. */
  gainedHeroId: CardExtId | null;
  /** Every other captured card, in capture order, with the deck it went under. */
  returnedToBottom: ReturnedCapturedHero[];
}

/**
 * Awards one captured card to the defeating player and returns the rest to the
 * bottom of their home decks (WP-838 / D-24771: Venom's Fight).
 *
 * The card selectCapturedHeroToGain picks goes to the player's discard. Every
 * other card, in capture order, is appended to the bottom of its home deck:
 * SIDEKICK_EXT_ID → G.piles.sidekicks, SHIELD_OFFICER_EXT_ID → G.piles.officers,
 * any other id → G.heroDeck. The capture entry is deleted (D-21401). No entry
 * or missing player zones → nothing written.
 *
 * @param G - Game state (mutated directly).
 * @param villainCardId - The defeated villain zone-instance ext_id.
 * @param playerId - The defeating player's id.
 * @returns What was gained and what went to the bottom of which deck.
 */
export function awardOneAttachedHeroRestToBottom(
  G: LegendaryGameState,
  villainCardId: CardExtId,
  playerId: string,
): AttachedHeroSplitOutcome {
  const emptyOutcome: AttachedHeroSplitOutcome = { gainedHeroId: null, returnedToBottom: [] };
  // why: guard for pre-WP-214 G fixtures in tests that do not include the field
  if (!G.villainAttachedHeroes) return emptyOutcome;
  const capturedHeroes = G.villainAttachedHeroes[villainCardId];
  if (capturedHeroes === undefined || capturedHeroes.length === 0) return emptyOutcome;
  const playerZones = G.playerZones[playerId];
  if (!playerZones) return emptyOutcome;

  const gainedIndex = selectCapturedHeroToGain(G, capturedHeroes);
  const gainedHeroId = capturedHeroes[gainedIndex]!;
  playerZones.discard.push(gainedHeroId);

  const returnedToBottom: ReturnedCapturedHero[] = [];
  for (let heroIndex = 0; heroIndex < capturedHeroes.length; heroIndex++) {
    if (heroIndex === gainedIndex) continue;
    const heroId = capturedHeroes[heroIndex]!;
    if (heroId === SIDEKICK_EXT_ID) {
      G.piles.sidekicks = [...G.piles.sidekicks, heroId];
      returnedToBottom.push({ heroId, deck: 'sidekick-deck' });
    } else if (heroId === SHIELD_OFFICER_EXT_ID) {
      G.piles.officers = [...G.piles.officers, heroId];
      returnedToBottom.push({ heroId, deck: 'officer-deck' });
    } else {
      G.heroDeck = [...G.heroDeck, heroId];
      returnedToBottom.push({ heroId, deck: 'hero-deck' });
    }
  }

  // why: delete entry rather than setting to [] — zone integrity rule:
  // G.villainAttachedHeroes[v] exists only while length > 0 (D-21401)
  delete G.villainAttachedHeroes[villainCardId];
  return { gainedHeroId, returnedToBottom };
}

/**
 * Awards all heroes attached to a defeated villain to the player's discard pile.
 *
 * Called from fightVillain after the villain is placed in victory. Moves every
 * hero in G.villainAttachedHeroes[villainCardId] to G.playerZones[playerId].discard.
 * Deletes the mapping entry (not set to []).
 *
 * @param G - Game state (mutated directly).
 * @param villainCardId - The defeated villain zone-instance ext_id.
 * @param playerId - The defeating player's id (ctx.currentPlayer string).
 */
// why: heroes go to discard ("Gain that Hero" card text) — they enter the
// player's deck the normal way by shuffling, not into the victory pile
export function awardAttachedHeroes(
  G: LegendaryGameState,
  villainCardId: CardExtId,
  playerId: string,
): void {
  // why: guard for pre-WP-214 G fixtures in tests that do not include the field
  if (!G.villainAttachedHeroes) return;
  const capturedHeroes = G.villainAttachedHeroes[villainCardId];
  if (capturedHeroes === undefined || capturedHeroes.length === 0) {
    // why: no-op when villain has no attached heroes — backward compatible
    return;
  }

  const playerZones = G.playerZones[playerId];
  if (!playerZones) return;

  for (const heroId of capturedHeroes) {
    playerZones.discard.push(heroId);
  }

  // why: delete entry rather than setting to [] — zone integrity rule:
  // G.villainAttachedHeroes[v] exists only while length > 0 (D-21401)
  delete G.villainAttachedHeroes[villainCardId];
}

/**
 * Moves all heroes attached to an escaping villain into the Escaped Villains pile.
 *
 * Called from both escape paths (villainDeck.reveal.ts and the scheme-twist push
 * in schemeTwistResolvers.ts). Appends every hero in
 * G.villainAttachedHeroes[villainCardId] to G.escapedPile and deletes the mapping
 * entry (not set to []).
 *
 * @param G - Game state (mutated directly).
 * @param villainCardId - The escaping villain zone-instance ext_id.
 */
// why: D-24657 — Universal Rules v23 "Villains Escaping with Captured Heroes":
// "If a Villain escapes with captured Heroes, that doesn't cause any discarding.
// The captured Heroes just stay in the Escape Pile." They used to be KO'd. A hero
// ext_id carries no villainDeckCardTypes entry and is not a Bystander, so the
// escaped-pile scheme-loss and bystander-lost counters do not count it.
export function moveAttachedHeroesToEscapedPile(
  G: LegendaryGameState,
  villainCardId: CardExtId,
): void {
  // why: guard for pre-WP-214 G fixtures in tests that do not include the field
  if (!G.villainAttachedHeroes) return;
  const capturedHeroes = G.villainAttachedHeroes[villainCardId];
  if (capturedHeroes === undefined || capturedHeroes.length === 0) {
    // why: no-op when villain has no attached heroes — backward compatible
    return;
  }

  G.escapedPile = [...G.escapedPile, ...capturedHeroes];

  // why: delete entry rather than setting to [] — zone integrity rule:
  // G.villainAttachedHeroes[v] exists only while length > 0 (D-21401)
  delete G.villainAttachedHeroes[villainCardId];
}
