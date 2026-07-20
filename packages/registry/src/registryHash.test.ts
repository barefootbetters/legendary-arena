/**
 * registryHash.test.ts — loader parity and hash stability (WP-393 / D-24197).
 *
 * The central claim of this packet is that identical card data produces an
 * identical hash regardless of which loader read it. That cannot be checked
 * against one loader, so these tests exercise BOTH: the local loader against
 * files under the OS temp directory, and the HTTP loader against a
 * `globalThis.fetch` stub serving the same parsed payload.
 *
 * The stub answers the set-index URL as well as each per-set URL —
 * `createRegistryFromHttp` requests both, and a stub covering only the per-set
 * route silently lets the index request reach the real network.
 */

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRegistryFromLocalFiles } from "./impl/localRegistry.js";
import { createRegistryFromHttp } from "./impl/httpRegistry.js";

/** Minimal but schema-valid set index entry. */
function buildSetIndexEntry(abbr: string, name: string) {
  return {
    id: `set-${abbr}`,
    abbr,
    pkgId: `pkg-${abbr}`,
    slug: abbr,
    name,
    releaseDate: "2026-01-01",
    type: "core",
  };
}

/**
 * Minimal but schema-valid set payload, shaped to SetDataSchema.
 *
 * why: built from the real schema rather than a plausible-looking guess — the
 * first version of this fixture failed SetDataSchema silently, every set
 * dropped, and four tests failed against two EMPTY registries that agreed
 * trivially. A fixture that does not load is a test that proves nothing.
 */
function buildSetData(heroName: string, cardCost: number) {
  return {
    id: 1,
    abbr: "fixture",
    exportName: "Fixture Set",
    heroes: [
      {
        id: 1,
        name: heroName,
        slug: heroName.toLowerCase(),
        team: "Avengers",
        cards: [{ slug: "card-one", name: "A Card", cost: cardCost }],
        physicalCards: [
          {
            id: "p1",
            count: 1,
            imageUrl: "https://images.example.test/card-one.jpg",
            sides: ["card-one"],
          },
        ],
      },
    ],
    masterminds: [],
    villains: [],
    henchmen: [],
    schemes: [],
    bystanders: [],
    wounds: [],
    other: [],
  };
}

const temporaryDirectories: string[] = [];
let originalFetch: typeof globalThis.fetch | undefined;

afterEach(async () => {
  // why: the fetch stub is global state. Restoring it in afterEach rather than
  // at the end of each test means a failing assertion cannot leave a poisoned
  // fetch behind for every later test in the file.
  if (originalFetch !== undefined) {
    globalThis.fetch = originalFetch;
    originalFetch = undefined;
  }
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

/** Writes a metadata/cards tree the local loader can read. */
async function writeLocalFixture(
  sets: Array<{ abbr: string; name: string; data: unknown }>
): Promise<{ metadataDir: string; cardsDir: string }> {
  const root = await mkdtemp(join(tmpdir(), "registry-hash-"));
  temporaryDirectories.push(root);

  const metadataDir = join(root, "metadata");
  const cardsDir = join(root, "cards");
  await mkdir(metadataDir, { recursive: true });
  await mkdir(cardsDir, { recursive: true });

  const setIndex = sets.map((set) => buildSetIndexEntry(set.abbr, set.name));
  await writeFile(join(metadataDir, "sets.json"), JSON.stringify(setIndex), "utf8");

  for (const set of sets) {
    await writeFile(
      join(cardsDir, `${set.abbr}.json`),
      JSON.stringify(set.data),
      "utf8"
    );
  }
  return { metadataDir, cardsDir };
}

/** Installs a fetch stub answering the set index AND every per-set URL. */
function installFetchStub(
  sets: Array<{ abbr: string; name: string; data: unknown }>
): void {
  originalFetch = globalThis.fetch;
  const setIndex = sets.map((set) => buildSetIndexEntry(set.abbr, set.name));

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("sets.json")) {
      return new Response(JSON.stringify(setIndex), { status: 200 });
    }
    for (const set of sets) {
      if (url.includes(`${set.abbr}.json`)) {
        return new Response(JSON.stringify(set.data), { status: 200 });
      }
    }
    // why: fail loudly rather than passing the request through. A stub that
    // silently forwards turns a unit test into a network test, and the
    // failure surfaces somewhere far away from the cause.
    throw new Error(
      `Fetch stub received an unexpected URL "${url}". The stub must answer ` +
        `every URL the loader requests; add the missing route to this test.`
    );
  }) as typeof globalThis.fetch;
}

