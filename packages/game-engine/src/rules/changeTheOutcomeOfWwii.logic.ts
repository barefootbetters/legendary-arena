/**
 * Change the Outcome of WWII (WP-832 / D-24765) — the Cap 75th scheme's invasions.
 *
 * "Twist: The Axis invades a new country. Put all Villains and Bystanders from the city on the
 * bottom of the Villain Deck. The number of city spaces changes. Play 2 cards from the Villain
 * Deck. If any Villains escape this country, stack a Twist next to the scheme as a 'conquered
 * capital.'" Twist 1 Poland 4 spaces, 2 France 3, 3 USSR 6, 4 England 3, 5 USA 5, 6 Australia 2,
 * 7 Switzerland 1. "Evil Wins: When 3 capitals are conquered."
 *
 * The rules v23 note: "Start in the normal city, not a country." So escapes before Twist 1 conquer
 * nothing. The City is resized through the WP-831 / D-24764 variable City: it is emptied first,
 * so no Villain is in a removed space. The tallies live in `G.counters` (lazily created keys), so
 * a match without this scheme serializes byte-identically.
 *
 * Pure helpers over G: no boardgame.io import, no I/O.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';
import type { ImplementationMap } from './ruleRuntime.execute.js';
import { playTopVillainDeckCards } from '../villainDeck/villainDeck.reveal.js';
import { initializeCity } from '../board/city.logic.js';
import { countEscapedPileByType, applySchemeCounterResourceLoss } from './schemeResourceLoss.js';
import { pushLog } from '../log/logPush.js';
import {
  WWII_CAPITALS_TO_WIN,
  WWII_CONQUERED_CAPITALS,
  WWII_COUNTRIES_INVADED,
  WWII_COUNTRY_CONQUERED,
  WWII_ESCAPES_AT_INVASION,
} from './changeTheOutcomeOfWwii.constants.js';

/** One country the Axis invades: its name and its number of City spaces. */
export interface WwiiCountry {
  name: string;
  citySpaces: number;
}

// why: the printed Twist table, in Twist order (Twist 1 is index 0).
/** The seven countries, in invasion order. */
export const WWII_COUNTRIES: readonly WwiiCountry[] = [
  { name: 'Poland', citySpaces: 4 },
  { name: 'France', citySpaces: 3 },
  { name: 'USSR', citySpaces: 6 },
  { name: 'England', citySpaces: 3 },
  { name: 'USA', citySpaces: 5 },
  { name: 'Australia', citySpaces: 2 },
  { name: 'Switzerland', citySpaces: 1 },
];

// why: "If any Villains escape" — Henchmen are Villains (rules v23 "Henchmen Are Villains").
/** The escaped-pile card types an invasion counts. */
const ESCAPING_VILLAIN_TYPES = ['villain', 'henchman'] as const;

/**
 * The Villains (Henchmen included) in the Escaped Villains pile.
 *
 * @param G - The game state (not mutated).
 * @returns Their count.
 */
function countEscapedVillains(G: LegendaryGameState): number {
  return countEscapedPileByType(G, ESCAPING_VILLAIN_TYPES);
}

/**
 * Puts every City Villain, then the Bystanders it holds, on the bottom of the Villain Deck, from
 * the Sewers toward the edge, and empties the City.
 *
 * // why: a returned Bystander came from the Bystander pile, so it may have no
 * villainDeckCardTypes entry; it is typed 'bystander' so its later reveal resolves (a reveal of
 * an untyped card fails). Captured Heroes are not "Villains and Bystanders" and stay with their
 * Villain (they travel with it, as they do when a Villain moves).
 *
 * @param G - The game state, mutated in place.
 * @returns How many cards went to the Villain Deck.
 */
