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
  /**
   * The completed play-turn count — the competitive `rounds` input
   * (`deriveScoringInputs` reads it). Floored at 1, consistent with
   * `reduceMatchToFinalState` (WP-336) and `par.aggregator`'s `turnsElapsed`, the
   * quantity the PAR baselines were calibrated with (D-24123). This retires the
   * D-4801 MVP proxy that used the player move count as the round count.
   */
  readonly turnCount: number;
}
