/**
 * UI state type definitions for the Legendary Arena game engine.
 *
 * UIState is the authoritative UI state contract. It is the only state
 * the UI consumes. The UI never reads G directly — it receives UIState,
 * a projection built from G and ctx by buildUIState.
 *
 * All types are JSON-serializable. No engine internals are exposed.
 *
 * Implements D-0301 (UI Consumes Projections Only).
 */

import type { FinalScoreSummary } from '../scoring/scoring.types.js';

// why: UIState is the only data the UI sees. All items in the canonical
// forbidden internals list (hookRegistry, ImplementationMap, cardStats,
// heroAbilityHooks, villainDeckCardTypes, schemeSetupInstructions, registry
// objects, setup builders) are hidden to prevent logic leakage and maintain
// the Layer Boundary. Implements D-0301 (UI Consumes Projections Only).

/**
 * The authoritative UI state contract.
 *
 * Derived from G and ctx by buildUIState. The UI never reads G directly.
 * JSON-serializable. Contains no engine internals.
 */
export interface UIState {
  game: {
    phase: string;
    turn: number;
    activePlayerId: string;
    currentStage: string;
  };
  players: UIPlayerState[];
  city: UICityState;
  hq: UIHQState;
  mastermind: UIMastermindState;
  scheme: UISchemeState;
  economy: UITurnEconomyState;
  log: string[];
  gameOver?: UIGameOverState;
}

/**
 * Per-player state projection. Zones projected as counts — not card arrays.
 *
 * // why: zone counts prevent the UI from accessing card identities it
 * shouldn't see (other players' hands, decks). Card display resolution
 * is a separate UI concern using the registry.
 */
export interface UIPlayerState {
  playerId: string;
  deckCount: number;
  handCount: number;
  discardCount: number;
  inPlayCount: number;
  victoryCount: number;
  woundCount: number;
  /**
   * Hand card ext_ids. Present for the viewing player's own hand;
   * undefined (redacted) for other players and spectators.
   *
   * // why: active player needs to see their own hand cards for gameplay.
   * Other players and spectators see handCount only to prevent information
   * leakage. buildUIState always populates this; filterUIStateForAudience
   * redacts it based on audience.
   */
  handCards?: string[];
}

/**
 * Display-safe card info for a card in the City.
 *
 * // why: contains only display-safe data — ext_id for registry lookup,
 * type for visual classification, keywords for gameplay indicators.
 * No engine internals.
 */
export interface UICityCard {
  extId: string;
  type: string;
  keywords: string[];
}

/**
 * City zone projection with display-safe card info.
 */
export interface UICityState {
  spaces: (UICityCard | null)[];
}

/**
 * HQ zone projection with ext_ids for display lookup.
 */
export interface UIHQState {
  slots: (string | null)[];
}

/**
 * Mastermind projection with identity and tactics counts.
 */
export interface UIMastermindState {
  id: string;
  tacticsRemaining: number;
  tacticsDefeated: number;
}

/**
 * Scheme projection with identity and twist count.
 */
export interface UISchemeState {
  id: string;
  twistCount: number;
}

/**
 * Economy projection with totals and available amounts.
 */
export interface UITurnEconomyState {
  attack: number;
  recruit: number;
  availableAttack: number;
  availableRecruit: number;
}

/**
 * Game-over projection with outcome, reason, and optional scores.
 */
export interface UIGameOverState {
  outcome: string;
  reason: string;
  scores?: FinalScoreSummary;
}

export type { UIAudience } from './uiAudience.types.js';
