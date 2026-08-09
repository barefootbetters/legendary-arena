/**
 * Secret Invasion cross-deck hero conversion (WP-514 / D-24326).
 *
 * "Setup: Shuffle 12 random Heroes from the Hero Deck into the Villain Deck.
 *  Special Rules: Heroes in the Villain Deck count as Skrull Villains."
 *
 * For the Secret Invasion scheme only, this pure helper takes the top 12 cards of
 * the already-shuffled hero reservoir, converts each into a Skrull Villain (typed
 * `'villain'` in villainDeckCardTypes so it routes/fights/escapes via the existing
 * villain path — the RevealedCardType union is NOT extended — plus origin `'skrull'`
 * in the converted-villain overlay for identity), injects them into the villain
 * deck, and re-shuffles the villain deck via a single `ctx.random.Shuffle`. Every
 * other scheme takes the passthrough: the inputs are returned unchanged and NO new
 * random draw is made, so non-Secret-Invasion games are byte-identical.
 *
 * Determinism: the caller runs this AFTER `buildHeroDeck` (the prior last random
 * draw) and BEFORE `fillHqFromDeck`, so the 12 are removed from the reservoir before
 * the HQ is filled (they never also land in the HQ / G.heroDeck) and the villain-deck
 * re-shuffle is the LAST random draw in setup.
 *
 * Pure helper — no boardgame.io import (the shuffle source is passed in as a
 * ShuffleProvider), no registry import, no `.reduce()`. Inputs are never mutated.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { ConvertedVillainOrigin } from '../types.js';
import type { RevealedCardType, VillainDeckState } from '../villainDeck/villainDeck.types.js';
import type { ShuffleProvider } from './shuffle.js';

/** The Secret Invasion scheme this conversion applies to. */
const SECRET_INVASION_SCHEME_ID = 'core/secret-invasion-of-the-skrull-shapeshifters';

// why: the card prints "Shuffle 12 random Heroes from the Hero Deck into the
// Villain Deck." A fixed count from the physical card, not a configurable param.
/** Number of Heroes converted into Skrull Villains at setup. */
const SKRULL_HERO_COUNT = 12;

/**
 * Result of the Secret Invasion hero → Skrull conversion.
 *
 * All four fields are the values the orchestrator writes into `G` (or feeds to
 * `fillHqFromDeck`). For non-Secret-Invasion schemes they equal the inputs.
 */
export interface ConvertHeroesToSkrullsResult {
  /** The hero reservoir after removing the converted Heroes (feeds fillHqFromDeck). */
  heroReservoir: CardExtId[];
  /** The villain deck state with the Skrulls injected and re-shuffled. */
  villainDeckState: VillainDeckState;
  /** The villain-deck card-type map with each converted Hero typed `'villain'`. */
  villainDeckCardTypes: Record<CardExtId, RevealedCardType>;
  /** The converted-villain overlay with each converted Hero marked `'skrull'`. */
  convertedOrigins: Record<CardExtId, ConvertedVillainOrigin>;
}

/**
 * Converts 12 Heroes into Skrull Villains for Secret Invasion, or passes the inputs
 * through unchanged for any other scheme.
 *
 * @param schemeId - The active scheme ext_id (`MatchSetupConfig.schemeId`).
 * @param shuffledHeroDeck - The shuffled hero reservoir (from buildHeroDeck); not mutated.
 * @param villainDeckState - The built villain deck state; not mutated.
 * @param villainDeckCardTypes - The villain-deck card-type map; not mutated.
 * @param convertedOrigins - The converted-villain overlay so far; not mutated.
 * @param context - Setup context with `ctx.random.Shuffle` (the re-shuffle source).
 * @returns The (possibly-converted) reservoir, villain deck, card types, and overlay.
 */
export function convertHeroesToSkrulls(
  schemeId: string,
  shuffledHeroDeck: CardExtId[],
  villainDeckState: VillainDeckState,
  villainDeckCardTypes: Record<CardExtId, RevealedCardType>,
  convertedOrigins: Record<CardExtId, ConvertedVillainOrigin>,
  context: ShuffleProvider,
): ConvertHeroesToSkrullsResult {
  // why: passthrough for every non-Secret-Invasion scheme — no reservoir draw, no
  // overlay entries, and (critically) NO new ctx.random.Shuffle call, so those games
  // add zero random draws and stay byte-identical.
  if (schemeId !== SECRET_INVASION_SCHEME_ID) {
    return {
      heroReservoir: shuffledHeroDeck,
      villainDeckState,
      villainDeckCardTypes,
      convertedOrigins,
    };
  }

  // why: take from the TOP of the already-shuffled reservoir — a uniform random
  // subset, so "12 random Heroes" needs no additional randomness for the selection.
  // A short reservoir (narrow test mocks) converts however many exist.
  const conversionCount = Math.min(SKRULL_HERO_COUNT, shuffledHeroDeck.length);
  const convertedHeroes: CardExtId[] = [];
  const heroReservoir: CardExtId[] = [];
  for (let heroIndex = 0; heroIndex < shuffledHeroDeck.length; heroIndex++) {
    if (heroIndex < conversionCount) {
      convertedHeroes.push(shuffledHeroDeck[heroIndex]!);
    } else {
      heroReservoir.push(shuffledHeroDeck[heroIndex]!);
    }
  }

  // why: copy the input maps (never mutate) and mark each converted Hero as a Skrull
  // Villain — typed 'villain' for native routing, origin 'skrull' for identity.
  const newCardTypes: Record<CardExtId, RevealedCardType> = { ...villainDeckCardTypes };
  const newOrigins: Record<CardExtId, ConvertedVillainOrigin> = { ...convertedOrigins };
  for (const heroId of convertedHeroes) {
    newCardTypes[heroId] = 'villain';
    newOrigins[heroId] = 'skrull';
  }

  // why: inject the Skrulls onto the villain deck, then re-shuffle so they are mixed
  // in rather than sitting on top. This is the SINGLE new ctx.random.Shuffle for the
  // scheme and — because the caller invokes this after the hero-deck shuffle — the
  // last random draw in setup.
  const injectedDeck = [...villainDeckState.deck, ...convertedHeroes];
  const reshuffledDeck = context.random.Shuffle(injectedDeck);

  return {
    heroReservoir,
    villainDeckState: { ...villainDeckState, deck: reshuffledDeck },
    villainDeckCardTypes: newCardTypes,
    convertedOrigins: newOrigins,
  };
}
