/**
 * Shared play-phase onBegin parity for the observation-only harnesses.
 *
 * The boardgame.io play-phase `onBegin` hook (game.ts) runs at the start of
 * every player turn. It resets the two once-per-turn allowance flags
 * (`villainRevealedThisTurn`, `hasDrawnThisTurn`), drops every wait-and-see
 * deferred conditional grant (`deferredConditionalGrants`, WP-568 / D-24377)
 * and clears the WP-656 defeat edge flag
 * (`villainOrMastermindDefeatedSinceResolve`, D-24467) and the WP-743 per-turn
 * Master Strike / Ambush Villain flags (`masterStrikePlayedThisTurn`,
 * `ambushVillainPlayedThisTurn`, D-24566). None of the engine's
 * three non-framework per-turn loops run that hook, so each mirrors it manually
 * through this helper:
 *
 *   - the simulation runner (`simulation.runner.ts`),
 *   - the PAR aggregator (`par.aggregator.ts`),
 *   - the replay fixture harness (`runFixture.ts`).
 *
 * why (WP-701 / D-24520): onBegin no longer draws — the new hand is drawn at the
 * END of the previous turn (`applyEndOfTurnCleanup`, reached by these harnesses
 * through the same `endTurn` move / `advanceTurnStage` cleanup they dispatch), and
 * initial hands are dealt at setup. So this mirror is now RESETS ONLY; it needs no
 * ShuffleProvider. The incoming seat already holds its hand.
 *
 * why (WP-744 / D-24567): the per-move half of the deferred-grant lifecycle
 * (`resolveDeferredHeroGrants`, live in `turn.onMove`) is mirrored at each loop's
 * move-dispatch site; the turn-boundary half (the clear) lives here, the single
 * shared onBegin mirror, so one edit covers all three loops including the
 * initial-turn call.
 *
 * Pure helper: no boardgame.io import, no I/O, no `Math.random()`.
 */

import type { LegendaryGameState } from '../types.js';
import { clearDeferredConditionalGrants } from '../hero/deferredConditionalGrants.js';

/**
 * Mirrors the play-phase onBegin hook for one turn start: resets the two
 * once-per-turn allowance flags for the incoming seat, drops every deferred
 * conditional grant, clears the WP-656 defeat edge flag, and deletes the WP-743
 * Master Strike / Ambush Villain flags — in the same order `game.ts` `onBegin` runs
 * them. No draw (D-24520 — the draw is at end of turn).
 *
 * why: rule-hook firing (onTurnStart) is intentionally NOT mirrored — the three
 * callers are observation-only and defer rule hooks (D-0205). Stage/economy
 * reset stays with the callers (they already do it); this helper owns the
 * flag resets and the deferred-grant turn-boundary clear of onBegin.
 *
 * @param gameState - the live per-game state; the two allowance flags are
 *   mutated in place, and `deferredConditionalGrants`,
 *   `villainOrMastermindDefeatedSinceResolve`, `masterStrikePlayedThisTurn` and
 *   `ambushVillainPlayedThisTurn` are deleted when present.
 * @param playerId - the seat whose turn is beginning (unused now beyond symmetry;
 *   the flags are global-per-turn, not per-seat, but kept for call-site clarity).
 */
export function applyOnBeginParity(
  gameState: LegendaryGameState,
  playerId: string,
): void {
  // why: the once-per-turn villain reveal allowance refreshes at the start of
  // every player turn; without this the move-level reveal guard (and the
  // legal-moves reveal gate) would permanently block reveals from turn 2 on.
  gameState.villainRevealedThisTurn = false;
  // why: WP-701 / D-24520 — the incoming seat's hand is ALREADY drawn (its own prior
  // end-of-turn, or setup for turn 1), so the scaffold drawCards move stays a guarded
  // no-op all turn. Set the flag TRUE (matching game.ts onBegin + the OLD model's
  // post-draw value), so harness legal-moves never offer a mid-turn manual refill.
  gameState.hasDrawnThisTurn = true;
  // why: WP-744 / D-24567 — mirrors game.ts onBegin for the rebuilt loops. The
  // wait-and-see window (WP-568 / D-24377) is THIS turn: an entry surviving into the
  // next turn would re-evaluate against a fresh turnEconomy and could grant for the
  // wrong turn. clearDeferredConditionalGrants is a guarded delete, so a game that
  // never recorded a deferred grant keeps a byte-unchanged G.
  clearDeferredConditionalGrants(gameState);
  // why: WP-744 / D-24567 — mirrors game.ts onBegin's WP-656 / D-24467 defeat edge
  // clear, in the same order (after the deferred-grant clear). The whole-turn window
  // ends at the turn boundary, so a stale defeat must never carry into the next turn.
  // Guarded so a never-set G stays byte-unchanged (no key is created or removed), which
  // keeps the sentinel finalStateHash and PRE_WP080_HASH oracles stable.
  if (gameState.villainOrMastermindDefeatedSinceResolve !== undefined) {
    delete gameState.villainOrMastermindDefeatedSinceResolve;
  }
  // why: WP-743 / D-24566 — mirrors game.ts onBegin's guarded deletes of the per-turn
  // Master Strike / Ambush Villain flags. The simulation runner, PAR aggregator and
  // fixture runner never run game.ts onBegin; without this a Master Strike would carry
  // into every later turn and re-open the Spring the Trap over-grant in the sim and PAR.
  // Guarded so a never-set G stays byte-unchanged.
  if (gameState.masterStrikePlayedThisTurn !== undefined) {
    delete gameState.masterStrikePlayedThisTurn;
  }
  if (gameState.ambushVillainPlayedThisTurn !== undefined) {
    delete gameState.ambushVillainPlayedThisTurn;
  }
  // why: playerId retained in the signature for call-site symmetry with the live
  // onBegin (which reads ctx.currentPlayer); referenced here so lint does not flag
  // it while the per-seat draw it once fed now lives in applyEndOfTurnCleanup.
  void playerId;
}
