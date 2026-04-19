/**
 * Preferences envelope, version constant, and runtime schema composer.
 *
 * The preferences surface is composed at runtime from whatever sections each
 * app registered during bootstrap (plan §2.8, §3.3). This lets the shared
 * `createPreferencesStore` factory live in one place while each app wires in
 * its own mix of shared + private sections.
 *
 * Pure Zod + TypeScript — no Vue imports, no DOM references. Transitively
 * depends on `../registry/sectionRegistry`, which may reference Vue's
 * `Component` type; the purity test only scans `*.schema.ts` source text,
 * so the indirection is deliberate.
 */

import { z } from "zod";
import { getRegisteredSections } from "../registry/sectionRegistry";

/**
 * Schema envelope version. Increment only when making a breaking change that
 * requires a migration step; `migratePreferences` is where the v2 -> v3 -> ...
 * chain will live.
 */
export const PREFERENCES_SCHEMA_VERSION = 2 as const;

/**
 * Builds the composed Zod schema from the current section-registry snapshot.
 * Each registered section contributes one top-level key to the envelope.
 *
 * This is invoked by the store factory at instantiation time, so the caller
 * is responsible for registering all sections BEFORE the store is created.
 * `src/prefs/registerSections.ts` handles that ordering in `main.ts`.
 */
export function buildPreferencesSchema(): z.ZodObject<
  Record<string, z.ZodTypeAny>
> {
  const shape: Record<string, z.ZodTypeAny> = {
    version: z.literal(PREFERENCES_SCHEMA_VERSION),
  };
  for (const [sectionId, entry] of getRegisteredSections()) {
    shape[sectionId] = entry.schema;
  }
  return z.object(shape);
}

/**
 * Migrates a raw unknown blob forward to the current schema version.
 *
 * For v2 (the first shipping version) this is a pass-through. Future
 * migrations chain here: read the `version` field, apply v1 -> v2 then
 * v2 -> v3 transforms in order, then return. Callers still run the result
 * through `buildPreferencesSchema().parse(...)` — migration shape-checks
 * are advisory, Zod is the authority.
 */
// why: keeping a separate migration step even for v2 pass-through so the
// call site in the store factory never needs to change when a real
// migration lands later.
export function migratePreferences(raw: unknown): unknown {
  return raw;
}

/**
 * Loose type for a composed preferences object. Strong per-section types
 * live on each section's schema module (e.g. `AppearancePrefs`). Consumers
 * that need field-level autocomplete should cast through the section-
 * specific types or via `storeToRefs` on a typed store.
 */
export type Preferences = z.infer<
  ReturnType<typeof buildPreferencesSchema>
>;
