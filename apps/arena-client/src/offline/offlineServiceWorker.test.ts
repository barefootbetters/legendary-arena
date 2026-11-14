/**
 * Tests the shipped offline service worker (WP-894 / D-24851).
 *
 * The worker is a classic script with no imports, so this suite reads the real
 * `public/offline/sw.js` (never a copy) and runs it in a `node:vm` context whose
 * globals are passed in: `URL`, `Request`, `Response`, a stub `caches`, a stub
 * `fetch`, timer functions, `AbortController`, and `self` (the context itself,
 * with `location`, `addEventListener` and `clients`).
 *
 * Requests are plain fake objects (`{ url, method, mode }`) because Node's
 * `Request` refuses `mode: 'navigate'`; a redirected response is a fake object
 * because a constructed `Response` can't be redirected. "Answered" means the
 * fetch handler called `event.respondWith` synchronously during dispatch.
 * Values from the vm realm are JSON round-tripped before `deepStrictEqual`.
 */
import { describe, mock, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { cardImageTierUrl, type CardImageTier } from '../lib/cardImageTiers';
import { IMAGE_CACHE_NAME } from './offlineImageCache';

const WORKER_PATH = fileURLToPath(new URL('../../public/offline/sw.js', import.meta.url));
const WORKER_SOURCE = readFileSync(WORKER_PATH, 'utf8');

const ORIGIN = 'https://play.example.test';
const BUILD_ID = 'abc1234';
const SHELL_CACHE = 'la-offline-shell-' + BUILD_ID;
const IMAGE_CACHE = 'la-offline-images-v1';
const BRAND_CSS_URL = 'https://www.legendary-arena.com/brand-tokens.css';
const IMAGE_ORIGIN = 'https://images.legendary-arena.com';

const CARD_ORIGINAL = IMAGE_ORIGIN + '/core/core-hr-x.webp';
const CARD_THUMB = IMAGE_ORIGIN + '/core/thumb/core-hr-x.webp';
const CARD_PHONE = IMAGE_ORIGIN + '/core/phone/core-hr-x.webp';

/** A sample precache list in the locked order (the plugin's real output shape). */
const SAMPLE_PRECACHE_URLS = [
  '/offline/',
  '/assets/OfflinePlayPage-abc.js',
  '/assets/index-abc.css',
  '/assets/index-abc.js',
  '/brand-tokens.local.css',
  '/offline/manifest.webmanifest',
  '/offline/icon-192.png',
  '/offline/icon-512.png',
  '/offline/apple-touch-icon.png',
  BRAND_CSS_URL,
];

/** A fake request the worker's fetch handler reads. */
interface FakeRequest {
  url: string;
  method: string;
  mode: string;
}

/** One stub `fetch` call. */
interface FetchCall {
  url: string;
  init: Record<string, unknown> | undefined;
}

type FetchHandler = (init: Record<string, unknown> | undefined) => Promise<unknown>;

/** The stub cache storage: cache name → (absolute URL → response). */
type CacheStore = Map<string, Map<string, unknown>>;

/** A loaded worker and the stubs around it. */
interface LoadedWorker {
  handlers: Record<string, (event: unknown) => void>;
  context: Record<string, unknown>;
  caches: CacheStore;
  fetchCalls: FetchCall[];
  fetchRoutes: Map<string, FetchHandler>;
  claimCount: () => number;
}

/**
 * Reads a request-like value as an absolute URL key.
 *
 * @param input - A string URL or a request-like object.
 * @returns The absolute URL.
 */
function keyOf(input: unknown): string {
  if (typeof input === 'string') {
    return new URL(input, ORIGIN).href;
  }
  return new URL((input as { url: string }).url, ORIGIN).href;
}

/**
 * Builds the stub `caches` over a cache store.
 *
 * @param store - The backing store.
 * @returns A CacheStorage-shaped stub.
 */
function makeFakeCaches(store: CacheStore): Record<string, unknown> {
  /** Opens (creating) one named cache. */
  function openStore(name: string): Map<string, unknown> {
    let entries = store.get(name);
    if (entries === undefined) {
      entries = new Map();
      store.set(name, entries);
    }
    return entries;
  }
  return {
    open(name: string): Promise<unknown> {
      const entries = openStore(name);
      return Promise.resolve({
        put(request: unknown, response: unknown): Promise<void> {
          entries.set(keyOf(request), response);
          return Promise.resolve();
        },
        match(request: unknown): Promise<unknown> {
          return Promise.resolve(entries.get(keyOf(request)));
        },
      });
    },
    match(request: unknown, options?: { cacheName?: string }): Promise<unknown> {
      const key = keyOf(request);
      if (options?.cacheName !== undefined) {
        return Promise.resolve(store.get(options.cacheName)?.get(key));
      }
      for (const entries of store.values()) {
        if (entries.has(key)) {
          return Promise.resolve(entries.get(key));
        }
      }
      return Promise.resolve(undefined);
    },
    keys(): Promise<string[]> {
      return Promise.resolve([...store.keys()]);
    },
    delete(name: string): Promise<boolean> {
      return Promise.resolve(store.delete(name));
    },
  };
}

/**
 * Loads the shipped worker into a fresh vm context.
 *
 * @param store - The cache store to share (a fresh one when omitted).
 * @returns The worker's handlers and stubs.
 */
function loadWorker(store: CacheStore = new Map()): LoadedWorker {
  const handlers: Record<string, (event: unknown) => void> = {};
  const fetchCalls: FetchCall[] = [];
  const fetchRoutes = new Map<string, FetchHandler>();
  let claims = 0;
  const context: Record<string, unknown> = {
    URL,
    URLSearchParams,
    Request,
    Response,
    Headers,
    AbortController,
    // why: wrappers read the global timers at call time, so node:test's
    // mock.timers (enabled after loading) drives the worker's timeout.
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    clearTimeout: (timeoutId: ReturnType<typeof setTimeout>) => clearTimeout(timeoutId),
    caches: makeFakeCaches(store),
    fetch(input: unknown, init?: Record<string, unknown>): Promise<unknown> {
      const url = keyOf(input);
      fetchCalls.push({ url, init });
      const route = fetchRoutes.get(url);
      if (route === undefined) {
        return Promise.reject(new TypeError('Failed to fetch (the fake network is offline).'));
      }
      return route(init);
    },
    clients: {
      claim(): Promise<void> {
        claims += 1;
        return Promise.resolve();
      },
    },
    location: new URL(ORIGIN + '/offline/sw.js?build=' + BUILD_ID),
    addEventListener(type: string, handler: (event: unknown) => void): void {
      handlers[type] = handler;
    },
  };
  context.self = context;
  vm.createContext(context);
  vm.runInContext(WORKER_SOURCE, context, { filename: WORKER_PATH });
  return { handlers, context, caches: store, fetchCalls, fetchRoutes, claimCount: () => claims };
}

/**
 * Builds a real response with a content type.
 *
 * @param body - The body text.
 * @param contentType - The content type.
 * @param status - The status code.
 * @returns The response.
 */
function makeResponse(body: string, contentType: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': contentType } });
}

/**
 * Builds a fake redirected response (a constructed `Response` can't be one).
 *
 * @param body - The body text.
 * @returns The fake response.
 */
function makeRedirectedResponse(body: string): Record<string, unknown> {
  const fake: Record<string, unknown> = {
    ok: true,
    status: 200,
    redirected: true,
    headers: new Headers({ 'content-type': 'text/html' }),
    body,
  };
  fake.clone = () => fake;
  return fake;
}

/**
 * Reads the handler the worker registered for an event type.
 *
 * @param worker - The loaded worker.
 * @param type - The event type.
 * @returns The handler.
 */
function handlerFor(worker: LoadedWorker, type: string): (event: unknown) => void {
  const handler = worker.handlers[type];
  assert.ok(handler !== undefined, `The worker registered no ${type} handler.`);
  return handler;
}

/**
 * Dispatches a lifecycle event and waits for its `waitUntil` promise.
 *
 * @param worker - The loaded worker.
 * @param type - `install` or `activate`.
 * @returns The `waitUntil` promise.
 */
function dispatchLifecycle(worker: LoadedWorker, type: string): Promise<unknown> {
  let pending: Promise<unknown> | null = null;
  handlerFor(worker, type)({
    waitUntil(promise: Promise<unknown>): void {
      pending = promise;
    },
  });
  assert.ok(pending !== null, `The ${type} handler did not call waitUntil.`);
  return pending;
}

/**
 * Dispatches a fetch event.
 *
 * @param worker - The loaded worker.
 * @param request - The fake request.
 * @returns The responded promise, or null when the handler did not answer.
 */
function dispatchFetch(worker: LoadedWorker, request: FakeRequest): Promise<unknown> | null {
  let responded: Promise<unknown> | null = null;
  handlerFor(worker, 'fetch')({
    request,
    respondWith(promise: Promise<unknown>): void {
      responded = promise;
    },
  });
  return responded;
}

/**
 * Builds a fake GET request.
 *
 * @param url - The URL (relative URLs resolve against the page origin).
 * @param mode - The request mode.
 * @returns The fake request.
 */
function getRequest(url: string, mode = 'no-cors'): FakeRequest {
  return { url: new URL(url, ORIGIN).href, method: 'GET', mode };
}

/**
 * Serves the sample precache list from the fake network.
 *
 * @param worker - The loaded worker.
 * @param build - The `build` the manifest names.
 */
function routePrecache(worker: LoadedWorker, build = BUILD_ID): void {
  worker.fetchRoutes.set(ORIGIN + '/offline/precache.json', () =>
    Promise.resolve(makeResponse(JSON.stringify({ build, urls: SAMPLE_PRECACHE_URLS }), 'application/json')),
  );
  for (const url of SAMPLE_PRECACHE_URLS) {
    const contentType = url === '/offline/' ? 'text/html; charset=utf-8' : 'text/plain';
    worker.fetchRoutes.set(new URL(url, ORIGIN).href, () => Promise.resolve(makeResponse('shell:' + url, contentType)));
  }
}

/**
 * Reads a response's body text (real or fake).
 *
 * @param response - The response.
 * @returns The body text.
 */
async function bodyOf(response: unknown): Promise<string> {
  if (response instanceof Response) {
    return response.clone().text();
  }
  return String((response as { body: unknown }).body);
}

/**
 * Seeds one cache entry.
 *
 * @param worker - The loaded worker.
 * @param cacheName - The cache.
 * @param url - The URL key.
 * @param body - The body text.
 */
function seed(worker: LoadedWorker, cacheName: string, url: string, body: string): void {
  let entries = worker.caches.get(cacheName);
  if (entries === undefined) {
    entries = new Map();
    worker.caches.set(cacheName, entries);
  }
  entries.set(new URL(url, ORIGIN).href, makeResponse(body, 'text/plain'));
}

/**
 * Copies a value out of the vm realm so `deepStrictEqual` compares structure,
 * not prototypes.
 *
 * @param value - A JSON-safe value from the worker.
 * @returns A main-realm copy.
 */
function plain(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

afterEach(() => {
  mock.timers.reset();
});

describe('offline service worker: install (WP-894)', () => {
  test('fetches precache.json no-store and puts every URL in la-offline-shell-<build>', async () => {
    const worker = loadWorker();
    routePrecache(worker);
    await dispatchLifecycle(worker, 'install');
    assert.deepEqual(plain(worker.fetchCalls[0]), { url: ORIGIN + '/offline/precache.json', init: { cache: 'no-store' } });
    const shell = worker.caches.get(SHELL_CACHE);
    assert.ok(shell !== undefined);
    assert.deepEqual(
      [...shell.keys()].sort(),
      SAMPLE_PRECACHE_URLS.map((url) => new URL(url, ORIGIN).href).sort(),
    );
    for (const call of worker.fetchCalls.slice(1)) {
      if (call.url === BRAND_CSS_URL) {
        assert.deepEqual(plain(call.init), { cache: 'no-store', mode: 'cors', credentials: 'omit' });
      } else {
        assert.deepEqual(plain(call.init), { cache: 'no-store' });
      }
    }
  });

  test('rejects when the manifest names another build', async () => {
    const worker = loadWorker();
    routePrecache(worker, 'other99');
    await assert.rejects(dispatchLifecycle(worker, 'install'), /build other99/);
  });

  test('rejects on a non-OK response', async () => {
    const worker = loadWorker();
    routePrecache(worker);
    worker.fetchRoutes.set(ORIGIN + '/offline/icon-192.png', () => Promise.resolve(makeResponse('gone', 'text/plain', 404)));
    await assert.rejects(dispatchLifecycle(worker, 'install'), /answered 404/);
  });

  test('rejects on a redirected response', async () => {
    const worker = loadWorker();
    routePrecache(worker);
    worker.fetchRoutes.set(ORIGIN + '/offline/', () => Promise.resolve(makeRedirectedResponse('portal')));
    await assert.rejects(dispatchLifecycle(worker, 'install'), /redirected/);
  });

  test('rejects an HTML response for a URL other than /offline/ (the SPA fallback for a missing file)', async () => {
    const worker = loadWorker();
    routePrecache(worker);
    worker.fetchRoutes.set(ORIGIN + '/offline/icon-512.png', () =>
      Promise.resolve(makeResponse('<!DOCTYPE html>', 'text/html; charset=utf-8')),
    );
    await assert.rejects(dispatchLifecycle(worker, 'install'), /answered HTML/);
  });
});

describe('offline service worker: activate (WP-894)', () => {
  test('deletes only other shell caches, keeps the image cache, and claims clients', async () => {
    const worker = loadWorker();
    seed(worker, 'la-offline-shell-old0001', '/assets/old.js', 'old');
    seed(worker, SHELL_CACHE, '/assets/new.js', 'new');
    seed(worker, IMAGE_CACHE, CARD_THUMB, 'image');
    seed(worker, 'some-other-cache', '/x', 'x');
    await dispatchLifecycle(worker, 'activate');
    assert.deepEqual([...worker.caches.keys()].sort(), [SHELL_CACHE, IMAGE_CACHE, 'some-other-cache'].sort());
    assert.equal(worker.claimCount(), 1);
  });

  test('the image cache name equals the page helper constant', () => {
    assert.equal(IMAGE_CACHE, IMAGE_CACHE_NAME);
  });
});

describe('offline service worker: shell route (WP-894)', () => {
  test('every precache URL except /offline/ is answered by the shell route from the shell cache', async () => {
    const worker = loadWorker();
    routePrecache(worker);
    await dispatchLifecycle(worker, 'install');
    worker.fetchRoutes.clear();
    for (const url of SAMPLE_PRECACHE_URLS) {
      if (url === '/offline/') {
        continue;
      }
      const responded = dispatchFetch(worker, getRequest(url));
      assert.ok(responded !== null, `${url} was not answered by the shell route.`);
      assert.equal(await bodyOf(await responded), 'shell:' + url);
    }
  });

  test('a freshly loaded worker with no install event serves a cached /assets/x.js (no in-memory state)', async () => {
    const store: CacheStore = new Map();
    const firstWorker = loadWorker(store);
    seed(firstWorker, SHELL_CACHE, '/assets/x.js', 'cached-asset');
    const coldWorker = loadWorker(store);
    const responded = dispatchFetch(coldWorker, getRequest('/assets/x.js'));
    assert.ok(responded !== null);
    assert.equal(await bodyOf(await responded), 'cached-asset');
    assert.equal(coldWorker.fetchCalls.length, 0);
  });

  test('a shell-cache miss goes to the network', async () => {
    const worker = loadWorker();
    worker.fetchRoutes.set(ORIGIN + '/assets/missing.js', () => Promise.resolve(makeResponse('network', 'text/javascript')));
    const responded = dispatchFetch(worker, getRequest('/assets/missing.js'));
    assert.ok(responded !== null);
    assert.equal(await bodyOf(await responded), 'network');
  });
});

describe('offline service worker: navigation (WP-894)', () => {
  test('network first: an OK response is returned untouched, its timer cleared, and never written', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const worker = loadWorker();
    seed(worker, SHELL_CACHE, '/offline/', 'cached-page');
    const networkPage = makeResponse('network-page', 'text/html');
    let signal: AbortSignal | null = null;
    worker.fetchRoutes.set(ORIGIN + '/offline/', (init) => {
      signal = init?.signal as AbortSignal;
      return Promise.resolve(networkPage);
    });
    const responded = dispatchFetch(worker, getRequest('/offline/', 'navigate'));
    assert.ok(responded !== null);
    assert.equal(await responded, networkPage);
    mock.timers.tick(5000);
    assert.ok(signal !== null);
    assert.equal((signal as AbortSignal).aborted, false);
    assert.equal(await bodyOf(worker.caches.get(SHELL_CACHE)?.get(ORIGIN + '/offline/')), 'cached-page');
    assert.equal(worker.caches.size, 1);
  });

  test('falls back to the cached /offline/ when the fetch rejects', async () => {
    const worker = loadWorker();
    seed(worker, SHELL_CACHE, '/offline/', 'cached-page');
    const responded = dispatchFetch(worker, getRequest('/offline/', 'navigate'));
    assert.ok(responded !== null);
    assert.equal(await bodyOf(await responded), 'cached-page');
  });

  test('falls back on a non-OK status', async () => {
    const worker = loadWorker();
    seed(worker, SHELL_CACHE, '/offline/', 'cached-page');
    worker.fetchRoutes.set(ORIGIN + '/offline/', () => Promise.resolve(makeResponse('bad gateway', 'text/html', 502)));
    const responded = dispatchFetch(worker, getRequest('/offline/', 'navigate'));
    assert.ok(responded !== null);
    assert.equal(await bodyOf(await responded), 'cached-page');
  });

  test('falls back on a redirected response (a captive portal)', async () => {
    const worker = loadWorker();
    seed(worker, SHELL_CACHE, '/offline/', 'cached-page');
    worker.fetchRoutes.set(ORIGIN + '/offline/', () => Promise.resolve(makeRedirectedResponse('portal-login')));
    const responded = dispatchFetch(worker, getRequest('/offline/', 'navigate'));
    assert.ok(responded !== null);
    assert.equal(await bodyOf(await responded), 'cached-page');
  });

  test('falls back when the fetch exceeds the 4 s timeout (a hung connection)', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const worker = loadWorker();
    seed(worker, SHELL_CACHE, '/offline/', 'cached-page');
    worker.fetchRoutes.set(ORIGIN + '/offline/', (init) => {
      const signal = init?.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('The fake fetch was aborted.')));
      });
    });
    const responded = dispatchFetch(worker, getRequest('/offline/', 'navigate'));
    assert.ok(responded !== null);
    mock.timers.tick(3999);
    let isSettled = false;
    void responded.then(() => {
      isSettled = true;
    });
    await Promise.resolve();
    assert.equal(isSettled, false);
    mock.timers.tick(1);
    assert.equal(await bodyOf(await responded), 'cached-page');
  });

  test('with no cached page: the network response when there is one, else Response.error()', async () => {
    const worker = loadWorker();
    const notFound = makeResponse('missing', 'text/html', 404);
    worker.fetchRoutes.set(ORIGIN + '/offline/', () => Promise.resolve(notFound));
    const withNetwork = dispatchFetch(worker, getRequest('/offline/', 'navigate'));
    assert.ok(withNetwork !== null);
    assert.equal(await withNetwork, notFound);

    worker.fetchRoutes.clear();
    const offline = dispatchFetch(worker, getRequest('/offline/', 'navigate'));
    assert.ok(offline !== null);
    assert.equal(((await offline) as Response).type, 'error');
  });
});

