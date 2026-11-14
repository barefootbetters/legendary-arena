import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SMALL_LADDER_MAX_CARD_WIDTH_PX,
  cardImageSources,
  cardImageTierUrl,
  gridImageLadder,
  resolveCardFaceSources,
} from './cardImageTiers';

/**
 * Tests for the WP-892 / D-24849 registry-viewer card image tier rule. The tier
 * examples are the WP-888 ones that `scripts/build-card-image-sizes.mjs`
 * `tierUrlFor` and the arena client's copy use.
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

describe('cardImageTierUrl (WP-892)', () => {
  test('inserts the tier folder before the file name for each tier', () => {
    assert.equal(cardImageTierUrl(ORIGINAL_URL, 'thumb'), THUMB_URL);
    assert.equal(cardImageTierUrl(ORIGINAL_URL, 'phone'), PHONE_URL);
    assert.equal(cardImageTierUrl(ORIGINAL_URL, 'large'), LARGE_URL);
  });

  test('a set folder with digits is a tiered card face', () => {
    assert.equal(
      cardImageTierUrl('https://images.legendary-arena.com/co2e/co2e-hr-x.webp', 'phone'),
      'https://images.legendary-arena.com/co2e/phone/co2e-hr-x.webp',
    );
  });

  test('returns null for a root URL, a nested path, another host, a non-webp file and the empty string', () => {
    for (const imageUrl of NON_TIERED_URLS) {
      assert.equal(cardImageTierUrl(imageUrl, 'thumb'), null, `expected null for "${imageUrl}"`);
      assert.equal(cardImageTierUrl(imageUrl, 'phone'), null, `expected null for "${imageUrl}"`);
      assert.equal(cardImageTierUrl(imageUrl, 'large'), null, `expected null for "${imageUrl}"`);
    }
  });
});

describe('cardImageSources (WP-892)', () => {
  test('the small ladder renders thumb with the exact "<thumb> 1x, <phone> 2x" srcset', () => {
    assert.deepEqual(cardImageSources(ORIGINAL_URL, 'small'), {
      src: THUMB_URL,
      srcset:
        'https://images.legendary-arena.com/core/thumb/core-hr-x.webp 1x, '
        + 'https://images.legendary-arena.com/core/phone/core-hr-x.webp 2x',
    });
  });

  test('the large ladder renders phone with the exact "<phone> 1x, <large> 2x" srcset', () => {
    assert.deepEqual(cardImageSources(ORIGINAL_URL, 'large'), {
      src: PHONE_URL,
      srcset:
        'https://images.legendary-arena.com/core/phone/core-hr-x.webp 1x, '
        + 'https://images.legendary-arena.com/core/large/core-hr-x.webp 2x',
    });
  });

  test('any other string passes through unchanged with no srcset on both ladders', () => {
    for (const imageUrl of NON_TIERED_URLS) {
      assert.deepEqual(cardImageSources(imageUrl, 'small'), { src: imageUrl, srcset: null });
      assert.deepEqual(cardImageSources(imageUrl, 'large'), { src: imageUrl, srcset: null });
    }
  });

  test('the large tier appears only in the large ladder', () => {
    const smallSources = cardImageSources(ORIGINAL_URL, 'small');
    assert.equal(smallSources.src.includes('/large/'), false);
    assert.equal(smallSources.srcset?.includes('/large/'), false);
    const largeSources = cardImageSources(ORIGINAL_URL, 'large');
    assert.equal(largeSources.srcset?.includes('/large/'), true);
    assert.equal(largeSources.srcset?.includes('/thumb/'), false);
  });
});

describe('gridImageLadder (WP-892)', () => {
  test('the threshold is the default slider value, 130 px', () => {
    assert.equal(SMALL_LADDER_MAX_CARD_WIDTH_PX, 130);
  });

  test('ordinary tiles at 80 and 130 px use the small ladder', () => {
    assert.equal(gridImageLadder(80, false), 'small');
    assert.equal(gridImageLadder(130, false), 'small');
  });

  test('ordinary tiles at 140 and 260 px use the large ladder', () => {
    assert.equal(gridImageLadder(140, false), 'large');
    assert.equal(gridImageLadder(260, false), 'large');
  });

  test('a split face uses the large ladder even at 80 px', () => {
    assert.equal(gridImageLadder(80, true), 'large');
  });
});

describe('resolveCardFaceSources (WP-892)', () => {
  test('after a tier failure the original renders with no srcset', () => {
    assert.deepEqual(resolveCardFaceSources(ORIGINAL_URL, 'small', true), {
      src: ORIGINAL_URL,
      srcset: null,
    });
    assert.deepEqual(resolveCardFaceSources(ORIGINAL_URL, 'large', true), {
      src: ORIGINAL_URL,
      srcset: null,
    });
  });

  test('before a tier failure the ladder sources render', () => {
    assert.deepEqual(
      resolveCardFaceSources(ORIGINAL_URL, 'small', false),
      cardImageSources(ORIGINAL_URL, 'small'),
    );
    assert.deepEqual(
      resolveCardFaceSources(ORIGINAL_URL, 'large', false),
      cardImageSources(ORIGINAL_URL, 'large'),
    );
  });
});