function returnCityToVillainDeckBottom(G: LegendaryGameState): number {
  const returned: CardExtId[] = [];
  for (const villainId of G.city) {
    if (villainId === null || villainId === undefined) {
      continue;
    }
    returned.push(villainId);
    for (const bystanderId of G.attachedBystanders[villainId] ?? []) {
      returned.push(bystanderId);
      if (G.villainDeckCardTypes[bystanderId] === undefined) {
        G.villainDeckCardTypes[bystanderId] = 'bystander';
      }
    }
    delete G.attachedBystanders[villainId];
  }
  G.villainDeck.deck = [...G.villainDeck.deck, ...returned];
  return returned.length;
}

/**
 * Stacks a conquered capital when a Villain has escaped the current country since its invasion.
 *
 * // why: "If any Villains escape this country" — once per country, at the first escape; the
 * normal City before Twist 1 is not a country. Called at the end of resolveVillainEscape (every
 * escape, in every harness) and inside invadeNextCountry before the invasion and after its plays, so
 * an escape anywhere (a reveal, a fight effect, an Ambush) counts for the country it happened in.
 *
 * @param G - The game state, mutated in place.
 */
export function settleWwiiConquest(G: LegendaryGameState): void {
  const invaded = G.counters[WWII_COUNTRIES_INVADED] ?? 0;
  if (invaded === 0 || (G.counters[WWII_COUNTRY_CONQUERED] ?? 0) === 1) {
    return;
  }
  if (countEscapedVillains(G) <= (G.counters[WWII_ESCAPES_AT_INVASION] ?? 0)) {
    return;
  }
  G.counters[WWII_COUNTRY_CONQUERED] = 1;
  const capitals = (G.counters[WWII_CONQUERED_CAPITALS] ?? 0) + 1;
  G.counters[WWII_CONQUERED_CAPITALS] = capitals;
  const country = WWII_COUNTRIES[invaded - 1]!;
  pushLog(G, `[Change the Outcome of WWII] A Villain escaped ${country.name}: its capital is conquered (${capitals} of ${WWII_CAPITALS_TO_WIN}).`, 'threat');
  applySchemeCounterResourceLoss(G);
}

/**
 * One Twist: the Axis invades the next country — the City returns to the Villain Deck, resizes to
 * the country's spaces, and 2 cards are played.
 *
 * // why: the country is numbered from its own counter, raised BEFORE the 2 cards are played: a
 * Twist among them re-enters this resolver and must invade the NEXT country. (schemeTwistCount
 * also counts a Twist that changes nothing, such as a Mystique Escape after Switzerland.) The previous country is settled first, so an escape there counts
 * for it. A Twist after the seventh country (no eighth is printed) changes nothing.
 *
 * @param G - The game state, mutated in place.
 * @param context - The reveal context (the plays use it).
 * @param implementationMap - The rule handler map (the plays use it).
 */
export function invadeNextCountry(
  G: LegendaryGameState,
  context: RevealContext,
  implementationMap: ImplementationMap,
): void {
  const invaded = G.counters[WWII_COUNTRIES_INVADED] ?? 0;
  if (invaded >= WWII_COUNTRIES.length) {
    pushLog(G, '[Change the Outcome of WWII] The Axis has no country left to invade; nothing changes.', 'neutral');
    return;
  }
  settleWwiiConquest(G);
  const country = WWII_COUNTRIES[invaded]!;
  G.counters[WWII_COUNTRIES_INVADED] = invaded + 1;
  const returnedCount = returnCityToVillainDeckBottom(G);
  G.city = initializeCity(country.citySpaces);
  G.counters[WWII_ESCAPES_AT_INVASION] = countEscapedVillains(G);
  G.counters[WWII_COUNTRY_CONQUERED] = 0;
  pushLog(
    G,
    `[Change the Outcome of WWII] Twist ${invaded + 1}: the Axis invades ${country.name}. ${returnedCount} card${returnedCount === 1 ? '' : 's'} from the City go${returnedCount === 1 ? 'es' : ''} to the bottom of the Villain Deck; the City now has ${country.citySpaces} space${country.citySpaces === 1 ? '' : 's'}. 2 cards are played.`,
    'threat',
  );
  playTopVillainDeckCards(G, context, implementationMap, 2);
  settleWwiiConquest(G);
}
