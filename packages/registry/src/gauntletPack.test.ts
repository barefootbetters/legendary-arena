/**
 * Unit tests for the Gauntlet Pack identity contract (WP-440 / EC-475).
 *
 * Covers: the round-trip of a `core/magneto` identity pack, an identity-only
 * key assertion (proving no legs/heroes/compositions leak in), and the four
 * reject paths — unknown major version, unknown key at either object level,
 * out-of-range player count, and a bad division value.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  GAUNTLET_PACK_VERSION,
  buildGauntletPack,
  validateGauntletPack,
  type GauntletPackIdentity,
} from "./gauntletPack.js";

/** The canonical identity used across the round-trip and negative tests. */
const magnetoIdentity: GauntletPackIdentity = {
  setAbbr: "core",
  mastermindSlug: "magneto",
  division: "fixed",
  playerCount: 1,
};

test("buildGauntletPack stamps the version and returns the identity-only pack", () => {
  const pack = buildGauntletPack(magnetoIdentity);
  assert.deepEqual(pack, {
    pack_version: 1,
    gauntlet: {
      setAbbr: "core",
      mastermindSlug: "magneto",
      division: "fixed",
      playerCount: 1,
    },
  });
  assert.equal(pack.pack_version, GAUNTLET_PACK_VERSION);
});

test("a built pack survives a JSON round-trip through validateGauntletPack", () => {
  const built = buildGauntletPack(magnetoIdentity);
  const roundTripped = validateGauntletPack(JSON.parse(JSON.stringify(built)));
  assert.deepEqual(roundTripped, built);
});

test("the validated pack carries exactly the identity keys and no run data", () => {
  const pack = validateGauntletPack(buildGauntletPack(magnetoIdentity));

  // Positive: exactly the two top-level keys and four identity keys.
  assert.deepEqual(Object.keys(pack).sort(), ["gauntlet", "pack_version"]);
  assert.deepEqual(Object.keys(pack.gauntlet).sort(), [
    "division",
    "mastermindSlug",
    "playerCount",
    "setAbbr",
  ]);

  // Negative: assert run/composition fields are ABSENT, not merely unread.
  const topLevel = pack as Record<string, unknown>;
  const gauntlet = pack.gauntlet as Record<string, unknown>;
  assert.equal("legs" in topLevel, false);
  assert.equal("heroDeckIds" in gauntlet, false);
  assert.equal("heroes" in gauntlet, false);
  assert.equal("compositions" in gauntlet, false);
  assert.equal("villainGroupIds" in gauntlet, false);
  assert.equal("henchmanGroupIds" in gauntlet, false);
});

test("an unknown major pack_version is rejected naming both versions", () => {
  const futurePack = {
    pack_version: 2,
    gauntlet: { ...magnetoIdentity },
  };
  assert.throws(
    () => validateGauntletPack(futurePack),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      // The message must name the unsupported version and the version read.
      assert.match(error.message, /pack_version 2/);
      assert.match(error.message, /version 1/);
      return true;
    },
  );
});

test("an extra top-level key is rejected by the strict schema", () => {
  const packWithLegs = {
    pack_version: 1,
    gauntlet: { ...magnetoIdentity },
    legs: [],
  };
  assert.throws(
    () => validateGauntletPack(packWithLegs),
    (error: unknown) => error instanceof Error,
  );
});

test("an extra gauntlet-level key is rejected by the strict schema", () => {
  const packWithHeroes = {
    pack_version: 1,
    gauntlet: { ...magnetoIdentity, heroDeckIds: [] },
  };
  assert.throws(
    () => validateGauntletPack(packWithHeroes),
    (error: unknown) => error instanceof Error,
  );
});

test("a playerCount of 0 is rejected", () => {
  const packZeroPlayers = {
    pack_version: 1,
    gauntlet: { ...magnetoIdentity, playerCount: 0 },
  };
  assert.throws(
    () => validateGauntletPack(packZeroPlayers),
    (error: unknown) => error instanceof Error,
  );
});

test("a playerCount of 6 is rejected", () => {
  const packSixPlayers = {
    pack_version: 1,
    gauntlet: { ...magnetoIdentity, playerCount: 6 },
  };
  assert.throws(
    () => validateGauntletPack(packSixPlayers),
    (error: unknown) => error instanceof Error,
  );
});

test("a division outside 'fixed' | 'open' is rejected", () => {
  const packBadDivision = {
    pack_version: 1,
    gauntlet: { ...magnetoIdentity, division: "legendary" },
  };
  assert.throws(
    () => validateGauntletPack(packBadDivision),
    (error: unknown) => error instanceof Error,
  );
});
