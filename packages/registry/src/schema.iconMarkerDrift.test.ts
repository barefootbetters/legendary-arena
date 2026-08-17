/**
 * schema.iconMarkerDrift.test.ts — WP-565 VP icon marker drift guard (D-24374)
 *
 * why: upstream `{ icon: 4 }` is a VICTORY POINT glyph, but convert-cards-v15.mjs
 * mapped it to `piercing` — so 35 ability texts across 12 sets told players the
 * wrong resource. Supreme HYDRA rendered "is worth +3[icon:piercing] for each
 * other HYDRA Villain in your Victory Pile" where the printed card reads +3 VP.
 * SCORING WAS NEVER AFFECTED: no engine path consumes the marker, and the
 * variable-VP maths was verified correct in a live match (Supreme HYDRA scored
 * 15 VP = 3 + 3x4 other HYDRA Villains). Only the text a player reads was wrong.
 *
 * This guard pins the corrected state so the marker cannot return silently — via
 * a re-run of the converter, a new set, or a hand edit.
 *
 * NOTE: `piercing` remains a LEGAL marker slug. This suite asserts only that no
 * CURRENT card text uses it, not that the slug is retired.
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

// why: pnpm --filter sets CWD to packages/registry/; the card data lives at the
// monorepo root under data/cards/, two directory levels up.
const cardsDir = join(process.cwd(), "..", "..", "data", "cards");

/** The marker token this guard forbids in committed card text. */
const FORBIDDEN_MARKER = "[icon:" + "piercing]";

/**
 * Counts occurrences of the forbidden marker in one blob of card text.
 *
 * Written as an explicit loop rather than a regex global-match so a zero result
 * is unambiguous and the helper can be exercised directly by the negative case.
 *
 * @param contents - Raw file contents to scan.
 * @returns How many times the forbidden marker appears.
 */
function countForbiddenMarker(contents: string): number {
  let total = 0;
  let cursor = contents.indexOf(FORBIDDEN_MARKER);
  while (cursor !== -1) {
    total = total + 1;
    cursor = contents.indexOf(FORBIDDEN_MARKER, cursor + FORBIDDEN_MARKER.length);
  }
  return total;
}

describe("icon marker drift — VP glyph never renders as piercing (WP-565 / D-24374)", () => {
  it("no committed card file uses the forbidden marker", () => {
    const offenders: string[] = [];
    let filesScanned = 0;

    for (const fileName of readdirSync(cardsDir)) {
      if (!fileName.endsWith(".json")) {
        continue;
      }
      filesScanned = filesScanned + 1;
      const contents = readFileSync(join(cardsDir, fileName), "utf8");
      const occurrences = countForbiddenMarker(contents);
      if (occurrences > 0) {
        offenders.push(`${fileName} (${occurrences})`);
      }
    }

    // why: a non-trivial scan count proves the walk actually read the corpus —
    // without it, a wrong cardsDir would produce a vacuous pass over zero files.
    assert.ok(
      filesScanned >= 40,
      `Expected to scan the full card corpus, but only read ${filesScanned} files. Check that data/cards/ resolves from packages/registry/.`,
    );

    assert.deepEqual(
      offenders,
      [],
      `Card text must render a victory-point value with the VP glyph, not the piercing glyph (D-24374). Offending files: ${offenders.join(", ")}. Fix the card text; do NOT regenerate data/cards/ (see WP-565 Scaffold Findings).`,
    );
  });

  it("NEGATIVE: the guard fails against a synthetic offender", () => {
    // why: a drift gate that only ever sees clean input cannot prove it guards
    // anything. Driving a synthetic string containing the marker through the same
    // helper the scan uses shows the check is non-vacuous (EC-TEMPLATE §Rules —
    // drift tests must be non-vacuous AND cheat-proof).
    const synthetic = '{"abilities":["Worth +3' + FORBIDDEN_MARKER + ' for each Villain."]}';
    assert.equal(countForbiddenMarker(synthetic), 1);

    const cleanEquivalent = synthetic.replace(FORBIDDEN_MARKER, "[icon:vp]");
    assert.equal(countForbiddenMarker(cleanEquivalent), 0);
  });

  it("the VP glyph IS present in committed card text", () => {
    // why: proves the corpus positively carries the corrected marker, so a future
    // change that strips ability text wholesale cannot satisfy the zero-offender
    // assertion above by emptying the data.
    let vpMarkerFiles = 0;
    for (const fileName of readdirSync(cardsDir)) {
      if (!fileName.endsWith(".json")) {
        continue;
      }
      const contents = readFileSync(join(cardsDir, fileName), "utf8");
      if (contents.includes("[icon:vp]")) {
        vpMarkerFiles = vpMarkerFiles + 1;
      }
    }
    assert.ok(
      vpMarkerFiles > 0,
      "Expected at least one card file to carry the VP icon marker after WP-565.",
    );
  });
});
