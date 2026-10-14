/**
 * Operator setter gate, labels, argument readers and route classifier
 * (WP-806 / EC-843 / D-24713).
 *
 * The six operator setters (`operatorSetters.ts`) share these pure helpers. The
 * gate (`canRunOperatorSetter`) is the D-24689 §7 rule: an operator match, the
 * operator's own turn, the `main` stage and no open choice. The readers turn an
 * untrusted client payload into a typed value or `null`, and never throw.
 *
 * No boardgame.io import. No `.reduce()`. Never throws.
 */

import type { LegendaryGameState } from '../types.js';
import type { PlayerZones } from '../state/zones.types.js';
import type { TurnStage } from '../turn/turnPhases.types.js';
import { hasAnyPendingChoice } from './phaseCard.js';
import { OPERATOR_SUPPLY_PILES } from './operatorSetters.types.js';
import type {
  OperatorPlayerZoneName,
  OperatorSupplyPile,
  OperatorZoneRef,
} from './operatorSetters.types.js';

const OPERATOR_SETTER_STAGE: TurnStage = 'main';

/** The five player-owned zones, in display order. */
const OPERATOR_PLAYER_ZONE_NAMES: readonly OperatorPlayerZoneName[] = ['hand', 'deck', 'discard', 'inPlay', 'victory'];

/** The log label for each supply pile. */
export const PILE_LABEL: Readonly<Record<OperatorSupplyPile, string>> = {
  wounds: 'Wound',
  bystanders: 'Bystander',
  officers: 'S.H.I.E.L.D. Officer',
  sidekicks: 'Sidekick',
};

/** The log label for each player zone, after "Player N's". */
const PLAYER_ZONE_LABEL: Readonly<Record<OperatorPlayerZoneName, string>> = {
  hand: 'hand',
  deck: 'deck',
  discard: 'discard pile',
  inPlay: 'play area',
  victory: 'Victory Pile',
};

// why: D-24689 §7 / D-24713 §6 — a gain from a supply lands where the rules put that
// card: a gained Wound, Officer or Sidekick in the discard pile, a rescued Bystander
// in the Victory Pile.
/** The only player zone each supply pile may be gained into. */
const GAIN_DESTINATION: Readonly<Record<OperatorSupplyPile, OperatorPlayerZoneName>> = {
  wounds: 'discard',
  officers: 'discard',
  sidekicks: 'discard',
  bystanders: 'victory',
};

/** A player-zone reference: a zone a seat owns, plus that seat's id. */
export type OperatorPlayerZoneRef = Extract<OperatorZoneRef, { playerId: string }>;

/** The four closed `operatorMoveCard` routes (D-24713 §6). */
export type OperatorMoveRoute = 'gain-from-supply' | 'ko-from-player' | 'between-player-zones' | 'hero-to-hq';

/**
 * Whether any choice is open, which refuses every operator setter.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when a choice is open or queued to open after the move.
 */
export function isOperatorChoiceOpen(G: LegendaryGameState): boolean {
  // why: D-24713 §1 — hasAnyPendingChoice does not cover pendingHeroChoice (its callers
  // check it separately), and the Diving Block and escape-procedure queues are opened
  // into seat choices by turn.onMove after the move, so a non-empty queue is a choice
  // already owed. pendingTeleportReturns is a set-aside list that lasts the turn, not a
  // choice, so it does not block.
  if (hasAnyPendingChoice(G)) return true;
  if (G.pendingHeroChoice !== undefined) return true;
  if ((G.pendingDivingBlockWounds?.length ?? 0) > 0) return true;
  if ((G.pendingEscapeProcedures?.length ?? 0) > 0) return true;
  return false;
}

/**
 * Whether an operator setter may run now.
 *
 * @param G - The game state to inspect (not mutated).
 * @param currentPlayer - The framework's current player (`ctx.currentPlayer`).
 * @param playerID - The seat submitting the move.
 * @returns true only in an operator match, on the submitter's own turn, in `main`, with no choice open.
 */
export function canRunOperatorSetter(G: LegendaryGameState, currentPlayer: string, playerID: string): boolean {
  // why: D-24689 §7 — setters exist only in an operator match, on the operator's own
  // turn, in the `main` stage, with no choice open. The playerID check is explicit
  // because while a seat choice is open a non-active seat is admitted into the empty
  // resolvingSeatChoice stage, where the global move bag (these setters included)
  // applies; boardgame.io alone would let that seat submit a setter.
  if (G.isDebugMatch !== true) return false;
  if (playerID !== currentPlayer) return false;
  if (G.currentStage !== OPERATOR_SETTER_STAGE) return false;
  return !isOperatorChoiceOpen(G);
}

/**
 * Whether a value is a non-null object whose fields may be read.
 *
 * @param value - The untrusted value.
 * @returns true for any non-null object.
 */
export function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Whether a value is one of the four operator supply piles.
 *
 * @param value - The untrusted value.
 * @returns true for 'wounds', 'bystanders', 'officers' or 'sidekicks'.
 */
