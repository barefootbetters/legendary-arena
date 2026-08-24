/**
 * TEMP diagnostic (preview-only, remove before merge). A trivial file-based
 * Pages Function at `/mw-probe`. If Cloudflare Pages Functions execute for this
 * project at all, this returns the plain-text body below. If `/mw-probe` instead
 * returns the SPA `index.html` shell (200 text/html), Functions are not running
 * on this project — which would mean `functions/_middleware.ts` (profile-meta
 * link previews AND the asset-shell guard) has never executed in production.
 */
export const onRequest = () =>
  new Response('MW-PROBE-OK', {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
