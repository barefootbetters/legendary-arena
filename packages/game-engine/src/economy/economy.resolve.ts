/**
 * Fight cost resolution for the Legendary Arena game engine (WP-214).
 *
 * resolveFightCost is the single authoritative source for villain fight cost.
 * Static villains return their fightCost directly. Dynamic villains (vAttack
 * "*" or "N+") return fightCostBase plus the sum of captured hero recruit
 * costs. The UI must never recompute dynamic values — it consumes the
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

// why: WP-539 / D-24348 — the Portals scheme ext_id, gating the Dark-Portal buffs.
const PORTALS_SCHEME_ID = 'core/portals-to-the-dark-dimension';

/**
 * Resolves the fight cost for a villain at the current game state.
 *
 * For static villains (fightCostMode === 'static'), returns fightCost
 * unchanged. For dynamic villains (fightCostMode === 'dynamic'), returns
 * fightCostBase + sum(captured hero recruit costs).
 *
 * Tolerates: missing cardStats entry (returns 0), no attached heroes
 * (returns fightCostBase), missing cardStats for a captured hero (treats
 * as 0). Always returns a deterministic integer >= 0.
 *
 * @param G - Game state (read-only).
 * @param villainCardId - The villain zone-instance ext_id.
 * @returns The resolved fight cost as a non-negative integer.
 */
export function resolveFightCost(
  G: LegendaryGameState,
  villainCardId: CardExtId,
): number {
  // why: WP-539 / D-24348 — the Dark-Portal bonus stacks on top of every villain's
  // resolved cost (static, dynamic, or a converted Killbot/Skrull), so it is applied
  // here around the base resolution.
  return resolveBaseFightCost(G, villainCardId) + darkPortalVillainBonus(G, villainCardId);
}

/**
 * The Portals Dark-Portal attack bonus for a villain (WP-539 / D-24348).
 *
 * Under the Portals scheme, a Villain in a city space that has a Dark Portal
 * attacks for +1. City space index K is portal'd once DARK_PORTAL_COUNT >= 6 - K
 * (twists 2-6 fill the leftmost portal-less space first; leftmost = Bridge = index 4
 * per DESIGN-BOARD-LAYOUT.md §City row + WP-489/D-24295). A Villain not in the City
 * (index not found) and any non-Portals scheme get 0.
 *
 * @param G - Game state (read-only).
 * @param villainCardId - The villain zone-instance ext_id.
 * @returns 1 when the villain's city space has a Dark Portal, else 0.
 */
function darkPortalVillainBonus(
  G: LegendaryGameState,
  villainCardId: CardExtId,
): number {
  // why: defensive `?.` on selection / city / counters mirrors resolveFightCost's
  // partial-G tolerance (integration/unit fixtures may omit these); a missing field
  // means "not the Portals scheme / not in the city" → no bonus.
  if (G.selection?.schemeId !== PORTALS_SCHEME_ID) {
    return 0;
  }
  const cityIndex = G.city?.indexOf(villainCardId) ?? -1;
  if (cityIndex < 0) {
    return 0;
  }
  const portalCount = G.counters?.[DARK_PORTAL_COUNT] ?? 0;
  return portalCount >= 6 - cityIndex ? 1 : 0;
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
  // why: defensive `?.` on selection / counters mirrors the partial-G tolerance of
  // this module; a missing field means "not the Portals scheme" → no bonus.
  const portalBonus =
    G.selection?.schemeId === PORTALS_SCHEME_ID &&
    (G.counters?.[DARK_PORTAL_COUNT] ?? 0) >= 1
      ? 1
      : 0;
  return baseFightCost + portalBonus;
}
