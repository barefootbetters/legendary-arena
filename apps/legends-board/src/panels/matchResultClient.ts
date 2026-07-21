/**
 * Match-result fetch client (WP-407 / D-24217).
 *
 * Fetches one completed match's result from the WP-406 producer
 * (`GET /api/match/:matchId/result-lagn`) on the **live server API** and parses
 * it into the panel view model.
 *
 * why: this is the first legends-board read that hits the live server API rather
 * than a published R2 snapshot — a single completed match's result is small and
 * fetched on demand by a deep link, so it is kept a **live fetch** rather than
 * added to the snapshot publisher, which keeps the publisher's aggregate scope
 * unchanged (EC-442). The fetch mirrors `snapshotClient`'s `AbortController`
 * timeout + non-OK error pattern.
 *
 * why: fetch functions are not unit-tested (they depend on `import.meta.env`,
 * which `node:test` cannot supply — see `snapshotClient.test.ts`); the parsing
 * they delegate to lives in `matchResultDisplay.ts` and is fully tested there.
 */

import {
  buildResultLagnUrl,
  parseResultLagn,
  type MatchResultView,
} from './matchResultDisplay'

// why: 10-second timeout, matching snapshotClient — a stalled edge must not block
// the board UI indefinitely.
const FETCH_TIMEOUT_MS = 10_000

/** Returns the server API base URL from the build-time env var. */
function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_LEGENDS_API_BASE_URL
  if (!baseUrl) {
    throw new Error(
      'VITE_LEGENDS_API_BASE_URL is not set. Configure this environment variable ' +
        'to point at the server API origin (e.g. https://play.legendary-arena.com).',
    )
  }
  return baseUrl
}

/**
 * Fetch a completed match's result and parse it into a view model.
 *
 * Returns `null` when the endpoint responds `404` — WP-406 returns `404` for both
 * an unknown/unprojectable match AND an in-progress one (`match_not_finished`).
 * Both mean "no result to show for this match yet", which the panel renders as a
 * non-error empty state (AC-3), not a failure banner. Throws on a network error,
 * a timeout, or any non-404 non-OK status (a real failure the panel surfaces).
 *
 * @param matchId The match id from the `#/match/<matchId>` deep link.
 * @returns The view model, or `null` when the match has no result to show.
 */
export async function fetchMatchResult(
  matchId: string,
): Promise<MatchResultView | null> {
  const url = buildResultLagnUrl(getApiBaseUrl(), matchId)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (response.status === 404) {
      return null
    }
    if (!response.ok) {
      throw new Error(
        `Match result fetch failed for ${url}: HTTP ${response.status} ${response.statusText}`,
      )
    }
    const body = (await response.json()) as unknown
    console.log(`[legends] Fetched ${url} (${response.status})`)
    return parseResultLagn(matchId, body)
  } finally {
    clearTimeout(timeoutId)
  }
}