describe('offline service worker: card images and icons (WP-894)', () => {
  test('a URL from cardImageTierUrl for each tier is answered by the card route', async () => {
    const worker = loadWorker();
    const tiers: CardImageTier[] = ['thumb', 'phone', 'large'];
    for (const tier of tiers) {
      const tierUrl = cardImageTierUrl(CARD_ORIGINAL, tier);
      assert.ok(tierUrl !== null);
      seed(worker, IMAGE_CACHE, tierUrl, 'image:' + tier);
      const responded = dispatchFetch(worker, getRequest(tierUrl));
      assert.ok(responded !== null, `${tierUrl} was not answered.`);
      assert.equal(await bodyOf(await responded), 'image:' + tier);
    }
  });

  test('a card image and real icon URLs are served from the image cache', async () => {
    const worker = loadWorker();
    const urls = [
      CARD_ORIGINAL,
      IMAGE_ORIGIN + '/icons/hero-classes/class-strength.svg',
      IMAGE_ORIGIN + '/icons/card-info/info-attack.svg',
    ];
    for (const url of urls) {
      seed(worker, IMAGE_CACHE, url, 'cached:' + url);
      const responded = dispatchFetch(worker, getRequest(url));
      assert.ok(responded !== null, `${url} was not answered.`);
      assert.equal(await bodyOf(await responded), 'cached:' + url);
    }
    assert.equal(worker.fetchCalls.length, 0);
  });

  test('icon URLs of the wrong depth are not answered', () => {
    const worker = loadWorker();
    assert.equal(dispatchFetch(worker, getRequest(IMAGE_ORIGIN + '/icons/x/y/z.svg')), null);
    assert.equal(dispatchFetch(worker, getRequest(IMAGE_ORIGIN + '/icons/x.svg')), null);
  });

  test('a cache miss is fetched cors/omit and stored', async () => {
    const worker = loadWorker();
    const networkImage = makeResponse('network-image', 'image/webp');
    worker.fetchRoutes.set(CARD_PHONE, () => Promise.resolve(networkImage));
    const responded = dispatchFetch(worker, getRequest(CARD_PHONE));
    assert.ok(responded !== null);
    assert.equal(await responded, networkImage);
    assert.deepEqual(plain(worker.fetchCalls), [{ url: CARD_PHONE, init: { mode: 'cors', credentials: 'omit' } }]);
    assert.equal(await bodyOf(worker.caches.get(IMAGE_CACHE)?.get(CARD_PHONE)), 'network-image');
  });

  test('a non-OK image is returned but not stored', async () => {
    const worker = loadWorker();
    worker.fetchRoutes.set(CARD_PHONE, () => Promise.resolve(makeResponse('nope', 'text/plain', 404)));
    const responded = dispatchFetch(worker, getRequest(CARD_PHONE));
    assert.ok(responded !== null);
    assert.equal(((await responded) as Response).status, 404);
    assert.equal(worker.caches.get(IMAGE_CACHE)?.has(CARD_PHONE) ?? false, false);
  });

  test('offline, a card-image miss falls back to a cached sibling tier', async () => {
    const worker = loadWorker();
    seed(worker, IMAGE_CACHE, CARD_THUMB, 'thumb-copy');
    const responded = dispatchFetch(worker, getRequest(CARD_PHONE));
    assert.ok(responded !== null);
    assert.equal(await bodyOf(await responded), 'thumb-copy');
  });

  test('offline, with no sibling cached, the answer is Response.error()', async () => {
    const worker = loadWorker();
    const responded = dispatchFetch(worker, getRequest(CARD_PHONE));
    assert.ok(responded !== null);
    assert.equal(((await responded) as Response).type, 'error');
  });
});

