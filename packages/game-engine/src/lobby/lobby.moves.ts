/**
 * Lobby phase move functions for the Legendary Arena game engine.
 *
 * These moves are wired into the lobby phase moves block in game.ts.
 * They follow the Move Validation Contract: validate args, then mutate G,
 * then return void. They never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { SetPlayerReadyArgs } from './lobby.types.js';
import { validateSetPlayerReadyArgs } from './lobby.validate.js';
import { validateCanStartMatch } from './lobby.validate.js';

/**
 * Sets the dispatching player's readiness status in the lobby.
 *
 * Validates that args.ready is a boolean. If valid, sets
 * G.lobby.ready[playerID] to the provided value, where playerID is the
 * authenticated dispatching player from boardgame.io's FnContext.
 *
 * @param context - boardgame.io move context with G, ctx, and playerID.
 * @param args - The move arguments containing a boolean ready field.
 */
export function setPlayerReady(
  // why: per D-10010, the move uses `playerID` from FnContext (the
  // authenticated dispatching player) rather than `ctx.currentPlayer`
  // (the turn-holder). In multi-active-player phases like lobby with
  // `activePlayers: { all: 'lobbyReady' }`, ANY seated player can
  // dispatch this move — but ctx.currentPlayer remains the original
  // turn-holder regardless of who clicked. Using ctx.currentPlayer
  // would overwrite player 0's ready slot every time, leaving
  // validateCanStartMatch perpetually unable to count player 1+ as
  // ready. boardgame.io's MoveFn signature includes playerID on the
  // context for exactly this case (see boardgame.io's
  // dist/types/src/types.d.ts MoveFn definition).
  { G, playerID }: FnContext<LegendaryGameState> & { playerID: PlayerID },
  args: SetPlayerReadyArgs,
): void {
  const validationResult = validateSetPlayerReadyArgs(args);
  if (!validationResult.ok) {
    return;
  }

  // why: G.lobby.ready[playerID] writes to the dispatching player's slot
  // per D-10010. With activePlayers config, this slot is the seat the
  // click came from, not the turn-holder.
  G.lobby.ready[playerID] = args.ready;
}

/**
 * Transitions the match from lobby to play if all required players are ready.
 *
 * Follows the non-negotiable observability ordering:
 * 1. Validate that all players are ready
 * 2. Set G.lobby.started = true (flag in G first)
 * 3. Call ctx.events.setPhase('play') (then transition)
 *
 * Per WP-100 §Scope J / D-10006, this move bypasses the empty `setup`
 * phase entirely. Setup is reserved for a future deck-construction WP.
 *
 * @param context - boardgame.io move context with G, ctx, and events.
 */
export function startMatchIfReady(
  { G, events }: FnContext<LegendaryGameState>,
): void {
  const validationResult = validateCanStartMatch(G.lobby);
  if (!validationResult.ok) {
    return;
  }

  // why: stored in G so UI can observe lobby completion regardless of read
  // timing. The UI can check G.lobby.started without inspecting ctx.phase.
  G.lobby.started = true;

  // why: ctx.events.setPhase is the boardgame.io mechanism for transitioning
  // phases from within a move. WP-100 retargets the lobby exit directly to
  // 'play' rather than routing through 'setup' per D-10006: the setup phase
  // declared at game.ts:279-281 has no onBegin, no endIf, no exit move, and
  // an empty moves block — and no production code anywhere in
  // packages/game-engine/src/ calls setPhase('play'). Routing through setup
  // therefore creates a dead-end phase that blocks every smoke-test path.
  // Setup is reserved for a future deck-construction WP that will either
  // (a) reroute lobby → setup once setup gains real phase machinery, or
  // (b) take ownership of the lobby → play seam differently. WP-100 does
  // not lock either evolution path out. G.lobby.started is set before this
  // call so the UI can observe lobby completion regardless of read timing.
  events.setPhase('play');
}
