/**
 * Runtime section registry for the preferences system.
 *
 * Each app calls `registerSection(id, schema, component)` during bootstrap
 * to contribute a top-level section to the composed preferences envelope.
 * The store factory calls `getRegisteredSections()` at instantiation time
 * to compose the envelope Zod schema.
 *
 * The registry is intentionally module-scoped (a singleton per app
 * bootstrap). No Pinia involvement — Pinia stores are instance state;
 * section registration is startup wiring.
 */

import type { Component } from "vue";
import type { z } from "zod";

interface SectionEntry {
  schema: z.ZodTypeAny;
  component: Component | null;
}

const registry = new Map<string, SectionEntry>();

/**
 * Registers a section. Id must be unique within the app bootstrap.
 *
 * The `component` parameter is nullable because WP-068 introduces the
 * registry and schemas without any UI primitives; WP-070 adds the control
 * components and WP-075/WP-076/WP-077 attach them to their respective
 * sections. Until then every call passes `null`.
 */
export function registerSection<S extends z.ZodTypeAny>(
  id: string,
  schema: S,
  component: Component | null,
): void {
  if (registry.has(id)) {
    // why: silent overwrite would let the second registration win invisibly,
    // which would be catastrophic for storage migrations — a v3 -> v4
    // migration targeting section X would run against section Y's shape
    // with no diagnostic. A loud throw at bootstrap is the only correct
    // degradation mode.
    throw new Error(
      `Preferences section "${id}" is already registered. Each id may be registered exactly once per application bootstrap.`,
    );
  }
  registry.set(id, { schema, component });
}

/**
 * Returns a read-only snapshot of the currently registered sections.
 * Callers must not mutate the returned map; the `ReadonlyMap` type is
 * structural and the underlying entry objects are not frozen, but
 * mutation is a contract violation.
 */
export function getRegisteredSections(): ReadonlyMap<string, SectionEntry> {
  return registry;
}

/**
 * Clears the registry. Test-only helper — the name is deliberately long
 * and awkward so misuse is obvious during code review.
 */
// why: production code must never reach the post-bootstrap state where
// sections disappear — the store's composed schema is captured at
// instantiation and would desync from a mid-life registry change. This
// helper exists solely so tests can set up clean per-test state.
export function resetRegistryForTests(): void {
  registry.clear();
}
