/**
 * savedLoadoutLaunch.ts — turns a profile Saved Loadouts row's stored LAGN
 * document into the launch inputs for `launchMatchFromComposition`
 * (WP-303 / EC-851).
 *
 * Why the lobby's readers instead of a LAGN validator import: D-24087 keeps
 * the stored `lagn` opaque in arena-client. The client imports no LAGN
 * validator, and the server (which validates every write, D-24086) stays the
 * LAGN validation authority. D-24722 narrowly refines that for the launch
 * path only: the row's `lagn` runs through the same two hand-rolled shape
 * readers the lobby already applies to a pasted LAGN (`convertLagnUpload` →
 * `parseLoadoutJson`, D-24018 / WP-092), so a saved loadout launches exactly
 * as the same LAGN pasted into the lobby would. Game.setup() stays the ext_id
 * authority. The launch itself is a single call to the D-24268 primitive at
 * the call site; this module only plans it, reads nothing from the network,
 * and never throws.
 */

import { convertLagnUpload } from '../lobby/lagnLoadout';
import { parseLoadoutJson } from '../lobby/parseLoadoutJson';
import type { MatchConfiguration } from '@legendary-arena/game-engine';

/**
 * The outcome of planning a saved-loadout launch. On success, `config` and
 * `playerCount` go straight into `launchMatchFromComposition`. On failure,
 * `message` is a full-sentence explanation for the profile's error line.
 */
export type SavedLoadoutLaunchPlan =
  | { ok: true; config: MatchConfiguration; playerCount: number }
  | { ok: false; message: string };

/** Prefix for a LAGN document the readers recognize but cannot use. */
const UNREADABLE_LOADOUT_PREFIX = "This saved loadout can't be played. ";

/** Copy for a stored value that is not a LAGN document at all. */
const NOT_LAGN_MESSAGE =
  "This saved loadout can't be played. It is not a LAGN document; delete it and save it again from the loadout builder.";

/**
 * Plans a match launch from one saved loadout's stored LAGN document.
 *
 * Reads in the lobby's order: `JSON.stringify` → `convertLagnUpload` → on
 * `ok`, `parseLoadoutJson`. The Final Blow flag is added only when the LAGN
 * turns it on. Never throws for any value a JSON response can carry,
 * including `null` and a missing `lagn`.
 *
 * @param lagn - The row's opaque `lagn` value from `GET /api/me/loadouts`.
 * @returns The launch config and seat count, or a full-sentence message.
 */
export function planSavedLoadoutLaunch(lagn: unknown): SavedLoadoutLaunchPlan {
  const lagnText = JSON.stringify(lagn);
  // why: JSON.stringify returns undefined (not a string) for an undefined
  // input, a missing `lagn` field. Answer with the not-LAGN copy here rather
  // than relying on convertLagnUpload's parse catch to turn the text
  // "undefined" into not_lagn.
  if (typeof lagnText !== 'string') {
    return { ok: false, message: NOT_LAGN_MESSAGE };
  }

  const conversion = convertLagnUpload(lagnText);
  if (conversion.kind === 'not_lagn') {
    return { ok: false, message: NOT_LAGN_MESSAGE };
  }
  if (conversion.kind === 'error') {
    return { ok: false, message: UNREADABLE_LOADOUT_PREFIX + conversion.message };
  }

  const parsed = parseLoadoutJson(conversion.documentJson);
  if (parsed.ok === false) {
    return {
      ok: false,
      message: UNREADABLE_LOADOUT_PREFIX + parsed.error.message,
    };
  }

  const config: MatchConfiguration = {
    ...parsed.value.composition,
    // why: D-24658 — Final Blow is an envelope flag, omit-when-off, so a
    // normal loadout's config stays exactly the 9-field composition. This
    // mirrors the lobby's submitFromJson spread.
    ...(conversion.finalBlow ? { finalBlow: true } : {}),
  };
  return { ok: true, config, playerCount: parsed.value.playerCount };
}
