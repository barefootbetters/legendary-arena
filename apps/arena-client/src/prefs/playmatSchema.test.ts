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

  test('SKIN_NAMES equals the D-24478 curated named-mat set (five entries)', () => {
    // WP-666 / D-24478 superseded the D-13003 three-skin lock with a curated
    // five-entry named-mat set. The classic/comic/minimal originals plus the
    // two first-party named mats midtown + cosmic.
    const sorted = SKIN_NAMES.slice().sort();
    assert.deepEqual(sorted, ['classic', 'comic', 'cosmic', 'midtown', 'minimal']);
  });

  test('every manifest entry carries displayLabel and boardBackgroundUrl (WP-666)', () => {
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
      // WP-666 ships no licensed art — the seam is unused in this set.
      assert.notEqual(entry.licensed, true, `${name} must not be marked licensed in WP-666`);
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
