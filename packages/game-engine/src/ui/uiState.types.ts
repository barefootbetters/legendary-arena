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
  progress: UIProgressCounters;
  gameOver?: UIGameOverState;
}

/**
 * Display-safe card data projected once at setup time and surfaced through
 * UIState. Read-only. JSON-serializable. Contains only primitive fields.
 *
 * Field set is locked at exactly four entries — adding `team`, `class`,
 * `setName`, `cardType`, `attack`, `recruit`, or `keywords` here is scope
 * creep and requires a separate WP. The drift-detection test in
 * uiState.types.drift.test.ts pins the field set.
 *
 * // why: gives the UI enough to render a real card (name + image + cost)
 * without granting the client a runtime registry import. Mirrors the
 * G.cardStats / G.villainDeckCardTypes setup-snapshot pattern (sibling
 * to WP-018, WP-014B). Sourced once at Game.setup() from the registry
 * and never mutated thereafter.
 */
export interface UICardDisplay {
  extId: string;
  name: string;
  imageUrl: string;
  cost: number | null;
}

/**
 * Display-bearing entry for an occupied HQ slot.
 *
 * Two-field shape locked: extId (the canonical join key, repeated for UI
 * convenience and drift-detection sanity) plus the display payload.
 */
export interface UIHQCard {
  extId: string;
  display: UICardDisplay;
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
  /**
   * Per-hand-card display data, parallel-aligned with handCards by index.
   * Length matches handCards exactly when both are present. Redacted
   * (omitted) alongside handCards by filterUIStateForAudience.
   *
   * // why: parallel-array form preserves backwards compatibility on the
   * existing `handCards: string[]` shape — consumers that read handCards
   * continue to work; new consumers opt into handDisplay for display
   * fields. Mirrors the WP-029 D-2902 exactOptionalPropertyTypes
   * conditional-assignment pattern: the projection and filter never
   * write `handDisplay: undefined` literally.
   */
  handDisplay?: UICardDisplay[];
}

/**
 * Display-safe card info for a card in the City.
 *
 * // why: contains only display-safe data — ext_id for registry lookup,
 * type for visual classification, keywords for gameplay indicators, and
 * the setup-snapshotted display payload. No engine internals.
 */
export interface UICityCard {
  extId: string;
  type: string;
  keywords: string[];
  display: UICardDisplay;
}

/**
 * City zone projection with display-safe card info.
 */
export interface UICityState {
  spaces: (UICityCard | null)[];
}

/**
 * HQ zone projection with ext_ids for display lookup.
 *
 * // why: `slots` shape preserved verbatim per pre-flight 2026-04-29 PS-6
 * (Q3 written audit blocked the breaking-change form — HQRow.vue and
 * HQRow.test.ts iterate `slots` as bare strings and live outside the
 * 9-file allowlist). The new `slotDisplay?` parallel array carries the
 * display payload aligned by index; `null` at position i in slotDisplay
 * matches `slots[i] === null` exactly. Mirrors the handCards / handDisplay
 * parallel-array pattern.
 */
export interface UIHQState {
  slots: (string | null)[];
  slotDisplay?: (UIHQCard | null)[];
}

/**
 * Mastermind projection with identity and tactics counts.
 *
 * // why: `display` is keyed internally by gameState.mastermind.baseCardId
 * (the canonical G.cardStats / G.cardDisplayData join key per pre-flight
 * 2026-04-29 PS-5); `id` continues to expose the qualified group id
 * (e.g., "core/dr-doom"). UI consumers never see the join key.
 */
export interface UIMastermindState {
  id: string;
  tacticsRemaining: number;
  tacticsDefeated: number;
  display: UICardDisplay;
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
  par?: UIParBreakdown;
}

// why: projected for WP-062 HUD consumption; `bystandersRescued` aggregates
// from each player's victory pile, `escapedVillains` surfaces
// G.counters[ESCAPED_VILLAINS]. See WP-067.
/**
 * Aggregate progress counters projected from G for HUD display.
 *
 * Both fields are derived at projection time from authoritative G state and
 * are required on every UIState — even during the lobby phase, where both
 * values are zero.
 */
export interface UIProgressCounters {
  /** Aggregate count of bystanders in every player's victory zone. */
  bystandersRescued: number;
  /** Cumulative count of villains that escaped the City. */
  escapedVillains: number;
}

// why: verbatim name-for-name mirror of WP-048 ScoreBreakdown so WP-062
// aria-labels bind to a single contract. Optional on UIGameOverState because
// not every match is PAR-scored; under D-6701 MVP the payload is deferred and
// the field is always omitted at runtime.
/**
 * PAR scoring breakdown projection for the endgame HUD.
 *
 * Field names mirror WP-048's ScoreBreakdown verbatim so WP-062 aria-labels
 * bind to a single contract. Per D-6701 the payload is deferred until the
 * follow-up WP wires `ReplayResult` into `buildUIState`; the type-level
 * contract ships here so the drift test pins the four field names today.
 */
export interface UIParBreakdown {
  /** Raw score before applying PAR baseline. */
  rawScore: number;
  /** Baseline PAR score for the scenario. */
  parScore: number;
  /** Final score after applying PAR baseline and penalty events. */
  finalScore: number;
  /** Version stamp of the ScenarioScoringConfig used to compute the breakdown. */
  scoringConfigVersion: number;
}

export type { UIAudience } from './uiAudience.types.js';
