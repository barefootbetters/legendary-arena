/**
 * Asset-shell guard — Legends Board edge subsurface.
 *
 * A Cloudflare Pages Functions middleware that runs ahead of static asset
 * serving. Its sole job: when a request under `/assets/` resolves to the SPA
 * HTML shell (a missing hashed chunk — a stale client asking for an old hash, or
 * a request that raced a deploy), return a real, uncacheable `404` instead of
 * letting the `200`-HTML fall through.
 *
 * Why this exists: `public/_redirects` ships the SPA catch-all `/*  /index.html
 * 200`, so a missing `/assets/<hash>.js` does not `404` — it returns
 * `index.html` (`text/html`) with a `200`. `public/_headers` marks `/assets/*`
 * `Cache-Control: public, max-age=31536000, immutable`, so Cloudflare caches that
 * HTML **against the asset URL, immutable, for a year**. Every subsequent visitor
 * is then served HTML where the `<script type="module">` expects JavaScript,
 * strict MIME checking rejects it, and the board never mounts — a blank screen
 * that self-heals only after a manual cache purge. This is the same edge-cache
 * poisoning that hit `play.legendary-arena.com` (arena-client) on 2026-08-10 and
 * again 2026-08-23; legends-board carried the same two preconditions with no
 * guard. See ewiki `operational-health-checks.md §SPA asset delivery`.
 *
 * Returning an uncacheable `404` for the missing hashed asset makes the miss fail
 * cleanly: the poisoning entry is never created (a `404 no-store` is not cached
 * against the asset URL). Real assets are untouched — an existing chunk is served
 * by `context.next()` with a `javascript`/`css` content-type, so `isHtml` is
 * false and the guard passes it straight through.
 *
 * IMPORTANT: this guard only runs if the `legendary-arena-legends` Pages project
 * is configured so Cloudflare finds this `functions/` directory — its **Root
 * directory must be `apps/legends-board`** (with Build output `dist`). With Root
 * blank, Pages looks for `functions/` at the repo root, finds none, and deploys
 * static-only, leaving this guard inert. Verify live with:
 *   curl -sSI https://legends.legendary-arena.com/assets/does-not-exist-probe.js
 * A `404 text/plain no-store` means the guard runs; a `200 text/html` means it is
 * bypassed (check the project's Root directory first).
 *
 * Edge subsurface of the read-only Legends Board SPA: imports no game framework,
 * no engine runtime, no registry package, and no database client; computes no
 * game outcomes.
 */

/**
 * Return a real `404` when a request under `/assets/` resolved to the SPA HTML
 * shell — i.e. the hashed build asset does not exist in the current deployment.
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
export const onRequest: PagesFunction = async (context) => {
  const response = await context.next();

  const contentType = response.headers.get('content-type') ?? '';
  const isHtml = contentType.includes('text/html');

  // why: a hashed /assets/* request that came back as the HTML shell is a
  // missing chunk — return a clean, uncacheable 404 instead of the poisoning
  // 200-HTML (see serveAssetNotFoundIfHtmlShell).
  const requestPathname = new URL(context.request.url).pathname;
  const assetNotFound = serveAssetNotFoundIfHtmlShell(requestPathname, isHtml);
  if (assetNotFound !== null) {
    return assetNotFound;
  }

  return response;
};
