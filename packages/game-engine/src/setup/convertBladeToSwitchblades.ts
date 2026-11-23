/**
 * Midnight Massacre Blade → Switchblade conversion (WP-764 / D-24596).
 *
 * The mdns scheme prints:
 * - "Setup: 11 Twists. Add all 14 cards for any Blade Hero to the Villain Deck."
 * - "Special Rules: Blade Hero cards in the Villain Deck and city are demonically-possessed
 *   'Switchblade' Villains with [attack] equal to their printed cost. Their only abilities are
 *   'Sunlight: To fight this, you must also spend 3 [recruit]. Moonlight: Blood Frenzy. Fight:
 *   Either KO this card or choose a player to gain it as a Hero.'"
 *
 * This module holds the two pure setup pieces: which Blade Hero this match uses (a deterministic
 * v1 preference, no operator pick yet) and the conversion that adds that Blade's 14 card instances
 * to the Villain Deck as Switchblade Villains. Each card is typed `'villain'` (so it reveals,
 * fights and escapes through the existing villain path — the RevealedCardType union is NOT
 * extended) and tagged `'switchblade'` in the converted-villain overlay; the Villain Deck is then
 * re-shuffled once. The Blade Hero is an EXTRA Hero that is NEVER in the Hero Deck or HQ: the
 * caller feeds it to the stats / traits / display / hook builders only, so a gained Switchblade
 * plays as a Hero (WP-764 §Extra-hero data feed).
 *
 * Determinism: the caller runs this AFTER the Skrull and Micro-Sized conversions (both passthroughs
 * for this scheme), so the re-shuffle here is the LAST random draw in setup. Every other scheme
 * passes an empty id list, which draws nothing and keeps its state hash byte-identical.
 *
 * The fight cost (`economy.resolve.ts`), the defeat seat choice (`moves/seatChoiceTactics.ts`) and
 * the Hero-Deck-burn twist (`rules/schemeTwistResolvers.ts`) read the `'switchblade'` origin this
 * module writes. The Sunlight/Moonlight fight modifiers are deferred and recorded as a hollow at
 * each defeat (`moves/fightVillain.ts`); this module adds no fight-cost term.
 *
 * Pure helper — no boardgame.io import (the shuffle source is passed in as a ShuffleProvider), no
 * registry import, no `.reduce()`. Inputs are never mutated. Never throws.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { ConvertedVillainOrigin } from '../types.js';
import type { RevealedCardType, VillainDeckState } from '../villainDeck/villainDeck.types.js';
import type { ShuffleProvider } from './shuffle.js';

/** The Midnight Massacre scheme this conversion applies to. */
export const MIDNIGHT_MASSACRE_SCHEME_ID = 'mdns/midnight-massacre';

/** The converted-villain origin a Blade Hero card carries while it is a Switchblade Villain. */
export const SWITCHBLADE_ORIGIN: ConvertedVillainOrigin = 'switchblade';

// why: WP-764 / D-24596 — the deterministic v1 Blade preference. Blade (Dark City) is the default,
// because it is an EXTRA Hero that is normally not one of the player-selected Heroes. When Blade is
// already a selected Hero, the Midnight Massacre printing on Blade Daywalker is used instead; when
// both are selected, there is no Blade left to convert (a named no-op edge case). An operator pick
// of the Blade Hero is a follow-up envelope field (the WP-524/525 three-layer precedent).
/** The preferred Blade Hero: Blade (Dark City). */
const BLADE_PREFERRED_HERO_ID = 'dkcy/blade';
/** The fallback Blade Hero when the preferred one is a selected Hero: Blade, Daywalker. */
const BLADE_FALLBACK_HERO_ID = 'mdns/blade-daywalker';

/**
 * Which Blade Hero this Midnight Massacre match converts into Switchblades.
 *
 * `bothBladesSelected` is set only for the named no-op: both Blade Heroes are selected Heroes, so
 * none is left to convert and the scheme plays without Switchblades.
 */
export interface BladeSelection {
  /** The Blade Hero to convert, or absent (no conversion). */
  bladeHeroId?: string;
  /** true only when both Blade Heroes are selected Heroes, so the conversion is skipped. */
  bothBladesSelected: boolean;
}

/**
 * Picks the Blade Hero whose cards become Switchblades, deterministically (WP-764 / D-24596).
 *
 * Blade (Dark City) by default, since it is normally an extra Hero outside `heroDeckIds`; Blade
 * Daywalker when Blade is already a selected Hero; neither (a logged no-op) when both are selected.
 * Every other scheme returns no Blade.
 *
 * @param schemeId - The active scheme ext_id.
 * @param heroDeckIds - The match's selected hero deck ids (not mutated).
 * @returns The Blade Hero to convert, and whether both Blades were selected (the no-op flag).
 */
