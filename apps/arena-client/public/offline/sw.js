/**
 * Legendary Arena offline page service worker (WP-894 / D-24851).
 *
 * A classic worker script: no imports, no importScripts. It is registered as
 * `/offline/sw.js?build=<git sha>` with scope `/offline/`, so it controls only
 * the offline page; the live game at `/` never reaches it.
 *
 * - install: precaches this build's shell (from `/offline/precache.json`) into
 *   `la-offline-shell-<build>`.
 * - activate: deletes other builds' shell caches, keeps the image cache, claims.
 * - fetch: navigation is network first with a cached fallback; shell files and
 *   card images / ability icons are cache first; everything else is not answered.
 *
 * Nothing here caches game state: Cache Storage holds static files and images.
 */
'use strict';

const BUILD_ID = new URLSearchParams(self.location.search).get('build') ?? 'dev';
// why: plane wifi gives captive portals and hung connections, not clean
// rejections; a navigation that hasn't answered in 4 s falls back to the cache.
const NAVIGATION_TIMEOUT_MS = 4000;
const SHELL_CACHE_PREFIX = 'la-offline-shell-';
const SHELL_CACHE = SHELL_CACHE_PREFIX + BUILD_ID;
const IMAGE_CACHE = 'la-offline-images-v1';
const IMAGE_ORIGIN = 'https://images.legendary-arena.com';
const BRAND_CSS_URL = 'https://www.legendary-arena.com/brand-tokens.css';
const SHELL_STATIC_PATHS = [
  '/brand-tokens.local.css',
  '/offline/manifest.webmanifest',
  '/offline/icon-192.png',
  '/offline/icon-512.png',
  '/offline/apple-touch-icon.png',
];
const OFFLINE_PAGE_PATH = '/offline/';
const PRECACHE_MANIFEST_PATH = '/offline/precache.json';

// why: the image host also serves audio (`/audio/...`) and play mats
// (`/play-mats/...`), which must not be cached. Only card faces (an original in
// a set folder, or one of its D-24840 tiers) and ability icons
// (`/icons/<group>/<file>.svg`, the shape abilityMarkers.ts builds) match.
const CARD_ORIGINAL_PATTERN = /^\/([a-z0-9]+)\/([^/]+\.webp)$/;
const CARD_TIER_PATTERN = /^\/([a-z0-9]+)\/(thumb|phone|large)\/([^/]+\.webp)$/;
const ABILITY_ICON_PATTERN = /^\/icons\/[a-z0-9-]+\/[^/]+\.svg$/;

/**
 * Lists the other cached copies of a card image, for an offline miss: the
 * `phone`, `thumb` and original URLs of the same card, minus the requested URL.
 *
 * @param {string} url - A card-image URL.
 * @returns {string[]} The sibling URLs in fallback order; `[]` for any other shape.
 */
function siblingImageUrls(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return [];
  }
  if (parsed.origin !== IMAGE_ORIGIN) {
    return [];
  }
  let setFolder = null;
  let fileName = null;
  const tierMatch = CARD_TIER_PATTERN.exec(parsed.pathname);
  const originalMatch = CARD_ORIGINAL_PATTERN.exec(parsed.pathname);
  if (tierMatch !== null) {
    setFolder = tierMatch[1];
    fileName = tierMatch[3];
  } else if (originalMatch !== null) {
    setFolder = originalMatch[1];
    fileName = originalMatch[2];
  } else {
    return [];
  }
  const candidates = [
    IMAGE_ORIGIN + '/' + setFolder + '/phone/' + fileName,
    IMAGE_ORIGIN + '/' + setFolder + '/thumb/' + fileName,
    IMAGE_ORIGIN + '/' + setFolder + '/' + fileName,
  ];
  return candidates.filter((candidate) => candidate !== parsed.href);
}

/**
 * Reports whether a URL is a shell file this worker serves from the shell cache.
 *
 * @param {URL} url - The request URL.
 * @returns {boolean} True for same-origin `/assets/*` and the static shell paths, and the brand CSS.
 */
