/**
 * Core move contracts for the Legendary Arena game engine.
 *
 * Defines the canonical move names, payload types, and the engine-wide
 * MoveResult/MoveError result contract. All move validators in every
 * future packet must import and return these types.
 *
 * No boardgame.io imports. No implementations. Contracts only.
 */

import type { CardExtId } from '../state/zones.types.js';

/**
 * The three core gameplay moves in canonical order.
 *
 * drawCards — draw cards from the player's deck into their hand
 * playCard — play a card from the player's hand into play
 * endTurn  — signal that the player's turn is complete
 */
export type CoreMoveName = 'drawCards' | 'playCard' | 'endTurn';

/**
 * All core move names in canonical order. Single source of truth.
 *
 * Used for drift-detection testing — if a move is added to the CoreMoveName
 * union type, it must also appear in this array (and vice versa).
 */
export const CORE_MOVE_NAMES: readonly CoreMoveName[] = [
  'drawCards',
  'playCard',
  'endTurn',
] as const;

/**
 * Payload for the drawCards move.
 *
 * count — how many cards to draw from the player's deck.
 */
export interface DrawCardsArgs {
  /** Number of cards to draw. Must be a finite integer >= 0. */
  count: number;
}

/**
 * Payload for the playCard move.
 *
 * cardId — the ext_id of the card to play from the player's hand.
 */
export interface PlayCardArgs {
  /** Card ext_id to play. Must be a non-empty string. */
  cardId: CardExtId;
}

/**
 * Payload for the endTurn move. No arguments required.
 */
export type EndTurnArgs = Record<string, never>;

// why: MoveError and MoveResult are the engine-wide result contract. Every move
// validator in every future packet must import and return these types. No
// parallel error types are permitted anywhere in the engine. This ensures a
// single, consistent error shape across all validation boundaries (lobby moves,
// gameplay moves, rule hooks, endgame evaluators). The only exception is
// ZoneValidationError in zones.validate.ts, which serves a distinct structural
// validation purpose and predates this contract.

/**
 * Structured error returned by move validators.
 *
 * code    — machine-readable error identifier (e.g., "INVALID_COUNT")
 * message — human-readable full sentence describing what failed
 * path    — the field or parameter that caused the error (e.g., "count", "cardId")
 */
export interface MoveError {
  /** Machine-readable error code. */
  code: string;
  /** Human-readable error message (must be a full sentence). */
  message: string;
  /** The field or parameter that caused the error. */
  path: string;
}

/**
 * Structured result returned by all move validators.
 *
 * Validators return { ok: true } on success, or { ok: false, errors: [...] }
 * on failure. They never throw.
 */
export type MoveResult = { ok: true } | { ok: false; errors: MoveError[] };
