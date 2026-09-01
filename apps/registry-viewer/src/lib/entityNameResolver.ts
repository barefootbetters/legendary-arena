/**
 * entityNameResolver.ts — group-level ext_id → display-name resolver for the
 * Registry Viewer (WP-245 loadout LAGN export).
 *
 * A composition ext_id is the set-qualified `setAbbr/slug` (D-24018) of a
 * mastermind, scheme, villain group, henchman group, or hero. Each of those
 * entities owns several cards that all share that one ext_id — a mastermind's
 * base face plus its four Tactics, a villain group's members, a hero's card set.
 * So the display name for a composition ext_id is the ENTITY's name, read from
 * `registry.getSet(abbr)` — NOT a member card's name from `listCards()`, where
 * keying by ext_id would let the last card written win (a Red Skull mastermind
 * resolving to its "Ruthless Dictator" Tactic instead of the base face). This
 * mirrors the server-side `buildNameResolver`
 * (`apps/server/src/match/matchLagn.logic.ts`).
 */

import type { CardRegistry } from "../registry/browser";

/** Resolve a set-qualified ext_id to a display name (or the ext_id when absent). */
export type ResolveEntityName = (extId: string) => string;

/**
 * Narrow an untyped set entity (a henchman group, typed `unknown` by the set
 * schema) to the `{ name, slug }` shape the resolver maps. Returns `false` for
 * any value missing a string `name` or `slug`.
 *
 * @param value The candidate entity.
 * @returns True when the value has string `name` and `slug` fields.
 */
function isNamedEntity(value: unknown): value is { name: string; slug: string } {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const candidate = value as { name?: unknown; slug?: unknown };
  return typeof candidate.name === "string" && typeof candidate.slug === "string";
}

/**
 * Build a resolver from every loaded set's group-level entities: one entry per
 * hero, mastermind, villain group, henchman group, and scheme, keyed
 * `${abbr}/${slug}` → `entity.name`. An ext_id with no entity (a set not yet
 * loaded, a malformed row) falls back to the ext_id unchanged — never a blank
 * name.
 *
 * @param registry The viewer's loaded CardRegistry.
 * @returns A resolver returning the display name, or the ext_id when absent.
 */
export function buildEntityNameResolver(registry: CardRegistry): ResolveEntityName {
  const nameByExtId = new Map<string, string>();
  for (const setEntry of registry.listSets()) {
    const setData = registry.getSet(setEntry.abbr);
    if (setData === undefined) {
      continue;
    }
    // why: use setData.abbr for the ext_id prefix so the key is byte-identical to
    // the `${abbr}/${slug}` ext_id the loadout draft carries (D-24018).
    const setAbbr = setData.abbr;
    for (const hero of setData.heroes) {
      nameByExtId.set(`${setAbbr}/${hero.slug}`, hero.name);
    }
    for (const mastermind of setData.masterminds) {
      nameByExtId.set(`${setAbbr}/${mastermind.slug}`, mastermind.name);
    }
    for (const villainGroup of setData.villains) {
      nameByExtId.set(`${setAbbr}/${villainGroup.slug}`, villainGroup.name);
    }
    for (const scheme of setData.schemes) {
      nameByExtId.set(`${setAbbr}/${scheme.slug}`, scheme.name);
    }
    // why: the set schema types `henchmen` as unknown[]; narrow each entry to its
    // { name, slug } before mapping, skipping a malformed row rather than throwing.
    for (const henchmanGroup of setData.henchmen) {
      if (isNamedEntity(henchmanGroup)) {
        nameByExtId.set(`${setAbbr}/${henchmanGroup.slug}`, henchmanGroup.name);
      }
    }
  }
  return (extId) => nameByExtId.get(extId) ?? extId;
}
