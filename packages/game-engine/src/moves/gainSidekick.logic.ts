/**
 * Gaining a Sidekick from the Sidekick Stack as a card effect (WP-844 / D-24778).
 *
 * Hero lines that print "Gain a [rule:Sidekick]" (cvwr Captain America, Secret Avenger's
 * Inspire a Nation, ssw1 Black Panther's King of Wakanda, ...) take the top token of
 * `G.piles.sidekicks` into the playing player's discard pile. The `gain-sidekick` hero
 * handler calls `gainSidekickToDiscard` once per Sidekick the line prints.
 *
 * A card-effect FREE gain, like `gainOfficerToDiscard` (D-24696): no Recruit is spent and
 * the once-per-turn Sidekick recruit flag (`hasRecruitedSidekickThisTurn`, D-24776) is never
 * read or written — rules v23 L3216-3218: "When card effects tell you to 'gain Sidekicks,'
 * that doesn't count against that one-per-turn limit."
 *
 * // why: D-24778 — this helper lives in its own module, not in recruitSidekick.ts, because
 * recruitSidekick.ts imports ~30 pending-choice guard modules and seven of them import
 * heroEffects.execute.ts back. Keeping the helper here (type imports only) keeps the effect
 * executor off that guard graph and adds no import cycle.
 *
 * Plain G-mutating helper: no boardgame.io import, no registry, no randomness, never throws.
 */

import type { LegendaryGameState } from '../types.js';

/**
 * Gains one Sidekick from the Sidekick Stack into a player's DISCARD pile (WP-844 / D-24778).
 *
 * Follows the rulebook default: rules v23 L1170 — "Gain" means "put it into your discard
 * pile." Same pile mutation as `gainOfficerToDiscard`, on `G.piles.sidekicks`.
 *
 * // why: D-24778 — an empty Sidekick Stack (a match created with `sidekicksCount: 0`, or a
 * Stack drained this game) or a missing player zone (a narrow mock) is a no-op that returns
 * false, so the caller can log the shortfall — moves never throw.
 *
 * @param G - Game state (mutated in place under Immer draft).
 * @param playerID - The player who gains the Sidekick.
 * @returns true when a Sidekick was moved to discard; false when the Stack was empty or the
 *   player's zones were missing.
 */
export function gainSidekickToDiscard(G: LegendaryGameState, playerID: string): boolean {
  const sidekickId = G.piles.sidekicks[0];
  if (sidekickId === null || sidekickId === undefined) {
    return false;
  }
  const zones = G.playerZones[playerID];
  if (!zones) {
    return false;
  }
  // why: pile[0] is the top card (the locked supply-pile convention); slice(1) drops it.
  G.piles.sidekicks = G.piles.sidekicks.slice(1);
  zones.discard = [...zones.discard, sidekickId];
  return true;
}
