/**
 * difficultyRatings.schema.ts — the Phase-1 seed difficulty-ratings schema and
 * validator (WP-422 / D-24242).
 *
 * Every competitive Mastermind, Scheme, and Villain Group carries an integer
 * difficulty rating (1-10) derived from five type-specific 0-4 sub-scores via
 * `difficultyRating = clamp(1, 10, ceil(sum(subscores) / 2))` — 5 is the
 * competent-game center. These ratings are the Phase-1 *priors* the Seed PAR
 * generator (`scripts/generate-seed-par.mjs`) composes into a per-scenario PAR;
 * simulation (Phase 2) later supersedes them. They are content metadata, never
 * scoring logic (per `wiki/par-simulation-calibration.md` §Phase 1).
 *
 * why the field lives on this new per-entity ratings surface, not the theme
 * schema (D-5508 reversed by D-24242): `theme.schema.ts` describes curated
 * theme *bundles*, not per-entity Mastermind/Scheme/Villain-Group records — there
 * is no per-entity object there to hang a rating on. The ratings are a standalone
 * registry data surface keyed by set-qualified ext_id, matching the record shape
 * the calibration wiki prescribes. Existing card data is untouched, so it still
 * validates (WP-422 AC-1).
 *
 * Pure: imports `zod` only. No Node built-ins, no filesystem read — the caller
 * (the authoring-time generator) reads `data/difficulty-ratings/<version>.json`
 * and passes the parsed value to `validateDifficultyRatings`. Never imports the
 * game engine, server, `pg`, any `apps/*` package, or `boardgame.io`.
 */

import { z } from "zod";

/** The five 0-4 rubric dimensions for a Mastermind rating (calibration wiki §Phase 1). */
export const MASTERMIND_DIFFICULTY_DIMENSIONS = [
  "attackThresholdPressure",
  "masterStrikeSeverity",
  "tacticSeverity",
  "protectionOrAccessRestriction",
  "scalingOrAlternateLossPressure",
] as const;

/** The five 0-4 rubric dimensions for a Scheme rating. */
export const SCHEME_DIFFICULTY_DIMENSIONS = [
  "clockTightness",
  "lossConditionSeverity",
  "irreversibleDamage",
  "resourceDenial",
  "setupConstraintOrScaling",
] as const;

/** The five 0-4 rubric dimensions for a Villain Group rating (VP + attack anchored). */
export const VILLAIN_GROUP_DIFFICULTY_DIMENSIONS = [
  "attackAndVpPressure",
  "ambushPressure",
  "fightPunishmentOrDenial",
  "escapePressure",
  "synergyOrKeywordComplexity",
] as const;

/**
 * Clamps a value to the inclusive `[low, high]` range.
 *
 * @param low the lower bound.
 * @param high the upper bound.
 * @param value the value to clamp.
 * @returns the clamped value.
 */
function clampRange(low: number, high: number, value: number): number {
  return Math.max(low, Math.min(high, value));
}

/**
 * Computes the canonical difficulty rating from a sub-score total:
 * `clamp(1, 10, ceil(sum / 2))`. The single source of the rubric formula so the
 * validator, the generator, and any test never re-derive it independently.
 *
 * @param subscoreTotal the sum of the five 0-4 sub-scores (0-20).
 * @returns the integer 1-10 difficulty rating.
 */
export function difficultyRatingFromSubscoreTotal(subscoreTotal: number): number {
  return clampRange(1, 10, Math.ceil(subscoreTotal / 2));
}

/**
 * Builds the strict Zod schema for one rating entry over a fixed dimension set.
 * The `subscores` object must carry exactly the five named dimensions, each an
 * integer 0-4, and `difficultyRating` MUST equal the rubric formula applied to
 * their sum — an entry whose rating disagrees with its own basis is rejected
 * loudly (auditable — no undocumented "vibes").
 *
 * @param dimensions the five sub-score dimension names for this entity type.
 * @returns a Zod schema validating one `{ difficultyRating, subscores }` entry.
 */
