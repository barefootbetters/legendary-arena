/**
 * gauntletQualificationCheck.ts — does a draft's adversary composition qualify
 * as a gauntlet leg? (WP-454 / EC-489 / D-24274.)
 *
 * WP-444 lets a visitor prefill the approved villains/henchmen for a gauntlet
 * leg, but those fields stay editable, and a hand-built loadout has no guard at
 * all. Gauntlet-leg qualification is otherwise enforced only AFTER a match is
 * played — server-side at aggregation (`matchesApprovedLoadout`, WP-395/D-24199)
 * or, for an uncalibrated scenario, rejected at submission
 * (`par_not_published`). This helper moves that feedback to BUILD time: it
 * compares the current draft's villain/henchmen groups and player count against
 * the mastermind's approved loadout menu and reports whether the loadout would
 * count, so the builder can render a pre-play badge.
 *
 * It is a pure, data-injected, never-throw sibling of `loadoutGauntletPackImport.ts`
 * (which resolves a downloaded PACK into a prefill). It lives in its own module
 * because the qualification check applies to ANY draft — including a hand-built
 * one whose mastermind hosts a gauntlet — not only a pack-sourced one.
 *
 * The menu is passed in (the caller resolves it via `getGauntletLoadoutMenu`),
 * so this module needs no registry import and unit-tests against constructed
 * menus. Advisory only: a result is a prediction from the same approved-menu
 * data the server uses, never an adjudication — the server remains the sole
 * authority, and nothing here blocks building, editing, or exporting a loadout.
 */

import type {
  GauntletLoadoutMenu,
  GauntletLoadoutComposition,
} from "@legendary-arena/registry/gauntletLoadouts";
// why: WP-483 — the per-scheme leg composition the caller resolves via the
// browser-safe getGauntletConfig loader, injected here so this pure helper stays
// registry-loader-free (data-injected, like the menu). Type-only import.
import type { GauntletConfigComposition } from "@legendary-arena/registry/gauntletConfigs";
import type { SupportedPlayerCount } from "@legendary-arena/registry/playerCountSetup";

/** The draft facts a qualification check decides on, all data-injected. */
export interface GauntletQualificationInput {
  /** The draft's villain groups, set-qualified `setAbbr/slug` ext_ids (D-10014). */
  villainGroupIds: readonly string[];
  /** The draft's henchmen groups, set-qualified `setAbbr/slug` ext_ids (D-10014). */
  henchmanGroupIds: readonly string[];
  /** The draft's player count (envelope-level; a plain number, narrowed here). */
  playerCount: number;
  /**
   * The draft's scheme ext_id (`setAbbr/schemeSlug`), or `""` when no scheme is
   * picked. WP-483: this is the load-bearing PER-SCHEME selector — when it is
   * non-empty AND `approvedComposition` is present, the per-scheme branch fires
   * (qualify against that single leg config); otherwise the per-mastermind menu
   * path runs, as before.
   */
  schemeId: string;
  /**
   * The approved loadout menu for the draft's mastermind, or `undefined` when
   * the mastermind hosts no gauntlet. The caller resolves this via
   * `getGauntletLoadoutMenu(setAbbr, mastermindSlug)`.
   */
  menu: GauntletLoadoutMenu | undefined;
  /**
   * The leg's per-scheme approved composition (WP-483 / D-24283), resolved by the
   * caller via `getGauntletConfig(setAbbr, mastermindSlug, schemeSlug, count)`, or
   * `undefined` for an absent leg (non-Core / unswapped) — then the per-mastermind
   * menu path runs (the WP-472 `overlay ?? menu` model).
   */
  approvedComposition?: GauntletConfigComposition;
}

/**
 * The verdict for a draft's adversary composition:
 * - `not-a-gauntlet` — the mastermind hosts no gauntlet menu; there is no
 *   qualification claim to make (the caller renders no badge).
 * - `unoffered-count` — the gauntlet exists but offers no composition at the
 *   draft's player count.
 * - `qualifies` — the villain AND henchmen groups exactly match an approved
 *   variant's composition for the player count; `variantIndex` is that variant's
 *   stable index.
 * - `not-qualifying` — the gauntlet offers this player count but no variant
 *   matches; `approvedVariantCount` is how many approved variants offer the
 *   count (for the message).
 */
export type GauntletQualificationResult =
  | { status: "not-a-gauntlet" }
  | { status: "unoffered-count" }
  | { status: "qualifies"; variantIndex: number }
  | { status: "not-qualifying"; approvedVariantCount: number };

/**
 * Narrows a plain number to the `SupportedPlayerCount` closed set (1..5).
 *
 * why: `playerCount` is a plain envelope `number` (`setPlayerCount` does not
 * clamp), while `compositionsByPlayerCount` is keyed by `SupportedPlayerCount`.
 * Indexing that Record with an arbitrary number is a type error and, at runtime,
 * an out-of-range count has no composition — so guard explicitly and let the
 * caller map a non-supported count to `unoffered-count`, never an unchecked cast.
 *
 * @param playerCount the draft's raw player count.
 * @returns true when the count is an integer in 1..5.
 */
