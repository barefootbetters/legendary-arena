import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { parseSkinName, isSkinName, SKIN_NAMES, DEFAULT_SKIN_NAME } from './playmatSchema';
import { skinManifest, type SkinName, type SkinManifestEntry } from './skinManifest';

describe('WP-130 prefs/playmatSchema', () => {
  test('SKIN_NAMES exactly equals Object.keys(skinManifest) (drift detection)', () => {
    const schemaKeys = SKIN_NAMES.slice().sort();
    const manifestKeys = (Object.keys(skinManifest) as SkinName[]).slice().sort();
    assert.deepEqual(
      schemaKeys,
      manifestKeys,
      'SkinName closed set drifted from skinManifest keys; re-derive SKIN_NAMES from Object.keys(skinManifest) per WP-130 §A canonical-source rule.',
    );
  });

  test('SKIN_NAMES equals the curated named-mat set (5 first-party + 9 licensed mats)', () => {
    // WP-666 / D-24478 superseded the D-13003 three-skin lock. The set is the
    // five first-party skins (classic/comic/minimal/midtown/cosmic) plus the nine
    // licensed Marvel / Upper Deck mats from the ewiki play-mats catalogue.
    const sorted = SKIN_NAMES.slice().sort();
    assert.deepEqual(sorted, [
      'classic', 'comic', 'cosmic', 'darkcity', 'darkphoenix', 'loki', 'midtown',
      'minimal', 'painttown', 'spidermanart', 'thanos', 'thanosart', 'villains', 'wolverine',
    ]);
  });

  test('every manifest entry carries displayLabel + boardBackgroundUrl, and licensed mats carry attribution', () => {
    for (const name of SKIN_NAMES) {
      // Widen to the interface so the optional `licensed` seam is reachable
      // (the `as const satisfies` narrows each entry's literal type without it).
      const entry: SkinManifestEntry = skinManifest[name];
      assert.equal(typeof entry.displayLabel, 'string', `${name} must have a displayLabel`);
      assert.ok(entry.displayLabel.length > 0, `${name} displayLabel must be non-empty`);
      // boardBackgroundUrl is a URL string (bundled/CDN) or null (palette ground).
      const url = entry.boardBackgroundUrl;
      assert.ok(
        url === null || (typeof url === 'string' && url.length > 0),
        `${name} boardBackgroundUrl must be a non-empty string or null`,
      );
      // A licensed mat must credit its source AND actually carry an image.
      if (entry.licensed === true) {
        assert.ok(
          typeof entry.attribution === 'string' && entry.attribution.length > 0,
          `${name} is licensed and must carry an attribution string`,
        );
        assert.ok(url !== null, `${name} is licensed and must carry a board image`);
      }
    }
  });

  test('DEFAULT_SKIN_NAME equals the WP-130 locked default value', () => {
    assert.equal(DEFAULT_SKIN_NAME, 'classic');
  });

  test('isSkinName accepts every name in the closed set', () => {
    for (const name of SKIN_NAMES) {
      assert.equal(isSkinName(name), true, `expected ${name} to narrow to SkinName`);
    }
  });

  test('isSkinName rejects unknown names, non-strings, and falsy values', () => {
    assert.equal(isSkinName('not-a-skin'), false);
    assert.equal(isSkinName(''), false);
    assert.equal(isSkinName(null), false);
    assert.equal(isSkinName(undefined), false);
    assert.equal(isSkinName(42), false);
    assert.equal(isSkinName({}), false);
    assert.equal(isSkinName(['classic']), false);
  });

  test('parseSkinName falls back to DEFAULT_SKIN_NAME for any rejected input', () => {
    const originalWarn = console.warn;
    let warnCount = 0;
    console.warn = () => {
      warnCount += 1;
    };
    try {
      assert.equal(parseSkinName('totally-unknown'), DEFAULT_SKIN_NAME);
      assert.equal(parseSkinName(null), DEFAULT_SKIN_NAME);
      assert.equal(parseSkinName(undefined), DEFAULT_SKIN_NAME);
      assert.equal(parseSkinName(123), DEFAULT_SKIN_NAME);
      assert.equal(warnCount, 4, 'expected one console.warn per rejected input');
    } finally {
      console.warn = originalWarn;
    }
  });

  test('parseSkinName returns the supplied value when it is in the closed set', () => {
    for (const name of SKIN_NAMES) {
      assert.equal(parseSkinName(name), name);
    }
  });
});
