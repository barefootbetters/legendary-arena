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
interface SchemeRegistryReader {
  getScheme(schemeId: string): unknown | undefined;
}

// ---------------------------------------------------------------------------
// Runtime type guard
// ---------------------------------------------------------------------------

/**
 * Returns true if the registry object has the required getScheme method.
 * Narrow test mocks that do not implement getScheme will return false.
 */
function isSchemeRegistryReader(
  registry: unknown,
): registry is SchemeRegistryReader {
  if (!registry || typeof registry !== 'object') return false;

  const candidate = registry as Record<string, unknown>;
  return typeof candidate.getScheme === 'function';
}

// ---------------------------------------------------------------------------
// buildSchemeSetupInstructions
// ---------------------------------------------------------------------------

/**
 * Builds scheme setup instructions from registry data at setup time.
 *
 * @param schemeId - The ext_id of the selected scheme.
 * @param registry - The card registry (typed as unknown; validated at runtime
 *   via isSchemeRegistryReader).
 * @returns Array of SchemeSetupInstruction entries. Empty at MVP.
 */
export function buildSchemeSetupInstructions(
  _schemeId: CardExtId,
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

  // Registry has getScheme but no structured setup metadata exists yet.
  // Future WP: resolve scheme data and extract instructions here.
  return [];
}