function isShellUrl(url) {
  if (url.href === BRAND_CSS_URL) {
    return true;
  }
  if (url.origin !== self.location.origin) {
    return false;
  }
  return url.pathname.startsWith('/assets/') || SHELL_STATIC_PATHS.includes(url.pathname);
}

/**
 * Reports whether a URL is a card image or an ability icon.
 *
 * @param {URL} url - The request URL.
 * @returns {boolean} True for the card and icon shapes on the image host.
 */
function isCardImageUrl(url) {
  if (url.origin !== IMAGE_ORIGIN) {
    return false;
  }
  return (
    CARD_ORIGINAL_PATTERN.test(url.pathname) ||
    CARD_TIER_PATTERN.test(url.pathname) ||
    ABILITY_ICON_PATTERN.test(url.pathname)
  );
}

/**
 * Fetches one precache URL and checks it is fit to answer from the cache.
 *
 * @param {string} url - A URL from the precache manifest.
 * @returns {Promise<Response>} The response to store.
 * @throws When the response is not OK, was redirected, or is an HTML fallback.
 */
async function fetchPrecacheEntry(url) {
  const absoluteUrl = new URL(url, self.location.origin);
  const isCrossOrigin = absoluteUrl.origin !== self.location.origin;
  const response = isCrossOrigin
    ? await fetch(absoluteUrl.href, { cache: 'no-store', mode: 'cors', credentials: 'omit' })
    : await fetch(absoluteUrl.href, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('The offline precache could not fetch ' + url + ': the server answered ' + response.status + '.');
  }
  // why: a cached redirect can't answer a navigation, and a redirected asset is
  // not the file the manifest names.
  if (response.redirected) {
    throw new Error('The offline precache refused ' + url + ' because the server redirected it.');
  }
  // why: Pages and vite preview answer a missing file with the SPA fallback,
  // `200 text/html`; caching that under an asset or icon URL would break the
  // offline page, so a missing file fails the install instead.
  const contentType = response.headers.get('content-type') ?? '';
  if (url !== OFFLINE_PAGE_PATH && contentType.startsWith('text/html')) {
    throw new Error('The offline precache refused ' + url + ' because the server answered HTML (the file is missing).');
  }
  return response;
}

/**
 * Precaches this build's shell. Any failure rejects, so the worker doesn't
 * install and the page keeps playing online.
 *
 * @returns {Promise<void>} Settles when every shell file is cached.
 */
async function precacheShell() {
  const manifestResponse = await fetch(PRECACHE_MANIFEST_PATH, { cache: 'no-store' });
  if (!manifestResponse.ok) {
    throw new Error('The offline precache manifest could not be fetched: the server answered ' + manifestResponse.status + '.');
  }
  const manifest = await manifestResponse.json();
  if (manifest.build !== BUILD_ID) {
    throw new Error('The offline precache manifest is for build ' + manifest.build + ', but this worker is build ' + BUILD_ID + '.');
  }
  const cache = await caches.open(SHELL_CACHE);
  await Promise.all(
    manifest.urls.map(async (url) => {
      const response = await fetchPrecacheEntry(url);
      await cache.put(new URL(url, self.location.origin).href, response);
    }),
  );
}

/**
 * Deletes every other build's shell cache, then takes uncontrolled pages.
 *
 * @returns {Promise<void>} Settles when activation is done.
 */
async function activateWorker() {
  const cacheNames = await caches.keys();
  for (const cacheName of cacheNames) {
    // why: the image cache is never deleted here: tier URLs are immutable, so
    // images survive a new build. A future rename of `la-offline-images-v1`
    // deletes the old name in this loop (D-24851).
    if (cacheName.startsWith(SHELL_CACHE_PREFIX) && cacheName !== SHELL_CACHE) {
      await caches.delete(cacheName);
    }
  }
  // why: the claim takes only uncontrolled `/offline/` pages (the first visit,
  // or a hard reload). With no skipWaiting no page ever changes worker, so no
  // code swaps under a match in progress.
  await self.clients.claim();
}

/**
 * Fetches a navigation, aborting it after NAVIGATION_TIMEOUT_MS.
 *
 * @param {Request} request - The navigation request.
 * @returns {Promise<Response|null>} The network response, or null on a rejection or timeout.
 */
