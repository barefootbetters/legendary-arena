/**
 * Charge (WP-874 / D-24820) — the pure City step for the rulebook Charge keyword.
 *
 * Rules v23 p.20 (keywords-full.json `charge`): "after this Villain enters the Sewers, it charges
 * forward an extra space, pushing other Villains forward. This might cause more escapes." One step
 * moves the charging Villain one space toward the escape edge; a Villain already on the destination
 * is pushed forward with the contiguous block ahead of it, and a card pushed past the last space
 * leaves the City.
 *
 * `charge` is the engine's one Charge primitive for villain-card Ambush Charge lines; the Ambush
 * bridge in `villainDeck/villainDeck.reveal.ts` (`chargeAmbushVillain`) applies this step once per
 * charged space and runs every escape through `resolveVillainEscape`.
 *
 * Pure helper: no boardgame.io import, no registry import, no `.reduce()`, never throws, never
 * mutates its input.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { CityZone } from './city.types.js';
import type { VillainChargePushConsequence } from '../rules/villainAbility.types.js';

/** What one charge step did to the City. */
export interface ChargeStepResult {
  /** The City after the step (a new array; the input is never mutated). */
  city: CityZone;
  /** True when the destination space was occupied, so the step pushed Villains forward. */
  hasPushedVillain: boolean;
  /** The card that left the City past the last space (a pushed Villain or the charger), or null. */
  escapedCardId: CardExtId | null;
  /** True when the charger itself left the City (it charged from the last space). */
  hasChargerEscaped: boolean;
}

/** What a whole charge did, as the Ambush bridge and the narrative read it. */
export interface ChargeOutcome {
  /** The steps after which the charger was still in the City. */
  spacesMoved: number;
  /** True when any step pushed a Villain forward. */
  hasPushedAnyVillain: boolean;
  /** True when the charger left the City. */
  hasChargerEscaped: boolean;
  /**
   * The push consequence the charge triggered (resolved inline by the bridge, or owed after the
   * move), or null when nothing was pushed or the line names no consequence.
   */
  triggeredPushConsequence: VillainChargePushConsequence | null;
}

/**
 * Moves the Villain on `fromIndex` one space toward the escape edge, pushing the contiguous block
 * ahead of it.
 *
 * - An out-of-range `fromIndex`, or an empty space there → an unchanged copy, nothing pushed.
 * - The charger on the last space → it leaves the City (`escapedCardId` is the charger).
 * - An empty destination → the charger moves into it.
 * - An occupied destination → the block from the destination up to the first empty space after
 *   it shifts one space forward; with no empty space, the last space's card leaves the City.
 *   Then the charger takes the destination.
 *
 * @param city - The current City (any size). Not mutated.
 * @param fromIndex - The charger's 0-based City index.
 * @returns The new City and what the step pushed or ejected.
 */
export function chargeCityVillainOneSpace(city: CityZone, fromIndex: number): ChargeStepResult {
  const newCity: CityZone = [...city];
  const unchanged: ChargeStepResult = {
    city: newCity,
    hasPushedVillain: false,
    escapedCardId: null,
    hasChargerEscaped: false,
  };
  if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= city.length) {
    return unchanged;
  }
  const chargerId = city[fromIndex];
  if (chargerId === null || chargerId === undefined) {
    return unchanged;
  }

  const lastIndex = city.length - 1;
  if (fromIndex === lastIndex) {
    // why: rules v23 L1117-1122 — the charge moves the Villain forward one more space; from the
    // last space, forward is out of the City, so the charger itself escapes.
    newCity[fromIndex] = null;
    return { city: newCity, hasPushedVillain: false, escapedCardId: chargerId, hasChargerEscaped: true };
  }

  const destinationIndex = fromIndex + 1;
  if (city[destinationIndex] === null) {
    newCity[destinationIndex] = chargerId;
    newCity[fromIndex] = null;
    return { city: newCity, hasPushedVillain: false, escapedCardId: null, hasChargerEscaped: false };
  }

  return pushBlockAheadAndCharge(city, newCity, fromIndex, destinationIndex, chargerId);
}

/**
 * Shifts the contiguous block that starts on the (occupied) destination one space forward, then
 * moves the charger onto the destination.
 *
 * @param city - The original City (read-only).
 * @param newCity - The copy being written (mutated: it is this step's own new array).
 * @param fromIndex - The charger's index.
 * @param destinationIndex - The occupied space the charger moves to.
 * @param chargerId - The charging card.
 * @returns The step result with `hasPushedVillain` true.
 */
function pushBlockAheadAndCharge(
  city: CityZone,
  newCity: CityZone,
  fromIndex: number,
  destinationIndex: number,
  chargerId: CardExtId,
): ChargeStepResult {
  // why: mirrors pushVillainIntoCity (board/city.logic.ts): only the contiguous block ahead of the
  // charger advances, and the first empty space after it absorbs the push, so a Villain beyond a
  // gap never moves. Only a block that reaches the escape edge ejects its last card.
  const lastIndex = city.length - 1;
  let firstEmptyIndex = -1;
  for (let spaceIndex = destinationIndex + 1; spaceIndex <= lastIndex; spaceIndex++) {
    if (city[spaceIndex] === null) {
      firstEmptyIndex = spaceIndex;
      break;
    }
  }

  let escapedCardId: CardExtId | null = null;
  let shiftTopIndex = firstEmptyIndex;
  if (firstEmptyIndex === -1) {
    escapedCardId = city[lastIndex] ?? null;
    shiftTopIndex = lastIndex;
  }
  // why: iterate top-down so each write reads the pre-shift value from the untouched input.
  for (let spaceIndex = shiftTopIndex; spaceIndex > destinationIndex; spaceIndex--) {
    newCity[spaceIndex] = city[spaceIndex - 1] ?? null;
  }
  newCity[destinationIndex] = chargerId;
  newCity[fromIndex] = null;
  return { city: newCity, hasPushedVillain: true, escapedCardId, hasChargerEscaped: false };
}
