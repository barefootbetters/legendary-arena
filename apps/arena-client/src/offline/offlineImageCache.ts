/**
 * Warms the offline page's card-image cache — Arena Client (WP-894 / D-24851).
 *
 * The featured table's card faces render at the `thumb` tier on a 1x screen and
 * the `phone` tier on 2x (`CardImage.vue`, D-24848), so both are cached for
 * every original URL the setup projects (`UIState.matchCardImageUrls`). The
 * service worker at `/offline/sw.js` serves this same cache cache-first.
 */

import { cardImageTierUrl } from '../lib/cardImageTiers';

/** The image cache's name. Equals `IMAGE_CACHE` in `public/offline/sw.js`. */
export const IMAGE_CACHE_NAME = 'la-offline-images-v1';

/** The warm's counts. `cached` counts URLs present after the call. */
export interface OfflineImageWarmResult {
  readonly total: number;
  readonly cached: number;
  readonly failed: number;
}

/**
 * Expands original card-image URLs to the tier URLs a card face requests.
 * An original with no tier URL is kept as itself.
 *
 * @param originalUrls - The projected original URLs.
 * @returns The unique URLs to cache, in first-seen order.
 */
export function expandOfflineImageUrls(originalUrls: Iterable<string>): string[] {
  const uniqueUrls = new Set<string>();
  for (const originalUrl of originalUrls) {
    const thumbUrl = cardImageTierUrl(originalUrl, 'thumb');
    const phoneUrl = cardImageTierUrl(originalUrl, 'phone');
    if (thumbUrl === null || phoneUrl === null) {
      uniqueUrls.add(originalUrl);
      continue;
    }
    uniqueUrls.add(thumbUrl);
    uniqueUrls.add(phoneUrl);
  }
  return [...uniqueUrls];
}

/**
 * Caches one URL unless it is already present.
 *
 * @param cache - The open image cache.
 * @param url - The image URL.
 * @returns True when the URL is in the cache after the call.
 */
async function cacheOneImage(cache: Cache, url: string): Promise<boolean> {
  try {
    const existing = await cache.match(url, { ignoreVary: true });
    if (existing !== undefined) {
      return true;
    }
    // why: an `<img>` asks `no-cors`, and Cache Storage stores an opaque
    // `no-cors` response at a padded size (megabytes per image). The image host
    // answers `Access-Control-Allow-Origin: *`, so a `cors` re-fetch is a real,
    // real-size response.
    await cache.add(new Request(url, { mode: 'cors', credentials: 'omit' }));
    return true;
  } catch {
    // why: one image failing (offline, a 404, quota) is counted, not thrown;
    // the status line reports how many could not be cached.
    return false;
  }
}

/**
 * Caches the `thumb` and `phone` tier of every original card-image URL in the
 * offline image cache. Never throws.
 *
 * @param originalUrls - The setup's original card-image URLs.
 * @param cacheStorage - The browser's `caches` (injected for tests).
 * @returns The counts: total URLs, URLs cached after the call, and failures.
 */
export async function warmOfflineCardImages(
  originalUrls: Iterable<string>,
  cacheStorage: CacheStorage,
): Promise<OfflineImageWarmResult> {
  const urls = expandOfflineImageUrls(originalUrls);
  let cache: Cache;
  try {
    cache = await cacheStorage.open(IMAGE_CACHE_NAME);
  } catch {
    // why: Cache Storage can refuse to open (private mode, storage disabled);
    // every URL then counts as failed and the page still plays online.
    return { total: urls.length, cached: 0, failed: urls.length };
  }
  let cached = 0;
  let failed = 0;
  for (const url of urls) {
    const isCached = await cacheOneImage(cache, url);
    if (isCached) {
      cached += 1;
    } else {
      failed += 1;
    }
  }
  return { total: urls.length, cached, failed };
}
