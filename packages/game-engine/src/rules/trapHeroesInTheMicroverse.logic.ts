/**
 * Trap Heroes in the Microverse — an extra Hero's cards as Micro-Sized Villains (WP-863 / D-24805).
 *
 * The antm scheme prints:
 * - "Setup: 11 Twists. Add all 14 cards for an extra Hero to the Villain Deck."
 * - "Special Rules: Heroes in the Villain Deck are 'Micro-Sized' Villains with Attack equal to
 *   their printed cost. They have Size-Changing for their card color and no other abilities while
 *   in the City. When you fight one, choose any player to gain it as a Hero."
 * - "Twist: Play two cards from the Villain Deck."
 * - "Evil Wins: When 3 Villains per player have escaped or the Villain Deck runs out."
 *
 * This module holds the pure pieces: which Hero is trapped and the setup conversion (the WP-514
 * Skrull precedent), the setup-time Size-Changing entries read by resolveFightPrice (D-24802), and
 * the defeat route with its "choose a player to gain it" seat choice (the WP-821 Dominate the Weak
 * shape). The Twist is the shipped chained-reveals resolver and the Evil Wins is the scheme config
 * (schemeTwistConfigs.ts); the Attack branch lives in economy.resolve.ts.
 *
 * No boardgame.io import. No registry import (the registry is read structurally at setup). No
 * .reduce(). Never throws.
 */

import type {
  ConvertedVillainOrigin,
  FightSizeChanging,
  LegendaryGameState,
  PendingSeatChoice,
  SeatChoiceOption,
} from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardTraitEntry } from '../state/cardTraits.types.js';
import type { RevealedCardType, VillainDeckState } from '../villainDeck/villainDeck.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import { buildHeroDeckCards } from '../setup/buildHeroDeck.js';
import { pushLog } from '../log/logPush.js';
import { resolveCardName } from '../log/logDisplay.js';
// why: seatChoice.resolve.ts imports this module's apply for its kind arm, and this module
// imports parkSeatChoice from it. The cycle is runtime-safe: each side reads the other's binding
// only inside a function body, never at module top level (the outOfTimeGrant.logic precedent).
import { parkSeatChoice } from '../moves/seatChoice.resolve.js';

/** The Trap Heroes in the Microverse scheme ext_id. */
export const TRAP_HEROES_IN_THE_MICROVERSE_SCHEME_ID = 'antm/trap-heroes-in-the-microverse';

/** The seat-choice kind for choosing which player gains a defeated Micro-Sized Villain. */
export const MICRO_SIZED_GAIN_SEAT_CHOICE_KIND = 'micro-sized-gain';

/** The converted-villain origin a trapped Hero card carries while it is a Villain. */
const MICRO_SIZED_ORIGIN: ConvertedVillainOrigin = 'micro-sized';

/** The source name every Micro-Sized gain log line ends with. */
const SCHEME_LOG_SOURCE = 'Trap Heroes in the Microverse';

/** The registry surface read at setup (structural; the real CardRegistry satisfies it). */
interface TrappedHeroRegistryReader {
  getSet(abbr: string): unknown | undefined;
}

/** Which Hero the scheme traps, and the Heroes left for the Hero Deck. */
export interface TrappedHeroSplit {
  /** The hero deck ids that build the Hero Deck (the trapped Hero removed). */
  heroDeckIds: string[];
  /** The trapped Hero's deck id, absent when the scheme traps nothing. */
  trappedHeroDeckId?: string;
}

/** Result of adding the trapped Hero's cards to the Villain Deck (the WP-514 result shape). */
export interface MicroSizedConversionResult {
  /** The Villain Deck with the trapped cards added and re-shuffled. */
  villainDeckState: VillainDeckState;
  /** The Villain Deck card-type map with each trapped card typed `'villain'`. */
  villainDeckCardTypes: Record<CardExtId, RevealedCardType>;
  /** The converted-villain overlay with each trapped card tagged `'micro-sized'`. */
  convertedOrigins: Record<CardExtId, ConvertedVillainOrigin>;
}

/**
 * Runtime guard for the structural setup registry read.
 *
 * @param registry - The setup registry, typed unknown to accept narrow mocks.
 * @returns true when the registry exposes a callable getSet.
 */
function isTrappedHeroRegistryReader(registry: unknown): registry is TrappedHeroRegistryReader {
  if (!registry || typeof registry !== 'object') {
    return false;
  }
  return typeof (registry as Record<string, unknown>).getSet === 'function';
}

