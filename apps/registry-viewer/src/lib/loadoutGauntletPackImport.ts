/**
 * loadoutGauntletPackImport.ts — parse a Gauntlet Pack identity token and
 * resolve it into a prefilled leg loadout (WP-444 / EC-479 / D-24263).
 *
 * The Loadout Builder already imports MATCH-SETUP documents ("Load JSON") and
 * LAGN files ("Load LAGN"), but a WP-440 Gauntlet Pack is neither: it is the
 * tiny identity token `{ pack_version, gauntlet: { setAbbr, mastermindSlug,
 * division, playerCount } }` a player downloads on the legends site to declare
 * WHICH gauntlet they want to start. It carries no legs, no heroes, and no
 * adversary composition. This module is the cards-side consumer that turns that
 * token into a prefilled builder draft, entirely client-side from the registry
 * the viewer already bundles — zero API, no server call.
 *
 * `parseGauntletPack` validates a pasted/uploaded pack via the registry's
 * strict `validateGauntletPack` (catching its throw and surfacing the
 * full-sentence message). `resolveGauntletLegLoadout` cross-checks the pack's
 * gauntlet against the approved `GAUNTLET_LOADOUT_MENUS` (passed in) and returns
 * the villain/henchmen composition for the picked leg, or a friendly
 * closed-set reason. `listGauntletLegSchemeIds` maps a set's scheme cards to
 * their leg ext_ids for the picker.
 *
 * Pure helper module: no Vue reactivity, no I/O beyond `JSON.parse`, no engine /
 * server / game-framework import. The registry symbols it uses come through the
 * narrow browser-safe subpaths (`/gauntletPack`, `/gauntletLoadouts`,
 * `/playerCountSetup`) — never the `@legendary-arena/registry` root barrel,
 * which pulls Node built-ins that break the Vite browser build. Neither exported
 * function throws; both return discriminated `{ ok }` results the caller applies
 * to the draft via the existing `UseLoadoutDraftApi` setters.
 */

import {
  validateGauntletPack,
  type GauntletPack,
} from "@legendary-arena/registry/gauntletPack";
import type {
  GauntletLoadoutMenu,
  GauntletLoadoutVariant,
} from "@legendary-arena/registry/gauntletLoadouts";
// why: WP-483 — the leg's per-scheme approved composition the caller resolves via
// the browser-safe getGauntletConfig loader, injected so this pure helper stays
// registry-loader-free. Type-only import (no Node built-ins reach the browser build).
import type { GauntletConfigComposition } from "@legendary-arena/registry/gauntletConfigs";
import type { SupportedPlayerCount } from "@legendary-arena/registry/playerCountSetup";

/** The result of parsing a pasted/uploaded Gauntlet Pack. */
export type ParseGauntletPackResult =
  | { ok: true; pack: GauntletPack }
  | { ok: false; error: string };

/**
 * The builder prefill a resolved gauntlet leg produces, in the MATCH-SETUP
 * composition field names (00.2 §8.1). Every id is a set-qualified `setAbbr/slug`
 * ext_id (D-10014). `heroDeckIds` is intentionally absent — the visitor brings
 * their own heroes.
 */
export interface GauntletLegPrefill {
  schemeId: string;
  mastermindId: string;
  villainGroupIds: string[];
  henchmanGroupIds: string[];
  playerCount: SupportedPlayerCount;
}

/**
 * The closed set of reasons a gauntlet leg cannot be resolved:
 * - `unknown-gauntlet` — no approved menu exists for the pack's
 *   `(setAbbr, mastermindSlug)` pair.
 * - `unoffered-count` — the menu exists but carries no composition for the
 *   pack's player count.
 * - `unknown-variant` — the requested variant index is not among the menu's
 *   variants.
 */
export type ResolveGauntletLegReason =
  | "unknown-gauntlet"
  | "unoffered-count"
  | "unknown-variant";

/** The result of resolving a picked gauntlet leg into a builder prefill. */
export type ResolveGauntletLegResult =
  | { ok: true; prefill: GauntletLegPrefill }
  | { ok: false; reason: ResolveGauntletLegReason; message: string };

