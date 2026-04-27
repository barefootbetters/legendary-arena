/**
 * Setup-time builder for scheme setup instructions.
 *
 * Resolves scheme data from the registry at setup time and produces a list
 * of declarative SchemeSetupInstruction entries. Same setup-time resolution
 * pattern as buildCardStats (WP-018) and buildCardKeywords (WP-025) — resolve
 * registry data once during Game.setup(), store results in G, never query
 * registry at runtime.
 *
 * MVP behavior: returns [] (empty array) for all schemes because the card
 * registry does not yet contain structured setup instruction metadata. A
 * future WP will add structured registry metadata or an explicit mapping
 * layer. See D-2601 (MVP data reality) and D-2504 (safe-skip precedent).
 */

import type { CardExtId } from '../state/zones.types.js';
import type { SchemeSetupInstruction } from '../scheme/schemeSetup.types.js';

// ---------------------------------------------------------------------------
// Local structural interface (layer boundary compliance)
// ---------------------------------------------------------------------------

// why: game-engine must not import @legendary-arena/registry; this interface
// is satisfied structurally by CardRegistry. It exposes the minimum methods
// needed for scheme data resolution at setup time.
//
// why: WP-113 follow-up alignment fix — the previous draft of this
//   interface and its guard checked for `getScheme(schemeId)`, which was
//   never a method on the real `CardRegistry`. The original
//   `buildSchemeSetupInstructions` body always fell into its early-return
//   path because the guard always failed; the MVP "returns []" semantic
//   per D-2601 was preserved by accident, not by design. WP-113 promoted
//   the misnamed guard to an export and surfaced it at the orchestration
//   site, which then noisily fired a "skipped" diagnostic on every
//   match-create. Fix Option A: realign the interface and guard to the
//   real registry shape (`listSets` + `getSet`), matching the four other
//   builder readers. The body still returns `[]` per D-2601 — MVP
//   behaviour is unchanged (per D-10014).
export interface SchemeRegistryReader {
  listSets(): Array<{ abbr: string }>;
  getSet(abbr: string): unknown | undefined;
}

// ---------------------------------------------------------------------------
// Runtime type guard
// ---------------------------------------------------------------------------

/**
 * Returns true if the registry object has the required listSets/getSet
 * methods. Narrow test mocks that do not implement them will return false.
 */
// why: D-10014 — orchestration-side diagnostic detection seam. The
// orchestration layer (buildInitialGameState) imports this guard to detect
// registry-reader interface mismatches and emit G.messages diagnostics.
// Aligned to the real CardRegistry shape per the WP-113 follow-up fix
// described above on the interface declaration.
export function isSchemeRegistryReader(
  registry: unknown,
): registry is SchemeRegistryReader {
  if (!registry || typeof registry !== 'object') return false;

  const candidate = registry as Record<string, unknown>;
  return (
    typeof candidate.listSets === 'function' &&
    typeof candidate.getSet === 'function'
  );
}

/**
 * Enumerates scheme slugs in a single set's data.
 *
 * Reads `setData.schemes[].slug` defensively. Returns an empty array on
 * any malformed shape — never throws. Used by the validator's
 * `buildKnownSchemeQualifiedIds` (Class B: set-data slug enumerator) as
 * the single source of truth for scheme slug semantics.
 */
// why: D-10014 — single source of truth — set-data slug enumerator.
export function listSchemeSlugsInSet(setData: unknown): string[] {
  if (!setData || typeof setData !== 'object') return [];
  const candidate = setData as { schemes?: unknown };
  if (!Array.isArray(candidate.schemes)) return [];

  const slugs: string[] = [];
  for (const entry of candidate.schemes) {
    if (entry && typeof entry === 'object') {
      const scheme = entry as { slug?: unknown };
      if (typeof scheme.slug === 'string' && scheme.slug.length > 0) {
        slugs.push(scheme.slug);
      }
    }
  }
  return slugs;
}

// ---------------------------------------------------------------------------
// buildSchemeSetupInstructions
// ---------------------------------------------------------------------------

/**
 * Parses a set-qualified ID `<setAbbr>/<slug>` into its components.
 *
 * Returns null on malformed input. Locally duplicated per WP-113 §6 step 1.
 */
// why: D-10014 — duplicated locally to avoid a circular import between
// builders and matchSetup.validate.ts.
function parseQualifiedId(input: string): { setAbbr: string; slug: string } | null {
  if (typeof input !== 'string' || input.length === 0) return null;
  if (input !== input.trim()) return null;
  const slashIndex = input.indexOf('/');
  if (slashIndex === -1) return null;
  if (input.indexOf('/', slashIndex + 1) !== -1) return null;
  const setAbbr = input.slice(0, slashIndex);
  const slug = input.slice(slashIndex + 1);
  if (setAbbr.length === 0 || slug.length === 0) return null;
  return { setAbbr, slug };
}

/**
 * Builds scheme setup instructions from registry data at setup time.
 *
 * @param schemeId - The set-qualified ext_id of the selected scheme
 *   (`<setAbbr>/<schemeSlug>` per D-10014). Parsed at the builder boundary
 *   so a future WP can iterate the named set's scheme metadata only.
 * @param registry - The card registry (typed as unknown; validated at runtime
 *   via isSchemeRegistryReader).
 * @returns Array of SchemeSetupInstruction entries. Empty at MVP.
 */
export function buildSchemeSetupInstructions(
  schemeId: CardExtId,
  registry: unknown,
): SchemeSetupInstruction[] {
  // why: same setup-time resolution pattern as buildCardStats and
  // buildCardKeywords — resolve registry data once during Game.setup(),
  // store results in G, never query registry at runtime.
  //
  // MVP: the card registry does not yet contain structured setup instruction
  // metadata. Return empty array for all schemes. The builder skeleton and
  // type guard exist so a future WP can populate real instructions without
  // refactoring the call site or executor.

  if (!isSchemeRegistryReader(registry)) {
    return [];
  }

  // why: D-10014 — Builder Filtering Order — iterate named set only.
  // schemeId is `<setAbbr>/<schemeSlug>`; parse here so a future WP that
  // populates real instructions reads from the named set's schemes[] only.
  // MVP behaviour unchanged — still returns []. Malformed input also
  // returns [] (graceful skip) since the validator is the authoritative
  // format-error reporter; this builder is defense-in-depth.
  const parsed = parseQualifiedId(schemeId);
  if (parsed === null) {
    return [];
  }
  void parsed;

  // Registry exposes listSets / getSet but no structured setup metadata
  // exists yet for schemes. Future WP: resolve scheme data from the named
  // set's `schemes[]` and extract instructions here.
  return [];
}