/**
 * Picks the trapped Hero for this scheme: the LAST listed Hero.
 *
 * // why: D-24805 — "Add all 14 cards for an extra Hero" makes the players pick one more Hero.
 * heroDeckIds is the only Hero input (MatchSetupConfig is locked), so the requirement rises by
 * one (playerCountSetup.ts, amending D-24672's main-Hero-Deck-only note) and the last-listed Hero
 * is the trapped one. The operator's order decides it; no random draw does. Every other scheme,
 * a list shorter than two, or a registry with no callable getSet passes the list through.
 *
 * @param schemeId - The active scheme ext_id.
 * @param heroDeckIds - The effective hero deck ids (not mutated).
 * @param registry - The setup registry (structural read).
 * @returns The Hero Deck ids and, for this scheme, the trapped Hero's id.
 */
export function splitTrappedHeroDeckId(
  schemeId: string,
  heroDeckIds: readonly string[],
  registry: unknown,
): TrappedHeroSplit {
  if (
    schemeId !== TRAP_HEROES_IN_THE_MICROVERSE_SCHEME_ID ||
    heroDeckIds.length < 2 ||
    !isTrappedHeroRegistryReader(registry)
  ) {
    return { heroDeckIds: [...heroDeckIds] };
  }
  return {
    heroDeckIds: heroDeckIds.slice(0, heroDeckIds.length - 1),
    trappedHeroDeckId: heroDeckIds[heroDeckIds.length - 1]!,
  };
}

/**
 * Lists the trapped Hero's card instance ids, one per physical card.
 *
 * @param trappedHeroDeckId - The trapped Hero's deck id, or undefined.
 * @param registry - The setup registry (structural read).
 * @returns The unshuffled instance ids (transform second forms and split alternates excluded).
 */
export function listTrappedHeroCards(
  trappedHeroDeckId: string | undefined,
  registry: unknown,
): CardExtId[] {
  if (trappedHeroDeckId === undefined || !isTrappedHeroRegistryReader(registry)) {
    return [];
  }
  return buildHeroDeckCards([trappedHeroDeckId], registry);
}

/**
 * Reads the trapped Hero's display name from the setup registry.
 *
 * @param registry - The setup registry (structural read of `getSet(abbr).heroes[].name`).
 * @param heroDeckId - The `<setAbbr>/<heroSlug>` id.
 * @returns The Hero's printed name, or the hero deck id when it cannot be read.
 */
export function readTrappedHeroName(registry: unknown, heroDeckId: string): string {
  const separatorIndex = heroDeckId.indexOf('/');
  if (separatorIndex <= 0 || !isTrappedHeroRegistryReader(registry)) {
    return heroDeckId;
  }
  const setData = registry.getSet(heroDeckId.slice(0, separatorIndex));
  const heroes = (setData as { heroes?: unknown } | undefined)?.heroes;
  if (!Array.isArray(heroes)) {
    return heroDeckId;
  }
  const heroSlug = heroDeckId.slice(separatorIndex + 1);
  for (const hero of heroes) {
    const heroEntry = hero as { slug?: unknown; name?: unknown } | null;
    if (heroEntry?.slug === heroSlug && typeof heroEntry.name === 'string' && heroEntry.name.length > 0) {
      return heroEntry.name;
    }
  }
  return heroDeckId;
}

/**
 * The setup message naming the trapped Hero.
 *
 * @param heroName - The trapped Hero's display name.
 * @param cardCount - How many of its cards went into the Villain Deck.
 * @returns The full-sentence setup log line.
 */
export function describeTrappedHero(heroName: string, cardCount: number): string {
  return `Trap Heroes in the Microverse: ${heroName}'s ${cardCount} cards are shuffled into the Villain Deck as Micro-Sized Villains.`;
}

/**
 * Adds the trapped Hero's cards to the Villain Deck as Micro-Sized Villains.
 *
 * Each card is typed `'villain'` (so it reveals, fights and escapes through the existing villain
 * path) and tagged `'micro-sized'` in the converted-villain overlay; the deck is then re-shuffled
 * once. Inputs are never mutated. No cards → the inputs pass through and no random draw is made.
 *
 * // why: WP-514 placement — the caller runs this after the Skrull conversion, so this re-shuffle
 * is the last random draw in setup and every earlier draw is unchanged. Every other scheme passes
 * an empty list, which draws nothing and keeps its state hash byte-identical.
 *
 * @param trappedCardIds - The trapped Hero's card instance ids.
 * @param villainDeckState - The built Villain Deck state.
 * @param villainDeckCardTypes - The Villain Deck card-type map.
 * @param convertedOrigins - The converted-villain overlay so far.
 * @param context - Setup context with `random.Shuffle`.
 * @returns The (possibly converted) Villain Deck, card types and overlay.
 */