describe('offline service worker: requests it never answers (WP-894)', () => {
  test('audio, a play mat, an API GET, version.json and a POST are not answered', () => {
    const worker = loadWorker();
    const unanswered: FakeRequest[] = [
      getRequest(IMAGE_ORIGIN + '/audio/sound-effects/combo-medium.mp3'),
      getRequest(IMAGE_ORIGIN + '/audio/music/theme.webp'),
      getRequest(IMAGE_ORIGIN + '/play-mats/marvel-mat.webp'),
      getRequest('/api/analytics/events', 'cors'),
      getRequest('/version.json', 'cors'),
      { url: ORIGIN + '/assets/index-abc.js', method: 'POST', mode: 'cors' },
    ];
    for (const request of unanswered) {
      assert.equal(dispatchFetch(worker, request), null, `${request.method} ${request.url} was answered.`);
    }
    assert.equal(worker.fetchCalls.length, 0);
  });
});

describe('offline service worker: siblingImageUrls (WP-894)', () => {
  /**
   * Calls the worker's top-level siblingImageUrls and leaves the vm realm.
   *
   * @param url - The URL.
   * @returns The sibling URLs as a main-realm array.
   */
  function siblings(url: string): string[] {
    const worker = loadWorker();
    const siblingImageUrls = worker.context.siblingImageUrls as (value: string) => unknown;
    return JSON.parse(JSON.stringify(siblingImageUrls(url))) as string[];
  }

  test('the original, thumb and phone shapes list the other two in phone, thumb, original order', () => {
    assert.deepStrictEqual(siblings(CARD_ORIGINAL), [CARD_PHONE, CARD_THUMB]);
    assert.deepStrictEqual(siblings(CARD_THUMB), [CARD_PHONE, CARD_ORIGINAL]);
    assert.deepStrictEqual(siblings(CARD_PHONE), [CARD_THUMB, CARD_ORIGINAL]);
  });

  test('an icon, a foreign URL and a non-URL give no siblings', () => {
    assert.deepStrictEqual(siblings(IMAGE_ORIGIN + '/icons/hero-classes/class-strength.svg'), []);
    assert.deepStrictEqual(siblings('https://example.test/core/core-hr-x.webp'), []);
    assert.deepStrictEqual(siblings('not a url'), []);
  });
});
