/**
 * schema.schemeDeckCounts.test.ts — WP-169 scheme villain-deck count curation
 *
 * Proves the curated per-scheme villainDeckTwistCount / villainDeckBystanderCount
 * data (D-16803) is applied independently and that defaults / carve-outs are not
 * over-encoded (D-16804). The counts themselves are extracted from each scheme's
 * committed printed "Setup:" text and applied by the two converters
 * (convert-cards-v15.mjs for the 36 npm sets, apply-card-counts.mjs for the 4
 * outlier sets); these cases assert the regenerated data/cards/*.json reflect them.
 *
 * Runner:  node:test (native Node.js test runner)
 * Invoke:  pnpm --filter @legendary-arena/registry test
 *
 * Assumptions:
 *   - CWD is packages/registry/ (pnpm --filter sets CWD to the package root)
 *   - data/cards/*.json exist at the monorepo root, two levels up
 *   - No network access, no database, no mocks — local files only
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SetDataSchema } from "./schema.js";

// why: pnpm --filter sets CWD to packages/registry/; the regenerated card data
// lives at the monorepo root under data/cards/, two directory levels up.
const cardsDir = join(process.cwd(), "..", "..", "data", "cards");

// why: the set census lives in data/metadata/sets.json — deriving the expected
// file list from it means adding a new set (e.g. co2e, set 41 in PR #766) does
// not re-break this suite with a hardcoded count.
const setsMetadataPath = join(process.cwd(), "..", "..", "data", "metadata", "sets.json");
const registeredSets = JSON.parse(readFileSync(setsMetadataPath, "utf8")) as Array<{ abbr: string }>;

type Scheme = {
  slug: string;
  villainDeckTwistCount?: number;
  villainDeckBystanderCount?: number;
};

/**
 * Reads a regenerated set file and returns the scheme matching the given slug,
 * failing loudly if the set or scheme is absent so a renamed slug surfaces here
 * rather than as a silent undefined.
 */
function findScheme(setAbbr: string, schemeSlug: string): Scheme {
  const setData = JSON.parse(readFileSync(join(cardsDir, `${setAbbr}.json`), "utf8"));
  const scheme = (setData.schemes as Scheme[]).find((candidate) => candidate.slug === schemeSlug);
  assert.ok(scheme, `${setAbbr}.json must contain the "${schemeSlug}" scheme`);
  return scheme;
}

describe("curated scheme deck counts — independent assignment (WP-169 / D-16803)", () => {
  it("a twist-only scheme carries villainDeckTwistCount and NO villainDeckBystanderCount key", () => {
    const portals = findScheme("core", "portals-to-the-dark-dimension");
    assert.equal(portals.villainDeckTwistCount, 7, "Portals prints 'Setup: 7 Twists.' → twist count 7");
    assert.equal(
      "villainDeckBystanderCount" in portals,
      false,
      "A twist-only entry must leave villainDeckBystanderCount absent (independent assignment, not defaulted)",
    );
  });

  it("the explicit-zero bystander scheme carries villainDeckBystanderCount 0 and NO twist key", () => {
    const hypnotize = findScheme("chmp", "hypnotize-every-human");
    assert.equal(
      hypnotize.villainDeckBystanderCount,
      0,
      "Hypnotize prints 'No Bystanders in the Villain Deck' → bystander count 0",
    );
    assert.equal(
      "villainDeckTwistCount" in hypnotize,
      false,
      "An entry printing the default 8 twists must leave villainDeckTwistCount absent",
    );
  });

  it("a both-counts scheme carries the printed twist and bystander counts", () => {
    const killbots = findScheme("core", "replace-earths-leaders-with-killbots");
    assert.equal(
      killbots.villainDeckTwistCount,
      5,
      "Killbots prints '5 Twists' in the deck (the 3 additional next to the Scheme are excluded)",
    );
    assert.equal(
      killbots.villainDeckBystanderCount,
      18,
      "Killbots prints '18 total Bystanders in the Villain Deck' → bystander count 18",
    );
  });
});

describe("outlier-set application via apply-card-counts.mjs (WP-169 Scope B)", () => {
  it("a 2099 outlier scheme carries its curated twist count", () => {
    const pullReality = findScheme("2099", "pull-reality-into-cyberspace");
    assert.equal(
      pullReality.villainDeckTwistCount,
      7,
      "2099 pull-reality-into-cyberspace prints 'Setup: 7 Twists' → twist count 7 (proves Scope B wiring)",
    );
  });
});