describe("registry content hashes — loader parity", () => {
  test("AC-2: both loaders agree for identical data and an equal load scope", async () => {
    const sets = [
      { abbr: "core", name: "Core Set", data: buildSetData("Cyclops", 3) },
      { abbr: "xmen", name: "X-Men", data: buildSetData("Storm", 5) },
    ];

    const { metadataDir, cardsDir } = await writeLocalFixture(sets);
    const local = await createRegistryFromLocalFiles({ metadataDir, cardsDir });

    installFetchStub(sets);
    // why: the HTTP loader defaults to `options.eagerLoad ?? []` — ZERO sets.
    // Without an explicit eagerLoad the comparison would be two empty
    // registries agreeing trivially.
    const http = await createRegistryFromHttp({
      metadataBaseUrl: "https://example.test",
      eagerLoad: ["core", "xmen"],
    });

    const localInfo = local.info();
    const httpInfo = http.info();

    assert.deepEqual(
      localInfo.setContentHashes,
      httpInfo.setContentHashes,
      "per-set hashes must match across loaders"
    );
    assert.equal(
      localInfo.registryVersion,
      httpInfo.registryVersion,
      "registryVersion must match across loaders"
    );
    assert.match(String(localInfo.registryVersion), /^sha256:[0-9a-f]{64}$/);
  });

  test("AC-3: changing a card changes that set's hash and the registryVersion", async () => {
    const before = await writeLocalFixture([
      { abbr: "core", name: "Core Set", data: buildSetData("Cyclops", 3) },
    ]);
    const after = await writeLocalFixture([
      { abbr: "core", name: "Core Set", data: buildSetData("Cyclops", 4) },
    ]);

    const first = (await createRegistryFromLocalFiles(before)).info();
    const second = (await createRegistryFromLocalFiles(after)).info();

    assert.notEqual(
      first.setContentHashes?.core,
      second.setContentHashes?.core,
      "a changed cost must change the set hash"
    );
    assert.notEqual(first.registryVersion, second.registryVersion);
  });

  test("AC-4: registryVersion is independent of set LOAD ORDER", async () => {
    const sets = [
      { abbr: "core", name: "Core Set", data: buildSetData("Cyclops", 3) },
      { abbr: "xmen", name: "X-Men", data: buildSetData("Storm", 5) },
    ];

    installFetchStub(sets);
    const forward = await createRegistryFromHttp({
      metadataBaseUrl: "https://example.test",
      eagerLoad: ["core", "xmen"],
    });
    const forwardVersion = forward.info().registryVersion;
    globalThis.fetch = originalFetch as typeof globalThis.fetch;

    installFetchStub(sets);
    const reversed = await createRegistryFromHttp({
      metadataBaseUrl: "https://example.test",
      eagerLoad: ["xmen", "core"],
    });
    const reversedVersion = reversed.info().registryVersion;

    assert.equal(forwardVersion, reversedVersion);
  });

  test("AC-5: registryVersion differs by load SCOPE; per-set hashes do not", async () => {
    const sets = [
      { abbr: "core", name: "Core Set", data: buildSetData("Cyclops", 3) },
      { abbr: "xmen", name: "X-Men", data: buildSetData("Storm", 5) },
    ];

    installFetchStub(sets);
    const both = await createRegistryFromHttp({
      metadataBaseUrl: "https://example.test",
      eagerLoad: ["core", "xmen"],
    });
    const bothInfo = both.info();
    globalThis.fetch = originalFetch as typeof globalThis.fetch;

    installFetchStub(sets);
    const onlyCore = await createRegistryFromHttp({
      metadataBaseUrl: "https://example.test",
      eagerLoad: ["core"],
    });
    const coreInfo = onlyCore.info();

    assert.notEqual(
      bothInfo.registryVersion,
      coreInfo.registryVersion,
      "a narrower load scope must report a different registryVersion"
    );
    assert.equal(
      bothInfo.setContentHashes?.core,
      coreInfo.setContentHashes?.core,
      "the same set must hash identically regardless of what else loaded"
    );
  });

  test("AC-5b: a zero-set load scope omits both fields entirely", async () => {
    installFetchStub([
      { abbr: "core", name: "Core Set", data: buildSetData("Cyclops", 3) },
    ]);
    // No eagerLoad — the HTTP loader's default is zero sets.
    const empty = await createRegistryFromHttp({
      metadataBaseUrl: "https://example.test",
    });
    const info = empty.info();

    assert.equal(info.registryVersion, undefined);
    assert.equal(info.setContentHashes, undefined);
  });

  test("info() returns a fresh hash object, not the cached reference", async () => {
    const { metadataDir, cardsDir } = await writeLocalFixture([
      { abbr: "core", name: "Core Set", data: buildSetData("Cyclops", 3) },
    ]);
    const registry = await createRegistryFromLocalFiles({ metadataDir, cardsDir });

    const first = registry.info();
    assert.notEqual(
      first.setContentHashes,
      registry.info().setContentHashes,
      "each call must return a distinct object"
    );

    // Mutating what a caller received must not corrupt the registry.
    delete first.setContentHashes?.core;
    assert.ok(
      registry.info().setContentHashes?.core,
      "mutating a returned object leaked into the registry's cache"
    );
  });
});
