/**
 * Canonical rule hook contracts for the Legendary Arena game engine.
 *
 * Defines trigger names, payload shapes, effect types, and the data-only
 * HookDefinition interface. These contracts are consumed by the rule
 * execution pipeline (WP-009B) and by all future rule implementations.
 *
 * No boardgame.io imports. No handler functions. Contracts only.
 */

import type { CardExtId } from '../state/zones.types.js';

// ---------------------------------------------------------------------------
// Trigger Names
// ---------------------------------------------------------------------------

/**
 * The five canonical rule trigger names.
 *
 * Each trigger corresponds to a game event that may activate scheme or
 * mastermind rule hooks.
 */
export type RuleTriggerName =
  | 'onTurnStart'
  | 'onTurnEnd'
  | 'onCardRevealed'
  | 'onSchemeTwistRevealed'
  | 'onMastermindStrikeRevealed';

/**
 * All rule trigger names in canonical order. Single source of truth.
 *
 * Used for drift-detection testing — if a trigger is added to the
 * RuleTriggerName union type, it must also appear in this array
 * (and vice versa).
 */
export const RULE_TRIGGER_NAMES: readonly RuleTriggerName[] = [
  'onTurnStart',
  'onTurnEnd',
  'onCardRevealed',
  'onSchemeTwistRevealed',
  'onMastermindStrikeRevealed',
] as const;

// ---------------------------------------------------------------------------
// Trigger Payloads
// ---------------------------------------------------------------------------

/**
 * Payload for the onTurnStart trigger.
 *
 * Fired at the beginning of each player's turn.
 */
export interface OnTurnStartPayload {
  /** The player ID whose turn is starting. */
  currentPlayerId: string;
}

/**
 * Payload for the onTurnEnd trigger.
 *
 * Fired at the end of each player's turn.
 */
export interface OnTurnEndPayload {
  /** The player ID whose turn is ending. */
  currentPlayerId: string;
}

/**
 * Payload for the onCardRevealed trigger.
 *
 * Fired when any card is revealed from the villain deck.
 */
export interface OnCardRevealedPayload {
  /** The ext_id of the revealed card. */
  cardId: CardExtId;
  /** The card type slug (e.g., 'villain', 'scheme-twist'). Uses hyphens, not underscores. */
  cardTypeSlug: string;
}

/**
 * Payload for the onSchemeTwistRevealed trigger.
 *
 * Fired when a scheme twist card is revealed from the villain deck.
 * Always preceded by an onCardRevealed trigger for the same card.
 */
export interface OnSchemeTwistRevealedPayload {
  /** The ext_id of the revealed scheme twist card. */
  cardId: CardExtId;
}

/**
 * Payload for the onMastermindStrikeRevealed trigger.
 *
 * Fired when a mastermind strike card is revealed from the villain deck.
 * Always preceded by an onCardRevealed trigger for the same card.
 */
export interface OnMastermindStrikeRevealedPayload {
  /** The ext_id of the revealed mastermind strike card. */
  cardId: CardExtId;
}

/**
 * Maps each RuleTriggerName to its corresponding payload type.
 *
 * Used by the execution pipeline to ensure type-safe trigger dispatch.
 */
export type TriggerPayloadMap = {
  onTurnStart: OnTurnStartPayload;
  onTurnEnd: OnTurnEndPayload;
  onCardRevealed: OnCardRevealedPayload;
  onSchemeTwistRevealed: OnSchemeTwistRevealedPayload;
  onMastermindStrikeRevealed: OnMastermindStrikeRevealedPayload;
};

// ---------------------------------------------------------------------------
// Rule Effects
// ---------------------------------------------------------------------------

// why: Effects are a data-only tagged union rather than callback functions.
// Each effect variant describes *what should happen* — the executor in WP-009B
// applies them deterministically. This design separates rule declaration from
// execution and keeps HookDefinition fully JSON-serializable. Functions cannot
// live in G, so storing effect descriptions as plain data is required by the
// persistence and determinism invariants.

/**
 * A rule effect produced by hook execution.
 *
 * Effects are data-only descriptions of state changes. The effect executor
 * (WP-009B) applies them to G deterministically.
 */
export type RuleEffect =
  | { type: 'queueMessage'; message: string }
  | { type: 'modifyCounter'; counter: string; delta: number }
  | { type: 'drawCards'; playerId: string; count: number }
  | { type: 'discardHand'; playerId: string };

/**
 * All rule effect type strings in canonical order. Single source of truth.
 *
 * Used for drift-detection testing — if an effect type is added to the
 * RuleEffect tagged union, it must also appear in this array (and vice versa).
 */
export const RULE_EFFECT_TYPES: readonly string[] = [
  'queueMessage',
  'modifyCounter',
  'drawCards',
  'discardHand',
] as const;

// ---------------------------------------------------------------------------
// Hook Definition
// ---------------------------------------------------------------------------

/**
 * A data-only rule hook definition stored in G.hookRegistry.
 *
 * HookDefinition declares what triggers a rule responds to and its execution
 * priority. It contains no handler functions — the ImplementationMap (WP-009B)
 * maps hook IDs to their handler functions at runtime, outside of G.
 */
export interface HookDefinition {
  /** Stable unique identifier for this hook. */
  id: string;
  /** Whether this hook belongs to a scheme or mastermind. */
  kind: 'scheme' | 'mastermind';
  /** The ext_id of the scheme or mastermind that owns this hook. */
  sourceId: string;
  /** Which triggers this hook subscribes to. */
  triggers: RuleTriggerName[];
  /** Execution priority — lower fires first; ties broken by id lexically. */
  priority: number;
}

/**
 * An array of HookDefinition entries stored in G.hookRegistry.
 *
 * The registry is built at setup time and is immutable during gameplay.
 */
export type HookRegistry = HookDefinition[];
