/**
 * Sunlight / Moonlight — the day/night board state (WP-765 / D-24598).
 *
 * `computeDayNight` is the single shared authority for which of Sunlight or
 * Moonlight is in effect. It is read by the hero `sunlightInEffect` /
 * `moonlightInEffect` conditions, the fused `day-night-both` handler and the
 * `UIHQState.dayNight` projection, and it is the helper the villain-side
 * follow-up reuses.
 *
 * Pure: reads G, never mutates it, never throws. No boardgame.io imports.
 * No registry imports. No .reduce().
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/**
 * Which day/night state is in effect: Sunlight, Moonlight, or neither (a tie).
 */
export type DayNightState = 'sunlight' | 'moonlight' | 'neither';

/**
 * Computes whether Sunlight or Moonlight is in effect from the Heroes in the HQ.
 *
 * // why: rules v23 ~L1696-1731 — Moonlight is in effect when most Heroes in the
 * HQ have odd-numbered costs, Sunlight when most have even-numbered costs, and
 * neither on a tie (including an empty HQ). Only PRINTED costs count, so this
 * reads `G.cardStats[id].cost` (the setup-time printed cost) and never a runtime
 * cost modifier. Each non-null HQ slot is one card, so a Divided Card counts
 * once and Villains Haunting a Hero (which never occupy an HQ slot) don't count.
 * `null` (empty) slots are skipped.
 *
 * // why: tolerates an absent `G.hq` or `G.cardStats` (narrow test mocks, and the
 * minimal G slice `heroConditionHoldsForInPlay` reconstructs) by returning
 * 'neither' — conditions and projections must never throw. A slot whose card has
 * no `cardStats` row is skipped the same way (it has no printed cost to read).
 *
 * @param G - Current game state (read-only).
 * @returns 'moonlight' when odd costs outnumber even, 'sunlight' when even
 *   outnumber odd, otherwise 'neither'.
 */
export function computeDayNight(G: LegendaryGameState): DayNightState {
  const hq = G.hq as readonly (CardExtId | null)[] | undefined;
  const cardStats = G.cardStats as LegendaryGameState['cardStats'] | undefined;
  if (!Array.isArray(hq) || cardStats === undefined || cardStats === null) {
    return 'neither';
  }

  let oddCount = 0;
  let evenCount = 0;
  for (const slot of hq) {
    if (slot === null) {
      continue;
    }
    const statEntry = cardStats[slot];
    if (statEntry === undefined) {
      continue;
    }
    if (statEntry.cost % 2 === 0) {
      evenCount += 1;
    } else {
      oddCount += 1;
    }
  }

  if (oddCount > evenCount) {
    return 'moonlight';
  }
  if (evenCount > oddCount) {
    return 'sunlight';
  }
  return 'neither';
}
