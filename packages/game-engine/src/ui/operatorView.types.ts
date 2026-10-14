/**
 * Operator projection contract types (WP-802 / EC-839 / D-24689).
 *
 * An operator match (`G.isDebugMatch === true`, set only at `Game.setup()` from
 * the admin-only operator create route) can be read whole by an admin over an
 * `admin-session-required` HTTP route. `buildOperatorView`
 * (`operatorView.build.ts`) builds that read from `G`. These types are the
 * contract the server returns and the planned arena-client panel consumes.
 *
 * This projection is NEVER served through `playerView`: every player and
 * spectator audience in `filterUIStateForAudience` is unchanged (D-24689 §4).
 * All types are JSON-serializable. Every array is in stored order, so index 0
 * is the next card drawn or revealed.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { TurnStage } from '../turn/turnPhases.types.js';
import type { UICardDisplay, UIState } from './uiState.types.js';

/**
 * The framework fields `buildOperatorView` reads, structurally identical to the
 * private `UIBuildContext` of `buildUIState` so the server can build it from a
 * fetched match's `ctx`.
 */
export interface OperatorBuildContext {
  readonly phase: string | null;
  readonly turn: number;
  readonly currentPlayer: string;
}

/** Wound cards counted separately in each of a seat's five zones. */
export interface OperatorWoundsByZone {
  readonly deck: number;
  readonly hand: number;
  readonly discard: number;
  readonly inPlay: number;
  readonly victory: number;
}

/** One seat's five card zones, unredacted and in stored order. */
export interface OperatorSeatView {
  readonly playerId: string;
  readonly deckTopFirst: readonly CardExtId[];
  readonly hand: readonly CardExtId[];
  readonly discard: readonly CardExtId[];
  readonly inPlay: readonly CardExtId[];
  readonly victory: readonly CardExtId[];
  readonly woundsByZone: OperatorWoundsByZone;
}

/** The remaining size of each shared supply pile. */
export interface OperatorSupplyCounts {
  readonly wounds: number;
  readonly bystanders: number;
  readonly officers: number;
  readonly sidekicks: number;
}

/** The whole-board operator read of an operator match. */
export interface OperatorView {
  readonly board: UIState;
  readonly currentStage: TurnStage;
  readonly seats: readonly OperatorSeatView[];
  readonly villainDeckTopFirst: readonly CardExtId[];
  readonly heroDeckTopFirst: readonly CardExtId[];
  readonly mastermindTacticsTopFirst: readonly CardExtId[];
  readonly supplyCounts: OperatorSupplyCounts;
  // why: WP-806 / D-24713 §5 — optional, present only once the operator has set a
  // supply card aside (G.operatorSetAside exists), so an older consumer's inline
  // OperatorView fixture still type-checks.
  /** Cards each supply pile has in the operator set-aside zone. Absent until the first decrease. */
  readonly setAsideCounts?: OperatorSupplyCounts;
  readonly koPile: readonly CardExtId[];
  readonly escapedPile: readonly CardExtId[];
  readonly counters: Readonly<Record<string, number>>;
  readonly cardDisplay: Readonly<Record<CardExtId, UICardDisplay>>;
}
