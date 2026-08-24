/**
 * Public-Profile Link-Preview Middleware — Client App edge subsurface (WP-300).
 *
 * A Cloudflare Pages Functions middleware that runs ahead of static asset
 * serving. When the served response is the SPA HTML shell AND the request
 * URL carries a valid `?profile=<handle>`, it fetches the existing guest
 * public-profile endpoint and injects per-player Open Graph / Twitter Card
 * `<meta>` into `<head>` via `HTMLRewriter`, so a shared profile link
 * unfurls into a rich preview card in crawlers that do not run the SPA.
 *
 * It also guards the hashed-asset surface: a request under `/assets/` whose
 * served response is the SPA HTML shell means the chunk is absent (a stale
 * client asking for an old hash, or a request that raced a deploy), and the
 * middleware returns a real, uncacheable `404` for it instead of letting the
 * `200`-HTML fall through — see `serveAssetNotFoundIfHtmlShell`. This stops a
 * CDN cache-poisoning incident (2026-08-10) in which that `200 text/html` was
 * served at a `.js` URL, tripped strict MIME checking (blank screen), and —
 * because `public/_headers` marks `/assets/*` immutable for a year — was
 * cached by Cloudflare against the asset URL and poisoned every visitor.
 *
 * ROUTING DEPENDENCY (why `public/_routes.json` exists): this guard only
 * protects `/assets/*` if the Function actually RUNS on those paths. Without
 * an explicit `_routes.json`, Cloudflare Pages auto-generates one whose
 * optimizer excludes the physical `/assets/` build directory from Function
 * invocation — so the middleware ran on `/` and SPA routes (profile-meta
 * worked) but was silently bypassed for `/assets/*`, leaving the poisoning
 * guard shipped-but-dead and letting the 2026-08-10 incident recur on
 * 2026-08-23. `public/_routes.json` pins `include: ["/*"]` so the Function is
 * the entry point for every path, including `/assets/*`. Real, cached assets
 * are still served from the edge cache without invoking the Function (a HIT
 * never reaches Pages), so the guard only runs on the cache MISS that is the
 * exact deploy-race window it must catch. Do NOT remove `_routes.json`.
 *
 * Every other request — no `?profile=`, non-HTML response, non-GET method,
 * malformed handle, and any API non-200 / timeout / error — passes the
 * unmodified asset response straight through (fail-soft). The middleware
 * never returns 5xx to the visitor for a profile-meta failure.
 *
 * Layer-boundary contract (D-24085): edge subsurface of `client-app`. It
 * imports no game framework, no engine runtime, no registry package, no
 * pre-plan package, and no database client; computes no game outcomes. Only
 * the pure, unit-tested meta composition is imported.
 *
 * Authority: WP-300 §Scope (In) §B; EC-331 §Files to Produce; D-24085.
 */

import { buildProfileMeta, type PublicProfileMetaInput } from './lib/buildProfileMeta';

/**
 * Pages environment bindings this middleware reads. `VITE_API_BASE_URL` is
 * the HTTP API origin — the same variable the SPA build already requires
 * (`apps/arena-client/src/lib/api/apiBaseUrl.ts`, WP-161). Cloudflare Pages
 * exposes project environment variables to Functions at runtime via
 * `context.env`.
 */
interface Env {
  readonly VITE_API_BASE_URL?: string;
}

// why: the locked handle grammar (WP-101 `HANDLE_REGEX`). A `profile` query
// value that does not match is treated as no match and passes through — the
// middleware never fetches for a malformed handle. Re-declared here (not
// imported) to keep the edge subsurface free of engine/server imports.
const HANDLE_REGEX = /^[a-z][a-z0-9_]{2,23}$/;

// why: a shared human profile load must not stall on a slow API — 1.5 s caps
// the added latency and the request degrades to the plain shell on expiry
// (WP-300 §Locked contract values / EC-331).
const PROFILE_FETCH_TIMEOUT_MS = 1500;

// why: production API origin used only when the Pages project has not set
// VITE_API_BASE_URL in its runtime environment. A wrong or missing origin
// fails soft (the fetch errors → the unmodified shell is served), so this
// fallback never breaks the page — it only preserves previews if the env
// binding is absent. Do not hardcode without this env-first resolution.
const FALLBACK_API_ORIGIN = 'https://api.legendary-arena.com';

/**
 * `HTMLRewriter` element handler that appends the composed meta markup to
 * the `<head>` element. Only appends `<meta>` tags — it never adds,
 * removes, or reorders `<link>`, `<script>`, or stylesheet elements, so the
 * WP-007a / EC-148 brand-token cascade order is preserved.
 */
class HeadMetaAppender {
  constructor(private readonly metaHtml: string) {}

  element(element: Element): void {
    element.append(this.metaHtml, { html: true });
  }
}

/**
 * Serialize the composed tag set into `<meta>` markup. Every `content`
 * value is already HTML-attribute-escaped by `buildProfileMeta`; the `key`
 * values are the fixed locked tag names, so the string is safe to inject as
 * HTML.
 *
 * @param handle The validated handle.
 * @param profile The parsed public-profile read-shape.
 * @returns A concatenated string of `<meta>` elements.
 */
