# WP-894 — Airplane mode slice 1: an installable `/offline/` page plays the featured solo setup with no network (web app manifest + service worker scoped to `/offline/`)

**Status:** Draft 2026-11-13
**Primary Layer:** arena-client (a second HTML entry, a production route, a page, a classic service worker and its precache manifest), plus two authority-text amendments (`docs/ai/ARCHITECTURE.md` §2, `.claude/rules/architecture.md` "Engine Owns Truth") under D-24844. No engine, registry, server, card-data or `UIState` change.
**Dependencies (all ✅):**
- WP-890 / D-24842 (the local match client, the game copy, the setup bundle and its reader, all reused unchanged)
- WP-888 / D-24840 and WP-891 / D-24848 (card faces request the `thumb` tier at 1x and `phone` at 2x through `CardImage.vue`; `lib/cardImageTiers.ts` maps an original URL to a tier URL)
- WP-410 / D-24222 (`UIState.matchCardImageUrls`, the setup's image list)
- WP-418 (the build-stamped `version.json` plugin in `vite.config.ts`, the precedent for a `generateBundle` asset; `__GIT_SHA__`)
- D-24844 (a single-seat solo match may run its rules on the device), D-24845 (the featured setup is the free one), D-24846 (downloads accepted, no expiry)

**User-Visible Surface:** `play.legendary-arena.com/offline/` — a new page a player can open, install to the home screen, and play the featured solo table on with no network. It is reachable by URL only; nothing in the lobby links to it until slice 3. The live game at `/` is unchanged and is never controlled by the service worker.
**Risk Tier:** MEDIUM — a service worker is a long-lived production artifact on players' devices; a bad cache policy can pin a stale build. It is contained by scope (`/offline/` only), a per-build cache name, network-first navigation, no `skipWaiting`, and an explicit passthrough for every request it doesn't own. No server, persistence of game state, auth, money or engine surface is touched.
**Lane:** Standard (two-session). Not lightweight-eligible: new runtime wiring (a service worker), an authority-text amendment, a D-entry that locks a cross-cutting policy, and more than four code files.

> Baseline: `origin/main` at `937a128c` plus the reserve #3351. Code facts read 2026-11-13 at that commit. Scaffold (draft session, reverted): adding `offline/index.html` (same `<script type="module" src="/src/main.ts">`) as a second `build.rollupOptions.input` emitted `dist/offline/index.html` referencing the **same single entry chunk** as `dist/index.html`; nothing split. The entry chunk's name follows the input key (key `main` renamed `index-*.js` to `main-*.js`), so the key is locked as `index`.

---

## Goal

Slice 1 of [Airplane Mode](../../../wiki/airplane-mode.md): the smallest offline version.

1. A player opens `https://play.legendary-arena.com/offline/` online once. The page plays the featured solo table on a `Local()` master (WP-890's client) with a fresh device-generated seed, and in the background caches the app shell and the setup's card images. When both are cached it shows **Ready offline**.
2. With no network (DevTools Offline, or airplane mode on an installed phone app), the page reloads or cold-starts from the cache and plays to the end.
3. The page is installable: a web app manifest with `start_url` and `scope` `/offline/`, icons, and standalone display.

**After this session:** `pnpm --filter @legendary-arena/arena-client build` then `preview` serves `/offline/`; in Chrome it reaches **Ready offline**, survives Network → Offline + reload, and plays to gameover. After deploy, the phone test (install, airplane mode, cold start, play) is the live-verify.

## User-Visible Impact

A new URL that plays the free featured table offline. Nothing changes at `/`: no service worker controls it, no new request, no new UI. The featured setup and its cached images are what D-24845 calls the free download; the download button, size label, badge and Pass gating are slice 3.

## Assumes

1. WP-890 is `[x]`: `apps/arena-client/src/client/localSpikeClient.ts` exports `createLocalSpikeClient`, `LOCAL_SPIKE_DEFAULT_SEED` and the handle `{ start, stop, submitMove, resync, getRecord, getState }`; `client/setupBundleReader.ts` exports `parseLocalSpikeSetupBundle`; the bundle is `src/fixtures/localSpike/featuredSetupBundle.json` (compact, 2,967,837 bytes, `eol=lf`). `pages/LocalSpikePage.vue` keys `PlayViewport` per match start and makes a 32-hex seed from `crypto.getRandomValues`.
2. `apps/arena-client/src/lib/cardImageTiers.ts` exports `cardImageTierUrl(imageUrl, tier)` (returns the tier URL, or `null` for a URL that doesn't match the D-24840 pattern) and `CardImageTier = 'thumb' | 'phone' | 'large'`. `src/components/play/CardImage.vue` renders `src` = `thumb`, `srcset` = `thumb 1x, phone 2x`, with a one-time fallback to the original (WP-891). Its `<img>` has no `crossorigin`, so the browser requests images `no-cors`.
3. `images.legendary-arena.com` answers `Access-Control-Allow-Origin: *` with no `Vary` (checked by curl at draft; wiki Edge Cases "Opaque responses"), so a `fetch(url, { mode: 'cors', credentials: 'omit' })` returns a non-opaque response that Cache Storage counts at real size. The same host also serves audio (`/audio/…`), ability icons (`/icons/*.svg`) and play mats (`/play-mats/…`); Howler fetches audio with full GETs.
4. `apps/arena-client/index.html` loads `/brand-tokens.local.css` and the cross-origin `https://www.legendary-arena.com/brand-tokens.css` (`ACAO: *`), an inline theme-init script, and `<script type="module" src="/src/main.ts">`. No web fonts. `public/` holds `_headers`, `_redirects`, `brand-tokens.local.css`, `loadout-test.json`, `og/`, `robots.txt`; no manifest, icon or service worker exists. No source file references `serviceWorker`.
5. Cloudflare Pages auto-deploys `main` and serves a directory's `index.html` for its path (the build already relies on that for `/`). `public/_headers` marks `/assets/*` immutable for a year; HTML gets Pages' default `max-age=0, must-revalidate`. `functions/_middleware.ts` rewrites only `?profile=` HTML and 404s an HTML-masked `/assets/*` request; every other request passes through.
6. `vite.config.ts` has `emitVersionJsonPlugin(gitSha)` (`generateBundle` + `this.emitFile`), `__GIT_SHA__` in `define`, `build.rollupOptions` with only `onwarn`, and fails the build on a `node:*` import in the bundle (the config file itself may import `node:*`).
7. `App.vue` routes by `?route=` and other query params through `parseQuery` / `selectRoute(parsed)` (no pathname today) into a closed `AppRoute` union; `shouldHydrateSession(route)` is true only for guarded routes, `lobby` and `live`; `useAnalyticsCapture()` runs on every route (it POSTs `/api/analytics/events` and writes `localStorage` flags, failing soft offline). `App.test.ts` mounts App through `mountApp(searchOverride)` with the route pages stubbed. `jsdom-setup` stamps `__GIT_SHA__`; `env.d.ts` declares it and includes `vite/client` types, so `import.meta.env.PROD` typechecks. `offline/index.html` sits outside `src/`, so `vue-tsc` needs no config change.
8. `PlayViewport` mounts with only `submitMove` (the `play-fixture` and spike precedent). With no game server, its children's requests fail soft (WP-890 AC 7: the only `/api/` request was the analytics POST). `useDeployVersionCheck` polls `version.json` and treats a failed fetch as a no-op.
9. A service worker's maximum scope is its script's directory, so `/offline/sw.js` registered with `scope: '/offline/'` controls only pages under `/offline/`; requests made by pages at `/` never reach it. A registration whose script URL differs (here, by `?build=<sha>`) installs a new worker; a waiting worker activates only when every controlled page has closed (no `skipWaiting`).
10. Root `package.json` depends on `sharp` (`scripts/build-card-image-sizes.mjs`), and `ewiki/branding/logo-la-emblem.svg` is the brand emblem.
11. D-24844 §2 says the engine still owns truth on the device: the UI submits intent and sees only `playerView`. `docs/ai/ARCHITECTURE.md` §2 "The Engine Owns Truth" has four bullets and no device clause; `.claude/rules/architecture.md` "Engine Owns Truth" says "no client-side rule execution or reconciliation". D-24842 §6 recorded the spike as a development-only exception and §7 left the production amendment to this slice.

12. A `vite preview` of a build serves `/offline/` from `dist/offline/index.html` and the root `index.html` at the bare `/offline`; both Pages and `vite preview` answer a missing non-`/assets/` path with `200 text/html` (the SPA fallback). A tsx probe of `createLocalSpikeClient` + `start()` gave a state synchronously, and two seeds each gave 31 unique `matchCardImageUrls`, all matching the tier pattern (pre-flight).

If any assumption is false, STOP and reconcile (update this WP and the D-24851 reservation) before coding.

## Context (Read First)

- `wiki/airplane-mode.md` (slice 1 row, §Caching, §Edge Cases "App update mid-game", "iOS storage eviction", "Opaque responses").
- D-24842 (what the spike proved and measured), D-24844..D-24847 (the operator decisions), D-24840 / D-24848 (tier URLs), D-24222 (image list), WP-418 (`version.json`).
- `docs/ai/ARCHITECTURE.md` §2 and §Layer Boundary; `.claude/rules/architecture.md` "Engine Owns Truth" and §Persistence Boundary. Cache Storage holds static files and images, never `G`, `ctx` or a match record; on-device save is slice 2.
- **Why a second HTML entry, not a route in `index.html`:** the manifest link must appear only on the offline page, or the live game at `/` would install as the offline app. The scaffold showed a second input reusing `src/main.ts` adds no chunk.
- **Why a hand-written classic service worker, not `vite-plugin-pwa`:** no new dependency; the policy is five routes and two caches, and the shipped file is tested directly (loaded into `node:vm`). The precache list and build id are the only build-time inputs, so a `generateBundle` plugin (the WP-418 precedent) emits `offline/precache.json`, and the build id rides the registration URL.
- **Why reuse the spike modules unchanged:** they are exactly the client slice 1 needs. Renaming `localSpike*` is churn with no behaviour; a later slice that changes bundle or record v1 renames under its own D-entry. The spike page itself stays behind `VITE_LOCAL_SPIKE`.
- DECISIONS scanned: D-10008, D-14401, D-24095, D-24119, D-24222, D-24715, D-24838, D-24840, D-24842, D-24844..D-24848. D-24842 §5 said a default build carries no fixture; this packet ships the fixture in the lazy `/offline/` chunk, and D-24851 supersedes that one clause.

## Non-Negotiable Constraints

**Repo-wide:** full file contents for every new or modified file (no diffs, no snippets); ESM only, Node v22+, `node:` prefixes. `public/offline/sw.js` is the one non-module file: a classic worker script with no imports (Locked Values). Human-style code per `00.6` and `.claude/rules/code-style.md` (full-word names, JSDoc on every function, functions about one screen, full-sentence errors, `try/catch` on I/O); `node:test` `.test.ts` suites.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile before coding. One WP per session.

**Packet-specific:**
- No engine, registry, server, card-data, `UIState` or `00.2` change. The local client, reader and bundle are used as WP-890 shipped them.
- The service worker never controls `/`: its script lives at `/offline/sw.js` and registers with `scope: '/offline/'`.
- Cache Storage holds only this build's shell files, card images and ability icons. Nothing persists `G`, `ctx`, a seed or a move log (slice 2). Audio and play mats are never cached.
- The page never runs a bot or the engine's AI.
- `/` behaves exactly as before: same entry chunk, same routes, no manifest link, no service-worker registration.
- No existing test assertion is edited to go green (`App.test.ts`'s `mountApp` helper gains an optional argument and a stub; no existing case changes).

## Locked Values

- **Path:** the offline page is `/offline/` (trailing slash). `isOfflinePath(pathname: string): boolean` in `apps/arena-client/src/offline/offlineRoute.ts` returns `pathname.startsWith('/offline/')`. The bare `/offline` is not the offline page (Vite preview serves the root `index.html` there, and it is outside the worker's scope).
- **Second entry:** `apps/arena-client/offline/index.html` is `index.html` with its `<title>` changed to `<title>Legendary Arena — Offline</title>` and three tags added after it: `<link rel="manifest" href="/offline/manifest.webmanifest" />`, `<meta name="theme-color" content="#fdfcf8" />`, `<link rel="apple-touch-icon" href="/offline/apple-touch-icon.png" />`. It loads the same `<script type="module" src="/src/main.ts">`. `vite.config.ts` sets `build.rollupOptions.input = { index: fileURLToPath(new URL('./index.html', import.meta.url)), offline: fileURLToPath(new URL('./offline/index.html', import.meta.url)) }` (`fileURLToPath` from `node:url`).
- **Route:** `AppRoute` gains `'offline'`. App gains a testing prop `pathnameOverride` (`String`, default `null` → `window.location.pathname`, or `''` with no window). `selectRoute(parsed: ParsedQuery, pathname: string): AppRoute` returns `'offline'` first, before every query-param route, when `isOfflinePath(pathname)`. The page is `const OfflinePlayPage = defineAsyncComponent(() => import('./pages/OfflinePlayPage.vue'));`, registered in `components` and rendered in a `route === 'offline'` template branch. The play-route flex CSS selector list gains `main[data-route='offline']`.
- **Manifest** `apps/arena-client/public/offline/manifest.webmanifest`:
  `{ "name": "Legendary Arena — Offline", "short_name": "LA Offline", "start_url": "/offline/", "scope": "/offline/", "display": "standalone", "background_color": "#fdfcf8", "theme_color": "#fdfcf8", "icons": [ { "src": "/offline/icon-192.png", "sizes": "192x192", "type": "image/png" }, { "src": "/offline/icon-512.png", "sizes": "512x512", "type": "image/png" }, { "src": "/offline/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" } ] }`.
- **Icons:** `public/offline/icon-192.png` (192×192), `icon-512.png` (512×512), `apple-touch-icon.png` (180×180): `ewiki/branding/logo-la-emblem.svg` resized with `sharp` to 70% of the square's height and composited at the centre of a `#fdfcf8` square. Generated once by the command in Verification step 2; no script is committed.
- **Precache manifest plugin:** `emitOfflinePrecacheManifestPlugin(gitSha)` in `vite.config.ts`, `generateBundle(options, bundle)` throws a full-sentence error when `gitSha === 'unknown'` (the `vite.config.ts` fallback when git is unavailable: every such build would share one `?build=` and never update the offline copy), and otherwise emits `offline/precache.json` = `{ "build": <gitSha>, "urls": [...] }`, where `urls` is, in this order: `/offline/`; every bundle `fileName` that starts with `assets/` and doesn't end with `.map`, as `/<fileName>`, sorted by code-unit order; then `/brand-tokens.local.css`, `/offline/manifest.webmanifest`, `/offline/icon-192.png`, `/offline/icon-512.png`, `/offline/apple-touch-icon.png`, `https://www.legendary-arena.com/brand-tokens.css`. Compact JSON.
- **Headers:** `public/_headers` gains `/offline/sw.js` → `Cache-Control: no-cache` and `/offline/precache.json` → `Cache-Control: no-store`.
- **Registration:** `registerOfflineServiceWorker(environment: { isProductionBuild: boolean; buildId: string; serviceWorkerContainer: ServiceWorkerContainer | undefined })` in `src/offline/registerOfflineServiceWorker.ts` returns `Promise<{ outcome: 'registered' | 'unsupported' | 'skipped-dev' | 'failed'; registration: ServiceWorkerRegistration | null }>`: `'skipped-dev'` when `environment.isProductionBuild !== true`; `'unsupported'` when `serviceWorkerContainer` is `undefined`; otherwise `serviceWorkerContainer.register('/offline/sw.js?build=' + encodeURIComponent(environment.buildId), { scope: '/offline/' })` → `'registered'` with the registration, or `'failed'` on a rejection. The page passes `isProductionBuild: typeof import.meta.env === 'object' && import.meta.env.PROD === true`, `buildId: __GIT_SHA__`, `serviceWorkerContainer: navigator.serviceWorker`.
- **Service worker** `apps/arena-client/public/offline/sw.js` (classic script, no imports, no `importScripts`; keeps no state between events, because the browser may stop it between any two events):
  - Constants: `BUILD_ID = new URLSearchParams(self.location.search).get('build') ?? 'dev'`; `NAVIGATION_TIMEOUT_MS = 4000`; `SHELL_CACHE = 'la-offline-shell-' + BUILD_ID`; `IMAGE_CACHE = 'la-offline-images-v1'`; `IMAGE_ORIGIN = 'https://images.legendary-arena.com'`; `BRAND_CSS_URL = 'https://www.legendary-arena.com/brand-tokens.css'`; `SHELL_STATIC_PATHS = ['/brand-tokens.local.css', '/offline/manifest.webmanifest', '/offline/icon-192.png', '/offline/icon-512.png', '/offline/apple-touch-icon.png']`.
  - `install`: `fetch('/offline/precache.json', { cache: 'no-store' })`; reject if `manifest.build !== BUILD_ID`. Then, for each URL in `manifest.urls`, `fetch(url, { cache: 'no-store', mode: 'cors', credentials: 'omit' })` for a cross-origin URL, `fetch(url, { cache: 'no-store' })` otherwise; reject if `!response.ok`, if `response.redirected` (a cached redirect can't answer a navigation), or if the URL isn't `/offline/` and the response's `content-type` starts with `text/html` (a Pages or preview SPA fallback for a missing file); else `put` it in `SHELL_CACHE`. Any rejection rejects `waitUntil`: the worker doesn't install and the page still plays online. No `skipWaiting`.
  - `activate`: delete every cache whose name starts with `la-offline-shell-` and isn't `SHELL_CACHE`; never delete `IMAGE_CACHE`; then `self.clients.claim()`. (The claim affects only uncontrolled `/offline/` pages, such as the first visit or a hard reload; with no `skipWaiting` no page ever changes worker, so no code swaps under a match.)
  - `fetch` (only `request.method === 'GET'`; anything else is not answered). The routing decision is synchronous and depends only on the URL:
    1. **Navigation** (`request.mode === 'navigate'`): network first with an `AbortController` timeout of `NAVIGATION_TIMEOUT_MS`, cleared with `clearTimeout` as soon as the fetch settles (resolve or reject), so a late abort can never cut off a response body; the network response is returned only when it is `ok` and not `redirected`. On a rejection, the timeout, a non-OK status or a redirect (a captive portal or a hung connection on plane wifi), answer `caches.match('/offline/', { cacheName: SHELL_CACHE })`; if that misses too, return the network response when there is one, else `Response.error()`. A network response is never written to a cache.
    2. **Shell file** (same origin and (`pathname.startsWith('/assets/')` or `SHELL_STATIC_PATHS` includes `pathname`), or the URL equals `BRAND_CSS_URL`): `caches.match(request, { cacheName: SHELL_CACHE, ignoreVary: true })`, else `fetch(request)`.
    3. **Card image or ability icon** (origin `IMAGE_ORIGIN` and pathname matches `^/[a-z0-9]+/[^/]+\.webp$`, `^/[a-z0-9]+/(thumb|phone|large)/[^/]+\.webp$` or `^/icons/[a-z0-9-]+/[^/]+\.svg$`, the shape `abilityMarkers.ts` builds, e.g. `/icons/hero-classes/class-strength.svg`): `caches.match(url, { cacheName: IMAGE_CACHE, ignoreVary: true })`; else `fetch(url, { mode: 'cors', credentials: 'omit' })`, and when `response.ok` put a clone in `IMAGE_CACHE`; if the fetch rejects, try `siblingImageUrls(url)` in `IMAGE_CACHE` in order; else `Response.error()`.
    4. **Everything else** (API, `version.json`, analytics, audio, play mats, other origins): not answered; the browser handles it.
  - `siblingImageUrls(url)` (a top-level `function`) maps a card URL `https://images.legendary-arena.com/<set>/<file>.webp` or `/<set>/<tier>/<file>.webp` to the `[phone, thumb, original]` URLs of that card, minus the requested URL; an icon or any other shape gives `[]`.
- **Image warm:** `warmOfflineCardImages(originalUrls: Iterable<string>, cacheStorage: CacheStorage)` in `src/offline/offlineImageCache.ts` expands each original to its `thumb` and `phone` tier URLs (`cardImageTierUrl`; an original with no tier URL is kept as itself), dedupes, opens `IMAGE_CACHE_NAME`, and for each URL not already matched calls `cache.add(new Request(url, { mode: 'cors', credentials: 'omit' }))`. It returns `{ total, cached, failed }` (`cached` counts URLs present after the call) and never throws; a failure counts in `failed`. `IMAGE_CACHE_NAME = 'la-offline-images-v1'` is exported and equals the worker's constant.
- **Status:** `describeOfflineStatus(input)` in `src/offline/offlineStatus.ts` is pure. Input: `{ registrationOutcome: 'pending' | 'registered' | 'unsupported' | 'skipped-dev' | 'failed'; isWorkerActive: boolean; hasInstallFailed: boolean; warm: { total: number; cached: number; failed: number } | null }`. Output, exactly one string, checked in this order: `'Offline copy is built only in production builds'` (`skipped-dev`); `'Offline copy unavailable: this browser has no service worker support'` (`unsupported`); `'Offline copy unavailable: the service worker could not be registered'` (`failed`); `'Offline copy unavailable: the service worker failed to install'` (`hasInstallFailed`); `'Offline copy unavailable: <failed> card images could not be cached'` (`warm.failed > 0`); `'Ready offline'` (`registered`, `isWorkerActive`, `warm.total > 0`, `warm.cached === warm.total`); otherwise `'Preparing offline copy…'`.
- **Page** `apps/arena-client/src/pages/OfflinePlayPage.vue`:
  - On mount: register the worker. When `'registered'`, `isWorkerActive` becomes true when `navigator.serviceWorker.ready` resolves; if `registration.installing` reaches the `redundant` state while `registration.active` is `null`, `hasInstallFailed` becomes true (a failed update leaves the previous build's offline copy working, so it isn't reported). Start a match with `createLocalSpikeClient({ bundle, matchConfiguration: bundle.matchConfiguration, seed: <32 lowercase hex from crypto.getRandomValues, 16 bytes>, writesStores: true })`; after `start()`, `warmOfflineCardImages(new Set(getState()?.matchCardImageUrls ?? []), caches)` when `typeof caches !== 'undefined'`.
  - The status line is `describeOfflineStatus(...)`.
  - **New game** stops the handle and starts a fresh match on a new seed; `PlayViewport` is keyed per match start.
  - Errors from the client or bundle show in the status line in place of the status text, and `PlayViewport` isn't rendered (no blank board). `stop()` on unmount.
  - Nothing is saved; the record is not exposed.
- **Authority amendment:** `docs/ai/ARCHITECTURE.md` §2 gains the bullet: "A single-seat solo match may run the unchanged engine on a boardgame.io `Local()` master on the player's device (D-24844, D-24851). The engine still owns truth there: the UI submits intents and reads only `playerView`; no UI code runs rules." `.claude/rules/architecture.md` "Engine Owns Truth" gains: "- A device-hosted `Local()` master running the unchanged engine for single-seat solo is the engine, not client-side rule execution (D-24844, D-24851)".

## Scope (In)

- **A) Entry + config:** `apps/arena-client/offline/index.html` (new); `vite.config.ts` (`input`, `emitOfflinePrecacheManifestPlugin`, `node:url` import).
- **B) Static files:** `public/offline/sw.js`, `public/offline/manifest.webmanifest`, `public/offline/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (new); `public/_headers` (two rules).
- **C) Helpers:** `src/offline/offlineRoute.ts`, `src/offline/registerOfflineServiceWorker.ts`, `src/offline/offlineImageCache.ts`, `src/offline/offlineStatus.ts` (new).
- **D) Page:** `src/pages/OfflinePlayPage.vue` (new).
- **E) App wiring:** `App.vue` (`pathnameOverride`, `'offline'` route first, lazy page, template branch, CSS selector).
- **F) Tests:**
  - `src/offline/offlineRoute.test.ts`: `/offline/` and `/offline/anything` → true; `/`, `/offline`, `/offlinex/` and `/play/offline/` → false.
  - `src/offline/registerOfflineServiceWorker.test.ts`: `'skipped-dev'`; `'unsupported'`; the exact script URL (with an encoded build id) and `scope` passed to `register`; `'failed'` on rejection.
  - `src/offline/offlineStatus.test.ts`: every output string, the order (a failure beats Ready), `warm.total === 0` is not Ready, and Ready needs `isWorkerActive`.
  - `src/offline/offlineImageCache.test.ts`: tier expansion (thumb + phone per original), dedupe, a non-matching URL kept as itself, already-cached URLs skipped, `cors`/`omit` requests, a failure counted not thrown, `IMAGE_CACHE_NAME`.
  - `src/offline/offlineServiceWorker.test.ts`: reads the shipped `public/offline/sw.js` and runs it in a `node:vm` context whose globals are passed in (`URL`, `Request`, `Response`, a stub `caches`, a stub `fetch`, `self` = the context with `location` and an `addEventListener` that captures handlers, and `clients.claim`, plus `setTimeout`, `clearTimeout` and `AbortController`, with the timeout case driven by `node:test` `mock.timers`); values from the vm realm are JSON round-tripped before `deepStrictEqual`. Requests are plain fake objects (`{ url, method, mode }`; Node's `Request` refuses `mode: 'navigate'`), and a redirected response is a fake object with `redirected: true` (a constructed `Response` can't be). "Answered" means the fetch handler called `event.respondWith` synchronously during dispatch; "not answered" means it never called it. It asserts: install fetches `precache.json` `no-store` and puts every URL in `la-offline-shell-<build>`; install rejects on a build mismatch, a non-OK response, a redirected response, and an HTML response for a non-`/offline/` URL; every URL in a sample precache list except `/offline/` is answered by the shell route (so the precache tail and `SHELL_STATIC_PATHS` can't drift); a URL produced by `cardImageTierUrl` for each tier is answered by the card route; activate deletes only other `la-offline-shell-*` caches, keeps the image cache, and claims clients; navigation is network-first, falls back to cached `/offline/` when the fetch rejects, returns a non-OK status, returns a redirected response, or exceeds the timeout, returns a fetch that resolves before the timeout untouched with its timer cleared, and never writes the network response; a freshly loaded worker with no install event serves a cached `/assets/x.js` (no in-memory state); a card image and a real icon URL (`/icons/hero-classes/class-strength.svg`, `/icons/card-info/info-attack.svg`) are served from cache, `/icons/x/y/z.svg` and `/icons/x.svg` are not answered, else fetched `cors`/`omit` and stored; offline, a card-image miss falls back to a sibling tier; an audio GET, a play-mat GET, an API GET, `version.json` and a POST are not answered; `siblingImageUrls` for the original, `thumb` and `phone` shapes and a foreign URL.
  - `App.test.ts`: `mountApp` gains an optional second argument `pathnameOverride` and the stub `OfflinePlayPage: true`; one new case: `pathnameOverride` `'/offline/'` gives `data-route` `'offline'`.
- **G) Authority text:** `docs/ai/ARCHITECTURE.md` §2 and `.claude/rules/architecture.md` "Engine Owns Truth", one bullet each (Locked Values). `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` `client-app` gains a "device-hosted engine / offline subsurface (D-24851)" paragraph naming `src/offline/`, `pages/OfflinePlayPage.vue`, `offline/index.html` and the classic `public/offline/sw.js` (Cache Storage and network I/O, no game state), on the `functions/` and `vfx/` precedent.
- **H) Docs:** `docs/03.1-DATA-SOURCES.md` gains the featured setup bundle (`apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json`, regenerated by `pnpm spike:local-bundle`) as a production input of `/offline/`. `wiki/airplane-mode.md`: slice 1 row gains a **Result** line (WP-894 / D-24851) and its check; §Caching's app-shell row records the hand-written worker (replacing "Workbox-style … candidate; not tried"); front-matter `source` gains the new files; the line saying offline events "are queued, not dropped" is marked as not yet true in slice 1 (an offline emit is dropped; the results-queue slice adds queuing).

## Out of Scope

- On-device save and resume (slice 2), the setup-bundle endpoint, download button, size label, badge and bundle trimming (slice 3), the storage page (slice 4), results upload and verification (slice 5), viewed-card caching and tier settings (slice 6).
- Any lobby link to `/offline/`, Pass gating, account or sign-in on the offline page.
- Audio and play mats offline (never cached; sounds and the mat may be missing offline; a later slice decides). Ability icons are cached only once seen online, so an icon never shown before going offline may be missing.
- Requesting persistent storage (`navigator.storage.persist()`) and measuring eviction: AC 7's phone test observes behaviour; requesting persistence is a later slice.
- A CI gate for `pnpm spike:local-bundle --check` (proposed as separate hygiene).
- Renaming the `localSpike*` modules or changing bundle / record v1.
- Changing `bgioClient.ts`, the live route, `useAnalyticsCapture`, `functions/_middleware.ts` or the SPA warm workflow.

## Files Expected to Change

- `apps/arena-client/offline/index.html` — **new**
- `apps/arena-client/public/offline/sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — **new**
- `apps/arena-client/src/offline/offlineRoute.ts` + `.test.ts`, `registerOfflineServiceWorker.ts` + `.test.ts`, `offlineImageCache.ts` + `.test.ts`, `offlineStatus.ts` + `.test.ts`, `offlineServiceWorker.test.ts` — **new**
- `apps/arena-client/src/pages/OfflinePlayPage.vue` — **new**
- `apps/arena-client/vite.config.ts`, `apps/arena-client/public/_headers`, `apps/arena-client/src/App.vue`, `apps/arena-client/src/App.test.ts` — **modified**
- `docs/ai/ARCHITECTURE.md`, `.claude/rules/architecture.md`, `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`, `docs/03.1-DATA-SOURCES.md`, `wiki/airplane-mode.md` — **modified**
- Governance (execution close): `docs/ai/DECISIONS.md` (D-24851 appended Active), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-894-airplane-mode-offline-shell.md` — **modified / new**

## Contract

- The `/offline/` path, the worker's script URL and scope, the two cache-name prefixes, and `offline/precache.json` `{ build, urls }`. Slices 2–4 build on these; a change needs a D-entry.
- The live route's contract is unchanged: `/` serves the same entry chunk and is never controlled.

## Vision Alignment

**Vision clauses touched:** §3 (randomness: the device generates the seed, as D-24844 allows), §8 (deterministic engine), §9 (card images stay R2-addressed; the cache holds copies, nothing is bundled), §11 Stateless Client, §16 Performance & Responsiveness, §18 (replay).
**Conflict assertion:** No conflict. §8 / §18: the engine runs unchanged; WP-890 proved the local master equals the server reducer. §11: the offline page keeps match state in memory only; a refresh starts a new match until slice 2 adds resume (recorded in D-24851). Caches hold static files and images only.
**Non-Goal proximity:** NG-1 untouched: the offline game plays by the same rules; nothing is bought.
**Determinism (§22):** no engine, `G` shape, replay contract or hash change.

## Funding Surface Gate

§20 **N/A**: no funding affordance, channel, copy or account surface. The featured setup is D-24845's free one; Pass gating is slice 3.

## API Catalog

§21 **N/A**: no `apps/server` endpoint or catalog function changes. The worker answers no `/api/` request.

---

## Acceptance Criteria

1. `pnpm --filter @legendary-arena/arena-client test` passes, every Scope F case present, no existing assertion edited; `typecheck` 0.
2. `pnpm --filter @legendary-arena/arena-client build` 0. `dist/offline/index.html` and `dist/index.html` reference the same `/assets/index-*.js` entry; `dist/index.html` has no `rel="manifest"`; `dist/offline/precache.json` parses, its `build` equals `dist/version.json`'s `gitSha`, and its `urls` follow the locked order and contain every non-map `dist/assets/*` file; `dist/offline/sw.js` is byte-identical to `public/offline/sw.js`; each icon has its locked size; every built `precache.json` URL except `/offline/` matches the shell-route rule (Verification step 4).
3. `vite preview`, Chrome: `/offline/` shows **Ready offline**; DevTools Application lists one worker with scope `/offline/`, caches `la-offline-shell-<sha>` and `la-offline-images-v1`; the warm reports `total` 62 (31 cards × `thumb` + `phone`, verified at draft) and `cached` 62 (the image cache may hold more: icons and any tier fetched at runtime). Network → Offline, reload: the page loads from the worker, plays to gameover by hand or 20 turns, and every card face renders. **New game** starts a fresh seed offline.
4. Same preview: `/` is not controlled (`navigator.serviceWorker.controller === null` there) and plays/lobbies as before.
5. `docs/ai/ARCHITECTURE.md` and `.claude/rules/architecture.md` carry the locked bullets; `wiki/airplane-mode.md` carries the slice 1 result; `pnpm wiki:lint` has no finding on it.
6. `git diff --name-only` ⊆ Files Expected to Change.
7. **Live-verify (D-24026), after deploy:** Claude, in the built-in browser on `https://play.legendary-arena.com/offline/`: Ready offline, Offline + reload plays; `/` uncontrolled; the bare `/offline` lands on `/offline/` or is recorded as not doing so. **Jeff, on a phone:** install to the home screen (iOS Safari and Android Chrome), airplane mode, cold start, play, and note whether a later cold start still finds the copy. STATUS records each result; the phone result may land after the WP closes.

## Verification Steps

1. `pnpm install`; `pnpm -r build`.
2. Icons, once, from the repo root:
   `node --input-type=module -e "import sharp from 'sharp'; const dir='apps/arena-client/public/offline/'; for (const [name,size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180]]) { const emblem=await sharp('ewiki/branding/logo-la-emblem.svg').resize({height:Math.round(size*0.7)}).png().toBuffer(); await sharp({create:{width:size,height:size,channels:4,background:'#fdfcf8'}}).composite([{input:emblem,gravity:'centre'}]).png().toFile(dir+name); console.log(name,(await sharp(dir+name).metadata()).width); }"`
   → prints `icon-192.png 192`, `icon-512.png 512`, `apple-touch-icon.png 180`.
3. `pnpm --filter @legendary-arena/arena-client test` and `typecheck` → 0 fail.
4. `pnpm --filter @legendary-arena/arena-client build`, then from `apps/arena-client` in pwsh: `Select-String dist/index.html,dist/offline/index.html -Pattern '/assets/index-[^"]+\.js'` (the same match in each); `Select-String dist/index.html -Pattern 'rel="manifest"'` (nothing); `(Get-FileHash dist/offline/sw.js).Hash -eq (Get-FileHash public/offline/sw.js).Hash` → `True`; `(Get-Content dist/offline/precache.json | ConvertFrom-Json).build -eq (Get-Content dist/version.json | ConvertFrom-Json).gitSha` → `True`; `$p = Get-Content dist/offline/precache.json | ConvertFrom-Json; $static = '/brand-tokens.local.css','/offline/manifest.webmanifest','/offline/icon-192.png','/offline/icon-512.png','/offline/apple-touch-icon.png','https://www.legendary-arena.com/brand-tokens.css'; ($p.urls | ? { $_ -ne '/offline/' -and -not $_.StartsWith('/assets/') -and $static -notcontains $_ }).Count` → `0`.
5. `pnpm --filter @legendary-arena/arena-client preview` → AC 3 and AC 4 in Chrome (built-in browser).
6. `pnpm wiki:lint`; `pnpm ledger:numbers:check`; `pnpm roadmap:counts:check`; `git diff --name-only` against the allowlist.

## Definition of Done

- [ ] ACs 1–6 pass; allowlist-only diff. AC 7's browser part passes after deploy and is recorded in STATUS (the phone part may follow).
- [ ] D-24851 Active. It records: the `/offline/` path and second entry; the worker's scope, caches, routes and update policy (per-build shell cache via `?build=`, network-first navigation never cached, no `skipWaiting`; `clients.claim()` at activation (it takes only uncontrolled `/offline/` pages: the first visit or a hard reload), image cache kept across builds, `cors` re-fetch to avoid opaque padding); the precache manifest and the install's HTML-fallback rejection; the image warm (`thumb` + `phone`) and runtime icon caching; that audio and play mats are never cached; that a refresh starts a new match until slice 2; the authority amendment and that it supersedes D-24842 §6's development-only framing for the offline page; that the featured fixture now ships in the lazy offline chunk (superseding D-24842 §5's "no fixture in a default build" for that file); the navigation fallback (timeout, non-OK, redirect); that a build with no git sha fails rather than shipping a shared `?build=unknown`; that a future rename of `la-offline-images-v1` deletes the old name at activation; that a local match feeds `useAnalyticsCapture` like any match, so it can use up the device's one-time first-match events and an offline emit is dropped with its flag still set (queuing is the results-queue slice); that slice 1's unlinked, signed-out access to the featured download is provisional and does not answer D-24845's guest question, which slice 3 decides; what slice 1 still doesn't do (save, download UI, Pass, audio).
- [ ] STATUS, WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`, `pnpm roadmap:counts:write` then `roadmap:counts:check` 0, ledger LANDED, 01.6 post-mortem.
- [ ] Two-commit topology: `EC-932:` (code, tests, static files, authority text, wiki), then the `SPEC:` close.

## Reserved Decision (lands at execution)

**D-24851 — airplane-mode-offline-shell.** Reserved in NUMBER-LEDGER (#3351); written Active in the execution `SPEC:` close.

## Settled Design Questions (drafting decisions, 2026-11-13)

1. **Production, isolated at `/offline/`.** Jeff chose this over a flag-gated preview deploy (2026-11-13). The worker's scope keeps the live game out of its reach.
2. **A second HTML entry sharing `src/main.ts`.** Only the offline page carries the manifest link; the scaffold showed no chunk split.
3. **A hand-written classic worker, tested in `node:vm`; no `vite-plugin-pwa`.** No new dependency, and the shipped file is the tested file.
4. **The build id in the registration URL.** Each deploy installs a new worker with its own shell cache; old shell caches go at activation. Without it a static `sw.js` would never update and the offline copy would pin the first build forever.
5. **Network-first navigation that never writes the cache.** Online, a player always gets the current HTML; offline, the cached HTML matches the cached assets of the same install.
6. **No `skipWaiting`.** A new build activates when every offline tab closes, so a match in progress never swaps code mid-game (wiki Edge Cases "App update mid-game").
7. **Images re-fetched in `cors` mode.** `<img>` asks `no-cors`; caching that opaque response would count at a padded size. `ACAO: *` makes the `cors` copy real-size.
8. **`thumb` + `phone` for the featured table.** Those are what `CardImage` asks for at 1x and 2x; `large` is never requested on the play surface.
9. **The App's analytics still runs on `/offline/`** (Assumes 7). It fails soft offline, but an offline first match uses up the device's one-time first-match events (the flag is set even when the POST fails); D-24851 records this, and queuing is the results-queue slice. Changing the analytics is out of scope.
10. **Signed-out access is provisional.** The unlinked page doesn't settle D-24845's guest-download question; slice 3 does.

---

## Lint Gate Self-Review (00.3)

Independent subagent runs (2026-11-13).

**Run 1: FAIL** on four text items, all fixed:
- §2: no "no diffs" clause, no session protocol, and "ESM" contradicted the classic worker. Now stated, with the worker as the one non-module file.
- §13: Verification step 2's icon command was elided and step 4 said only "inspect". Now the exact `sharp` command and pwsh checks.
- §15.2: the EC's Risk Tier paraphrased the WP's. Now pasted verbatim.
- EC-TEMPLATE: no live-on-surface gate. Now in After Completing; the DoD requires AC 7's browser part.
- Design finding: the shell route depended on an in-memory precache set, lost when the worker restarts (also pre-flight PS-1).

**Run 2: FAIL** on two contradictions (the DoD said no `clients.claim`; an EC guardrail omitted icons). Both fixed verbatim.

**Run 3: PASS** after the pre-flight round 2 edits; two optional items applied (DoD claim wording, a redirect test case).

**Run 4: FAIL** on one §13 item after the copilot edits (the precache claim check wasn't an exact command); replaced with an exact pwsh check. PASS with that fix.

| § | Verdict |
|---|---|
| §1 Structure | PASS |
| §2 Constraints | PASS |
| §3 Assumes | PASS (12 items) |
| §4 Context | PASS |
| §5 Files | PASS |
| §6 Naming | PASS |
| §7 Dependencies | PASS (no new package; `vite-plugin-pwa` rejected) |
| §8 Boundaries | PASS (Engine Owns Truth amended under D-24844) |
| §9 Windows | PASS |
| §10 Env vars | PASS (none new) |
| §11 Auth | N/A: no auth surface |
| §12 Tests | PASS |
| §13 Verification | PASS |
| §14 ACs | PASS (7 items) |
| §15 / §15.1 / §15.2 | PASS |
| §16 Code style | PASS (the classic worker stated as the one non-module file) |
| §17 Vision | PASS (§3, §8, §9, §11, §16, §18) |
| §18 Prose-vs-grep | N/A: no literal-grep step |
| §19 Bridge-vs-HEAD | N/A: commit-time rule |
| §20 Funding | N/A, justified |
| §21 API catalog | N/A, justified |
| EC-TEMPLATE | PASS (80 content lines; Locked Values byte-identical) |

## Gate Record

**Pre-flight (01.4), independent subagent.**

**Round 1: NOT READY**, two PS items, both applied:
- **PS-1:** the shell route keyed on a precache set held in memory; an offline cold start restarts the worker and loses it, so `/assets/*` would fall through and the page would be blank. Now a synchronous URL-only rule (`/assets/` prefix, `SHELL_STATIC_PATHS`, the brand CSS URL), with a vm case for a freshly loaded worker.
- **PS-2:** the image route matched the whole image host, which also serves audio and play mats. Now only the D-24840 card shapes and ability icons.

RS items applied: `selectRoute(parsed, pathname)`; `mountApp`'s optional argument and stub; the vm realm traps; watching for a `redundant` install; install doing its own fetch and rejecting `text/html` for a missing file (Pages and preview answer `200` with the SPA shell); bare `/offline` dropped; `clients.claim()` at activation; build-mismatch rejection; the `03.1-DATA-SOURCES.md` row; wording; a pure, tested status helper.

Verified by the agent: every Assumes item at HEAD; a tsx probe of `createLocalSpikeClient` (synchronous state; two seeds each give 31 URLs, all tier-shaped, so 62 tier entries); curl of `ACAO: *` with no `Vary` on the image host and the www brand CSS, and the live `version.json` sha; `vite preview` serving `/offline/` from `dist/offline/index.html` and the root page at bare `/offline`.

**Round 2: READY TO EXECUTE** once the DoD's `clients.claim` contradiction was fixed (fixed). RS applied: the claim comment's wording; a failed update isn't reported while an older worker is active; install rejects a redirected response; `ignoreVary` on the shell route. The agent ran Verification step 2's icon command into scratch (192 / 512 / 180).

**Copilot (01.7), independent subagent.**

**Round 1: RISK → HOLD**, eight scope-neutral findings, all applied:
- **#11/#26:** the icon pattern missed the real `/icons/<group>/<file>.svg` shape (`abilityMarkers.ts`). Fixed, with real-URL and negative vm cases.
- **#13:** `02-CODE-CATEGORIES.md` contradicted the amendment and classified none of the new paths. Added to Scope G.
- **#22:** navigation fell back only on a rejected fetch; plane wifi gives captive portals and hung connections. Now a 4 s timeout plus non-OK and redirect fallback.
- **#29/#24:** a local match feeds the analytics first-match events, and an offline emit is dropped with its flag set. Recorded for D-24851; the wiki line is corrected.
- **#30/#20:** signed-out access would settle D-24845's guest question by default. Recorded as provisional; slice 3 decides.
- **#11:** the vm harness couldn't build navigate requests or redirected responses. Fake objects locked; "answered" defined.
- **#4:** the precache tail and `SHELL_STATIC_PATHS` were two hand-kept copies. Cross-checks added (vm and AC 2).
- **#28:** a build with no git sha would ship `?build=unknown` forever. The plugin now throws; the image-cache rename rule goes into D-24851.

**Round 2: RISK → HOLD** on one item: the navigation timer's lifetime (a late abort could cut off a body). Now cleared when the fetch settles, with timer globals and `mock.timers` in the vm harness.

**Round 3: PASS.** All 30 failure modes clear.
