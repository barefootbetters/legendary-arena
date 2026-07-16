/**
 * lagnShareLink.ts — build the Registry Viewer `?lagn=` deep-link from a match's
 * LAGN document (WP-363 / D-24155).
 *
 * Encodes an opaque LAGN document into the `?lagn=<base64url(UTF-8 JSON)>` URL
 * the Registry Viewer's Loadout tab ingests (WP-362 / D-24154). This encoder is
 * the **exact inverse** of WP-362's `parseLagnUrlParam` decoder — the
 * `base64url(UTF-8 JSON)` encoding is a cross-WP contract owned by WP-362.
 *
 * Pure helper: deterministic, no Vue, no network, no DOM beyond the global
 * `btoa` / `TextEncoder`. Treats `lagn` **opaquely** — it stringifies the value
 * as-received and never reads a field (the server validated it in WP-361; the
 * viewer re-validates via `parseLagnLoadout`; the client is a relay).
 *
 * Authority: WP-363 §Scope (In) §A; EC-393; D-24155; D-24154 (encoding contract);
 * D-24085 (opaque `lagn` posture).
 */

// why: the deployed Registry Viewer origin — the link opens the viewer directly,
// so it must match the SERVED origin (per apps/registry-viewer/CLAUDE.md the
// viewer is live at cards.legendary-arena.com since the 2026-07-16 domain
// migration; the legacy cards.barefootbetters.com 301-redirects here and both
// remain CORS-allowlisted server-side, but that governs the server fetch, not
// this direct viewer navigation). No trailing slash so the URL is built with
// exactly one `/` before `?lagn=`.
export const REGISTRY_VIEWER_ORIGIN = "https://cards.legendary-arena.com";

/**
 * Encode a UTF-8 string to base64url (RFC 4648 §5: `-`/`_` alphabet, no `=`
 * padding) — the exact inverse of WP-362's decoder.
 *
 * @param text - The UTF-8 text to encode.
 * @returns The base64url representation.
 */
function utf8ToBase64Url(text: string): string {
  // why: TextEncoder → a Latin-1 byte string for `btoa` (which only accepts
  // Latin-1), so multi-byte card names encode correctly; then base64 → base64url
  // (`+`→`-`, `/`→`_`, strip `=`) so the value is URL-safe and carries no `+`
  // that URLSearchParams would turn into a space on the viewer side.
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Build the Registry Viewer Loadout-tab deep-link for a match's LAGN document.
 *
 * @param lagn - The opaque LAGN document (from `GET /api/match/:matchId/lagn`).
 * @param viewerBaseUrl - The viewer origin (no trailing slash; typically
 *                        {@link REGISTRY_VIEWER_ORIGIN}).
 * @returns `${viewerBaseUrl}/?lagn=<base64url(UTF-8 JSON.stringify(lagn))>`.
 */
export function encodeLagnToViewerUrl(
  lagn: unknown,
  viewerBaseUrl: string,
): string {
  const encoded = utf8ToBase64Url(JSON.stringify(lagn));
  return `${viewerBaseUrl}/?lagn=${encoded}`;
}
