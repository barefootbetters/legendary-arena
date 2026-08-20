import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildEntityNameResolver } from "./entityNameResolver";
import type { CardRegistry } from "../registry/browser";

/** One set's group-level entities the resolver reads via getSet(). */
interface FakeSet {
  abbr: string;
  heroes?: { name: string; slug: string }[];
  masterminds?: { name: string; slug: string }[];
  villains?: { name: string; slug: string }[];
  henchmen?: unknown[];
  schemes?: { name: string; slug: string }[];
}

/** A fake registry exposing the listSets()/getSet() surface the resolver reads. */
function fakeRegistry(sets: FakeSet[]): CardRegistry {
  const byAbbr = new Map(sets.map((set) => [set.abbr, set]));
  return {
    listSets: () => sets.map((set) => ({ abbr: set.abbr })),
    getSet: (abbr: string) => {
      const set = byAbbr.get(abbr);
      if (set === undefined) {
        return undefined;
      }
      return {
        abbr: set.abbr,
        heroes: set.heroes ?? [],
        masterminds: set.masterminds ?? [],
        villains: set.villains ?? [],
        henchmen: set.henchmen ?? [],
        schemes: set.schemes ?? [],
      };
    },
  } as unknown as CardRegistry;
}

test("resolves each composition entity kind to its group-level name", () => {
  const resolveName = buildEntityNameResolver(
    fakeRegistry([
      {
        abbr: "core",
        heroes: [{ name: "Spider-Man", slug: "spider-man" }],
        masterminds: [{ name: "Red Skull", slug: "red-skull" }],
        villains: [{ name: "HYDRA", slug: "hydra" }],
        henchmen: [{ name: "Doombot Legion", slug: "doombot-legion" }],
        schemes: [{ name: "Super Hero Civil War", slug: "super-hero-civil-war" }],
      },
    ]),
  );
  assert.equal(resolveName("core/spider-man"), "Spider-Man");
  assert.equal(resolveName("core/red-skull"), "Red Skull");
  assert.equal(resolveName("core/hydra"), "HYDRA");
  assert.equal(resolveName("core/doombot-legion"), "Doombot Legion");
  assert.equal(resolveName("core/super-hero-civil-war"), "Super Hero Civil War");
});

test("an unknown ext_id falls back to the ext_id, never a blank name", () => {
  const resolveName = buildEntityNameResolver(
    fakeRegistry([{ abbr: "core", masterminds: [{ name: "Red Skull", slug: "red-skull" }] }]),
  );
  assert.equal(resolveName("core/unknown-entity"), "core/unknown-entity");
  assert.notEqual(resolveName("core/unknown-entity"), "");
});

test("a mastermind resolves to its group name regardless of Tactic-card entries", () => {
  // why: the entity name is read from getSet().masterminds (the base face), so
  // the four Red Skull Tactic cards (Ruthless Dictator, …) can never win the
  // ext_id — the exact collision the sibling server fix addresses.
  const resolveName = buildEntityNameResolver(
    fakeRegistry([{ abbr: "core", masterminds: [{ name: "Red Skull", slug: "red-skull" }] }]),
  );
  assert.equal(resolveName("core/red-skull"), "Red Skull");
  assert.notEqual(resolveName("core/red-skull"), "Ruthless Dictator");
});
