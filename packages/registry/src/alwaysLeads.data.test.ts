/**
 * alwaysLeads.data.test.ts — WP-797 / D-24667 Always Leads fidelity
 *
 * Proves the committed card data (all 41 data/cards sets) carries every
 * mastermind's printed Always Leads in the right field:
 *   - every mastermind has both `alwaysLeads` (Villain groups) and
 *     `alwaysLeadsHenchmen` (Henchman groups);
 *   - every lead slug is an in-set group of its own type;
 *   - `ledBy` is symmetric both ways, for villain AND Henchman groups;
 *   - the 9 Henchman leads and the 11 corrected Villain leads hold exactly
 *     (runtime pin, D-24372).
 *
 * Reads the raw JSON (not SetDataSchema): the schema's `.default([])` would mask
 * a set that is missing a lead array.
 *
 * Runner:  node:test (native Node.js test runner)
 * Invoke:  pnpm --filter @legendary-arena/registry test
 *
 * Assumptions:
 *   - CWD is packages/registry/ (pnpm --filter sets CWD to the package root)
 *   - data/cards/*.json exists at the monorepo root, two levels up
 *   - No network access, no database, no mocks — local files only
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// why: pnpm --filter sets CWD to packages/registry/; the card data lives at the
// monorepo root under data/cards/, two directory levels up.
const cardsDirectory = join(process.cwd(), "..", "..", "data", "cards");

/** One mastermind's lead arrays as read from raw JSON (undefined when absent). */
interface RawMastermindLeads {
  slug: string;
  alwaysLeads: string[] | undefined;
  alwaysLeadsHenchmen: string[] | undefined;
}

/** One villain or Henchman group's `ledBy` as read from raw JSON. */
interface RawLedGroup {
  slug: string;
  ledBy: string[] | undefined;
}

/** One set's lead-relevant data. */
interface SetLeads {
  setAbbr: string;
  masterminds: RawMastermindLeads[];
  villains: RawLedGroup[];
  henchmen: RawLedGroup[];
}

/**
 * Narrows an unknown value to a string array, or undefined when it is not one.
 *
 * @param value the raw field value.
 * @returns the string array, or undefined.
 */
function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      return undefined;
    }
    strings.push(entry);
  }
  return strings;
}

/**
 * Reads one raw field off an unknown object entry.
 *
 * @param entry the raw set-JSON entry.
 * @param field the field name.
 * @returns the field's value, or undefined when the entry is not an object.
 */
function readField(entry: unknown, field: string): unknown {
  if (typeof entry !== "object" || entry === null) {
    return undefined;
  }
  const value: unknown = Reflect.get(entry, field);
  return value;
}

/**
 * Reads the `ledBy` groups (villain or Henchman) from a raw set-JSON array.
 *
 * @param entries the raw `villains` or `henchmen` array.
 * @returns each group's slug and ledBy.
 */
function readLedGroups(entries: unknown): RawLedGroup[] {
  const groups: RawLedGroup[] = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const slug = readField(entry, "slug");
    if (typeof slug === "string") {
      groups.push({ slug, ledBy: asStringArray(readField(entry, "ledBy")) });
    }
  }
  return groups;
}

/**
 * Reads every committed set's lead data.
 *
 * @returns one SetLeads record per data/cards file, in file-name order.
 */
function readAllSetLeads(): SetLeads[] {
  const allSets: SetLeads[] = [];
  for (const fileName of readdirSync(cardsDirectory).filter((name) => name.endsWith(".json")).sort()) {
    const setData: unknown = JSON.parse(readFileSync(join(cardsDirectory, fileName), "utf8"));
    const masterminds: RawMastermindLeads[] = [];
    const rawMasterminds = readField(setData, "masterminds");
    for (const entry of Array.isArray(rawMasterminds) ? rawMasterminds : []) {
      const slug = readField(entry, "slug");
      if (typeof slug === "string") {
        masterminds.push({
          slug,
          alwaysLeads: asStringArray(readField(entry, "alwaysLeads")),
          alwaysLeadsHenchmen: asStringArray(readField(entry, "alwaysLeadsHenchmen")),
        });
      }
    }
    allSets.push({
      setAbbr: fileName.replace(".json", ""),
      masterminds,
      villains: readLedGroups(readField(setData, "villains")),
      henchmen: readLedGroups(readField(setData, "henchmen")),
    });
  }
  return allSets;
}

