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
} from "./schema.js";
