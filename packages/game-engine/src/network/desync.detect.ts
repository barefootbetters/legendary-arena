/**
 * Desync detection for the Legendary Arena multiplayer layer.
 *
 * Compares a client-reported state hash against the engine's
 * authoritative state hash. Pure function — no I/O, no mutations.
 *
 * // why: engine-authoritative resync (D-0402). If the client's view
 * of game state has diverged from the engine's truth, the engine wins.
 * The client must discard its local state and resync from the engine.
 */

import type { LegendaryGameState } from '../types.js';
import { computeStateHash } from '../replay/replay.hash.js';

/**
 * Compares a client-reported state hash against the engine's
 * authoritative state hash.
 *
 * @param clientHash - The hash reported by the client, or undefined if
 *   the client did not provide one.
 * @param gameState - The authoritative engine game state.
 * @returns desynced is false when clientHash is undefined (client opted
 *   out of hash reporting) or when hashes match.
 */
export function detectDesync(
  clientHash: string | undefined,
  gameState: LegendaryGameState,
): { desynced: boolean; engineHash: string } {
  const engineHash = computeStateHash(gameState);

  if (clientHash === undefined) {
    return { desynced: false, engineHash };
  }

  return {
    desynced: clientHash !== engineHash,
    engineHash,
  };
}
