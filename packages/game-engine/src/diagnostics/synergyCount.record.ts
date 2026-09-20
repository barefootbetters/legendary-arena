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
 * why: WP-709 / D-24532 — the same call also accrues the clause's attack/recruit
 * `clauseValue` (see `heroClauseValue`): `potentialValue` always (the value the
 * clause could offer at the current board), and `realizedValue` only when the
 * condition held. These feed the display-only per-match Realized Value %; same
 * hash-excluded, never-scored posture as `played`/`assembled`.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param playerID - The acting player's id.
 * @param outcome - Whether the clause's condition was met (`assembled`) and the
 *   clause's attack/recruit value (`clauseValue`).
 */
export function recordConditionalClause(
  G: LegendaryGameState,
  playerID: string,
  outcome: { assembled: boolean; clauseValue: number; countsTowardRate?: boolean },
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
  const entry = G.diagnostics.conditionalClauses[playerID] ?? {
    played: 0,
    assembled: 0,
    potentialValue: 0,
    realizedValue: 0,
  };
  // why: WP-712 / D-24535 — countsTowardRate (default true) gates the Synergy Rate
  // counters. A pure count-scaled clause (no boolean gate) carries synergy VALUE but no
  // assembly decision, so it accrues potentialValue/realizedValue with countsTowardRate
  // false — keeping played/assembled (WP-708 Synergy Rate) boolean-gated only.
  const countsTowardRate = outcome.countsTowardRate ?? true;
  if (countsTowardRate) {
    entry.played += 1;
  }
  // why: WP-709 — potentialValue accrues the value the clause could offer whether
  // or not the condition held; realizedValue accrues it only when assembled.
  entry.potentialValue += outcome.clauseValue;
  if (outcome.assembled) {
    if (countsTowardRate) {
      entry.assembled += 1;
    }
    entry.realizedValue += outcome.clauseValue;
  }
  G.diagnostics.conditionalClauses[playerID] = entry;
}
