/**
 * setupContract/index.ts — browser-safe barrel for the MATCH-SETUP
 * document contract (WP-091).
 *
 * // why: apps/registry-viewer cannot import from the root
 * // `@legendary-arena/registry` barrel because the root re-exports a
 * // node-only local-file registry factory (`node:fs/promises`,
 * // `node:path`). This dedicated subpath export has zero node-module
 * // dependencies so the viewer's production Vite build stays
 * // browser-safe. Precedent: `./schema` and `./theme.schema` sub-paths
 * // used by glossaryClient.ts and themeClient.ts.
 */

export type {
  CardRegistryReader,
  SetupCompositionInput,
  SetupEnvelope,
  MatchSetupDocument,
  HeroSelectionMode,
  MatchSetupErrorCode,
  MatchSetupValidationError,
  ValidateMatchSetupDocumentResult,
} from "./setupContract.types.js";

export {
  UNSUPPORTED_HERO_SELECTION_MODE_TEMPLATE,
  HERO_SELECTION_MODE_READONLY_LABEL,
  HERO_SELECTION_MODE_SHORT_LABEL,
  HERO_SELECTION_MODE_LONG_EXPLANATION,
  HERO_SELECTION_MODE_FUTURE_NOTICE,
} from "./setupContract.types.js";

export { MatchSetupDocumentSchema } from "./setupContract.schema.js";
export { validateMatchSetupDocument } from "./setupContract.validate.js";
