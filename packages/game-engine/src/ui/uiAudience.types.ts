/**
 * Audience type definitions for permission-filtered UI views.
 *
 * UIAudience defines who is viewing the game state. The engine produces
 * filtered views based on audience — it does not enforce access control.
 *
 * // why: audiences are roles, not permissions. The engine produces views;
 * it does not enforce who can call what. Access control is a server concern.
 * Replay viewers use the spectator audience.
 */

/**
 * Discriminated union representing who is viewing the game.
 *
 * - player: an active participant, identified by playerId
 * - spectator: a non-participant observer (also used for replay viewers)
 */
export type UIAudience =
  | { kind: 'player'; playerId: string }
  | { kind: 'spectator' };
