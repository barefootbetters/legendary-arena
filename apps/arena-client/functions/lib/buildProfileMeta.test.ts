/**
 * Tests for `buildProfileMeta` — Client App edge subsurface (WP-300 / EC-331).
 *
 * Covers the load-bearing safety property (HTML-attribute escaping of the
 * user-controlled display fields), the display-name → display-handle title
 * fallback, the §23 description guard (no combat/PvP framing), and the
 * canonical `og:url` composition.
 *
 * Runner: `node:test` (native). No game-framework, engine, or registry
 * imports — the edge subsurface isolation is asserted by omission here and
 * grep-gated at the EC's forbidden-import check.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProfileMeta,
  type PublicProfileMetaInput,
  type MetaTag,
} from './buildProfileMeta';

/**
 * Build a `PublicProfileMetaInput` with sensible defaults, overridable
 * per-field so each test states only what it varies.
 */
function makeProfile(
  overrides: Partial<PublicProfileMetaInput> = {},
): PublicProfileMetaInput {
  return {
    displayName: 'Aria Stormblade',
    displayHandle: 'aria_sb',
    badges: [],
    teamAffiliations: [],
    publicReplays: [],
    ...overrides,
  };
}

/**
 * Find the `content` of the tag with the given key, asserting it exists.
 */
function contentOf(tags: readonly MetaTag[], key: string): string {
  const match = tags.find((tag) => tag.key === key);
  assert.ok(match, `expected a tag with key "${key}" to be present`);
  return match.content;
}

test('returns exactly the locked tag set', () => {
  const { tags } = buildProfileMeta(makeProfile(), 'aria_sb');
  const keys = tags.map((tag) => tag.key);
  assert.deepEqual(keys, [
    'og:type',
    'og:title',
    'og:description',
    'og:image',
    'og:url',
    'twitter:card',
    'twitter:title',
    'twitter:description',
    'twitter:image',
  ]);
  assert.equal(contentOf(tags, 'og:type'), 'profile');
  assert.equal(contentOf(tags, 'twitter:card'), 'summary_large_image');
});

test('title uses displayName when present', () => {
  const { tags } = buildProfileMeta(makeProfile(), 'aria_sb');
  assert.equal(contentOf(tags, 'og:title'), 'Aria Stormblade');
  assert.equal(contentOf(tags, 'twitter:title'), 'Aria Stormblade');
});

test('title falls back to displayHandle when displayName is empty', () => {
  const { tags } = buildProfileMeta(
    makeProfile({ displayName: '', displayHandle: 'aria_sb' }),
    'aria_sb',
  );
  assert.equal(contentOf(tags, 'og:title'), 'aria_sb');
  assert.equal(contentOf(tags, 'twitter:title'), 'aria_sb');
});

test('title falls back when displayName is whitespace-only', () => {
  const { tags } = buildProfileMeta(
    makeProfile({ displayName: '   ', displayHandle: 'aria_sb' }),
    'aria_sb',
  );
  assert.equal(contentOf(tags, 'og:title'), 'aria_sb');
});

test('description composes the public counts with correct pluralization', () => {
  const { tags } = buildProfileMeta(
    makeProfile({
      badges: [{}, {}, {}],
      teamAffiliations: [{}],
      publicReplays: [{}, {}],
    }),
    'aria_sb',
  );
  const description = contentOf(tags, 'og:description');
  assert.equal(
    description,
    'Aria Stormblade on Legendary Arena — 3 badges, 1 team affiliation, 2 public replays.',
  );
});

test('description uses singular nouns at count one and plural at zero', () => {
  const { tags } = buildProfileMeta(
    makeProfile({ badges: [{}], teamAffiliations: [], publicReplays: [] }),
    'aria_sb',
  );
  const description = contentOf(tags, 'og:description');
  assert.match(description, /1 badge,/);
  assert.match(description, /0 team affiliations,/);
  assert.match(description, /0 public replays\./);
});

test('description contains no combat / PvP framing (§23 guard)', () => {
  const { tags } = buildProfileMeta(
    makeProfile({
      displayName: 'Aria Stormblade',
      badges: [{}, {}],
      teamAffiliations: [{}],
      publicReplays: [{}, {}, {}],
    }),
    'aria_sb',
  );
  const description = contentOf(tags, 'og:description').toLowerCase();
  // why: §23 forbids re-presenting the profile as a player-vs-player combat
  // surface. These terms must never appear in the crawler-facing description.
  for (const forbidden of ['win', 'rank', 'opponent', 'challenge']) {
    assert.equal(
      description.includes(forbidden),
      false,
      `description must not contain the forbidden term "${forbidden}"`,
    );
  }
});

test('every value is HTML-attribute-escaped (load-bearing safety)', () => {
  const { tags } = buildProfileMeta(
    makeProfile({
      displayName: `"><script>alert('x')</script> & friends`,
      displayHandle: 'aria_sb',
    }),
    'aria_sb',
  );
  const title = contentOf(tags, 'og:title');
  // No raw angle brackets, quotes, ampersands, or apostrophes survive.
  assert.equal(/[<>"']/.test(title), false, 'title must have no raw markup chars');
  assert.equal(title.includes('&amp;'), true, 'ampersand must be entity-escaped');
  assert.equal(title.includes('&lt;script&gt;'), true, 'tag must be entity-escaped');
  assert.equal(title.includes('&quot;'), true, 'quote must be entity-escaped');
  assert.equal(title.includes('&#39;'), true, 'apostrophe must be entity-escaped');
  // The escaped value is mirrored into the twitter:title.
  assert.equal(contentOf(tags, 'twitter:title'), title);
});

test('og:url is the canonical profile URL for the handle', () => {
  const { tags } = buildProfileMeta(makeProfile(), 'aria_sb');
  assert.equal(
    contentOf(tags, 'og:url'),
    'https://play.legendary-arena.com/?profile=aria_sb',
  );
});

test('og:image and twitter:image are the absolute brand card URL', () => {
  const { tags } = buildProfileMeta(makeProfile(), 'aria_sb');
  const expected = 'https://play.legendary-arena.com/og/profile-card.png';
  assert.equal(contentOf(tags, 'og:image'), expected);
  assert.equal(contentOf(tags, 'twitter:image'), expected);
});
