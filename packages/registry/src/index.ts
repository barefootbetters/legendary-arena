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
} from "./types/index.js";

// Factories
export { createRegistryFromHttp        } from "./impl/httpRegistry.js";
export { createRegistryFromLocalFiles  } from "./impl/localRegistry.js";

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
  ViewerConfigSchema,
  ThemeIndexSchema,
} from "./schema.js";

export type {
  KeywordGlossaryEntry,
  RuleGlossaryEntry,
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
