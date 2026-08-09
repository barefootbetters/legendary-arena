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
import { KILLBOT_TWISTS_NEXT_TO_SCHEME } from '../types.js';

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
  // why: WP-513 / D-24325 — a converted Killbot's attack is dynamic: it equals the
  // per-scheme "twists next to this Scheme" counter (seeded 3, +1 per Killbots
  // twist). Checked OVERLAY-FIRST, before the cardStats guard, because converted
  // villain-deck Bystanders carry no cardStats row (that guard would return 0).
  // Reads G.counters — a deliberate input-widening; the UI still consumes only the
  // engine-resolved value and never recomputes.
  if (G.convertedVillainOrigins?.[villainCardId] === 'killbot') {
    return G.counters[KILLBOT_TWISTS_NEXT_TO_SCHEME] ?? 0;
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
