import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { menaceMusicManifest, musicTrackForTier } from './menaceMusicManifest';
import { MENACE_TIERS } from '@legendary-arena/game-engine';

describe('menaceMusicManifest (WP-560) — tier coverage', () => {
  test('AC-1: every MenaceTier maps to a distinct track', () => {
    // why: iterating the ENGINE's canonical array rather than a local list
    // means a future tier member fails this test until it is given a loop —
    // the shared contract stays honest across the package boundary.
    const urls = MENACE_TIERS.map((tier) => musicTrackForTier(tier));
    assert.equal(urls.length, MENACE_TIERS.length);
    assert.equal(new Set(urls).size, MENACE_TIERS.length);
  });

  test('every track is an R2 music URL, not a sound-effects URL', () => {
    // why: music uses a NEW audio/music/ prefix, sibling to the SFX prefix.
    // A track accidentally pointed at audio/sound-effects/ would 404 forever.
    for (const url of Object.values(menaceMusicManifest)) {
      assert.equal(
        url.startsWith('https://images.legendary-arena.com/audio/music/'),
        true,
        `${url} must live under the audio/music/ prefix`,
      );
    }
  });

  test('the manifest declares no band boundaries of its own', () => {
    // why: D-24369 §3 — the bands live once, engine-side. This module keys off
    // the projected tier and must contain no numeric thresholds. A second band
    // table here is how the Danger Meter and this score would drift apart.
    const source = JSON.stringify(menaceMusicManifest);
    assert.equal(/0\.\d+/.test(source), false, 'no numeric thresholds in the manifest');
  });

  test('musicTrackForTier returns the tier it is given, not a re-derived one', () => {
    assert.equal(musicTrackForTier('calm'), menaceMusicManifest.calm);
    assert.equal(musicTrackForTier('critical'), menaceMusicManifest.critical);
  });
});