const ALL_SETS = readAllSetLeads();

/**
 * Finds one mastermind's lead arrays by set and slug, failing loudly when absent.
 *
 * @param setAbbr the set abbreviation.
 * @param mastermindSlug the mastermind slug.
 * @returns the mastermind's raw lead arrays.
 */
function findMastermind(setAbbr: string, mastermindSlug: string): RawMastermindLeads {
  const setLeads = ALL_SETS.find((candidate) => candidate.setAbbr === setAbbr);
  const mastermind = setLeads?.masterminds.find((candidate) => candidate.slug === mastermindSlug);
  assert.ok(mastermind !== undefined, `Expected mastermind ${setAbbr}/${mastermindSlug} in data/cards.`);
  return mastermind;
}

/**
 * Asserts that each mastermind lead points at a group of the given list whose
 * ledBy names the mastermind, and each group's ledBy names a mastermind that
 * leads it — the D-16703 symmetry, for one lead field.
 *
 * @param setLeads the set under check.
 * @param leadField which mastermind lead array to read.
 * @param groups the set's groups of the matching type.
 * @param groupLabel "villain" or "Henchman", for failure messages.
 */
function assertSymmetricLeads(
  setLeads: SetLeads,
  leadField: "alwaysLeads" | "alwaysLeadsHenchmen",
  groups: RawLedGroup[],
  groupLabel: string,
): void {
  const groupBySlug = new Map(groups.map((group) => [group.slug, group]));
  for (const mastermind of setLeads.masterminds) {
    for (const leadSlug of mastermind[leadField] ?? []) {
      const group = groupBySlug.get(leadSlug);
      const label = `${setLeads.setAbbr}/${mastermind.slug} ${leadField} "${leadSlug}"`;
      assert.ok(group !== undefined, `${label} is not an in-set ${groupLabel} group.`);
      assert.ok(group.ledBy?.includes(mastermind.slug), `${label}: the group's ledBy must name the mastermind.`);
    }
  }
  const mastermindBySlug = new Map(setLeads.masterminds.map((mastermind) => [mastermind.slug, mastermind]));
  for (const group of groups) {
    for (const leaderSlug of group.ledBy ?? []) {
      const leader = mastermindBySlug.get(leaderSlug);
      const label = `${setLeads.setAbbr} ${groupLabel} group "${group.slug}" ledBy "${leaderSlug}"`;
      assert.ok(leader !== undefined, `${label} is not an in-set mastermind.`);
      assert.ok(leader[leadField]?.includes(group.slug), `${label}: the mastermind's ${leadField} must name the group.`);
    }
  }
}

describe("Always Leads data shape (D-24667)", () => {
  it("reads all 41 committed sets", () => {
    assert.equal(ALL_SETS.length, 41);
  });

  it("gives every mastermind both lead arrays and every villain / Henchman group a ledBy", () => {
    for (const setLeads of ALL_SETS) {
      for (const mastermind of setLeads.masterminds) {
        const label = `${setLeads.setAbbr}/${mastermind.slug}`;
        assert.ok(mastermind.alwaysLeads !== undefined, `${label} must carry alwaysLeads: string[].`);
        assert.ok(mastermind.alwaysLeadsHenchmen !== undefined, `${label} must carry alwaysLeadsHenchmen: string[].`);
      }
      for (const group of [...setLeads.villains, ...setLeads.henchmen]) {
        assert.ok(group.ledBy !== undefined, `${setLeads.setAbbr} group "${group.slug}" must carry ledBy: string[].`);
      }
    }
  });

  it("keeps every lead in-set, of its own type, and symmetric with ledBy", () => {
    for (const setLeads of ALL_SETS) {
      assertSymmetricLeads(setLeads, "alwaysLeads", setLeads.villains, "villain");
      assertSymmetricLeads(setLeads, "alwaysLeadsHenchmen", setLeads.henchmen, "Henchman");
    }
  });
});

