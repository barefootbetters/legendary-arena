/**
 * Snapshot creation for Legendary Arena.
 *
 * createSnapshot derives a read-only MatchSnapshot from the current game
 * state. It is a pure function (no I/O, no throws) that returns a frozen
 * object via Object.freeze().
 *
 * No boardgame.io imports. No game logic. Pure helper only.
 */

import type { LegendaryGameState } from '../types.js';
import type { MatchSnapshot, MatchSnapshotPlayer, MatchSnapshotOutcome } from './persistence.types.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';

/**
 * Minimal context interface for snapshot creation.
 *
 * Captures only what createSnapshot needs from the boardgame.io ctx object.
 * Defined locally to avoid importing boardgame.io in persistence files
 * (pure helper rule). The real boardgame.io Ctx satisfies this structurally.
 */
export interface SnapshotContext {
  /** The current turn number. */
  turn: number;
  /** The current phase name. */
  phase: string;
  /** The active player ID. */
  currentPlayer: string;
}

/**
 * Create a read-only snapshot of the current match state.
 *
 * Derives zone counts (not contents) from G.playerZones, copies counters
 * and messages by value, and embeds the endgame outcome if present.
 *
 * This function is pure: no I/O, no throws, deterministic given the same
 * inputs (except for snapshotAt which is audit metadata).
 *
 * @param gameState - The current LegendaryGameState (G).
 * @param context - Minimal context with turn, phase, and currentPlayer.
 * @param matchId - The unique match identifier.
 * @returns A frozen, read-only MatchSnapshot.
 */
export function createSnapshot(
  gameState: LegendaryGameState,
  context: SnapshotContext,
  matchId: string,
): Readonly<MatchSnapshot> {
  // why: zone counts not contents prevents snapshots from becoming a second
  // source of truth about card positions. The live G is authoritative for
  // where cards are; snapshots are audit records only.
  const players: MatchSnapshotPlayer[] = [];
  const playerIds = Object.keys(gameState.playerZones);

  for (const playerId of playerIds) {
    const zones = gameState.playerZones[playerId];
    if (zones === undefined) {
      continue;
    }
    players.push({
      playerId,
      deckCount: zones.deck.length,
      handCount: zones.hand.length,
      discardCount: zones.discard.length,
      inPlayCount: zones.inPlay.length,
      victoryCount: zones.victory.length,
    });
  }

  // why: outcome is derived by calling evaluateEndgame (a pure function that
  // reads G.counters) rather than stored on G. boardgame.io's endIf returns
  // EndgameResult via the framework; it is not persisted in G.
  let outcome: MatchSnapshotOutcome | undefined;
  const endgameResult = evaluateEndgame(gameState);

  if (endgameResult !== null) {
    outcome = {
      result: endgameResult.outcome,
      reason: endgameResult.reason,
    };
  }

  const snapshot: MatchSnapshot = {
    matchId,
    // why: snapshotAt uses new Date().toISOString() — a wall-clock read.
    // This is permitted because createSnapshot is never called during
    // gameplay; snapshotAt is audit metadata that does not affect game
    // outcomes.
    snapshotAt: new Date().toISOString(),
    turn: context.turn,
    phase: context.phase,
    activePlayer: context.currentPlayer,
    players,
    counters: { ...gameState.counters },
    messages: [...gameState.messages],
    ...(outcome !== undefined ? { outcome } : {}),
  };

  return Object.freeze(snapshot);
}