describe("defaults and carve-outs are not over-encoded (WP-169 / D-16804)", () => {
  it("a default-8 scheme with no explicit bystander count carries neither field", () => {
    const cosmicCube = findScheme("core", "unleash-the-power-of-the-cosmic-cube");
    assert.equal(
      "villainDeckTwistCount" in cosmicCube,
      false,
      "An 8-twist scheme must stay unencoded (the 8-twist default is already correct)",
    );
    assert.equal(
      "villainDeckBystanderCount" in cosmicCube,
      false,
      "A scheme naming no villain-deck bystander count must stay unencoded (numPlayers default applies)",
    );
  });

  it("a player-count-dependent (carve-out) scheme carries NO villainDeckTwistCount", () => {
    const civilWar = findScheme("core", "super-hero-civil-war");
    assert.equal(
      "villainDeckTwistCount" in civilWar,
      false,
      "Super Hero Civil War (2-3 players: 8; 4-5 players: 5) is carved out and must keep the 8-twist fallback",
    );
  });
});

// why: the engine's default twist count when a scheme carries no
// villainDeckTwistCount (D-1411); mirrors SCHEME_TWIST_COUNT in villainDeck.setup.ts.
const DEFAULT_TWIST_COUNT = 8;

// why: a Setup sentence that is exactly "N Twist(s)." is a fixed count. A clause
// such as "11 Twists, minus 1 Twist per player" or "Twists equal to the number of
// players plus 4" does not match, so per-player counts (D-16804, sized in the
// engine) stay out of this census.
const FIXED_TWIST_SENTENCE = /(?:^Setup:\s*|\.\s+)(\d+) Twists?\.(?:\s|$)/;

describe("every fixed printed twist count is curated (D-24735)", () => {
  it("a scheme whose Setup line prints a fixed 'N Twists.' builds N twists", () => {
    const mismatches: string[] = [];
    let fixedCountSchemes = 0;
    for (const file of readdirSync(cardsDir).filter((name) => name.endsWith(".json"))) {
      const setData = JSON.parse(readFileSync(join(cardsDir, file), "utf8"));
      for (const scheme of setData.schemes ?? []) {
        const abilityLines: string[] = [];
        for (const card of scheme.cards ?? []) {
          abilityLines.push(...(card.abilities ?? []));
        }
        const setupLine = abilityLines.find((line) => line.startsWith("Setup:"));
        const fixedMatch = setupLine?.match(FIXED_TWIST_SENTENCE);
        if (!fixedMatch) {
          continue;
        }
        fixedCountSchemes += 1;
        const printedCount = Number(fixedMatch[1]);
        const builtCount = scheme.villainDeckTwistCount ?? DEFAULT_TWIST_COUNT;
        if (builtCount !== printedCount) {
          mismatches.push(`${file} ${scheme.slug}: prints ${printedCount}, builds ${builtCount}`);
        }
      }
    }
    assert.ok(fixedCountSchemes > 100, "the census must find the fixed-count schemes (Setup text shape changed?)");
    assert.deepEqual(
      mismatches,
      [],
      "Each scheme printing a fixed twist count needs a matching villainDeckTwistCount in " +
        "scripts/convert-cards/inputs/scheme-deck-counts.json (then regenerate data/cards)",
    );
  });

  it("Clash of the Monsters Unleashed carries its printed 10 twists", () => {
    const clash = findScheme("chmp", "clash-of-the-monsters-unleashed");
    assert.equal(clash.villainDeckTwistCount, 10, "Clash prints 'Setup: 10 Twists.' → twist count 10");
  });
});

describe("all regenerated data/cards/*.json validate against SetDataSchema", () => {
  const setFiles = readdirSync(cardsDir).filter((file) => file.endsWith(".json"));

  it("the cards directory holds exactly one set file per set registered in sets.json", () => {
    const registeredAbbrs = registeredSets.map((set) => set.abbr).sort();
    const fileAbbrs = setFiles.map((file) => file.replace(/\.json$/, "")).sort();
    assert.deepEqual(
      fileAbbrs,
      registeredAbbrs,
      "data/cards/ must contain exactly one regenerated set file per entry in data/metadata/sets.json (a mismatch means a set was registered without regenerating its cards, or an orphan file was left behind)",
    );
  });

  for (const file of setFiles) {
    it(`${file} validates`, () => {
      const setData = JSON.parse(readFileSync(join(cardsDir, file), "utf8"));
      const result = SetDataSchema.safeParse(setData);
      assert.equal(
        result.success,
        true,
        `${file} must validate against SetDataSchema` +
          (result.success ? "" : `: ${JSON.stringify(result.error.issues[0])}`),
      );
    });
  }
});
