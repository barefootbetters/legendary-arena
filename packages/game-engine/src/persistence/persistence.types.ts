/**
 * Persistence boundary types for Legendary Arena.
 *
 * Defines the three canonical data classes, the MatchSnapshot shape (derived,
 * read-only audit records), and PersistableMatchConfig (safe-to-store match
 * configuration).
 *
 * These types are the authoritative classification system for all data in
 * Legendary Arena. Every future packet that classifies data must import and
 * use PERSISTENCE_CLASSES constants — never string literals.
 *
 * No boardgame.io imports. No game logic. Contracts only.
 */

import type { MatchSetupConfig } from '../matchSetup.types.js';

// why: The three persistence classes are the canonical data classification for
// all data in Legendary Arena. They govern what may be persisted, how, and
// with what constraints.
//
// - runtime: G, ctx, in-flight rule effects, socket/session data — exist only
//   in boardgame.io's in-memory process; never persisted. Persisting any
//   runtime object is a critical bug.
//
// - configuration: MatchSetupConfig, player names, seat assignments, creation
//   timestamp — deterministic inputs to a match. Safe to store before or after
//   a match because they have no dependency on boardgame.io runtime.
//
// - snapshot: turn count, phase, zone counts, counters, messages, outcome —
//   derived, read-only, immutable records. Never re-hydrated into a live
//   match. Safe to delete without affecting game integrity.

/**
 * The three canonical data classes in Legendary Arena.
 *
 * Every data object belongs to exactly one of these classes. Future packets
 * must import and use these constants — never the string values directly.
 */
export const PERSISTENCE_CLASSES = {
  RUNTIME:       'runtime',
  CONFIGURATION: 'configuration',
  SNAPSHOT:      'snapshot',
} as const;

/**
 * The safe-to-store subset of match configuration data.
 *
 * Contains the deterministic inputs to a match: the setup config, player
 * names, and creation metadata. Does not contain G, ctx, or any runtime
 * state.
 */
export interface PersistableMatchConfig {
  /** Unique match identifier. */
  matchId: string;
  /** The 9-field setup payload used to configure this match. */
  setupConfig: MatchSetupConfig;
  /** Map of player IDs to display names. */
  playerNames: Record<string, string>;
  /** ISO 8601 timestamp of when the match was created. */
  createdAt: string;
}

/**
 * A derived, read-only audit record of match state at a point in time.
 *
 * Snapshots contain zone counts only — never zone contents (CardExtId arrays).
 * They must never be re-hydrated into a live match or replace G as the source
 * of truth.
 *
 * Excluded from snapshots: hookRegistry, lobby, currentStage, CardExtId arrays.
 */
export interface MatchSnapshot {
  /** Unique match identifier. */
  matchId: string;
  // why: snapshotAt uses new Date().toISOString() — a wall-clock read that is
  // normally forbidden in the engine. This is permitted because createSnapshot
  // is never called during gameplay (it is an external audit operation), and
  // snapshotAt is audit metadata that does not affect game outcomes.
  /** ISO 8601 timestamp of when this snapshot was taken. */
  snapshotAt: string;
  /** The turn number at the time of the snapshot. */
  turn: number;
  /** The phase name at the time of the snapshot. */
  phase: string;
  /** The active player ID at the time of the snapshot. */
  activePlayer: string;
  // why: zone counts (not contents) prevent snapshots from becoming a second
  // source of truth about card positions. The live G is authoritative for
  // card locations; snapshots record only how many cards are in each zone.
  /** Per-player zone counts. No zone contents — counts only. */
  players: MatchSnapshotPlayer[];
  /** Copy of G.counters at snapshot time. */
  counters: Record<string, number>;
  /** Copy of G.messages at snapshot time. */
  messages: string[];
  /** Endgame result if the match has concluded; undefined if ongoing. */
  outcome?: MatchSnapshotOutcome;
}

/**
 * Per-player zone counts in a match snapshot.
 *
 * Derived from PlayerZones keys: deck, hand, discard, inPlay, victory.
 * Contains exactly 5 count fields — no zone contents.
 */
export interface MatchSnapshotPlayer {
  /** The player's unique identifier. */
  playerId: string;
  /** Number of cards in the player's deck. */
  deckCount: number;
  /** Number of cards in the player's hand. */
  handCount: number;
  /** Number of cards in the player's discard pile. */
  discardCount: number;
  /** Number of cards currently in play. */
  inPlayCount: number;
  /** Number of cards in the player's victory pile. */
  victoryCount: number;
}

/**
 * Endgame outcome embedded in a snapshot.
 *
 * Mirrors the shape of EndgameResult from endgame.types.ts.
 */
export interface MatchSnapshotOutcome {
  /** Which side won the match. */
  result: 'heroes-win' | 'scheme-wins';
  /** Human-readable description of the triggering condition. */
  reason: string;
}
