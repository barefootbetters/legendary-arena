import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { profileHref } from './profileLink.ts';

/**
 * Pure-logic tests for the leaderboard profile-link helper (WP-579 / D-24388).
 * The panel SFCs render a link only when `entry.handleCanonical` is present (a
 * claimed handle) and plain text otherwise — that v-if is covered by typecheck
 * + the dev-server smoke, matching the legends-board convention (see
 * matchResultDisplay.test.ts). This pins the URL the link points at.
 */
describe('profileHref (WP-579)', () => {
  it('builds the play-surface profile URL from a claimed canonical handle', () => {
    assert.equal(
      profileHref('alicethegreat'),
      'https://play.legendary-arena.com/?profile=alicethegreat',
    );
  });

  it('percent-encodes a handle with URL-significant characters', () => {
    // why: defends against a canonical handle that contains characters the URL
    // would otherwise interpret (query separators, spaces).
    assert.equal(
      profileHref('a b&c'),
      'https://play.legendary-arena.com/?profile=a%20b%26c',
    );
  });
});
