/**
 * Operator setter contract types (WP-806 / EC-843 / D-24713).
 *
 * The six operator-match-only moves (`operatorSetSupplyCount`,
 * `operatorMoveToDeckTop`, `operatorRevealNow`, `operatorMoveCard`,
 * `operatorAddEconomy`, `operatorEscapeVillain`) take these argument shapes. They
 * run only in an operator match (`G.isDebugMatch === true`), on the operator's own
 * turn, in the `main` stage, with no choice open (D-24689 §7, D-24713 §1).
 *
 * The WP-807 client pane consumes this contract through the engine's `.` surface.
 * All types are JSON-serializable. No boardgame.io import.
 */

import type { CardExtId } from '../state/zones.types.js';

/** A shared supply pile an operator setter may read or write. */
export type OperatorSupplyPile = 'wounds' | 'bystanders' | 'officers' | 'sidekicks';

/** Canonical list of the operator supply piles, in display order. */
export const OPERATOR_SUPPLY_PILES: readonly OperatorSupplyPile[] = ['wounds', 'bystanders', 'officers', 'sidekicks'];

/** A shared deck `operatorMoveToDeckTop` may reorder. */
export type OperatorDeckName = 'villain' | 'hero';

/** A villain-deck card type `operatorRevealNow` may reveal now. */
export type OperatorRevealCardType = 'scheme-twist' | 'mastermind-strike';

/** A turn resource `operatorAddEconomy` may add. */
export type OperatorEconomyResource = 'attack' | 'recruit';

// why: OD-1 (WP-806) — one submit adds at most 20; raising it changes no rule.
/** The largest amount one `operatorAddEconomy` submit may add. */
export const OPERATOR_ECONOMY_MAX_AMOUNT = 20;

/** A player-owned zone an operator setter may name. */
export type OperatorPlayerZoneName = 'hand' | 'deck' | 'discard' | 'inPlay' | 'victory';

/** A zone reference for `operatorMoveCard`'s `from` and `to`. */
export type OperatorZoneRef = { zone: OperatorPlayerZoneName; playerId: string } | { zone: 'ko' } | { zone: 'heroDeck' } | { zone: 'hq'; hqIndex: number } | { zone: 'supply'; pile: OperatorSupplyPile };

/** Arguments for `operatorSetSupplyCount`. */
export interface OperatorSetSupplyCountArgs { pile: OperatorSupplyPile; count: number }

/** Arguments for `operatorMoveToDeckTop`. */
export interface OperatorMoveToDeckTopArgs { deck: OperatorDeckName; cardId: CardExtId }

/** Arguments for `operatorRevealNow`. */
export interface OperatorRevealNowArgs { cardType: OperatorRevealCardType }

/** Arguments for `operatorMoveCard`. */
export interface OperatorMoveCardArgs { cardId: CardExtId; from: OperatorZoneRef; to: OperatorZoneRef }

/** Arguments for `operatorAddEconomy`. */
export interface OperatorAddEconomyArgs { resource: OperatorEconomyResource; amount: number }

/** Arguments for `operatorEscapeVillain` (none; any keys are ignored). */
export type OperatorEscapeVillainArgs = Record<string, never>;

/** The six operator setter move names. */
export type OperatorSetterMoveName = 'operatorSetSupplyCount' | 'operatorMoveToDeckTop' | 'operatorRevealNow' | 'operatorMoveCard' | 'operatorAddEconomy' | 'operatorEscapeVillain';

/** Canonical list of the six operator setter move names. */
export const OPERATOR_SETTER_MOVE_NAMES: readonly OperatorSetterMoveName[] = ['operatorSetSupplyCount', 'operatorMoveToDeckTop', 'operatorRevealNow', 'operatorMoveCard', 'operatorAddEconomy', 'operatorEscapeVillain'];
