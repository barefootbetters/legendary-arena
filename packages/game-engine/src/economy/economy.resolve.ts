/**
 * Fight cost resolution for the Legendary Arena game engine (WP-214).
 *
 * resolveFightCost is the single authoritative source for villain fight cost.
 * Static villains return their fightCost directly. Dynamic villains (vAttack
 * "*" or "N+") return fightCostBase plus the sum of captured hero recruit
 * costs. Scheme bonuses stack on top: the Portals Dark-Portal space bonus
 * (WP-539) and the Midtown Bank Robbery family's +1 per attached Bystander
 * (WP-748). A Blood Frenzy villain adds the fighting player's distinct Victory
 * Point value count (WP-760). The UI must never recompute dynamic values — it consumes the
 * engine-resolved projection from UIState.
 *
 * No boardgame.io import. No ctx dependency. No randomness. No .reduce().
 * Always returns a deterministic integer >= 0.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { LegendaryGameState } from '../types.js';
// why: WP-513 / D-24325 — value import for the Killbots per-scheme twist counter key.
// why: WP-539 / D-24348 — DARK_PORTAL_COUNT drives the Portals Dark-Portal buffs.
import { KILLBOT_TWISTS_NEXT_TO_SCHEME, DARK_PORTAL_COUNT } from '../types.js';
// why: WP-728 / D-24549 — the fixed City space count bounds the Dark-Portal
// location scan; CITY_SPACE_NAMES is the single source of the 5-space board.
import { CITY_SPACE_NAMES } from '../board/citySpaceNames.js';
// why: WP-760 / D-24589 — villain Blood Frenzy reuses WP-765's shared distinct-VP
// helper (D-24598), so villain and hero Blood Frenzy can never count differently.
import { countDistinctVictoryPointValues } from './bloodFrenzy.logic.js';

// why: WP-539 / D-24348 — the Portals scheme ext_id, gating the Dark-Portal buffs.
const PORTALS_SCHEME_ID = 'core/portals-to-the-dark-dimension';

// why: WP-728 / D-24549 — the +N attack a single Dark Portal grants (the
// Mastermind, or Villains in a portal'd city space). A named constant so the
// combat buffs (below) and the UIState projection (darkPortalLocations
// consumers) share ONE value and can never disagree.
export const DARK_PORTAL_ATTACK_BONUS = 1;

// why: WP-748 / D-24572 — the schemes whose Special Rules print "Each Villain gets
// +1 attack for each Bystander it has": core Midtown Bank Robbery, the co2e Bank
// Robbery Hostage Crisis reprint, and msp1 Destroy the Cities of Earth. A card-data
// scan of every set finds exactly these three. Consumed only by
// bystanderVillainAttackBonus.
const VILLAIN_ATTACK_PER_BYSTANDER_SCHEME_IDS: ReadonlySet<string> = new Set([
  'core/midtown-bank-robbery',
  'co2e/bank-robbery-hostage-crisis',
  'msp1/destroy-the-cities-of-earth',
]);

/**
 * Resolves the fight cost for a villain at the current game state.
 *
 * For static villains (fightCostMode === 'static'), returns fightCost
 * unchanged. For dynamic villains (fightCostMode === 'dynamic'), returns
 * fightCostBase + sum(captured hero recruit costs). Scheme bonuses are then
 * added: the Portals Dark-Portal space bonus (darkPortalVillainBonus) and the
 * Midtown Bank Robbery family's per-Bystander bonus (bystanderVillainAttackBonus).
 * A Blood Frenzy villain then adds the fighting player's distinct Victory Point
 * value count (villainBloodFrenzyBonus).
 *
 * Tolerates: missing cardStats entry (returns 0), no attached heroes
 * (returns fightCostBase), missing cardStats for a captured hero (treats
 * as 0). Always returns a deterministic integer >= 0.
 *
 * @param G - Game state (read-only).
 * @param villainCardId - The villain zone-instance ext_id.
 * @param fightingPlayerId - The player who would fight (the active player). When
 *   omitted, the Blood Frenzy term is 0.
 * @returns The resolved fight cost as a non-negative integer.
 */
export function resolveFightCost(
  G: LegendaryGameState,
  villainCardId: CardExtId,
  fightingPlayerId?: string,
): number {
  // why: scheme bonuses stack on top of every villain's resolved cost (static,
  // dynamic, or a converted Killbot/Skrull), so they are applied here around the
  // base resolution: the Portals Dark-Portal bonus (WP-539 / D-24348) and the
  // Midtown Bank Robbery family's +1 per Bystander (WP-748 / D-24572). This is the
  // single site, so the fight move, the bot's legal moves and the City fightCost
  // projection can never disagree. Blood Frenzy (WP-760 / D-24589) is a villain
  // keyword, not a scheme bonus, but it lives here for the same reason.
  return (
    resolveBaseFightCost(G, villainCardId) +
    darkPortalVillainBonus(G, villainCardId) +
    bystanderVillainAttackBonus(G, villainCardId) +
    villainBloodFrenzyBonus(G, villainCardId, fightingPlayerId)
  );
}

