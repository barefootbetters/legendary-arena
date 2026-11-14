import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { IMAGE_CACHE_NAME, warmOfflineCardImages } from './offlineImageCache';

/** One captured `cache.add` request. */
interface AddedRequest {
  url: string;
  mode: string;
  credentials: string;
}

/**
 * Builds a fake CacheStorage holding one cache.
 *
 * @param options - URLs already cached, and URLs whose `add` rejects.
 * @returns The storage, the added requests and the opened cache names.
 */
function makeFakeCacheStorage(options: {
  alreadyCached?: string[];
  failingUrls?: string[];
}): { storage: CacheStorage; added: AddedRequest[]; openedNames: string[] } {
  const stored = new Set<string>(options.alreadyCached ?? []);
  const failing = new Set<string>(options.failingUrls ?? []);
  const added: AddedRequest[] = [];
  const openedNames: string[] = [];
  const cache = {
    match(url: string): Promise<Response | undefined> {
      return Promise.resolve(stored.has(url) ? new Response('cached') : undefined);
    },
    add(request: Request): Promise<void> {
      added.push({ url: request.url, mode: request.mode, credentials: request.credentials });
      if (failing.has(request.url)) {
        return Promise.reject(new TypeError('The fake fetch failed.'));
      }
      stored.add(request.url);
      return Promise.resolve();
    },
  } as unknown as Cache;
  const storage = {
    open(name: string): Promise<Cache> {
      openedNames.push(name);
      return Promise.resolve(cache);
    },
  } as unknown as CacheStorage;
  return { storage, added, openedNames };
}

const ORIGINAL_A = 'https://images.legendary-arena.com/core/core-hr-a.webp';
const ORIGINAL_B = 'https://images.legendary-arena.com/core/core-hr-b.webp';
const THUMB_A = 'https://images.legendary-arena.com/core/thumb/core-hr-a.webp';
const PHONE_A = 'https://images.legendary-arena.com/core/phone/core-hr-a.webp';
const THUMB_B = 'https://images.legendary-arena.com/core/thumb/core-hr-b.webp';
const PHONE_B = 'https://images.legendary-arena.com/core/phone/core-hr-b.webp';

describe('warmOfflineCardImages (WP-894)', () => {
  test('the cache name equals the worker constant', () => {
    assert.equal(IMAGE_CACHE_NAME, 'la-offline-images-v1');
  });

  test('each original expands to its thumb and phone tiers, deduped, in cors/omit requests', async () => {
    const fake = makeFakeCacheStorage({});
    const result = await warmOfflineCardImages([ORIGINAL_A, ORIGINAL_B, ORIGINAL_A], fake.storage);
    assert.deepEqual(fake.openedNames, ['la-offline-images-v1']);
    assert.deepEqual(
      fake.added.map((request) => request.url),
      [THUMB_A, PHONE_A, THUMB_B, PHONE_B],
    );
    for (const request of fake.added) {
      assert.equal(request.mode, 'cors');
      assert.equal(request.credentials, 'omit');
    }
    assert.deepEqual(result, { total: 4, cached: 4, failed: 0 });
  });

  test('a URL with no tier shape is kept as itself', async () => {
    const otherUrl = 'https://images.legendary-arena.com/root-file.png';
    const fake = makeFakeCacheStorage({});
    const result = await warmOfflineCardImages([otherUrl], fake.storage);
    assert.deepEqual(fake.added.map((request) => request.url), [otherUrl]);
    assert.deepEqual(result, { total: 1, cached: 1, failed: 0 });
  });

  test('already-cached URLs are skipped but still counted as cached', async () => {
    const fake = makeFakeCacheStorage({ alreadyCached: [THUMB_A] });
    const result = await warmOfflineCardImages([ORIGINAL_A], fake.storage);
    assert.deepEqual(fake.added.map((request) => request.url), [PHONE_A]);
    assert.deepEqual(result, { total: 2, cached: 2, failed: 0 });
  });

  test('a failed add is counted, not thrown', async () => {
    const fake = makeFakeCacheStorage({ failingUrls: [PHONE_B] });
    const result = await warmOfflineCardImages([ORIGINAL_A, ORIGINAL_B], fake.storage);
    assert.deepEqual(result, { total: 4, cached: 3, failed: 1 });
  });

  test('a cache that refuses to open counts every URL as failed', async () => {
    const storage = {
      open(): Promise<Cache> {
        return Promise.reject(new Error('The fake storage is disabled.'));
      },
    } as unknown as CacheStorage;
    const result = await warmOfflineCardImages([ORIGINAL_A], storage);
    assert.deepEqual(result, { total: 2, cached: 0, failed: 2 });
  });
});
