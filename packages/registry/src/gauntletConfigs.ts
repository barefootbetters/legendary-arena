/**
 * gauntletConfigs.ts — the year-keyed per-scheme gauntlet config loader
 * (WP-471 / EC-506 — per-scheme gauntlet variety, arc 1/5; browser-safe data
 * source added by WP-483 / EC-518).
 *
 * Exposes a per-(set × mastermind × scheme × player-count) lookup of the approved
 * adversary composition, over the hand-authored `data/gauntlet-configs.json` baked
 * into `gauntletConfigs.generated.ts` (WP-483). The file varies a mastermind's
 * approved villains and henchmen BY SCHEME, so a mastermind's gauntlet legs are no
 * longer identical scheme-to-scheme.
 *
 * why a baked literal, not `readFileSync` (WP-483): the loader originally read the
 * JSON from disk at module load, which pulled `node:fs` into the load path and
 * broke apps/registry-viewer's Vite BROWSER build (which needs this for the cards
 * qualification badge + pack prefill). The generator `scripts/generate-gauntlet-configs.mjs`
 * bakes the parsed JSON into `gauntletConfigs.generated.ts`; this module validates
 * that literal at load. `data/gauntlet-configs.json` stays the source of truth —
 * revisions are data edits, and the generated literal is regenerated + drift-gated.
 *
 * why the JSON is the source of truth: the compositions are hand-authored data
 * (authored under #1116; revisions are data edits, not a code change). This module
 * is the registry LOADER over that data. The downstream packets (WP-472 server
 * truth + leaderboard, WP-473 run-tracker + launch, WP-474 legends-board, WP-475
 * arena-client, WP-483 cards) consume it.
 *
 * why the loader resolves an absent leg through the generated menu's
 * `schemeOverrides`, else `undefined` (rather than a synthesized default): the
 * authored file covers only the sets/masterminds/schemes that carry curated
 * per-scheme variety (Core today). A leg with no authored config whose scheme
 * prints "Add an extra Henchman group" (D-24666 — msp1 Asgard Under Siege, vnom
 * Invasion of the Venom Symbiotes) returns the per-mastermind menu's generated
 * `schemeOverrides` entry (variant 0 plus one henchmen group, emitted by
 * `scripts/generate-gauntlet-loadouts.mjs`), so its approved composition is legal
 * under the scheme-aware Henchman requirement. Every other non-authored leg
 * returns `undefined` and the consumer falls back to the per-mastermind
 * `GAUNTLET_LOADOUT_MENUS` (the WP-472 absent-scheme → menu-fallback model). The
 * loader never invents a composition: both sources are generated or authored data.
 *
 * why the henchmen slice is scheme-effective (D-24666): an authored leg's
 * henchmen are sliced by `resolveEffectiveHenchmenCount` (base + 1 for the
 * extra-Henchman schemes), not the bare table value, so the four Core Negative
 * Zone Prison Breakout pools carry a third entry (`core/sentinel`) that makes
 * 4–5 players (3 groups) satisfiable. `validateGauntletConfigs` rejects a pool
 * too short for its scheme's 5-player effective count.
 *
 * why the year key exists but only the active year is exposed: the file is keyed
 * by championship year so a future annual rollover can add a new year's block
 * without disturbing prior years, but the loader deliberately exposes ONLY the
 * active year (`activeYear`). Archival/rollover (reading a prior year) is deferred
 * — there is no consumer for it yet.
 *
 * Layer: Registry. Imports `zod`, `./playerCountSetup.js`, `./gauntletLoadouts.js`
 * (the generated per-mastermind menu, for its `schemeOverrides`), and the generated
 * literal only — NO Node built-ins (browser-safe, per WP-483), and never the game
 * engine, server, `pg`, any `apps/*` package, or `boardgame.io`. Composition ext_ids are
 * full D-10014 `setAbbr/slug` ids (a group's real home set, which is not always
 * the parent set — cross-set core-fallback groups keep their source qualifier),
 * and the loader returns them as-is.
 */