export function addMicroSizedHeroesToVillainDeck(
  trappedCardIds: readonly CardExtId[],
  villainDeckState: VillainDeckState,
  villainDeckCardTypes: Record<CardExtId, RevealedCardType>,
  convertedOrigins: Record<CardExtId, ConvertedVillainOrigin>,
  context: ShuffleProvider,
): MicroSizedConversionResult {
  if (trappedCardIds.length === 0) {
    return { villainDeckState, villainDeckCardTypes, convertedOrigins };
  }
  const newCardTypes: Record<CardExtId, RevealedCardType> = { ...villainDeckCardTypes };
  const newOrigins: Record<CardExtId, ConvertedVillainOrigin> = { ...convertedOrigins };
  for (const cardId of trappedCardIds) {
    newCardTypes[cardId] = 'villain';
    newOrigins[cardId] = MICRO_SIZED_ORIGIN;
  }
  const injectedDeck = [...villainDeckState.deck, ...trappedCardIds];
  // why: the scheme's one seeded shuffle mixes the trapped cards into the deck.
  const reshuffledDeck = context.random.Shuffle(injectedDeck);
  return {
    villainDeckState: { ...villainDeckState, deck: reshuffledDeck },
    villainDeckCardTypes: newCardTypes,
    convertedOrigins: newOrigins,
  };
}

/**
 * Builds each trapped card's "Size-Changing for its card color" fight discount.
 *
 * // why: D-24805 — the color Size-Changing is a fixed fact of each trapped card, so it is a
 * setup-time G.fightSizeChanging entry read by resolveFightPrice (D-24802), not a runtime grant.
 * A dual-class card has Size-Changing for BOTH colors: the engine reads a printed two-class
 * Size-Changing line as one 2-less step per class (D-24802), and "its card color" on a two-color
 * card names both (flagged for the operator in D-24805). A card with no class gets no entry.
 *
 * @param trappedCardIds - The trapped Hero's card instance ids.
 * @param cardTraits - The setup-built card traits (keyed by the same instance ids).
 * @returns The fight discounts keyed by card instance id (empty when nothing is trapped).
 */
export function buildMicroSizedFightSizeChanging(
  trappedCardIds: readonly CardExtId[],
  cardTraits: Record<CardExtId, CardTraitEntry>,
): Record<CardExtId, FightSizeChanging> {
  const result: Record<CardExtId, FightSizeChanging> = {};
  for (const cardId of trappedCardIds) {
    const traits = cardTraits[cardId];
    const classes: string[] = [];
    for (const heroClass of [traits?.heroClass, traits?.heroClass2]) {
      if (typeof heroClass === 'string' && heroClass.length > 0 && !classes.includes(heroClass)) {
        classes.push(heroClass);
      }
    }
    if (classes.length > 0) {
      result[cardId] = { classes, microscopicIcons: [] };
    }
  }
  return result;
}

/**
 * Whether a card is a Micro-Sized Villain right now.
 *
 * @param G - The game state (read-only).
 * @param cardId - The card instance id.
 * @returns true while the card carries the `'micro-sized'` origin.
 */
export function isMicroSizedVillain(G: LegendaryGameState, cardId: CardExtId): boolean {
  return G.convertedVillainOrigins?.[cardId] === MICRO_SIZED_ORIGIN;
}

/**
 * Gains a defeated Micro-Sized Villain as a Hero: "When you fight one, choose any player to gain it
 * as a Hero."
 *
 * The card's origin is cleared and it goes to the defeater's discard pile (never a Victory Pile).
 * With one seat that is the whole gain. With two or more, the defeater then chooses the player
 * through a seat choice; the card already sits in a zone, so a dropped or timed-out choice leaves
 * it with the defeater (the default).
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The defeating (active) player.
 * @param cardId - The defeated card, already removed from the City.
 * @returns true when the defeater gained it outright (the fight narrative's gain clause).
 */
