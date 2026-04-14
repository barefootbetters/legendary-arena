/**
 * Replay contract types for the Legendary Arena game engine.
 *
 * ReplayInput is the canonical contract defining everything needed to
 * reconstruct a game deterministically: seed, setup config, player order,
 * and ordered moves.
 *
 * Implements D-0201 (Replay as a First-Class Feature).
 */

import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { LegendaryGameState } from '../types.js';

// why: ReplayInput is everything needed to reconstruct a game
// deterministically. It is Class 2 (Configuration) data — safe to persist.
// The replayed G is Class 1 (Runtime) — never persisted.

/**
 * A single move record in a replay sequence.
 */
export interface ReplayMove {
  readonly playerId: string;
  readonly moveName: string;
  readonly args: unknown;
}

/**
 * Canonical replay input contract. Contains everything needed to reconstruct
 * a game deterministically: seed, setup config, player order, and ordered
 * moves.
 *
 * Implements D-0201 (Replay as a First-Class Feature).
 */
export interface ReplayInput {
  readonly seed: string;
  readonly setupConfig: MatchSetupConfig;
  readonly playerOrder: string[];
  readonly moves: ReplayMove[];
}

/**
 * Result of replaying a game from a ReplayInput.
 */
export interface ReplayResult {
  readonly finalState: LegendaryGameState;
  readonly stateHash: string;
  readonly moveCount: number;
}