import { z } from "zod";
import {
  PLAYER_COUNT_SETUP,
  getPlayerCountSetup,
  resolveEffectiveHenchmenCount,
} from "./playerCountSetup.js";
import type { SupportedPlayerCount } from "./playerCountSetup.js";
// why: D-24666 — a leg with no authored config reads the generated per-mastermind
// menu's `schemeOverrides` (the extra-Henchman schemes' scheme-aware compositions).
// gauntletLoadouts.js imports only its generated literal (browser-safe, no Node
// built-ins) and never this module, so the import creates no cycle.
import { getGauntletLoadoutMenu } from "./gauntletLoadouts.js";
// why: WP-483 — the config data is baked into a generated TS literal
// (gauntletConfigs.generated.ts, from data/gauntlet-configs.json) instead of read
// from disk at module load. This drops the only Node dependency (node:fs) so the
// module is browser-safe and can be exposed via the ./gauntletConfigs subpath for
// apps/registry-viewer's Vite build; freshness is guarded by the in-test
// deep-equal assertion in gauntletConfigs.test.ts (CI) + `pnpm gauntlet:configs:check`.
import { GAUNTLET_CONFIGS_DATA } from "./gauntletConfigs.generated.js";

/**
 * One authored gauntlet leg: the ordered villain and henchman pools (full
 * set-qualified ext_ids) for one (set × mastermind × scheme), plus display
 * metadata. Each pool is an inclusion-priority list — the loader takes its first
 * N for a given player count — sized to the 5-player superset. `variety` is a
 * human-readable note when the leg deviates from the mastermind's base pools, or
 * `null` when it reproduces them.
 */
export interface GauntletConfigLeg {
  readonly schemeName: string;
  readonly villainPool: readonly string[];
  readonly henchmanPool: readonly string[];
  readonly variety: string | null;
}

/**
 * One mastermind's authored config: its display name, printed Always-Leads anchor
 * (`anchorVillainGroup | anchorHenchmanGroup (exactly one)`), base pools, and the
 * per-scheme legs.
 */
export interface GauntletMastermindConfig {
  readonly mastermindName: string;
  readonly anchorVillainGroup?: string | undefined;
  readonly anchorHenchmanGroup?: string | undefined;
  readonly baseVillainPool: readonly string[];
  readonly baseHenchmanPool: readonly string[];
  readonly schemes: Readonly<Record<string, GauntletConfigLeg>>;
}

/** One set's authored config: its display name and its masterminds. */
export interface GauntletSetConfig {
  readonly setName: string;
  readonly masterminds: Readonly<Record<string, GauntletMastermindConfig>>;
}

/** One championship year's authored config: a label and its sets. */
export interface GauntletYearConfig {
  readonly label: string;
  readonly sets: Readonly<Record<string, GauntletSetConfig>>;
}

/**
 * The file's documented slicing table: how many villain and henchmen groups a
 * pool is sliced to for each player count. Mirrors `PLAYER_COUNT_SETUP` (the
 * canonical source the loader actually slices by); kept in the file for
 * self-documentation and guarded against drift by the test.
 */
export interface GauntletSlicing {
  readonly note: string;
  readonly villainGroupCountByPlayerCount: Readonly<Record<string, number>>;
  readonly henchmanGroupCountByPlayerCount: Readonly<Record<string, number>>;
}

/**
 * The whole gauntlet-configs file: a schema stamp, a description, the active
 * championship year, the slicing table, and the year-keyed configs.
 * `years[year].sets[setAbbr].masterminds[mastermindSlug].schemes[schemeSlug]`
 * resolves to one leg.
 */
export interface GauntletConfigsFile {
  readonly schemaVersion: number;
  readonly description: string;
  readonly activeYear: string;
  readonly slicing: GauntletSlicing;
  readonly years: Readonly<Record<string, GauntletYearConfig>>;
}

/**
 * The scaled composition the loader returns for one leg at one player count:
 * the approved villain and henchmen groups, as full set-qualified ext_ids in the
 * canonical `villainGroupIds` / `henchmanGroupIds` field names
 * (00.2-data-requirements.md §8.1).
 */
export interface GauntletConfigComposition {
  readonly villainGroupIds: readonly string[];
  readonly henchmanGroupIds: readonly string[];
}

/** The strict Zod schema for one authored leg. */
const GauntletConfigLegSchema = z
  .object({
    schemeName: z.string().min(1),
    villainPool: z.array(z.string().min(1)).min(1),
    henchmanPool: z.array(z.string().min(1)).min(1),
    variety: z.string().min(1).nullable(),
  })
  .strict();