function isSupportedPlayerCount(
  playerCount: number,
): playerCount is SupportedPlayerCount {
  return Number.isInteger(playerCount) && playerCount >= 1 && playerCount <= 5;
}

/**
 * Whether two lists of ext_ids hold the same set of ids (order-insensitive).
 *
 * why: sort a SPREAD COPY of each side — never the input arrays. The draft's
 * `villainGroupIds` is a live reactive array in the caller; sorting it in place
 * would silently reorder the visitor's on-screen chips. Duplicates are not
 * expected in either list (groups are added once), so a length check plus a
 * sorted element-wise compare is an exact set-equality test.
 *
 * @param first one list of set-qualified ext_ids.
 * @param second the other list of set-qualified ext_ids.
 * @returns true when both hold exactly the same ids.
 */
function haveSameIdSet(
  first: readonly string[],
  second: readonly string[],
): boolean {
  if (first.length !== second.length) {
    return false;
  }
  const sortedFirst = [...first].sort();
  const sortedSecond = [...second].sort();
  for (let index = 0; index < sortedFirst.length; index += 1) {
    if (sortedFirst[index] !== sortedSecond[index]) {
      return false;
    }
  }
  return true;
}

/**
 * Whether a draft composition matches one approved composition exactly — both
 * the villain groups and the henchmen groups must be set-equal.
 *
 * why: this is the same qualification the server enforces at aggregation
 * (`matchesApprovedLoadout`), but compared on the FULL set-qualified ext_ids of
 * both dimensions rather than the server's bare-slug `ScenarioKey`
 * villain-segment. The draft and the menu both carry full ext_ids, so the client
 * check is exact and strictly stronger. It cannot report a false "won't count":
 * D-24131 (a leg's scheme and mastermind share one set) plus the server's own
 * exact set-qualified `henchman_key` comparison already collapse the only
 * divergent case (same bare slug, different set), so a client `qualifies`
 * implies the server would also match.
 *
 * @param draft the draft's villain + henchmen groups.
 * @param approved one approved composition for the player count.
 * @returns true when both group sets match exactly.
 */
function matchesComposition(
  draft: Pick<GauntletQualificationInput, "villainGroupIds" | "henchmanGroupIds">,
  approved: GauntletLoadoutComposition,
): boolean {
  return (
    haveSameIdSet(draft.villainGroupIds, approved.villainGroupIds) &&
    haveSameIdSet(draft.henchmanGroupIds, approved.henchmanGroupIds)
  );
}

/**
 * Checks whether a draft's adversary composition qualifies as a leg of the
 * draft mastermind's gauntlet, for a pre-play advisory badge. Never throws;
 * mutates nothing (the input arrays are read via spread copies).
 *
 * @param input the draft's villain/henchmen groups, player count, and the
 *   resolved approved menu (or `undefined` when the mastermind hosts no gauntlet).
 * @returns a discriminated qualification result.
 */
export function checkGauntletQualification(
  input: GauntletQualificationInput,
): GauntletQualificationResult {
  // why: WP-483 / D-24283 — the PER-SCHEME branch. When the caller resolved this
  // leg's per-scheme config (a non-empty schemeId AND an injected
  // approvedComposition), qualify the draft against THAT single leg config — one
  // canonical composition per leg, so a match reports variantIndex 0. This is the
  // WP-472 overlay: an absent leg (approvedComposition undefined) falls through to
  // the per-mastermind menu path below.
  if (input.schemeId !== "" && input.approvedComposition !== undefined) {
    if (matchesComposition(input, input.approvedComposition)) {
      return { status: "qualifies", variantIndex: 0 };
    }
    // why: exactly one approved composition for the leg, so a miss is a
    // one-variant not-qualifying (mirrors the menu path's count shape).
    return { status: "not-qualifying", approvedVariantCount: 1 };
  }
  if (input.menu === undefined) {
    return { status: "not-a-gauntlet" };
  }
  if (!isSupportedPlayerCount(input.playerCount)) {
    // why: an out-of-range player count has no approved composition anywhere;
    // report it the same as a gauntlet that does not offer the count.
    return { status: "unoffered-count" };
  }

  let offeredVariantCount = 0;
  for (const variant of input.menu.variants) {
    const approvedComposition =
      variant.compositionsByPlayerCount[input.playerCount];
    if (approvedComposition === undefined) {
      continue;
    }
    offeredVariantCount += 1;
    if (matchesComposition(input, approvedComposition)) {
      // why: report the variant's stable `variantIndex` field, not its array
      // position — the board and challenge links cite the index.
      return { status: "qualifies", variantIndex: variant.variantIndex };
    }
  }

  if (offeredVariantCount === 0) {
    return { status: "unoffered-count" };
  }
  return { status: "not-qualifying", approvedVariantCount: offeredVariantCount };
}