/**
 * The Blood Frenzy attack bonus for a villain (WP-760 / D-24589).
 *
 * A villain flagged in G.villainBloodFrenzy gets +1 attack for each different
 * Victory Point value among the cards in the fighting player's Victory Pile.
 * Unflagged villains, and any call without a fighting player, get 0.
 *
 * @param G - Game state (read-only).
 * @param villainCardId - The villain zone-instance ext_id.
 * @param fightingPlayerId - The player who would fight, if known.
 * @returns The distinct VP value count, or 0.
 */
function villainBloodFrenzyBonus(
  G: LegendaryGameState,
  villainCardId: CardExtId,
  fightingPlayerId: string | undefined,
): number {
  // why: Blood Frenzy reads the FIGHTER's Victory Pile, so the term needs a player.
  // The parameter is optional so every pre-WP-760 caller and test stays
  // byte-identical; the three production callers pass the active player — the only
  // player who can fight — so the City projection shows that player's cost to every
  // audience.
  if (fightingPlayerId === undefined) {
    return 0;
  }
  if (G.villainBloodFrenzy?.[villainCardId] !== true) {
    return 0;
  }
  return countDistinctVictoryPointValues(G, fightingPlayerId);
}

/**
 * The Portals Dark-Portal locations for the current game state (WP-728 / D-24549).
 *
 * The single source of the portal→location mapping: the Dark Portal above the
 * Mastermind opens on twist 1 (DARK_PORTAL_COUNT >= 1), and city space index K is
 * portal'd once DARK_PORTAL_COUNT >= 6 - K (twists 2-6 fill the leftmost
 * portal-less space first; leftmost = Bridge = index 4 per WP-489/D-24295). Both
 * the combat buffs (darkPortalVillainBonus / resolveMastermindFightCost) and the
 * UIState projection (uiState.build) read this helper, so combat and the UI can
 * never disagree on where the portals are. A non-Portals scheme (or a missing
 * selection/counter) yields no portals.
 *
 * @param G - Game state (read-only).
 * @returns onMastermind + the ascending list of portal'd city space indices.
 */
export function darkPortalLocations(
  G: LegendaryGameState,
): { onMastermind: boolean; citySpaceIndices: number[] } {
  // why: defensive `?.` mirrors this module's partial-G tolerance (integration /
  // unit fixtures may omit selection/counters); a missing field means "not the
  // Portals scheme" → no portals.
  if (G.selection?.schemeId !== PORTALS_SCHEME_ID) {
    return { onMastermind: false, citySpaceIndices: [] };
  }
  const portalCount = G.counters?.[DARK_PORTAL_COUNT] ?? 0;
  const citySpaceIndices: number[] = [];
  // why: the `6 - K` fill predicate is the SAME one this helper's callers used
  // inline before; an explicit index loop over the fixed 5 City spaces (no
  // .reduce()), collecting portal'd indices ascending.
  for (let cityIndex = 0; cityIndex < CITY_SPACE_NAMES.length; cityIndex++) {
    if (portalCount >= 6 - cityIndex) {
      citySpaceIndices.push(cityIndex);
    }
  }
  return { onMastermind: portalCount >= 1, citySpaceIndices };
}

/**
 * The Portals Dark-Portal attack bonus for a villain (WP-539 / D-24348).
 *
 * Under the Portals scheme, a Villain in a city space that has a Dark Portal
 * attacks for DARK_PORTAL_ATTACK_BONUS more. A Villain not in the City (index not
 * found) and any non-Portals scheme get 0.
 *
 * @param G - Game state (read-only).
 * @param villainCardId - The villain zone-instance ext_id.
 * @returns DARK_PORTAL_ATTACK_BONUS when the villain's city space has a Dark
 *   Portal, else 0.
 */
function darkPortalVillainBonus(
  G: LegendaryGameState,
  villainCardId: CardExtId,
): number {
  // why: the villain's own city index gates the buff; darkPortalLocations is the
  // single source for WHICH spaces are portal'd (it also gates the Portals scheme
  // + partial-G tolerance, so a non-Portals scheme returns no portal'd indices).
  const cityIndex = G.city?.indexOf(villainCardId) ?? -1;
  if (cityIndex < 0) {
    return 0;
  }
  return darkPortalLocations(G).citySpaceIndices.includes(cityIndex)
    ? DARK_PORTAL_ATTACK_BONUS
    : 0;
}

/**
 * The Midtown Bank Robbery family's attack bonus for a villain (WP-748 / D-24572).
 *
 * Under a scheme in VILLAIN_ATTACK_PER_BYSTANDER_SCHEME_IDS, a Villain (henchmen
 * included) gets +1 attack for each Bystander it holds in G.attachedBystanders.
 * Any other scheme gets 0. The Mastermind is not a Villain and never reads this.
 *
 * @param G - Game state (read-only).
 * @param villainCardId - The villain zone-instance ext_id.
 * @returns The number of Bystanders the villain holds under a family scheme, else 0.
 */