/** The strict Zod schema for one mastermind's config. */
const GauntletMastermindConfigSchema = z
  .object({
    mastermindName: z.string().min(1),
    anchorVillainGroup: z.string().min(1).optional(),
    anchorHenchmanGroup: z.string().min(1).optional(),
    baseVillainPool: z.array(z.string().min(1)).min(1),
    baseHenchmanPool: z.array(z.string().min(1)).min(1),
    schemes: z.record(z.string(), GauntletConfigLegSchema),
  })
  .strict();

/** The strict Zod schema for one set's config. */
const GauntletSetConfigSchema = z
  .object({
    setName: z.string().min(1),
    masterminds: z.record(z.string(), GauntletMastermindConfigSchema),
  })
  .strict();

/** The strict Zod schema for one year's config. */
const GauntletYearConfigSchema = z
  .object({
    label: z.string().min(1),
    sets: z.record(z.string(), GauntletSetConfigSchema),
  })
  .strict();

/** The strict Zod schema for the slicing table. */
const GauntletSlicingSchema = z
  .object({
    note: z.string(),
    villainGroupCountByPlayerCount: z.record(z.string(), z.number().int().positive()),
    henchmanGroupCountByPlayerCount: z.record(z.string(), z.number().int().positive()),
  })
  .strict();

/** The strict Zod schema for the whole file. */
const GauntletConfigsFileSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    description: z.string(),
    activeYear: z.string().min(1),
    slicing: GauntletSlicingSchema,
    years: z.record(z.string(), GauntletYearConfigSchema),
  })
  .strict();

/**
 * Formats a Zod validation failure into a single readable sentence fragment
 * listing each offending path and its message.
 *
 * @param error the Zod error to describe.
 * @returns a `;`-joined list of `path: message` entries.
 */
function describeSchemaIssues(error: z.ZodError): string {
  const descriptions: string[] = [];
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    descriptions.push(`${path}: ${issue.message}`);
  }
  return descriptions.join("; ");
}

/**
 * Validates unknown input as a gauntlet-configs file, returning the typed file
 * or throwing a full-sentence `Error` describing what failed.
 *
 * Beyond the structural schema, this enforces that `activeYear` is actually a key
 * present in `years` — a file whose active year points at a missing block is
 * malformed even though every field is individually well-typed — and that every
 * leg's `henchmanPool` is long enough for its scheme's 5-player effective
 * Henchman count (D-24666).
 *
 * @param input the untrusted value to validate (for example a parsed JSON file).
 * @returns the validated gauntlet-configs file.
 * @throws Error on any shape violation, a dangling active year, or a short
 *   henchman pool.
 */
export function validateGauntletConfigs(input: unknown): GauntletConfigsFile {
  const result = GauntletConfigsFileSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `This value is not a valid gauntlet-configs file: ${describeSchemaIssues(result.error)}. ` +
        `A valid file is { schemaVersion, description, activeYear, slicing, years: { "<year>": ` +
        `{ label, sets: { "<setAbbr>": { setName, masterminds: { "<mastermindSlug>": ` +
        `{ mastermindName, anchorVillainGroup | anchorHenchmanGroup (exactly one), ` +
        `baseVillainPool, baseHenchmanPool, schemes: ` +
        `{ "<schemeSlug>": { schemeName, villainPool, henchmanPool, variety } } } } } } } } } ` +
        `with no other keys.`,
    );
  }
  const file = result.data;
  if (file.years[file.activeYear] === undefined) {
    throw new Error(
      `The gauntlet-configs file declares activeYear "${file.activeYear}", but there is no ` +
        `years["${file.activeYear}"] block. Add the active year's block or point activeYear at a ` +
        `year that exists (${Object.keys(file.years).join(", ") || "no years present"}).`,
    );
  }
  assertExactlyOneAnchor(file);
  assertHenchmanPoolsCoverEffectiveCount(file);
  return file;
}

