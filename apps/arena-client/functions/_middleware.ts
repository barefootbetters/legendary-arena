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
 * Cloudflare Pages Functions middleware entry point.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  const response = await context.next();

  // why: asset requests and paramless page loads must be zero-cost
  // pass-throughs — the middleware only acts on a GET whose response is the
  // HTML shell and whose URL carries a valid ?profile=<handle>.
  const contentType = response.headers.get('content-type') ?? '';
  const isHtml = contentType.includes('text/html');
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
