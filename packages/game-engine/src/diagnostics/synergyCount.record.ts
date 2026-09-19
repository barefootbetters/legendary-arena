/**
 * Conditional-clause synergy counter for the Legendary Arena game engine
 * (WP-708 / D-24531).
 *
 * `recordConditionalClause` is the single seam the hero effect executor calls at
 * the `evaluateAllConditions` chokepoint to tally, per player, how many
 * conditional Hero clauses were PLAYED and how many were ASSEMBLED (condition
 * met). It lazy-inits the runtime-only `G.diagnostics` channel (mirroring
 * `recordHollowEffect`) and increments a `{played, assembled}` pair keyed by
 * player id. The derived per-match Synergy Rate is display-only (never scored),
 * and the channel is hash-excluded (D-24034), so this writer re-pins NO hash.
 *
 * No boardgame.io imports. No registry imports. No I/O. No randomness. Never throws.
 */

import type { LegendaryGameState } from '../types.js';

// ---------------------------------------------------------------------------
// recordConditionalClause — the single write seam (WP-708)
// ---------------------------------------------------------------------------

/**
 * Records one conditional-clause observation into the runtime-only
 * `G.diagnostics.conditionalClauses` tally.
 *
 * Increments the acting player's `played` count always, and `assembled` only
 * when the clause's condition was met. Lazy-inits `G.diagnostics` and the
 * `conditionalClauses` map on first write (mirrors `recordHollowEffect` —
 * never in `Game.setup`). Bounded by player count (one entry per seat), so it
 * needs no cap. The channel is observation only: no move, rule, `endIf`, bot,
 * or scoring path may consume it as gameplay input, and it is excluded from both
 * hash oracles — the load-bearing rule that keeps this display-only and re-pin-free.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param playerID - The acting player's id.
 * @param outcome - Whether the clause's condition was met (assembled).
 */
export function recordConditionalClause(
  G: LegendaryGameState,
  playerID: string,
  outcome: { assembled: boolean },
): void {
  // why: WP-708 — lazy-init the runtime-only diagnostics channel on first write
  // (mirrors recordHollowEffect) — NEVER seeded in Game.setup; tolerates narrow
  // test mocks that predate the channel.
  if (!G.diagnostics) {
    G.diagnostics = { hollowEffects: [], hollowEffectsDropped: 0 };
  }
  // why: WP-708 / D-24531 — the per-player conditional-clause tally rides the same
  // hash-excluded G.diagnostics channel as hollowEffects/traces. Display-only, never
  // gameplay input; one entry per seat, so no bounded-cap needed (unlike the
  // per-dispatch traces channel).
  if (!G.diagnostics.conditionalClauses) {
    G.diagnostics.conditionalClauses = {};
  }
  const entry = G.diagnostics.conditionalClauses[playerID] ?? { played: 0, assembled: 0 };
  entry.played += 1;
  if (outcome.assembled) {
    entry.assembled += 1;
  }
  G.diagnostics.conditionalClauses[playerID] = entry;
}
