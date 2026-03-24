/**
 * browser.ts — browser-safe entry point for the registry package.
 * Only exports the HTTP registry. Never imports node:fs or node:path.
 * Used by the Vite viewer via the alias in vite.config.ts.
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
  FlatCardType,
  CardQuery,
  CardQueryExtended,
  RegistryInfo,
  HealthReport,
  CardRegistry,
  HttpRegistryOptions,
} from "./types/index.js";

// HTTP factory only — no localRegistry (requires node:fs)
export { createRegistryFromHttp } from "./impl/httpRegistry.js";

// Schema exports safe for browser use
export {
  SetDataSchema,
  SetIndexEntrySchema,
  HeroCardSchema,
  HeroClassSchema,
  CardQuerySchema,
} from "./schema.js";
