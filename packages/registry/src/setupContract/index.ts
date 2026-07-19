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
  // why: EC-425 — EC-421 added the support-pool contract to
  // setupContract.types.ts but never re-exported it here, so the types were
  // unreachable through the subpath the viewer must import from (the root
  // barrel pulls in node-only modules and breaks the Vite build). The feature
  // shipped structurally complete and practically unusable; these lines are
  // what make it consumable.
  SupportPool,
  SupportPoolCard,
  SupportPoolCountField,
  SupportPoolKind,
  SupportPoolMode,
  SupportPools,
} from "./setupContract.types.js";

export {
  SUPPORT_COUNT_MINIMUMS,
  SUPPORT_POOL_COUNT_FIELD,
  SUPPORT_POOL_KINDS,
  UNSUPPORTED_HERO_SELECTION_MODE_TEMPLATE,
  HERO_SELECTION_MODE_READONLY_LABEL,
  HERO_SELECTION_MODE_SHORT_LABEL,
  HERO_SELECTION_MODE_LONG_EXPLANATION,
  HERO_SELECTION_MODE_FUTURE_NOTICE,
} from "./setupContract.types.js";

export { MatchSetupDocumentSchema } from "./setupContract.schema.js";
export { validateMatchSetupDocument } from "./setupContract.validate.js";

// why: the per-player-count setup table lives on its own browser-safe subpath
// `@legendary-arena/registry/playerCountSetup` (it is not a MATCH-SETUP-document
// concern). Consumers import it from there, not this barrel.