export function isOperatorSupplyPile(value: unknown): value is OperatorSupplyPile {
  return typeof value === 'string' && (OPERATOR_SUPPLY_PILES as readonly string[]).includes(value);
}

/**
 * Whether a value is one of the five player zone names.
 *
 * @param value - The untrusted value.
 * @returns true for 'hand', 'deck', 'discard', 'inPlay' or 'victory'.
 */
function isOperatorPlayerZoneName(value: unknown): value is OperatorPlayerZoneName {
  return typeof value === 'string' && (OPERATOR_PLAYER_ZONE_NAMES as readonly string[]).includes(value);
}

/**
 * Whether a value is the id of a seat in this match.
 *
 * @param G - The game state to inspect (not mutated).
 * @param value - The untrusted value.
 * @returns true when the value is an own key of `G.playerZones`.
 */
export function isKnownPlayerId(G: LegendaryGameState, value: unknown): value is string {
  // why: Object.hasOwn, not `in` or an index read — a client-sent 'constructor' or
  // '__proto__' must never reach Object.prototype.
  return typeof value === 'string' && Object.hasOwn(G.playerZones, value);
}

/**
 * Reads an untrusted zone reference into a typed `OperatorZoneRef`.
 *
 * @param G - The game state (for player ids and the HQ size; not mutated).
 * @param value - The untrusted `from` / `to` value.
 * @returns The typed reference, or `null` when any part is invalid.
 */
export function readOperatorZoneRef(G: LegendaryGameState, value: unknown): OperatorZoneRef | null {
  // why: moves never throw — the nested ref is checked as a non-null object before
  // any of its fields is read.
  if (!isObjectRecord(value)) return null;
  const zone = value.zone;
  if (isOperatorPlayerZoneName(zone)) {
    const playerId = value.playerId;
    if (!isKnownPlayerId(G, playerId)) return null;
    return { zone, playerId };
  }
  if (zone === 'ko') return { zone: 'ko' };
  if (zone === 'heroDeck') return { zone: 'heroDeck' };
  if (zone === 'hq') {
    const hqIndex = value.hqIndex;
    if (typeof hqIndex !== 'number' || !Number.isInteger(hqIndex)) return null;
    if (hqIndex < 0 || hqIndex >= G.hq.length) return null;
    return { zone: 'hq', hqIndex };
  }
  if (zone === 'supply') {
    const pile = value.pile;
    if (!isOperatorSupplyPile(pile)) return null;
    return { zone: 'supply', pile };
  }
  return null;
}

/**
 * Whether a zone reference names a player-owned zone.
 *
 * @param ref - A typed zone reference.
 * @returns true when the reference carries a player id.
 */
export function isPlayerZoneRef(ref: OperatorZoneRef): ref is OperatorPlayerZoneRef {
  return 'playerId' in ref;
}

/**
 * Classifies a `from` → `to` pair into one of the four closed routes.
 *
 * @param from - The typed source reference.
 * @param to - The typed destination reference.
 * @returns The route, or `null` when the pair is not allowed.
 */
export function classifyOperatorRoute(from: OperatorZoneRef, to: OperatorZoneRef): OperatorMoveRoute | null {
  if (from.zone === 'supply') {
    if (isPlayerZoneRef(to) && to.zone === GAIN_DESTINATION[from.pile]) return 'gain-from-supply';
    return null;
  }
  if (from.zone === 'heroDeck') {
    return to.zone === 'hq' ? 'hero-to-hq' : null;
  }
  if (!isPlayerZoneRef(from)) {
    return null;
  }
  if (to.zone === 'ko') return 'ko-from-player';
  // why: D-24713 §6 — no card lands in a play area without having been played, so
  // `inPlay` is a source only.
  if (isPlayerZoneRef(to) && to.zone !== 'inPlay') return 'between-player-zones';
  return null;
}

/**
 * Builds the log label for a zone reference.
 *
 * @param ref - A typed zone reference.
 * @param isDestination - Whether the zone is the move's destination (a deck destination is its top).
 * @returns The label, e.g. "Player 0's discard pile" or "HQ space 3".
 */
export function describeOperatorZone(ref: OperatorZoneRef, isDestination: boolean): string {
  if (isPlayerZoneRef(ref)) {
    if (isDestination && ref.zone === 'deck') return `the top of Player ${ref.playerId}'s deck`;
    return `Player ${ref.playerId}'s ${PLAYER_ZONE_LABEL[ref.zone]}`;
  }
  if (ref.zone === 'ko') return 'the KO pile';
  if (ref.zone === 'heroDeck') return 'the Hero Deck';
  if (ref.zone === 'hq') return `HQ space ${ref.hqIndex + 1}`;
  return `the ${PILE_LABEL[ref.pile]} supply`;
}

/**
 * Reads the zones of the seat a player-zone reference names.
 *
 * @param G - The game state (not mutated).
 * @param ref - A player-zone reference whose id passed `isKnownPlayerId`.
 * @returns That seat's zones, or undefined when absent.
 */
export function readSeatZones(G: LegendaryGameState, ref: OperatorPlayerZoneRef): PlayerZones | undefined {
  return G.playerZones[ref.playerId];
}
