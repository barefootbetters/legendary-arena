/**
 * Shared play-phase onBegin parity for the observation-only harnesses.
 *
 * The boardgame.io play-phase `onBegin` hook (game.ts) runs at the start of
 * every player turn and resets the two once-per-turn allowance flags
 * (`villainRevealedThisTurn`, `hasDrawnThisTurn`). None of the engine's three
 * non-framework per-turn loops run that hook, so each mirrors it manually:
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
 * Pure helper: no boardgame.io import, no I/O, no `Math.random()`.
 */

import type { LegendaryGameState } from '../types.js';

/**
 * Mirrors the play-phase onBegin hook for one turn start: resets the two
 * once-per-turn allowance flags for the incoming seat. No draw (D-24520 — the
 * draw is at end of turn).
 *
 * why: rule-hook firing (onTurnStart) is intentionally NOT mirrored — the three
 * callers are observation-only and defer rule hooks (D-0205). Stage/economy
 * reset stays with the callers (they already do it); this helper owns only the
 * flag reset part of onBegin.
 *
 * @param gameState - the live per-game state; the two flags are mutated in place.
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
  // why: playerId retained in the signature for call-site symmetry with the live
  // onBegin (which reads ctx.currentPlayer); referenced here so lint does not flag
  // it while the per-seat draw it once fed now lives in applyEndOfTurnCleanup.
  void playerId;
}