function buildRatingEntrySchema(
  dimensions: readonly string[],
): z.ZodTypeAny {
  const subscoreShape: Record<string, z.ZodTypeAny> = {};
  for (const dimension of dimensions) {
    subscoreShape[dimension] = z.number().int().min(0).max(4);
  }
  return z
    .object({
      difficultyRating: z.number().int().min(1).max(10),
      subscores: z.object(subscoreShape).strict(),
    })
    .strict()
    .refine(
      (entry) => {
        const subscores = entry.subscores as Record<string, number>;
        let subscoreTotal = 0;
        for (const dimension of dimensions) {
          const dimensionScore = subscores[dimension];
          // why: zod has already validated all five dimensions are present as
          // integers 0-4, so this is defensive; a missing dimension fails the refine.
          if (dimensionScore === undefined) {
            return false;
          }
          subscoreTotal = subscoreTotal + dimensionScore;
        }
        return (
          entry.difficultyRating ===
          difficultyRatingFromSubscoreTotal(subscoreTotal)
        );
      },
      {
        message:
          "difficultyRating must equal clamp(1, 10, ceil(sum(subscores) / 2)) — the rating must match its sub-score basis exactly.",
      },
    );
}

/** Strict schema for one Mastermind rating entry. */
export const MastermindDifficultyRatingSchema = buildRatingEntrySchema(
  MASTERMIND_DIFFICULTY_DIMENSIONS,
);

/** Strict schema for one Scheme rating entry. */
export const SchemeDifficultyRatingSchema = buildRatingEntrySchema(
  SCHEME_DIFFICULTY_DIMENSIONS,
);

/** Strict schema for one Villain Group rating entry. */
export const VillainGroupDifficultyRatingSchema = buildRatingEntrySchema(
  VILLAIN_GROUP_DIFFICULTY_DIMENSIONS,
);

/** One rating entry: the 1-10 rating plus its auditable 0-4 sub-score basis. */
export interface DifficultyRatingEntry {
  readonly difficultyRating: number;
  readonly subscores: Readonly<Record<string, number>>;
}

/**
 * The whole seed difficulty-ratings file: a version stamp, an optional
 * description, and three ext_id-keyed maps (Mastermind / Scheme / Villain Group).
 * Keys are set-qualified ext_ids (`setAbbr/slug`, D-10014). Henchman groups are
 * deliberately absent — the Seed PAR formula has no henchman term.
 */
export interface DifficultyRatingsFile {
  readonly entityDifficultyVersion: string;
  readonly description?: string;
  readonly masterminds: Readonly<Record<string, DifficultyRatingEntry>>;
  readonly schemes: Readonly<Record<string, DifficultyRatingEntry>>;
  readonly villainGroups: Readonly<Record<string, DifficultyRatingEntry>>;
}

/** The strict Zod schema for the whole seed difficulty-ratings file. */
const DifficultyRatingsFileSchema = z
  .object({
    entityDifficultyVersion: z.string().min(1),
    description: z.string().optional(),
    masterminds: z.record(z.string(), MastermindDifficultyRatingSchema),
    schemes: z.record(z.string(), SchemeDifficultyRatingSchema),
    villainGroups: z.record(z.string(), VillainGroupDifficultyRatingSchema),
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
 * Validates unknown input as a seed difficulty-ratings file, returning the typed
 * file or throwing a full-sentence `Error` describing what failed. Beyond the
 * structural schema, every entry's `difficultyRating` is checked against its
 * sub-score basis by the per-entry refine.
 *
 * @param input the untrusted value to validate (for example a parsed JSON file).
 * @returns the validated difficulty-ratings file.
 * @throws Error on any shape or rubric-formula violation.
 */
export function validateDifficultyRatings(input: unknown): DifficultyRatingsFile {
  const result = DifficultyRatingsFileSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `This value is not a valid seed difficulty-ratings file: ${describeSchemaIssues(result.error)}. ` +
        `A valid file is { entityDifficultyVersion, description?, masterminds, schemes, villainGroups }, ` +
        `where each map is keyed by set-qualified ext_id ("setAbbr/slug") and each entry is ` +
        `{ difficultyRating (1-10), subscores (five 0-4 dimensions) } with difficultyRating equal to ` +
        `clamp(1, 10, ceil(sum(subscores) / 2)).`,
    );
  }
  return result.data as DifficultyRatingsFile;
}