/** The inputs `resolveGauntletLegLoadout` needs, all data-injected. */
export interface ResolveGauntletLegInput {
  /** The validated pack whose gauntlet identity is being resolved. */
  pack: GauntletPack;
  /** The picked leg's scheme ext_id ("{setAbbr}/{schemeSlug}"). */
  schemeId: string;
  /**
   * The approved menu for the pack's `(setAbbr, mastermindSlug)`, or `undefined`
   * when the pair hosts no gauntlet. Passed in (looked up via
   * `getGauntletLoadoutMenu`) so this resolver is testable without a live
   * registry.
   */
  menu: GauntletLoadoutMenu | undefined;
  /**
   * The leg's per-scheme approved composition (WP-483 / D-24283), resolved by the
   * caller via `getGauntletConfig(setAbbr, mastermindSlug, schemeSlug-from-schemeId,
   * playerCount)`. When present, the prefill uses THIS leg config; when `undefined`
   * (an absent leg — non-Core / unswapped) it falls back to the scheme-blind menu
   * variant below (the WP-472 `overlay ?? menu` model).
   */
  approvedComposition?: GauntletConfigComposition;
  /** The chosen variant index; defaults to `0`. */
  variantIndex?: number;
}

/**
 * Parses pasted/uploaded text as a Gauntlet Pack and validates it.
 *
 * Returns `{ ok: false, error }` with a full-sentence message when the text is
 * not JSON, or is not a valid v1 pack — a MATCH-SETUP document, a LAGN file, or
 * a future-version pack pasted into the gauntlet box is rejected loudly (they
 * lack `pack_version` / `gauntlet` or declare a version this build cannot read).
 *
 * @param jsonText - The raw text of a `.gauntlet.json` pack (or pasted JSON).
 * @returns A discriminated result; never throws.
 */
export function parseGauntletPack(jsonText: string): ParseGauntletPackResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (parseFailure) {
    const message =
      parseFailure instanceof Error ? parseFailure.message : String(parseFailure);
    return {
      ok: false,
      error: `The pasted text could not be parsed as JSON: ${message}`,
    };
  }
  // why: delegate detection AND validation entirely to the registry's strict
  // validateGauntletPack (major-version reject, no unknown keys) — this module
  // adds no second schema and no lax pre-check. The validator throws a
  // full-sentence Error on any failure; catch it here and surface its message so
  // a bad pack shows friendly text, never an unhandled exception.
  try {
    const pack = validateGauntletPack(parsed);
    return { ok: true, pack };
  } catch (validationFailure) {
    const message =
      validationFailure instanceof Error
        ? validationFailure.message
        : String(validationFailure);
    return { ok: false, error: message };
  }
}

/**
 * Finds a menu variant by its stable `variantIndex` (not its array position).
 *
 * @param menu - The approved menu for the gauntlet.
 * @param variantIndex - The variant index to find.
 * @returns The matching variant, or `undefined` when the index is not offered.
 */
function findVariantByIndex(
  menu: GauntletLoadoutMenu,
  variantIndex: number,
): GauntletLoadoutVariant | undefined {
  for (const variant of menu.variants) {
    if (variant.variantIndex === variantIndex) {
      return variant;
    }
  }
  return undefined;
}

/**
 * Resolves a picked gauntlet leg into a builder prefill, cross-checking the
 * pack's gauntlet against the approved menu.
 *
 * The villains and henchmen come from the chosen variant's composition for the
 * pack's player count — the AUTHORITATIVE leg composition, not the mastermind's
 * default Always-Leads set. `mastermindId` is rebuilt as
 * `"{setAbbr}/{mastermindSlug}"`; `schemeId` is the picked leg; `heroDeckIds` is
 * omitted (bring your own heroes). On any mismatch it returns a closed-set
 * `reason` with a full-sentence message rather than throwing.
 *
 * @param input - The data-injected pack, picked leg, menu, and variant index.
 * @returns A discriminated result; never throws.
 */
