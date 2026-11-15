# EC-932 — Airplane mode offline shell (Execution Checklist)

**Source:** docs/ai/work-packets/WP-894-airplane-mode-offline-shell.md
**Layer:** arena-client (second HTML entry, `/offline/` route and page, classic service worker, precache plugin) + two authority-text bullets
**Risk Tier:** MEDIUM — a service worker is a long-lived production artifact on players' devices; a bad cache policy can pin a stale build. It is contained by scope (`/offline/` only), a per-build cache name, network-first navigation, no `skipWaiting`, and an explicit passthrough for every request it doesn't own. No server, persistence of game state, auth, money or engine surface is touched.

## Before Starting
- [ ] Baseline `origin/main` includes #3351 (reserve) and the WP-894 draft SPEC; WP-890, WP-888, WP-891, WP-410 `[x]`.
- [ ] `pnpm install` → 0; `pnpm -r build` → 0; arena-client `test` → 0 fail (record the count); `typecheck` → 0.
- [ ] Re-check WP §Assumes 1, 2, 4, 6, 7 against the files; any drift means STOP.
- [ ] Scope lock: the target file set is exactly §Files to Produce; anything else needs an inline amendment (01.5).

## Locked Values (do not re-derive)

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

## Guardrails
- No engine, registry, server, card-data, `UIState`, `bgioClient.ts`, `functions/_middleware.ts` or analytics change; the `localSpike*` modules and bundle are reused unchanged.
- The worker never controls `/`: script `/offline/sw.js`, `scope: '/offline/'`. `/` keeps the same entry chunk and gets no manifest link.
- Cache Storage holds only this build's shell files, card images and ability icons; nothing persists `G`, `ctx`, a seed or a move log.
- No `skipWaiting`; no writing a navigation response to a cache; no caching an opaque response, audio or a play mat; the worker keeps no state between events.
- The page never runs a bot or the engine's AI.
- No existing assertion edited to go green; the `node:vm` worker test loads the shipped `public/offline/sw.js`, never a copy.
- Full-sentence errors; `try/catch` on every I/O call; JSDoc on every function.

## Required `// why:` Comments
- The second HTML entry: the manifest link must exist only on the offline page; the input key `index` keeps the live entry chunk's name.
- The precache plugin: the worker needs this build's hashed file list; `build` ties the list to `version.json`.
- The `?build=` registration URL: a new URL per deploy installs a new worker; a static URL would pin the first build.
- Network-first navigation that never writes the cache: cached HTML must match the cached assets of the same install.
- No `skipWaiting`: a new build must not swap code under a match in progress.
- The `cors` image re-fetch: an opaque `no-cors` response is stored at a padded size; `ACAO: *` makes the copy real-size.
- Never deleting `la-offline-images-v1` at activation: tier URLs are immutable, so images survive a new build.
- `clients.claim()` at activation: it takes only uncontrolled `/offline/` pages (first visit, hard reload); with no `skipWaiting` no page changes worker, so no code swaps under a match.
- The URL-only routing in the worker: the browser may stop the worker between events, so nothing is kept in memory.
- The install's HTML check: Pages and preview answer a missing file with the SPA fallback, `200 text/html`.
- The card/icon path patterns: the image host also serves audio and play mats, which must not be cached.
- The navigation timeout and the non-OK / redirect fallback: plane wifi gives captive portals and hung connections, not clean rejections.
- The plugin's `unknown` sha guard: a shared `?build=unknown` would never install an update.
- `pathnameOverride` on App: a testing seam, like `searchOverride`.
- The `'offline'` route first in `selectRoute`: the path is its own surface; a leftover query param must not shadow it.

## Files to Produce
- `apps/arena-client/offline/index.html` — **new** — second entry with the manifest link
- `apps/arena-client/public/offline/sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — **new**
- `apps/arena-client/src/offline/offlineRoute.ts`, `registerOfflineServiceWorker.ts`, `offlineImageCache.ts`, `offlineStatus.ts` (+ a `.test.ts` each), `offlineServiceWorker.test.ts` — **new**
- `apps/arena-client/src/pages/OfflinePlayPage.vue` — **new**
- `apps/arena-client/vite.config.ts`, `public/_headers`, `src/App.vue`, `src/App.test.ts` — **modified**
- `docs/ai/ARCHITECTURE.md`, `.claude/rules/architecture.md`, `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`, `docs/03.1-DATA-SOURCES.md`, `wiki/airplane-mode.md` — **modified**
- `docs/ai/DECISIONS.md` (D-24851), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-894-airplane-mode-offline-shell.md` — governance close

## After Completing
- [ ] arena-client `test` and `typecheck` → 0 fail; every WP Scope F case present.
- [ ] Build: AC 2 checks on `dist/` all hold.
- [ ] `vite preview` in Chrome: Ready offline, warm `total` and `cached` 62, Offline + reload plays to gameover or 20 turns, New game offline, `/` uncontrolled.
- [ ] Live-on-surface (D-24026), after deploy: built-in browser on https://play.legendary-arena.com/offline/ shows Ready offline, Offline + reload plays, and `/` is uncontrolled; recorded in STATUS (Jeff's phone install may follow).
- [ ] `pnpm wiki:lint` → no finding on `airplane-mode.md`; `ledger:numbers:check` 0; allowlist-only `git diff --name-only`.
- [ ] D-24851 Active covering every WP DoD bullet. STATUS updated. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `pnpm roadmap:counts:write` then `roadmap:counts:check` 0. Ledger LANDED. 01.6 post-mortem. Two-commit topology: `EC-932:` → `SPEC:` close.

## Common Failure Smells
- `/` shows a manifest or is controlled by a worker → the link went into `index.html`, or the worker was registered without `scope: '/offline/'`.
- The live entry chunk renamed to `main-*.js` → the input key isn't `index`.
- Offline reload shows the browser's offline page → install failed: a missing file came back as the SPA fallback (`200 text/html`) and the HTML check rejected it (often a missing icon), or a build mismatch; or the worker never activated.
- Offline cold start is blank while a warm reload works → the shell route used an in-memory list that a worker restart lost.
- The cache grows with sounds → the image route matched the whole origin, not the card and icon shapes.
- Ability icons blank offline after an online game → the icon pattern missed the `/icons/<group>/<file>.svg` folder level.
- On plane wifi the page shows a login portal or spins → navigation fell back only on a rejected fetch.
- Status stuck on Preparing → `registration.installing` reaching `redundant` isn't watched.
- After a deploy, `/offline/` keeps old code forever → the registration URL lacks `?build=`.
- Cards blank offline → images weren't warmed, or the worker cached the opaque `no-cors` response instead of a `cors` re-fetch.
- Quota balloons in DevTools → opaque responses cached.
- "Ready offline" never appears in `preview` → `registerOfflineServiceWorker` received `isProductionBuild: false`.
- The vm worker test passes on a copy of the worker → it must read `public/offline/sw.js`.