function bystanderVillainAttackBonus(
  G: LegendaryGameState,
  villainCardId: CardExtId,
): number {
  // why: defensive `?.` mirrors this module's partial-G tolerance — the Portals and
  // Mastermind fixtures build G under Midtown with no selection or no
  // attachedBystanders map, and a missing map means "holds no Bystanders".
  const schemeId = G.selection?.schemeId;
  if (schemeId === undefined || !VILLAIN_ATTACK_PER_BYSTANDER_SCHEME_IDS.has(schemeId)) {
    return 0;
  }
  return G.attachedBystanders?.[villainCardId]?.length ?? 0;
}

/**
 * Resolves the base fight cost for a villain (WP-214), before any scheme-driven
 * bonus. See resolveFightCost for the Portals Dark-Portal wrapper.
 *
 * @param G - Game state (read-only).
 * @param villainCardId - The villain zone-instance ext_id.
 * @returns The resolved base fight cost as a non-negative integer.
 */
function resolveBaseFightCost(
  G: LegendaryGameState,
  villainCardId: CardExtId,
): number {
  // why: WP-513 / D-24325 — a converted Killbot's attack is dynamic: it equals the
  // per-scheme "twists next to this Scheme" counter (seeded 3, +1 per Killbots
  // twist). Checked OVERLAY-FIRST, before the cardStats guard, because converted
  // villain-deck Bystanders carry no cardStats row (that guard would return 0).
  // Reads G.counters — a deliberate input-widening; the UI still consumes only the
  // engine-resolved value and never recomputes.
  if (G.convertedVillainOrigins?.[villainCardId] === 'killbot') {
    return G.counters[KILLBOT_TWISTS_NEXT_TO_SCHEME] ?? 0;
  }

  // why: WP-514 / D-24327 — a converted Skrull (a Hero shuffled into the Villain Deck
  // by Secret Invasion) attacks for the Hero's cost + 2. Checked OVERLAY-FIRST, beside
  // the Killbot branch. PROXY: the printed attack is the Hero's VP + 2, but hero VP
  // exists nowhere in the data (generated or upstream — buildCardVictoryPoints emits
  // villains/henchmen/masterminds only), so we approximate with the Hero's cost (present
  // in G.cardStats). Swap seam: change `G.cardStats[...]?.cost` to
  // `G.cardVictoryPoints?.[villainCardId]` if hero VP is ever authored. cost typically
  // runs slightly higher than VP, so Skrulls skew a touch harder than printed.
  if (G.convertedVillainOrigins?.[villainCardId] === 'skrull') {
    return (G.cardStats[villainCardId]?.cost ?? 0) + 2;
  }

  const villainStats = G.cardStats[villainCardId];
  if (villainStats === undefined) {
    return 0;
  }

  // why: treat missing fightCostMode as 'static' for backward-compat with
  // pre-WP-214 G fixtures in integration tests that use partial cardStats
  if (!villainStats.fightCostMode || villainStats.fightCostMode === 'static') {
    return villainStats.fightCost;
  }

  // Dynamic mode: base + sum of captured hero recruit costs
  const base = villainStats.fightCostBase;

  // why: reads CardStatEntry.cost (hero recruit cost), NOT fightCost
  // (which is the villain's own fight requirement, always 0 for heroes).
  // G.villainAttachedHeroes[v] is undefined (not []) when no heroes are
  // attached — the ?? [] guard is required to avoid iterating undefined.
  // The top-level G.villainAttachedHeroes guard handles pre-WP-214 G fixtures.
  const capturedHeroes = G.villainAttachedHeroes?.[villainCardId] ?? [];
  let heroSum = 0;
  for (const heroId of capturedHeroes) {
    heroSum += G.cardStats[heroId]?.cost ?? 0;
  }

  return base + heroSum;
}

/**
 * Resolves the Mastermind's fight requirement (WP-539 / D-24348).
 *
 * The base requirement is the mastermind base card's fightCost (WP-018 / D-1805).
 * Under the Portals scheme, the Dark Portal placed above the Mastermind on twist 1
 * adds +1 (once DARK_PORTAL_COUNT >= 1). This centralizes what fightMastermind,
 * uiState.build, and ai.legalMoves previously read inline, so combat, the UI, and
 * the bot never disagree on affordability.
 *
 * @param G - Game state (read-only).
 * @returns The mastermind fight requirement as a non-negative integer.
 */
export function resolveMastermindFightCost(G: LegendaryGameState): number {
  const baseFightCost = G.cardStats[G.mastermind.baseCardId]?.fightCost ?? 0;
  // why: the twist-1 Dark Portal above the Mastermind adds DARK_PORTAL_ATTACK_BONUS;
  // darkPortalLocations is the single source (scheme gate + counter read), so this
  // combat read and the UIState projection can never disagree.
  const portalBonus = darkPortalLocations(G).onMastermind ? DARK_PORTAL_ATTACK_BONUS : 0;
  return baseFightCost + portalBonus;
}
