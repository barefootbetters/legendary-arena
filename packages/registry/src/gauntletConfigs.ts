/**
 * gauntletConfigs.ts — the year-keyed per-scheme gauntlet config loader
 * (WP-471 / EC-506 — per-scheme gauntlet variety, arc 1/5).
 *
 * Reads the hand-authored `data/gauntlet-configs.json` and exposes a
 * per-(set × mastermind × scheme × player-count) lookup of the approved adversary
 * composition. The file varies a mastermind's approved villains and henchmen BY
 * SCHEME, so a mastermind's gauntlet legs are no longer identical
 * scheme-to-scheme.
 *
 * why the JSON is the source of truth: the compositions are hand-authored data
 * (authored under #1116; revisions are data edits, not a code change). This packet
 * adds only the registry LOADER over that existing file — the additive foundation
 * of the arc. The four downstream packets (WP-472 server truth + leaderboard,
 * WP-473 run-tracker + launch, WP-474 client + cards, WP-475 arena-client) migrate
 * their readers to it one at a time.
 *
 * why the loader returns `undefined` for an absent leg (rather than a synthesized
 * default): the authored file covers only the sets/masterminds/schemes that carry
 * curated per-scheme variety (Core today). Every other leg has no authored
 * override, so `getGauntletConfig` returns `undefined` and the consumer falls back
 * to the per-mastermind `GAUNTLET_LOADOUT_MENUS` (the WP-472 absent-scheme →
 * menu-fallback model). The loader never invents a composition.
 *
 * why the year key exists but only the active year is exposed: the file is keyed
 * by championship year so a future annual rollover can add a new year's block
 * without disturbing prior years, but the loader deliberately exposes ONLY the
 * active year (`activeYear`). Archival/rollover (reading a prior year) is deferred
 * — there is no consumer for it yet.
 *
 * Layer: Registry. Imports Node built-ins and `zod` only — never the game engine,
 * server, `pg`, any `apps/*` package, or `boardgame.io`. Composition ext_ids are
 * full D-10014 `setAbbr/slug` ids (a group's real home set, which is not always
 * the parent set — cross-set core-fallback groups keep their source qualifier),
 * and the loader returns them as-is.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { getPlayerCountSetup } from "./playerCountSetup.js";
import type { SupportedPlayerCount } from "./playerCountSetup.js";

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
 * One mastermind's authored config: its display name, printed Always-Leads anchor,
 * base pools, and the per-scheme legs.
 */
export interface GauntletMastermindConfig {
  readonly mastermindName: string;
  readonly anchorVillainGroup: string;
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
    anchorVillainGroup: z.string().min(1),
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
 * malformed even though every field is individually well-typed.
 *
 * @param input the untrusted value to validate (for example a parsed JSON file).
 * @returns the validated gauntlet-configs file.
 * @throws Error on any shape violation or a dangling active year.
 */
export function validateGauntletConfigs(input: unknown): GauntletConfigsFile {
  const result = GauntletConfigsFileSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `This value is not a valid gauntlet-configs file: ${describeSchemaIssues(result.error)}. ` +
        `A valid file is { schemaVersion, description, activeYear, slicing, years: { "<year>": ` +
        `{ label, sets: { "<setAbbr>": { setName, masterminds: { "<mastermindSlug>": ` +
        `{ mastermindName, anchorVillainGroup, baseVillainPool, baseHenchmanPool, schemes: ` +
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
  return file;
}

/**
 * Resolves the path to `data/gauntlet-configs.json` relative to this module, so
 * the lookup does not depend on the process's working directory.
 *
 * why import.meta.url-relative (not process.cwd()): this module ships in the
 * registry `dist`, imported by the server from an arbitrary cwd. Both
 * `packages/registry/src/gauntletConfigs.ts` (tests, via tsx) and
 * `packages/registry/dist/gauntletConfigs.js` (runtime) sit one directory under
 * `packages/registry`, so the repo root is three levels up in both cases.
 *
 * @returns the absolute path to the gauntlet-configs JSON file.
 */
function resolveConfigsPath(): string {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  return join(moduleDirectory, "..", "..", "..", "data", "gauntlet-configs.json");
}

/**
 * Reads and validates the gauntlet-configs file once, at module load.
 *
 * why at load (registry setup-time throw is allowed): the file is immutable
 * game-reference data, so it is read and validated a single time; a malformed or
 * missing file is a deploy-blocking error surfaced loudly here rather than a
 * silent per-lookup failure later.
 *
 * @returns the validated gauntlet-configs file.
 * @throws Error when the file is missing, is not valid JSON, or fails validation.
 */
function loadGauntletConfigs(): GauntletConfigsFile {
  const configsPath = resolveConfigsPath();
  let fileText: string;
  try {
    fileText = readFileSync(configsPath, "utf8");
  } catch (readError) {
    const reason = readError instanceof Error ? readError.message : String(readError);
    throw new Error(
      `Failed to read the gauntlet-configs file at ${configsPath}: ${reason}. Confirm the ` +
        `data/gauntlet-configs.json file is present in the checkout.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch (parseError) {
    const reason = parseError instanceof Error ? parseError.message : String(parseError);
    throw new Error(
      `The gauntlet-configs file at ${configsPath} is not valid JSON: ${reason}. Fix the ` +
        `hand-authored JSON.`,
    );
  }
  return validateGauntletConfigs(parsed);
}

// why: read once at module load — the file is immutable reference data and this
// is the registry's setup-time validation point (a bad file blocks the deploy).
const GAUNTLET_CONFIGS: GauntletConfigsFile = loadGauntletConfigs();

/**
 * Returns the active championship year the loader reads from.
 *
 * @returns the active year (for example "2026").
 */
export function getActiveYear(): string {
  return GAUNTLET_CONFIGS.activeYear;
}

/**
 * Resolves the approved composition for one gauntlet leg at one player count, or
 * `undefined` when the leg carries no authored per-scheme override.
 *
 * The leg's ordered pools are scaled to the player count by taking the first
 * `villainGroupCount` / `henchmenGroupCount` groups from `PLAYER_COUNT_SETUP` —
 * the single canonical per-count sizing (WP-370 / D-24165). The stored ext_ids are
 * already set-qualified and are returned unchanged.
 *
 * `undefined` is returned when the active year has no block for the set, the set
 * has no config for the mastermind, the mastermind has no authored leg for the
 * scheme, or the player count is out of range. A `undefined` result means "no
 * per-scheme override" — the consumer falls back to the per-mastermind
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
    return undefined;
  }
  const setupRow = getPlayerCountSetup(playerCount);
  if (setupRow === undefined) {
    return undefined;
  }
  return {
    villainGroupIds: leg.villainPool.slice(0, setupRow.villainGroupCount),
    henchmanGroupIds: leg.henchmanPool.slice(0, setupRow.henchmenGroupCount),
  };
}