/**
 * Throws a full-sentence `Error` naming the set and mastermind of the first
 * config that carries neither or both of `anchorVillainGroup` /
 * `anchorHenchmanGroup`.
 *
 * why: Dr. Doom's printed Always Leads is a Henchman group (Doombot Legion,
 * D-24667), so the anchor may be either kind — but a config records exactly one
 * printed lead, never zero and never two.
 *
 * @param file the structurally valid gauntlet-configs file.
 * @throws Error when any mastermind config has no anchor or two anchors.
 */
function assertExactlyOneAnchor(file: GauntletConfigsFile): void {
  for (const yearConfig of Object.values(file.years)) {
    for (const [setAbbr, setConfig] of Object.entries(yearConfig.sets)) {
      for (const [mastermindSlug, mastermindConfig] of Object.entries(setConfig.masterminds)) {
        const hasVillainAnchor = mastermindConfig.anchorVillainGroup !== undefined;
        const hasHenchmanAnchor = mastermindConfig.anchorHenchmanGroup !== undefined;
        if (hasVillainAnchor === hasHenchmanAnchor) {
          throw new Error(
            `The gauntlet config for set "${setAbbr}", mastermind "${mastermindSlug}" must carry ` +
              `exactly one of anchorVillainGroup or anchorHenchmanGroup (its printed Always-Leads ` +
              `group), but it has ${hasVillainAnchor ? "both" : "neither"}. Fix that mastermind in ` +
              `data/gauntlet-configs.json and run \`pnpm gauntlet:configs\`.`,
          );
        }
      }
    }
  }
}

/**
 * Throws a full-sentence `Error` naming the set, mastermind and scheme of the
 * first leg whose `henchmanPool` is shorter than its scheme's 5-player effective
 * Henchman count.
 *
 * why: D-24666 — `getGauntletConfig` slices a leg's henchmen by the
 * scheme-effective count (base + 1 for the "Add an extra Henchman group"
 * schemes), so a pool shorter than the largest (5-player) effective count would
 * silently yield an illegal composition. The bound comes from the table and the
 * resolver; no table value is hard-coded here.
 *
 * @param file the structurally valid gauntlet-configs file.
 * @throws Error when any leg's henchman pool is too short.
 */
function assertHenchmanPoolsCoverEffectiveCount(file: GauntletConfigsFile): void {
  for (const yearConfig of Object.values(file.years)) {
    for (const [setAbbr, setConfig] of Object.entries(yearConfig.sets)) {
      for (const [mastermindSlug, mastermindConfig] of Object.entries(setConfig.masterminds)) {
        for (const [schemeSlug, leg] of Object.entries(mastermindConfig.schemes)) {
          const requiredPoolLength = resolveEffectiveHenchmenCount(
            `${setAbbr}/${schemeSlug}`,
            5,
            PLAYER_COUNT_SETUP[5].henchmenGroupCount,
          );
          if (leg.henchmanPool.length < requiredPoolLength) {
            throw new Error(
              `The gauntlet leg for set "${setAbbr}", mastermind "${mastermindSlug}", scheme ` +
                `"${schemeSlug}" has a henchmanPool of ${leg.henchmanPool.length} groups, but the ` +
                `scheme requires ${requiredPoolLength} Henchman groups at 5 players. Add groups to ` +
                `that leg's henchmanPool in data/gauntlet-configs.json and run \`pnpm gauntlet:configs\`.`,
            );
          }
        }
      }
    }
  }
}

// why: validate the baked literal once at module load (registry setup-time throw
// is allowed) — the same validate-at-load semantics the file-read path had, now
// on the in-memory generated literal instead of a `readFileSync`. A malformed
// literal (a stale/hand-edited generated module) is a deploy-blocking error
// surfaced loudly here; `validateGauntletConfigs` throws a full-sentence message.
// The literal's freshness against data/gauntlet-configs.json is guarded by the
// in-test deep-equal assertion (CI) + `pnpm gauntlet:configs:check` — not at runtime.
const GAUNTLET_CONFIGS: GauntletConfigsFile = validateGauntletConfigs(
  GAUNTLET_CONFIGS_DATA,
);

/**
 * Returns the active championship year the loader reads from.
 *
 * @returns the active year (for example "2026").
 */
export function getActiveYear(): string {
  return GAUNTLET_CONFIGS.activeYear;
}

