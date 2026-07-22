import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { sfxManifest, type SfxEventKey } from './sfxManifest';

// why: the six NotableGameEventType discriminators, spelled out locally so this
// drift test fails loudly if a variant is unmapped OR mapped to an empty URL.
// The `Record<SfxEventKey, string>` type in sfxManifest.ts is the compile-time
// half of the pin (a seventh engine variant breaks vue-tsc there); this is the
// runtime half.
const EXPECTED_EVENT_KEYS: readonly SfxEventKey[] = [
  'fightResolved',
  'ambushResolved',
  'schemeTwistResolved',
  'mastermindStrikeResolved',
  'mastermindDefeated',
  'healResolved',
];

describe('sfxManifest (WP-412 §C) — exhaustive over NotableGameEventType', () => {
  test('maps exactly the six notable-event keys', () => {
    assert.deepEqual(
      Object.keys(sfxManifest).sort(),
      [...EXPECTED_EVENT_KEYS].sort(),
    );
  });

  test('every event key maps to a non-empty audio/sound-effects/ URL', () => {
    for (const key of EXPECTED_EVENT_KEYS) {
      const url = sfxManifest[key];
      assert.equal(typeof url, 'string', `manifest['${key}'] must be a string`);
      assert.ok(url.length > 0, `manifest['${key}'] must be non-empty`);
      assert.ok(
        url.includes('/audio/sound-effects/'),
        `manifest['${key}'] must reference the audio/sound-effects/ R2 prefix (got '${url}')`,
      );
    }
  });

  test('serves clips from images.legendary-arena.com', () => {
    for (const key of EXPECTED_EVENT_KEYS) {
      assert.ok(
        sfxManifest[key].startsWith('https://images.legendary-arena.com/audio/sound-effects/'),
        `manifest['${key}'] must be hosted on images.legendary-arena.com`,
      );
    }
  });
});
