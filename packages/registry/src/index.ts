/**
 * packages/registry/src/index.ts — public API surface
 */

// Types
export type {
  SetIndexEntry,
  SetData,
  Hero,
  HeroCard,
  HeroClass,
  Mastermind,
  MastermindCard,
  VillainGroup,
  VillainCard,
  Scheme,
  FlatCard,
  CardQuery,
  RegistryInfo,
  HealthReport,
  CardRegistry,
  HttpRegistryOptions,
  PhysicalCard,
} from "./types/index.js";

// Factories
export { createRegistryFromHttp        } from "./impl/httpRegistry.js";
export { createRegistryFromLocalFiles  } from "./impl/localRegistry.js";

// why: WP-370 / D-24165 — the canonical per-player-count setup table + pure
// helpers, the single source of truth consumed by the registry-viewer
// loadout builder, the server match-create gate, and (via the registry
// object at setup time) the game engine.
export {
  PLAYER_COUNT_SETUP,
  getPlayerCountSetup,
  checkPlayerCountComposition,
} from "./playerCountSetup.js";
export type {
  PlayerCountSetupRow,
  SupportedPlayerCount,
  PlayerCountCompositionMismatch,
  PlayerCountCompositionInput,
} from "./playerCountSetup.js";

// why: WP-395 / D-24199 — the approved villain + henchmen configurations a
// ranked gauntlet leg must be played with. The server wiring layer reads these
// at startup and threads them into the gauntlet catalog as plain data, so the
// qualification predicate never imports the registry (its layer lock).
export {
  GAUNTLET_LOADOUT_MENUS,
  getGauntletLoadoutMenu,
  buildVillainSegment,
  buildHenchmanKey,
} from "./gauntletLoadouts.js";
export type {
  GauntletLoadoutComposition,
  GauntletLoadoutVariant,
  GauntletLoadoutMenu,
} from "./gauntletLoadouts.js";

// Schema (for external validation use)
export {
  SetDataSchema,
  SetIndexEntrySchema,
  HeroCardSchema,
  HeroClassSchema,
  CardQuerySchema,
  KeywordGlossaryEntrySchema,
  KeywordGlossarySchema,
  RuleGlossaryEntrySchema,
  RuleGlossarySchema,
  CardTypeEntrySchema,
  CardTypesIndexSchema,
  ViewerConfigSchema,
  ThemeIndexSchema,
} from "./schema.js";

export type {
  KeywordGlossaryEntry,
  RuleGlossaryEntry,
  CardTypeEntry,
  CardTypesIndex,
  CardType,
  ViewerConfig,
  ThemeIndex,
} from "./schema.js";

// Theme types
export type { ThemeDefinition } from "./theme.schema.js";

// Theme schemas
export {
  ThemeDefinitionSchema,
  ThemeSetupIntentSchema,
  ThemePlayerCountSchema,
  ThemePrimaryStoryReferenceSchema,
  ThemeMusicAssetsSchema,
} from "./theme.schema.js";

// Theme validators
export { validateTheme, validateThemeFile } from "./theme.validate.js";

// why: Browser-safe MATCH-SETUP document contract (WP-091). Consumed by
// apps/registry-viewer (loadout builder) and any future tooling that needs
// to validate a MATCH-SETUP envelope + composition without crossing the
// engine layer boundary. The engine-side validator at
// packages/game-engine/src/matchSetup.validate.ts remains authoritative
// at match creation time; these registry-side exports mirror its ext_id
// lookup algorithm byte-for-byte (D-1209, A-091-03) plus add strict zod
// structural validation of the envelope (WP-093 consumer).
export type {
  CardRegistryReader,
  SetupCompositionInput,
  SetupEnvelope,
  MatchSetupDocument,
  HeroSelectionMode,
  MatchSetupErrorCode,
  MatchSetupValidationError,
  ValidateMatchSetupDocumentResult,
} from "./setupContract/setupContract.types.js";

export {
  UNSUPPORTED_HERO_SELECTION_MODE_TEMPLATE,
  HERO_SELECTION_MODE_READONLY_LABEL,
  HERO_SELECTION_MODE_SHORT_LABEL,
  HERO_SELECTION_MODE_LONG_EXPLANATION,
  HERO_SELECTION_MODE_FUTURE_NOTICE,
} from "./setupContract/setupContract.types.js";

export { MatchSetupDocumentSchema } from "./setupContract/setupContract.schema.js";
export { validateMatchSetupDocument } from "./setupContract/setupContract.validate.js";