/**
 * Resolves the approved composition for one gauntlet leg at one player count:
 * the authored per-scheme config when one exists, else the generated menu's
 * scheme override (D-24666), else `undefined`.
 *
 * Authored leg: its ordered pools are scaled to the player count by taking the
 * first `villainGroupCount` groups from `PLAYER_COUNT_SETUP` (the single canonical
 * per-count sizing, WP-370 / D-24165) and the first scheme-effective Henchman
 * count — `resolveEffectiveHenchmenCount`, which is the table's
 * `henchmenGroupCount` for most schemes and base + 1 for the "Add an extra
 * Henchman group" schemes (D-24666). The stored ext_ids are already set-qualified
 * and are returned unchanged.
 *
 * No authored leg: when the mastermind's generated `GAUNTLET_LOADOUT_MENUS` entry
 * carries a `schemeOverrides` entry for the scheme (an extra-Henchman scheme in
 * the mastermind's own set — msp1 Asgard Under Siege, vnom Invasion of the Venom
 * Symbiotes), that composition is returned: variant 0's villains and one more
 * henchmen group. Otherwise `undefined` is returned — when the active year has no
 * block for the set, the set has no config for the mastermind, the mastermind has
 * no authored leg for the scheme, or the player count is out of range — meaning
 * "no per-scheme override": the consumer falls back to the per-mastermind
 * `GAUNTLET_LOADOUT_MENUS` (the WP-472 absent-scheme → menu-fallback model).
 *
 * @param setAbbr the gauntlet's home set abbreviation.
 * @param mastermindSlug the gauntlet's mastermind slug.
 * @param schemeSlug the leg's scheme slug.
 * @param playerCount the player count to size the composition for.
 * @returns the scaled composition, or `undefined` when no override or count applies.
 */
export function getGauntletConfig(
  setAbbr: string,
  mastermindSlug: string,
  schemeSlug: string,
  playerCount: SupportedPlayerCount,
): GauntletConfigComposition | undefined {
  const yearBlock = GAUNTLET_CONFIGS.years[GAUNTLET_CONFIGS.activeYear];
  const leg = yearBlock?.sets?.[setAbbr]?.masterminds?.[mastermindSlug]?.schemes?.[schemeSlug];
  if (leg === undefined) {
    return getMenuSchemeOverride(setAbbr, mastermindSlug, schemeSlug, playerCount);
  }
  const setupRow = getPlayerCountSetup(playerCount);
  if (setupRow === undefined) {
    return undefined;
  }
  const henchmenGroupCount = resolveEffectiveHenchmenCount(
    `${setAbbr}/${schemeSlug}`,
    playerCount,
    setupRow.henchmenGroupCount,
  );
  return {
    villainGroupIds: leg.villainPool.slice(0, setupRow.villainGroupCount),
    henchmanGroupIds: leg.henchmanPool.slice(0, henchmenGroupCount),
  };
}

/**
 * Returns the generated menu's scheme-aware composition for a leg with no
 * authored config, or `undefined` when the mastermind's menu carries none for the
 * scheme at that player count.
 *
 * why: D-24666 — menu-fallback legs whose scheme prints "Add an extra Henchman
 * group" get a scheme-aware composition (the generator's `schemeOverrides`, built
 * with the D-24199 fill rule) without new seed-PAR scenarios: seed PAR enumerates
 * its scenarios from data/gauntlet-configs.json, never from the menu.
 *
 * @param setAbbr the gauntlet's home set abbreviation.
 * @param mastermindSlug the gauntlet's mastermind slug.
 * @param schemeSlug the leg's scheme slug.
 * @param playerCount the player count to size the composition for.
 * @returns a copy of the override composition, or `undefined`.
 */
function getMenuSchemeOverride(
  setAbbr: string,
  mastermindSlug: string,
  schemeSlug: string,
  playerCount: SupportedPlayerCount,
): GauntletConfigComposition | undefined {
  const menu = getGauntletLoadoutMenu(setAbbr, mastermindSlug);
  const override = menu?.schemeOverrides?.[schemeSlug]?.[playerCount];
  if (override === undefined) {
    return undefined;
  }
  return {
    villainGroupIds: [...override.villainGroupIds],
    henchmanGroupIds: [...override.henchmanGroupIds],
  };
}
