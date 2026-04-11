/**
 * Lobby state and move argument types for the lobby phase.
 *
 * The lobby phase holds players in a waiting state until all required
 * players have signaled readiness. Once all players are ready,
 * startMatchIfReady transitions the game into the setup phase.
 *
 * No boardgame.io imports. Types only.
 */

// why: MoveResult and MoveError are the engine-wide result contract defined
// canonically in coreMoves.types.ts (WP-008A). Re-exported here for
// convenience so lobby validators can import from this module. No new error
// types are defined.
export type { MoveResult, MoveError } from '../moves/coreMoves.types.js';

/**
 * The shape of G.lobby — lobby phase state stored in the game state.
 *
 * Invariant: LobbyState must be JSON-serializable at all times.
 * All fields are primitives or plain objects.
 */
export interface LobbyState {
  /** Number of players required before the match can start. Set from ctx.numPlayers at setup time. */
  requiredPlayers: number;
  /** Map of player ID to readiness status. Keyed by boardgame.io player ID string. */
  ready: Record<string, boolean>;
  // why: stored in G so UI can observe lobby completion regardless of read
  // timing. The UI can check G.lobby.started without inspecting ctx.phase.
  /** Whether the lobby has completed and the match is transitioning to setup. */
  started: boolean;
}

/**
 * Arguments for the setPlayerReady move.
 */
export interface SetPlayerReadyArgs {
  /** Whether the player is signaling ready (true) or unready (false). */
  ready: boolean;
}