async function fetchNavigation(request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS);
  try {
    return await fetch(request, { signal: controller.signal });
  } catch {
    // why: offline, a DNS failure or the timeout's abort all mean "use the
    // cached page"; the caller decides.
    return null;
  } finally {
    // why: cleared as soon as the fetch settles, so a late abort can never cut
    // off a response body that is still streaming.
    clearTimeout(timeoutId);
  }
}

/**
 * Answers a navigation: network first, the cached `/offline/` page on a
 * rejection, timeout, non-OK status or redirect.
 *
 * @param {Request} request - The navigation request.
 * @returns {Promise<Response>} The response for the page.
 */
async function answerNavigation(request) {
  // why: network first, and the network response is never written to a cache:
  // online the player always gets the current HTML, and offline the cached HTML
  // matches the cached assets of the same install.
  const networkResponse = await fetchNavigation(request);
  // why: plane wifi answers with a captive-portal redirect or an error page,
  // not a clean rejection; only an OK, unredirected response is the real page.
  if (networkResponse !== null && networkResponse.ok && !networkResponse.redirected) {
    return networkResponse;
  }
  const cachedPage = await caches.match(OFFLINE_PAGE_PATH, { cacheName: SHELL_CACHE });
  if (cachedPage !== undefined) {
    return cachedPage;
  }
  if (networkResponse !== null) {
    return networkResponse;
  }
  return Response.error();
}

/**
 * Answers a shell file from the shell cache, else from the network.
 *
 * @param {Request} request - The shell-file request.
 * @returns {Promise<Response>} The response.
 */
async function answerShellFile(request) {
  const cachedResponse = await caches.match(request, { cacheName: SHELL_CACHE, ignoreVary: true });
  if (cachedResponse !== undefined) {
    return cachedResponse;
  }
  return fetch(request);
}

/**
 * Answers a card image or ability icon: cache first, else a `cors` fetch that
 * is stored when OK, else a cached sibling tier.
 *
 * @param {string} url - The image URL.
 * @returns {Promise<Response>} The response.
 */
async function answerCardImage(url) {
  const cachedResponse = await caches.match(url, { cacheName: IMAGE_CACHE, ignoreVary: true });
  if (cachedResponse !== undefined) {
    return cachedResponse;
  }
  let networkResponse;
  try {
    // why: an `<img>` asks `no-cors`, and an opaque response is stored at a
    // padded size; the image host answers `Access-Control-Allow-Origin: *`, so
    // a `cors` re-fetch gives a real-size copy.
    networkResponse = await fetch(url, { mode: 'cors', credentials: 'omit' });
  } catch {
    for (const siblingUrl of siblingImageUrls(url)) {
      const siblingResponse = await caches.match(siblingUrl, { cacheName: IMAGE_CACHE, ignoreVary: true });
      if (siblingResponse !== undefined) {
        return siblingResponse;
      }
    }
    return Response.error();
  }
  if (networkResponse.ok) {
    try {
      const imageCache = await caches.open(IMAGE_CACHE);
      await imageCache.put(url, networkResponse.clone());
    } catch {
      // why: a full quota only means this image isn't kept offline; the
      // player still sees it now.
    }
  }
  return networkResponse;
}

self.addEventListener('install', (event) => {
  // why: no skipWaiting. A new build waits until every offline tab closes, so
  // it never swaps code under a match in progress.
  event.waitUntil(precacheShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(activateWorker());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }
  // why: the routing decision is synchronous and reads only the URL. The
  // browser may stop the worker between any two events, so nothing is kept in
  // memory: a cold-started worker routes exactly like a warm one.
  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    event.respondWith(answerNavigation(request));
    return;
  }
  if (isShellUrl(url)) {
    event.respondWith(answerShellFile(request));
    return;
  }
  if (isCardImageUrl(url)) {
    event.respondWith(answerCardImage(url.href));
  }
  // Everything else (API, version.json, analytics, audio, play mats, other
  // origins) is not answered; the browser handles it.
});
