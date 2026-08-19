/**
 * generate-seed-par.test.ts — WP-422 / EC-457 / D-24242.
 *
 * Proves the two properties the seed PAR generator must hold:
 *  1. Determinism — generating twice into fresh directories produces
 *     byte-identical output (no Date.now / random / unsorted keys), so the
 *     committed artifacts are reproducible and a re-run diffs clean.
 *  2. Publication — a representative scenario resolves through the same
 *     cross-class resolver the server gate uses (`resolveParForScenario`) to a
 *     non-null `source: "seed"` hit, i.e. the committed index actually turns the
 *     competitive surface on.
 *
 * node:test + node:assert only. Run via `pnpm par:seed:test` (from repo root, so
 * the generator's `data/` input paths resolve).
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { posix, join } from "node:path";

import { generate } from "./generate-seed-par.mjs";
import { resolveParForScenario } from "@legendary-arena/game-engine/setup";

/** The season scope: 4 masterminds x 8 schemes x 4 distinct villain-slices. */
const EXPECTED_SCENARIO_COUNT = 128;

/** A known 1-villain (solo) scenario key the season produces. */
const REPRESENTATIVE_SCENARIO_KEY =
  "midtown-bank-robbery::dr-doom::masters-of-evil";

const temporaryRoots: string[] = [];

/** Creates a unique temp directory for one generation and tracks it for cleanup. */
async function makeTemporaryRoot(label: string): Promise<string> {
  // why: pid + label keeps the two generations in this run distinct without a
  // random suffix; the after() hook removes them.
  const root = join(tmpdir(), `seed-par-${process.pid}-${label}`);
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  temporaryRoots.push(root);
  return root;
}

/**
 * Reads every file under a directory tree as a sorted map of
 * posix-relative-path -> UTF-8 contents, for a byte-for-byte comparison.
 */
async function readTreeContents(root: string): Promise<Map<string, string>> {
  const contents = new Map<string, string>();
  async function walk(directory: string, relative: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const childRelative = relative === "" ? entry.name : posix.join(relative, entry.name);
      const childAbsolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(childAbsolute, childRelative);
      } else {
        contents.set(childRelative, await readFile(childAbsolute, "utf8"));
      }
    }
  }
  await walk(root, "");
  return contents;
}

after(async () => {
  for (const root of temporaryRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("generate-seed-par determinism", () => {
  it("produces byte-identical output on two independent generations", async () => {
    const rootA = await makeTemporaryRoot("a");
    const rootB = await makeTemporaryRoot("b");
    const countA = await generate("v1", {
      parBasePath: posix.join(rootA, "par"),
      scoringConfigDir: posix.join(rootA, "scoring-configs"),
    });
    const countB = await generate("v1", {
      parBasePath: posix.join(rootB, "par"),
      scoringConfigDir: posix.join(rootB, "scoring-configs"),
    });

    assert.equal(countA, EXPECTED_SCENARIO_COUNT, "the season must publish exactly 128 scenarios");
    assert.equal(countB, countA, "both generations must publish the same scenario count");

    const treeA = await readTreeContents(rootA);
    const treeB = await readTreeContents(rootB);
    assert.deepEqual(
      [...treeA.keys()].sort(),
      [...treeB.keys()].sort(),
      "both generations must write the same set of files",
    );
    for (const [relativePath, contentsA] of treeA) {
      assert.equal(
        contentsA,
        treeB.get(relativePath),
        `file ${relativePath} must be byte-identical across generations`,
      );
    }
  });
});

describe("generate-seed-par publication", () => {
  it("resolves a representative scenario to a non-null seed PAR (the gate's own resolver)", async () => {
    const root = await makeTemporaryRoot("resolve");
    await generate("v1", {
      parBasePath: posix.join(root, "par"),
      scoringConfigDir: posix.join(root, "scoring-configs"),
    });

    const resolution = await resolveParForScenario(
      REPRESENTATIVE_SCENARIO_KEY,
      posix.join(root, "par"),
      "v1",
    );

    assert.ok(resolution, `expected a PAR resolution for ${REPRESENTATIVE_SCENARIO_KEY}`);
    assert.equal(resolution.source, "seed", "a seed-only index must resolve source 'seed'");
    assert.equal(
      typeof resolution.parValue,
      "number",
      "the resolved PAR value must be a number the gate can normalize against",
    );
  });
});
