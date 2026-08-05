/**
 * Player-initiated "End Game" move for Legendary Arena (WP-502 / D-24306).
 *
 * endMatchEarly lets the players close out an in-progress match — e.g. a co-op
 * table that ran out of time. It latches the MATCH_ENDED_EARLY endgame counter,
 * which evaluateEndgame reads first and turns into a 'tie' outcome flagged
 * endedEarly. The top-level endIf then sets ctx.gameover for every seat and the
 * UIState projection surfaces the endgame panel to all connected clients, so one
 * player ending the match closes it out for everyone.
 *
 * An early-ended match is deliberately NOT scored on the competitive leaderboard
 * (the endedEarly marker; enforced server-side in the competitive submission path
 * and skipped client-side in the submit-on-gameover hook).
 *
 * Non-core move. Never throws. Idempotent — a no-op once the match has already
 * ended (whether by a natural win/loss/tie or a prior End Game).
 *
 * No registry imports. No .reduce().
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Ends the current match early at the players' request.
 *
 * Latches MATCH_ENDED_EARLY so the endgame evaluator resolves the match as an
 * endedEarly tie. Returns void with no mutation when the match has already ended
 * (idempotent). Moves never throw.
 *
 * @param context - boardgame.io move context with G, ctx.
 */
export function endMatchEarly({ G, ctx }: MoveContext): void {
  // why: idempotent guard — a match that has already reached any endgame
  // condition (a natural win / loss / tie, or a prior End Game) must not be
  // re-latched or relabelled. evaluateEndgame is the sole endgame authority and a
  // pure counter read, so this check is side-effect free.
  if (evaluateEndgame(G) !== null) return;

  // why: WP-502 / D-24306 — latch the player-initiated end. evaluateEndgame reads
  // MATCH_ENDED_EARLY first, so the very next top-level endIf sets ctx.gameover
  // for all seats and every client's UIState projects the endgame panel. Use the
  // constant, never the string literal.
  G.counters[ENDGAME_CONDITIONS.MATCH_ENDED_EARLY] = 1;

  pushLog(G, `Player ${ctx.currentPlayer} ended the match early.`);
}