export function gainDefeatedMicroSizedHero(
  G: LegendaryGameState,
  currentPlayer: string,
  cardId: CardExtId,
): boolean {
  if (G.convertedVillainOrigins !== undefined) {
    delete G.convertedVillainOrigins[cardId];
  }
  G.playerZones[currentPlayer]?.discard.push(cardId);
  const heroName = resolveCardName(G.cardDisplayData, cardId);
  const seats = Object.keys(G.playerZones);
  if (seats.length < 2) {
    pushLog(G,
      `Player ${currentPlayer} defeated ${heroName} (Micro-Sized) and gained it as a Hero into their discard pile.`,
      'applied',
      cardId,
    );
    return true;
  }
  // why: WP-860 posture — at most one seat choice is open at a time, so an open one blocks only the
  // park; the card stays with the defeater. parkSeatChoice overwrites, so a later park in the same
  // move would drop this choice the same way (accepted, D-24805).
  if (G.pendingSeatChoice !== undefined) {
    pushLog(G,
      `Player ${currentPlayer} gained ${heroName} — another choice is open, so no other player could be chosen (${SCHEME_LOG_SOURCE}).`,
      'blocked',
      cardId,
    );
    return false;
  }
  parkSeatChoice(G, undefined, buildMicroSizedGainChoice(G, currentPlayer, cardId), currentPlayer);
  pushLog(G,
    `Player ${currentPlayer} chooses a player to gain ${heroName} (${SCHEME_LOG_SOURCE}).`,
    'neutral',
    cardId,
  );
  return false;
}

/**
 * Builds the defeater's "Player N gains <Hero>" choice.
 *
 * @param G - The game state (read for seats and the display name).
 * @param currentPlayer - The defeater, the only addressed seat and the first option.
 * @param cardId - The defeated card.
 * @returns The pending seat choice (default 0: the defeater gains it).
 */
function buildMicroSizedGainChoice(
  G: LegendaryGameState,
  currentPlayer: string,
  cardId: CardExtId,
): PendingSeatChoice {
  const otherSeats = Object.keys(G.playerZones)
    .filter((seat) => seat !== currentPlayer)
    .sort();
  const heroName = resolveCardName(G.cardDisplayData, cardId);
  const options: SeatChoiceOption[] = [];
  // why: the defeater first, so defaultOptionIndex 0 (the bot, the sim and a timeout) keeps the
  // card where it already is — the Dominate the Weak ordering.
  for (const seat of [currentPlayer, ...otherSeats]) {
    options.push({ label: `Player ${seat} gains ${heroName}`, cardId, recipientSeat: seat });
  }
  return {
    kind: MICRO_SIZED_GAIN_SEAT_CHOICE_KIND,
    addressedSeats: [currentPlayer],
    seatPrompts: { [currentPlayer]: { options } },
    submissions: {},
    defaultOptionIndex: 0,
  };
}

/**
 * Applies a resolved "Player N gains <Hero>" choice: moves the card from the defeater's discard to
 * the chosen player's discard.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted pending choice (kind 'micro-sized-gain').
 */
export function applyMicroSizedGainResolvedSeatChoice(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
): void {
  const holderSeat = choice.addressedSeats[0];
  if (holderSeat === undefined) {
    return;
  }
  const submission = choice.submissions[holderSeat];
  const optionIndex = submission?.optionIndex ?? choice.defaultOptionIndex;
  const option = choice.seatPrompts[holderSeat]?.options[optionIndex];
  const cardId = option?.cardId;
  const recipientSeat = option?.recipientSeat;
  if (cardId === undefined || recipientSeat === undefined) {
    return;
  }
  const heroName = resolveCardName(G.cardDisplayData, cardId);
  const holderDiscard = G.playerZones[holderSeat]?.discard;
  const cardIndex = holderDiscard === undefined ? -1 : holderDiscard.indexOf(cardId);
  // why: other resolve moves can still change a discard pile while the pick is open (a reshuffle
  // draw), so the apply re-checks that the card is still where the defeat put it.
  if (holderDiscard === undefined || cardIndex === -1) {
    pushLog(G,
      `${heroName} is no longer in Player ${holderSeat}'s discard pile, so no one else gains it (${SCHEME_LOG_SOURCE}).`,
      'blocked',
      cardId,
    );
    return;
  }
  const recipientZones = G.playerZones[recipientSeat];
  if (recipientSeat !== holderSeat && recipientZones !== undefined) {
    holderDiscard.splice(cardIndex, 1);
    recipientZones.discard.push(cardId);
  }
  pushLog(G, `Player ${recipientSeat} gains ${heroName} (${SCHEME_LOG_SOURCE}).`, 'applied', cardId);
}
