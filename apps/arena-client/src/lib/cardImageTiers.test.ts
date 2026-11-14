import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CARD_IMAGE_BASE_URL,
  cardImageSources,
  cardImageTierUrl,
} from './cardImageTiers';

/**
 * Tests for the WP-891 / D-24848 card image tier rule. The tier examples are
 * the WP-888 ones that `scripts/build-card-image-sizes.mjs` `tierUrlFor` uses.
 */

const ORIGINAL_URL = 'https://images.legendary-arena.com/core/core-hr-x.webp';
const THUMB_URL = 'https://images.legendary-arena.com/core/thumb/core-hr-x.webp';
const PHONE_URL = 'https://images.legendary-arena.com/core/phone/core-hr-x.webp';
const LARGE_URL = 'https://images.legendary-arena.com/core/large/core-hr-x.webp';

const NON_TIERED_URLS: readonly string[] = [
  'https://images.legendary-arena.com/agent.webp',
  'https://images.legendary-arena.com/core/thumb/x.webp',
  'https://images.example/core/core-hr-x.webp',
  'https://images.legendary-arena.com/core/core-hr-x.jpg',
  '',
];

describe('cardImageTierUrl (WP-891)', () => {
  test('the base URL is the R2 card-image host', () => {
    assert.equal(CARD_IMAGE_BASE_URL, 'https://images.legendary-arena.com');
  });

  test('inserts the tier folder before the file name for each tier', () => {
    assert.equal(cardImageTierUrl(ORIGINAL_URL, 'thumb'), THUMB_URL);
    assert.equal(cardImageTierUrl(ORIGINAL_URL, 'phone'), PHONE_URL);
    assert.equal(cardImageTierUrl(ORIGINAL_URL, 'large'), LARGE_URL);
  });

  test('a two-digit set folder is a tiered card face', () => {
    assert.equal(
      cardImageTierUrl('https://images.legendary-arena.com/3dtc/3dtc-hr-x.webp', 'thumb'),
      'https://images.legendary-arena.com/3dtc/thumb/3dtc-hr-x.webp',
    );
  });

  test('returns null for a root URL, a nested path, another host, a non-webp file and the empty string', () => {
    for (const imageUrl of NON_TIERED_URLS) {
      assert.equal(cardImageTierUrl(imageUrl, 'thumb'), null, `expected null for "${imageUrl}"`);
      assert.equal(cardImageTierUrl(imageUrl, 'phone'), null, `expected null for "${imageUrl}"`);
    }
  });
});

describe('cardImageSources (WP-891)', () => {
  test('a set-path URL renders the thumb tier with the exact density srcset', () => {
    assert.deepEqual(cardImageSources(ORIGINAL_URL), {
      src: THUMB_URL,
      srcset: `${THUMB_URL} 1x, ${PHONE_URL} 2x`,
    });
  });

  test('the srcset string is exactly "<thumb> 1x, <phone> 2x"', () => {
    assert.equal(
      cardImageSources(ORIGINAL_URL).srcset,
      'https://images.legendary-arena.com/core/thumb/core-hr-x.webp 1x, '
        + 'https://images.legendary-arena.com/core/phone/core-hr-x.webp 2x',
    );
  });

  test('any other string passes through unchanged with no srcset', () => {
    for (const imageUrl of NON_TIERED_URLS) {
      assert.deepEqual(cardImageSources(imageUrl), { src: imageUrl, srcset: null });
    }
  });

  test('the large tier is never part of the rendered sources', () => {
    const sources = cardImageSources(ORIGINAL_URL);
    assert.equal(sources.src.includes('/large/'), false);
    assert.equal(sources.srcset?.includes('/large/'), false);
  });
});