describe("Always Leads printed-card pins (WP-797)", () => {
  /** The 9 printed Henchman-Group leads, as [set, mastermind, Henchman slug]. */
  const HENCHMAN_LEADS: [string, string, string][] = [
    ["core", "dr-doom", "doombot-legion"],
    ["co2e", "doctor-doom", "doombot-legion"],
    ["cosm", "magus", "universal-church-of-truth"],
    ["dims", "j-jonah-jameson", "spider-slayer"],
    ["rvlt", "mandarin", "mandarins-rings"],
    ["ssw2", "spider-queen", "spider-infected"],
    ["vill", "odin", "asgardian-warriors"],
    ["wtif", "killmonger-the-betrayer", "vibranium-liberator-drones"],
    ["wtif", "ultron-infinity", "ultron-sentries"],
  ];

  /** The 11 corrected Villain-Group leads, as [set, mastermind, alwaysLeads]. */
  const VILLAIN_LEAD_CORRECTIONS: [string, string, string[]][] = [
    ["asrd", "hela-goddess-of-death", ["omens-of-ragnarok"]],
    ["asrd", "malekith-the-accursed", ["dark-council"]],
    ["msis", "thanos", ["infinity-stones"]],
    ["msis", "ebony-maw", ["children-of-thanos"]],
    ["dkcy", "mephisto", ["underworld"]],
    ["2099", "alchemax-executives", ["alchemax-enforcers"]],
    ["msp1", "loki", ["enemies-of-asgard"]],
    ["amwp", "kang-quantum-conqueror", ["armada-of-kang"]],
    ["co2e", "doctor-octopus", ["sinister-spider-foes"]],
    ["wpnx", "omega-red", []],
    ["mgtg", "ego-the-living-planet", []],
  ];

  it("carries each printed Henchman-Group lead in alwaysLeadsHenchmen, not alwaysLeads", () => {
    for (const [setAbbr, mastermindSlug, henchmanSlug] of HENCHMAN_LEADS) {
      const mastermind = findMastermind(setAbbr, mastermindSlug);
      assert.deepEqual(mastermind.alwaysLeadsHenchmen, [henchmanSlug], `${setAbbr}/${mastermindSlug} Henchman lead.`);
      assert.deepEqual(mastermind.alwaysLeads, [], `${setAbbr}/${mastermindSlug} leads no Villain group.`);
    }
  });

  it("carries each corrected Villain-Group lead exactly as printed", () => {
    for (const [setAbbr, mastermindSlug, expectedLeads] of VILLAIN_LEAD_CORRECTIONS) {
      const mastermind = findMastermind(setAbbr, mastermindSlug);
      assert.deepEqual(mastermind.alwaysLeads, expectedLeads, `${setAbbr}/${mastermindSlug} alwaysLeads.`);
      assert.deepEqual(mastermind.alwaysLeadsHenchmen, [], `${setAbbr}/${mastermindSlug} leads no Henchman group.`);
    }
  });

  it("no longer has Masters of Evil led by core Dr. Doom", () => {
    const coreLeads = ALL_SETS.find((candidate) => candidate.setAbbr === "core");
    const mastersOfEvil = coreLeads?.villains.find((group) => group.slug === "masters-of-evil");
    const doombotLegion = coreLeads?.henchmen.find((group) => group.slug === "doombot-legion");
    assert.deepEqual(mastersOfEvil?.ledBy, []);
    assert.deepEqual(doombotLegion?.ledBy, ["dr-doom"]);
  });
});
