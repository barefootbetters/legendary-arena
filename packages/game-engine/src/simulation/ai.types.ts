/**
 * AI playtesting and balance simulation type contracts for the Legendary
 * Arena game engine.
 *
 * These types define the pluggable AI policy interface, the legal-move
 * description shape, and the simulation configuration and aggregate result
 * records. They are pure type-only exports — no runtime values, no behavior.
 *
 * No boardgame.io imports. No registry imports.
 */

import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { UIState } from '../ui/uiState.types.js';
import type { ClientTurnIntent } from '../network/intent.types.js';

// why: AI receives a filterUIStateForAudience view with the player audience —
// the same visibility a human player has (D-0701: AI Is Tooling, Not
// Gameplay). AIPolicy lives outside G; simulation is an external consumer
// of the engine pipeline. Balance changes require simulation validation
// (D-0702: Balance Changes Require Simulation). The four types in this
// file ship pure data contracts — no runtime values are exported.

/**
 * A single legal move available to the AI policy.
 *
 * name must be one of the eight play-phase move names enumerated in
 * SIMULATION_MOVE_NAMES (ai.legalMoves.ts). args is a deliberate wide type
 * that mirrors ClientTurnIntent.move.args so downstream submission is
 * type-compatible without narrowing casts.
 */
export interface LegalMove {
  readonly name: string;
  readonly args: unknown;
}

/**
 * Pluggable AI decision interface.
 *
 * The AI policy receives the audience-filtered UIState (the same projection
 * a human player sees) plus the list of legal moves, and returns a
 * ClientTurnIntent to be submitted through the same validation + dispatch
 * pipeline as humans. The policy MUST return an intent whose move name is
 * either one of the LegalMove entries or the 'endTurn' fallback from the
 * zero-legal-moves branch.
 *
 * Forbidden behaviors (permanent, not just at MVP):
 * - Caching or memoizing decisions across calls.
 * - Closing over G, ctx, or any engine internal.
 * - Retaining state between calls that would affect the next call's output.
 * - Reading or writing any external resource (filesystem, network, clock).
 *
 * name is free-form metadata for logging and aggregation — not
 * drift-pinned.
 */
export interface AIPolicy {
  readonly name: string;
  decideTurn(
    playerView: UIState,
    legalMoves: LegalMove[],
  ): ClientTurnIntent;
}

/**
 * Parameters for a single simulation run.
 *
 * policies[i] is applied when the active player's playerId === String(i).
 * policies.length must match the player count derived from setupConfig, or
 * runSimulation returns a zeroed SimulationResult with a warning (no
 * throw).
 */
export interface SimulationConfig {
  readonly games: number;
  readonly seed: string;
  readonly setupConfig: MatchSetupConfig;
  readonly policies: AIPolicy[];
}

/**
 * Aggregate statistics from one or more simulated games.
 *
 * Every numeric field is derived from per-game UIState projections (via
 * buildUIState + filterUIStateForAudience) — never from direct G access.
 * JSON-serializable. seed is copied verbatim from config.seed to enable
 * reproduction.
 */
export interface SimulationResult {
  readonly gamesPlayed: number;
  readonly winRate: number;
  readonly averageTurns: number;
  readonly averageScore: number;
  readonly escapedVillainsAverage: number;
  readonly woundsAverage: number;
  readonly seed: string;
}