function renderMetaHtml(handle: string, profile: PublicProfileMetaInput): string {
  const { tags } = buildProfileMeta(profile, handle);
  let markup = '';
  for (const tag of tags) {
    markup += `<meta ${tag.attribute}="${tag.key}" content="${tag.content}">`;
  }
  return markup;
}

/**
 * Read and validate the `profile` query param. Returns the handle when it
 * is present and matches the locked grammar, otherwise `null`.
 *
 * @param requestUrl The full request URL.
 * @returns The validated handle, or `null` for no match.
 */
function readProfileHandle(requestUrl: string): string | null {
  const handle = new URL(requestUrl).searchParams.get('profile');
  if (handle === null || !HANDLE_REGEX.test(handle)) {
    return null;
  }
  return handle;
}

/**
 * Return a real `404` when a request under `/assets/` resolved to the SPA HTML
 * shell — i.e. the hashed build asset does not exist in the current deployment.
 *
 * Cloudflare Pages' built-in single-page-application fallback answers any
 * unmatched path with `200` + `index.html` (`text/html`). For a normal SPA
 * route that is correct, but for a `/assets/<hash>.js|.css` URL it is a trap: a
 * client on a stale `index.html` (or a request that raced a deploy) asks for a
 * hash that is gone, receives HTML at a script URL, and the browser rejects it
 * under strict MIME checking so the module never executes — a blank screen.
 * Worse, `public/_headers` marks `/assets/*` `immutable, max-age=31536000`, so
 * Cloudflare caches that HTML against the asset URL and poisons every visitor
 * until the cache is purged (production incident 2026-08-10).
 *
 * Returning an uncacheable `404` for the missing hashed asset makes it fail
 * cleanly: the poisoned entry is never created, and the SPA's `vite:preloadError`
 * update-available path (WP-418) can prompt a reload. Real assets are untouched
 * — an existing chunk is served by `context.next()` with a `javascript`/`css`
 * content-type, so `isHtml` is false and this guard does not fire.
 *
 * @param requestPathname The request URL's pathname.
 * @param isHtmlShell Whether the served response's content-type is HTML.
 * @returns A `404` Response for a missing hashed asset, or `null` to pass through.
 */
function serveAssetNotFoundIfHtmlShell(
  requestPathname: string,
  isHtmlShell: boolean,
): Response | null {
  if (!isHtmlShell || !requestPathname.startsWith('/assets/')) {
    return null;
  }
  return new Response(
    'Asset not found. This hashed build asset is not part of the current deployment.',
    {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        // why: the missing-asset 404 must never be cached — the whole incident
        // was a stale HTML body pinned against an asset URL. no-store keeps the
        // edge and the browser re-asking origin until a good deploy answers.
        'cache-control': 'no-store',
      },
    },
  );
}

/**
 * Cloudflare Pages Functions middleware entry point.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  const requestPathname = new URL(context.request.url).pathname;
  let response = await context.next();

  // DIAGNOSTIC (preview-only, remove before merge): stamp every response the
  // middleware actually touches, so a probe can see WHICH paths invoke the
  // Function. A /assets/* response that lacks this header proves the Function is
  // bypassed there (Pages serving the static/SPA layer ahead of the Function).
  response = new Response(response.body, response);
  response.headers.set('x-mw-ran', requestPathname);

  const contentType = response.headers.get('content-type') ?? '';
  const isHtml = contentType.includes('text/html');

  // why: a hashed /assets/* request that came back as the HTML shell is a
  // missing chunk — return a clean, uncacheable 404 instead of the poisoning
  // 200-HTML (see serveAssetNotFoundIfHtmlShell). Runs before the profile-meta
  // path because that path only ever acts on the root/SPA HTML document.
  const assetNotFound = serveAssetNotFoundIfHtmlShell(requestPathname, isHtml);
  if (assetNotFound !== null) {
    assetNotFound.headers.set('x-mw-ran', requestPathname + ':guard404');
    return assetNotFound;
  }

  // why: asset requests and paramless page loads must be zero-cost
  // pass-throughs — the middleware only acts on a GET whose response is the
  // HTML shell and whose URL carries a valid ?profile=<handle>.
  const handle = readProfileHandle(context.request.url);
  if (context.request.method !== 'GET' || !isHtml || handle === null) {
    return response;
  }

  const apiOrigin = context.env.VITE_API_BASE_URL ?? FALLBACK_API_ORIGIN;
  const profileUrl = `${apiOrigin}/api/players/${encodeURIComponent(handle)}/profile`;

  try {
    // why: a profile-meta failure must never break the page. Any non-200,
    // timeout, network error, or parse failure returns the unmodified shell
    // (fail-soft) rather than surfacing an error to the visitor.
    const profileResponse = await fetch(profileUrl, {
      signal: AbortSignal.timeout(PROFILE_FETCH_TIMEOUT_MS),
    });
    if (profileResponse.status !== 200) {
      return response;
    }
    const profile = (await profileResponse.json()) as PublicProfileMetaInput;
    const metaHtml = renderMetaHtml(handle, profile);
    return new HTMLRewriter()
      .on('head', new HeadMetaAppender(metaHtml))
      .transform(response);
  } catch {
    return response;
  }
};