export function selectBladeHero(
  schemeId: string,
  heroDeckIds: readonly string[],
): BladeSelection {
  if (schemeId !== MIDNIGHT_MASSACRE_SCHEME_ID) {
    return { bothBladesSelected: false };
  }
  const isPreferredSelected = heroDeckIds.includes(BLADE_PREFERRED_HERO_ID);
  const isFallbackSelected = heroDeckIds.includes(BLADE_FALLBACK_HERO_ID);
  if (isPreferredSelected && isFallbackSelected) {
    return { bothBladesSelected: true };
  }
  if (!isPreferredSelected) {
    return { bladeHeroId: BLADE_PREFERRED_HERO_ID, bothBladesSelected: false };
  }
  return { bladeHeroId: BLADE_FALLBACK_HERO_ID, bothBladesSelected: false };
}

/**
 * The setup message naming the Blade Hero converted into Switchblades.
 *
 * @param bladeHeroName - The Blade Hero's display name (or its deck id when unknown).
 * @param cardCount - How many of its cards joined the Villain Deck.
 * @returns The full-sentence setup log line.
 */
export function describeSwitchbladeConversion(bladeHeroName: string, cardCount: number): string {
  return `Midnight Massacre: ${bladeHeroName}'s ${cardCount} cards are shuffled into the Villain Deck as Switchblade Villains.`;
}

/** The setup message for the named no-op: both Blade Heroes are selected, so none is converted. */
export function describeNoBladeAvailable(): string {
  return 'Midnight Massacre: both Blade Heroes are selected Heroes, so there is no Blade to convert; the scheme plays without Switchblades.';
}

/** Result of adding a Blade Hero's cards to the Villain Deck as Switchblades (the WP-514 shape). */
export interface ConvertBladeToSwitchbladesResult {
  /** The Villain Deck with the Switchblades added and re-shuffled. */
  villainDeckState: VillainDeckState;
  /** The Villain Deck card-type map with each Switchblade typed `'villain'`. */
  villainDeckCardTypes: Record<CardExtId, RevealedCardType>;
  /** The converted-villain overlay with each Switchblade tagged `'switchblade'`. */
  convertedOrigins: Record<CardExtId, ConvertedVillainOrigin>;
}

/**
 * Adds a Blade Hero's card instances to the Villain Deck as Switchblade Villains (WP-764 / D-24596).
 *
 * Each card is typed `'villain'` (so it reveals, fights and escapes through the existing villain
 * path) and tagged `'switchblade'` in the converted-villain overlay; the deck is then re-shuffled
 * once. Inputs are never mutated. Gated on the Midnight Massacre scheme id with a non-empty id
 * list — every other scheme (and this scheme with no Blade to convert) passes through with no
 * random draw, so its state hash is byte-identical.
 *
 * // why: WP-764 placement — the caller runs this AFTER the Skrull and Micro-Sized conversions
 * (passthroughs here), so this re-shuffle is the last random draw in setup and every earlier draw
 * is unchanged.
 *
 * @param schemeId - The active scheme ext_id (the conversion gate).
 * @param bladeInstanceIds - The Blade Hero's card instance ids (from buildHeroDeckCards).
 * @param villainDeckState - The built Villain Deck state; not mutated.
 * @param villainDeckCardTypes - The Villain Deck card-type map; not mutated.
 * @param convertedOrigins - The converted-villain overlay so far; not mutated.
 * @param context - Setup context with `random.Shuffle`.
 * @returns The (possibly converted) Villain Deck, card types and overlay.
 */
export function convertBladeToSwitchblades(
  schemeId: string,
  bladeInstanceIds: readonly CardExtId[],
  villainDeckState: VillainDeckState,
  villainDeckCardTypes: Record<CardExtId, RevealedCardType>,
  convertedOrigins: Record<CardExtId, ConvertedVillainOrigin>,
  context: ShuffleProvider,
): ConvertBladeToSwitchbladesResult {
  // why: passthrough for every non-Midnight-Massacre scheme AND for a Midnight Massacre match with
  // no Blade to convert (the both-selected no-op) — no overlay entries and, critically, NO new
  // ctx.random.Shuffle call, so those games add zero random draws and stay byte-identical.
  if (schemeId !== MIDNIGHT_MASSACRE_SCHEME_ID || bladeInstanceIds.length === 0) {
    return { villainDeckState, villainDeckCardTypes, convertedOrigins };
  }
  const newCardTypes: Record<CardExtId, RevealedCardType> = { ...villainDeckCardTypes };
  const newOrigins: Record<CardExtId, ConvertedVillainOrigin> = { ...convertedOrigins };
  for (const cardId of bladeInstanceIds) {
    newCardTypes[cardId] = 'villain';
    newOrigins[cardId] = SWITCHBLADE_ORIGIN;
  }
  const injectedDeck = [...villainDeckState.deck, ...bladeInstanceIds];
  // why: the scheme's one seeded shuffle mixes the Switchblades into the deck.
  const reshuffledDeck = context.random.Shuffle(injectedDeck);
  return {
    villainDeckState: { ...villainDeckState, deck: reshuffledDeck },
    villainDeckCardTypes: newCardTypes,
    convertedOrigins: newOrigins,
  };
}
