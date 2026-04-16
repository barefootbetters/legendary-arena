/**
 * browser.ts — browser-safe entry point for the registry package.
 * Only exports the HTTP registry. Never imports node:fs or node:path.
 * Used by the Vite viewer via the alias in vite.config.ts.
 */

// why: types/types-index.ts is the live type source — it matches runtime
// FlatCard usage (9-value cardType including henchman/bystander/wound/
// location/other) and exports FlatCardType + CardQueryExtended used by
// App.vue. types/index.ts is a narrower stale parallel file. EC-102
// consolidates the viewer on the live file.
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
} from "./types/types-index.js";

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
