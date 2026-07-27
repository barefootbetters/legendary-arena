/**
 * gauntletPack.ts — the Gauntlet Pack identity contract (WP-440 / D-24260).
 *
 * A Gauntlet Pack is the tiny download token a player receives on the legends
 * site to declare WHICH Mastermind Gauntlet they want to start. It carries an
 * identity and nothing else: `{ pack_version, gauntlet: { setAbbr,
 * mastermindSlug, division, playerCount } }`. It holds NO legs, NO hero picks,
 * and NO approved adversary compositions — the server re-resolves all of those
 * from the live registry at import time (WP-5).
 *
 * This module owns three things: the strict Zod schema for a v1 pack, a pure
 * `buildGauntletPack` builder, and a `validateGauntletPack` validator. It is
 * registry-layer code: it imports `zod` and Node built-ins only, never the
 * game engine, server, `pg`, any `apps/*` package, or `boardgame.io`.
 *
 * why: D-24260 — validation here is SHAPE-ONLY and never checks that the
 * `(setAbbr, mastermindSlug)` pair actually hosts a gauntlet, nor that the
 * requested `division`/`playerCount` is offered for it. The pack is an import
 * token, not a rules container; the server is the sole authority that
 * re-resolves a gauntlet's legs and approved compositions from the live
 * registry at import (WP-5). Baking an existence check in here would give the
 * registry a runtime dependency on menu data and blur that boundary.
 */

import { z } from "zod";
import type { SupportedPlayerCount } from "./playerCountSetup.js";

/**
 * The current supported Gauntlet Pack major version. A pack declaring any other
 * major version is rejected loudly by `validateGauntletPack`, never accepted.
 */
export const GAUNTLET_PACK_VERSION = 1;

/**
 * The two competitive divisions a gauntlet can be entered in: `fixed` (the
 * fixed-hero-pool gauntlet, D-24187) or `open` (free hero selection).
 */
export type GauntletDivision = "fixed" | "open";

/**
 * The identity of one gauntlet a pack targets. The `(setAbbr, mastermindSlug)`
 * pair mirrors the `GauntletLoadoutMenu` lookup key (WP-395 / D-24199);
 * `playerCount` reuses the registry's `SupportedPlayerCount` (WP-370 /
 * D-24165) rather than re-declaring the 1..5 union.
 */
export interface GauntletPackIdentity {
  readonly setAbbr: string;
  readonly mastermindSlug: string;
  readonly division: GauntletDivision;
  readonly playerCount: SupportedPlayerCount;
}

/**
 * A complete Gauntlet Pack: a version stamp plus the gauntlet identity, and
 * nothing else. This is the exact JSON a player downloads and later imports.
 */
export interface GauntletPack {
  readonly pack_version: number;
  readonly gauntlet: GauntletPackIdentity;
}

/**
 * The strict Zod schema for the gauntlet identity block.
 *
 * why: `.strict()` — an unknown key inside `gauntlet` means the pack was
 * produced by a newer or mismatched writer (for example a future field, or a
 * leaked `heroDeckIds`/`villainGroupIds` composition key). We reject it rather
 * than silently drop it, so a shape mismatch surfaces at import instead of
 * being quietly discarded and misread as a valid identity-only pack.
 */
const GauntletPackIdentitySchema = z
  .object({
    setAbbr: z.string(),
    mastermindSlug: z.string(),
    division: z.enum(["fixed", "open"]),
    // why: a union of the five supported literals reuses SupportedPlayerCount's
    // exact value set (1..5) so 0, 6, and non-integers are rejected as shape
    // errors, without re-declaring the TypeScript union here.
    playerCount: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ]),
  })
  .strict();

/**
 * The strict Zod schema for a v1 Gauntlet Pack.
 *
 * why: `.strict()` at the top level too — an unknown top-level key (for example
 * `legs: []`) means a producer tried to smuggle run data into an identity-only
 * token. Rejecting it keeps the pack a four-field identifier and never a rules
 * container.
 */
export const GauntletPackSchema = z
  .object({
    pack_version: z.literal(GAUNTLET_PACK_VERSION),
    gauntlet: GauntletPackIdentitySchema,
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
 * Builds an identity-only Gauntlet Pack from a gauntlet identity.
 *
 * The builder is pure: it stamps `pack_version: GAUNTLET_PACK_VERSION`, copies
 * the four identity fields explicitly (so no stray key on the input can leak
 * into the pack), and validates the result before returning it.
 *
 * @param identity the gauntlet identity to wrap in a pack.
 * @returns the validated, identity-only Gauntlet Pack.
 * @throws Error when the identity is not a valid v1 pack shape.
 */
export function buildGauntletPack(identity: GauntletPackIdentity): GauntletPack {
  const pack: GauntletPack = {
    pack_version: GAUNTLET_PACK_VERSION,
    gauntlet: {
      setAbbr: identity.setAbbr,
      mastermindSlug: identity.mastermindSlug,
      division: identity.division,
      playerCount: identity.playerCount,
    },
  };
  return validateGauntletPack(pack);
}

/**
 * Validates unknown input as a v1 Gauntlet Pack, returning the typed pack or
 * throwing a full-sentence `Error` describing what failed.
 *
 * Validation is shape-only: it confirms the pack's structure, not that the
 * gauntlet it names actually exists (see the module `why:` on the
 * no-existence-check boundary).
 *
 * @param input the untrusted value to validate (for example a parsed download).
 * @returns the validated Gauntlet Pack.
 * @throws Error on an unsupported major version or any shape violation.
 */
export function validateGauntletPack(input: unknown): GauntletPack {
  // why: gate on the major version FIRST, before schema parsing, so an
  // unsupported version produces a clear "which version this build reads"
  // error rather than an opaque `.strict()` literal-mismatch. D-24260 makes
  // forward compatibility explicit via the version field — a pack from a
  // future major is rejected loudly, never lax-parsed or field-ignored.
  const declaredVersion = (input as { pack_version?: unknown } | null | undefined)
    ?.pack_version;
  if (
    typeof declaredVersion === "number" &&
    declaredVersion !== GAUNTLET_PACK_VERSION
  ) {
    throw new Error(
      `This gauntlet pack declares pack_version ${declaredVersion}, but this build only understands gauntlet pack version ${GAUNTLET_PACK_VERSION}. Re-export the pack from a compatible build, or update this build to read version ${declaredVersion}.`,
    );
  }

  const result = GauntletPackSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `This value is not a valid gauntlet pack: ${describeSchemaIssues(result.error)}. A valid pack is { pack_version: ${GAUNTLET_PACK_VERSION}, gauntlet: { setAbbr, mastermindSlug, division, playerCount } } with no other keys.`,
    );
  }
  return result.data;
}
