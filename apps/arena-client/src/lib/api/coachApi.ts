/**
 * Coach API Client — Arena Client (WP-595 / EC-630 / D-24404)
 *
 * Typed `fetch` wrapper for the endgame AI coach read endpoint:
 *   - `GET /api/me/scores/:replayHash/coach` — the Legendary-Pass endgame
 *     coaching for a scored match the caller owns (WP-594). Lazy + cached
 *     server-side; the client calls it on demand when a Pass holder opens the
 *     coach.
 *
 * Layer-boundary contract: imports nothing from `apps/server/`,
 * `@legendary-arena/*`, `boardgame.io`, or `vue-sfc-loader`. The wire shapes are
 * declared inline by structural compatibility with the server's `CoachReport` /
 * `StoredCoachReport` (`apps/server/src/coach/coach.types.ts`) — the server is
 * authoritative; the client must not import server-layer types. Mirrors the
 * WP-339 `competitionApi.ts` never-throw Bearer-fetch pattern.
 *
 * Authority: WP-595 §Scope; EC-630; D-24404; WP-594 (the server surface).
 */

import { buildApiUrl } from './apiBaseUrl';

/**
 * The coaching report, a structural mirror of the server's `CoachReport`. The
 * client renders it verbatim.
 */
export interface CoachReport {
  readonly headline: string;
  readonly heroFit: string;
  readonly purchases: string;
  readonly suggestions: readonly string[];
}

/**
 * A stored coach report (mirror of the server's `StoredCoachReport`): the report
 * plus which model produced it and when.
 */
export interface StoredCoachReport {
  readonly report: CoachReport;
  readonly model: string;
  readonly generatedAt: string;
}

/**
 * Result of a coach fetch. Never throws: a network failure surfaces as
 * `status: 0`. `report`/`wasCached` are present only on HTTP 200; `error` carries
 * the server's `{ error: <code> }` string on a non-200 (e.g. `not_entitled`,
 * `coach_unavailable`).
 */
export interface FetchCoachResult {
  readonly status: number;
  readonly report: StoredCoachReport | null;
  readonly wasCached: boolean | null;
  readonly error: string | null;
}

/**
 * Best-effort extraction of the server's `{ error: <code> }` string from a
 * non-200 body. Returns `null` when absent / not JSON / no string `error`.
 *
 * @param response The non-200 fetch response.
 * @returns The error code string, or `null`.
 */
async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : null;
  } catch {
    // why: a non-200 with no/malformed body is a transport-level failure; surface
    // only the status so the caller can render a generic state.
    return null;
  }
}

/**
 * Fetch the endgame coaching for a scored match by its `replayHash`. The server
 * enforces the Legendary-Pass gate + ownership; the client calls this only for a
 * Pass holder who opened the coach. Never throws (`status: 0` on network failure).
 *
 * @param authToken The bearer token, or `null` for an unauthenticated caller.
 * @param replayHash The scored match's replay hash.
 * @returns The fetch result (never throws).
 */
export async function fetchCoachReport(
  authToken: string | null,
  replayHash: string,
): Promise<FetchCoachResult> {
  let response: Response;
  try {
    response = await fetch(
      // why: encode the path segment — a replay hash is hex today, but encoding
      // keeps the URL well-formed if the id format ever widens.
      buildApiUrl(`/api/me/scores/${encodeURIComponent(replayHash)}/coach`),
      {
        method: 'GET',
        headers:
          authToken === null ? {} : { Authorization: `Bearer ${authToken}` },
      },
    );
  } catch {
    return { status: 0, report: null, wasCached: null, error: null };
  }
  if (response.status === 200) {
    const body = (await response.json()) as {
      report: StoredCoachReport;
      wasCached: boolean;
    };
    return {
      status: 200,
      report: body.report,
      wasCached: body.wasCached,
      error: null,
    };
  }
  return {
    status: response.status,
    report: null,
    wasCached: null,
    error: await readErrorCode(response),
  };
}
