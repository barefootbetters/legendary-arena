/**
 * Gauntlet display helpers — pure functions behind the WP-343 panels,
 * kept out of the Vue components so they are unit-testable under
 * node:test (the SPA has no component mount harness).
 */

import type { GauntletIndexEntry } from "../snapshots/snapshotClient";

/** One set's slice of the gauntlet index, for grouped rendering. */
export interface GauntletSetGroup {
  readonly setAbbr: string;
  readonly setName: string;
  readonly gauntlets: readonly GauntletIndexEntry[];
}

/**
 * Formats an integer centesimal PAR-relative average for display.
 *
 * @param averageScoreCentis The ×100 integer average from the snapshot.
 * @returns `E` for zero, else a signed one-decimal string
 *   (`+1.3`, `-3.5`).
 */
export function formatAverageScore(averageScoreCentis: number): string {
  // why: 'E' is the golf even-with-PAR convention the scoring model is
  // built on (VISION §20) — a bare '0.0' reads as "no score" rather
  // than "exactly at PAR".
  if (averageScoreCentis === 0) {
    return "E";
  }
  const oneDecimal = (averageScoreCentis / 100).toFixed(1);
  if (averageScoreCentis > 0) {
    return `+${oneDecimal}`;
  }
  return oneDecimal;
}

/**
 * Groups index entries by set, preserving the artifact's order (the
 * publisher emits setAbbr ASC, mastermind ASC — this function adds no
 * ordering of its own).
 *
 * @param gauntlets The index artifact's entries.
 * @returns Consecutive-set groups in artifact order.
 */
export function groupGauntletsBySet(
  gauntlets: readonly GauntletIndexEntry[],
): GauntletSetGroup[] {
  const groups: GauntletSetGroup[] = [];
  let currentGroup: {
    setAbbr: string;
    setName: string;
    gauntlets: GauntletIndexEntry[];
  } | null = null;

  for (const gauntlet of gauntlets) {
    if (currentGroup === null || currentGroup.setAbbr !== gauntlet.setAbbr) {
      currentGroup = {
        setAbbr: gauntlet.setAbbr,
        setName: gauntlet.setName,
        gauntlets: [],
      };
      groups.push(currentGroup);
    }
    currentGroup.gauntlets.push(gauntlet);
  }

  return groups;
}

/**
 * Composes the attract-cycle board list. When the manifest advertises a
 * gauntlet index, the cycle gains exactly ONE extra slide for it.
 *
 * @param boardNames The manifest's classic board names.
 * @param hasGauntletIndex Whether the manifest carries `gauntletIndex`.
 * @returns The board names the attract cycler should rotate through.
 */
export function buildAttractBoardList(
  boardNames: readonly string[],
  hasGauntletIndex: boolean,
): string[] {
  // why: exactly one slide, and never the per-gauntlet boards — 105
  // gauntlet boards in the rotation would starve the classic slides
  // (EC-373 §Locked Values; D-24131 §8a).
  if (hasGauntletIndex) {
    return [...boardNames, "gauntlet-index"];
  }
  return [...boardNames];
}
