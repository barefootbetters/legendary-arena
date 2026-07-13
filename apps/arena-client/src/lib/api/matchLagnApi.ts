/**
 * matchLagnApi.ts — authenticated fetch wrapper for the current-match LAGN read
 * (WP-363 / D-24155).
 *
 * Wraps `GET /api/match/:matchId/lagn` (WP-361), which returns the match's setup
 * as an opaque Tier-1 LAGN document for the in-match "View loadout in Registry
 * Viewer" control. Mirrors the WP-301 `loadoutLibraryApi.ts` never-throws
 * pattern: a non-200 maps to `{ ok: false, status }`; a thrown `fetch` — OR a
 * malformed 200 body — maps to `{ ok: false, status: 0 }`. It NEVER throws, so a
 * click handler on the play surface never rejects and never blocks the match.
 *
 * The `lagn` is returned opaquely (`unknown`) — the client never validates or
 * inspects it (the server is the validation authority, WP-361; the viewer
 * re-validates in WP-362; the client is a relay).
 *
 * Authority: WP-363 §Scope (In) §B; EC-393; D-24155; WP-361 (endpoint);
 * WP-301 / D-16101 (`buildApiUrl` + Bearer pattern).
 */

import { buildApiUrl } from './apiBaseUrl';

/** The result of fetching a match's LAGN. Never thrown — always returned. */
export type MatchLagnResult =
  | { ok: true; lagn: unknown }
  | { ok: false; status: number };

/**
 * Fetch a match's Tier-1 LAGN from `GET /api/match/:matchId/lagn`.
 *
 * @param matchId - The match id (from the `?match=` URL parameter).
 * @param authToken - The current session bearer, or `null` for a guest (the
 *                    request then omits the `Authorization` header and the server
 *                    returns `401`).
 * @returns `{ ok: true, lagn }` on 200; `{ ok: false, status }` on a non-200; and
 *          `{ ok: false, status: 0 }` on a network failure or an unparseable 200
 *          body. Never throws.
 */
export async function fetchMatchLagn(
  matchId: string,
  authToken: string | null,
): Promise<MatchLagnResult> {
  let response: Response;
  try {
    response = await fetch(
      buildApiUrl(`/api/match/${encodeURIComponent(matchId)}/lagn`),
      {
        method: 'GET',
        headers:
          authToken === null ? {} : { Authorization: `Bearer ${authToken}` },
      },
    );
  } catch {
    // why: a thrown fetch is a network/transport failure with no HTTP status;
    // the client never throws, so it maps to status 0 (mirrors loadoutLibraryApi).
    return { ok: false, status: 0 };
  }
  if (response.status !== 200) {
    return { ok: false, status: response.status };
  }
  try {
    // why: parse the body INSIDE the guarded region (unlike loadoutLibraryApi,
    // whose bodies are always well-formed) so a malformed 200 body maps to a
    // failure rather than throwing out of this never-throws wrapper.
    const body = (await response.json()) as { lagn?: unknown };
    return { ok: true, lagn: body.lagn };
  } catch {
    return { ok: false, status: 0 };
  }
}
