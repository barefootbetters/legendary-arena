import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { moveSfxManifest } from './moveSfxManifest';
import type { UiMoveName } from '../components/play/uiMoveName.types';

// why: the five player-action moves that carry a Surface-2 tactile cue, spelled
// out locally with their locked ewiki filenames so this drift test fails loudly
// if a mapping is dropped, renamed, or points at the wrong clip. The
// `Partial<Record<UiMoveName, string>>` type in moveSfxManifest.ts is the
// compile-time half of the pin (renaming a UiMoveName breaks vue-tsc there);
// this is the runtime half.
const EXPECTED_MOVE_CLIPS: Readonly<Partial<Record<UiMoveName, string>>> = {
  playCard: 'play-card.mp3',
  recruitHero: 'recruit-hero.mp3',
  fightVillain: 'attack-villain.mp3',
  drawCards: 'draw-cards.mp3',
  endTurn: 'end-turn.mp3',
};

const EXPECTED_MOVE_KEYS = Object.keys(EXPECTED_MOVE_CLIPS) as UiMoveName[];

describe('moveSfxManifest (WP-419 §A) — the five dispatch-keyed move cues', () => {
  test('maps exactly the five player-action move keys', () => {
    assert.deepEqual(
      Object.keys(moveSfxManifest).sort(),
      [...EXPECTED_MOVE_KEYS].sort(),
    );
  });

  test('each move maps to its locked ewiki clip filename', () => {
    for (const key of EXPECTED_MOVE_KEYS) {
      const url = moveSfxManifest[key];
      assert.equal(typeof url, 'string', `manifest['${key}'] must be a string`);
      assert.ok(
        url?.endsWith(`/${EXPECTED_MOVE_CLIPS[key]}`),
        `manifest['${key}'] must end with '${EXPECTED_MOVE_CLIPS[key]}' (got '${url}')`,
      );
    }
  });

  test('every clip is a non-empty images.legendary-arena.com/audio/sound-effects/ URL', () => {
    for (const key of EXPECTED_MOVE_KEYS) {
      const url = moveSfxManifest[key] ?? '';
      assert.ok(url.length > 0, `manifest['${key}'] must be non-empty`);
      assert.ok(
        url.startsWith('https://images.legendary-arena.com/audio/sound-effects/'),
        `manifest['${key}'] must be hosted on the images.legendary-arena.com R2 prefix (got '${url}')`,
      );
    }
  });

  test('clip filenames use hyphens, never underscores (the repo image-URL rule)', () => {
    for (const key of EXPECTED_MOVE_KEYS) {
      const filename = (moveSfxManifest[key] ?? '').split('/').pop() ?? '';
      assert.ok(
        !filename.includes('_'),
        `manifest['${key}'] filename '${filename}' must use hyphens, not underscores`,
      );
    }
  });

  // why: the ewiki Surface-2 table lists a sixth row, dodgeCard → dodge.mp3, but
  // dodgeCard is an engine-only move with no UiMoveName / no client dispatch
  // path (WP-419 Out of Scope). Pin its ABSENCE so a future contributor who adds
  // a dodge UI affordance is reminded to map it here, and so the gap is not
  // silently "fixed" by mapping a clip that can never fire.
  test('does NOT map dodgeCard (no client dispatch path — documented gap)', () => {
    assert.ok(
      !Object.prototype.hasOwnProperty.call(moveSfxManifest, 'dodgeCard'),
      'dodgeCard has no UiMoveName dispatch path; mapping it would add an unfired clip',
    );
  });
});