export function resolveGauntletLegLoadout(
  input: ResolveGauntletLegInput,
): ResolveGauntletLegResult {
  // why: variant 0 is the default because it is the approved baseline
  // composition for a gauntlet; the picker may offer the menu's other variants,
  // but a leg resolves against variant 0 unless the visitor selects another.
  const chosenVariantIndex = input.variantIndex ?? 0;
  const { setAbbr, mastermindSlug, playerCount } = input.pack.gauntlet;
  const mastermindId = `${setAbbr}/${mastermindSlug}`;

  // why: WP-483 / D-24283 — the PER-SCHEME prefill. When the caller resolved this
  // leg's per-scheme config (via getGauntletConfig on input.schemeId's slug), use
  // it directly — the leg's OWN approved adversaries (a Secret-Invasion leg fills
  // Skrulls), not the scheme-blind menu variant. Copy into fresh arrays so the
  // prefill never aliases the registry's readonly composition; heroes + supply
  // stay at blank-draft defaults, as in the menu path. An absent leg (non-Core /
  // unswapped) leaves approvedComposition undefined and falls through to the menu.
  if (input.approvedComposition !== undefined) {
    return {
      ok: true,
      prefill: {
        schemeId: input.schemeId,
        mastermindId,
        villainGroupIds: [...input.approvedComposition.villainGroupIds],
        henchmanGroupIds: [...input.approvedComposition.henchmanGroupIds],
        playerCount,
      },
    };
  }

  if (input.menu === undefined) {
    return {
      ok: false,
      reason: "unknown-gauntlet",
      message: `The gauntlet "${mastermindId}" is not in this build's registry, so there is no approved composition to prefill. Check that the pack came from this game and that its set is loaded.`,
    };
  }

  const chosenVariant = findVariantByIndex(input.menu, chosenVariantIndex);
  if (chosenVariant === undefined) {
    return {
      ok: false,
      reason: "unknown-variant",
      message: `Variant ${chosenVariantIndex} is not offered for the "${mastermindId}" gauntlet, which has ${input.menu.variants.length} approved variant(s). Pick one of the offered variants.`,
    };
  }

  const composition = chosenVariant.compositionsByPlayerCount[playerCount];
  if (composition === undefined) {
    return {
      ok: false,
      reason: "unoffered-count",
      message: `The "${mastermindId}" gauntlet does not offer a ${playerCount}-player composition for variant ${chosenVariantIndex}. Re-export the pack for a supported player count.`,
    };
  }

  // why: the resolved variant's villains/henchmen are the authoritative leg
  // composition; copy them into fresh arrays so the prefill never aliases the
  // registry's readonly composition. heroDeckIds and the four supply-pile counts
  // are intentionally NOT part of the prefill: heroes are left empty (bring your
  // own), and the supply piles stay at the builder's blank-draft defaults
  // (30/30/30/0) rather than being read from PLAYER_COUNT_SETUP, which carries
  // only heroCount, not the four supply counts.
  return {
    ok: true,
    prefill: {
      schemeId: input.schemeId,
      mastermindId,
      villainGroupIds: [...composition.villainGroupIds],
      henchmanGroupIds: [...composition.henchmanGroupIds],
      playerCount,
    },
  };
}

/**
 * Maps a set's scheme cards to their leg ext_ids for the picker.
 *
 * The schemes are injected (from `registry.query({ setAbbr, cardType: 'scheme' })`)
 * so this helper is testable without a live registry. Each scheme's `extId` is
 * the set-qualified `"{setAbbr}/{schemeSlug}"` id a leg loadout stores. Entries
 * whose ext_id is not in the requested set, and duplicate ext_ids, are skipped.
 *
 * @param setAbbr - The gauntlet's home-set abbreviation (its legs' set).
 * @param schemes - The set's scheme cards (each carrying an `extId`).
 * @returns The leg scheme ext_ids, in the order the schemes were supplied.
 */
export function listGauntletLegSchemeIds(
  setAbbr: string,
  schemes: ReadonlyArray<{ extId: string }>,
): string[] {
  const setPrefix = `${setAbbr}/`;
  const schemeIds: string[] = [];
  for (const scheme of schemes) {
    if (!scheme.extId.startsWith(setPrefix)) {
      continue;
    }
    if (schemeIds.includes(scheme.extId)) {
      continue;
    }
    schemeIds.push(scheme.extId);
  }
  return schemeIds;
}
