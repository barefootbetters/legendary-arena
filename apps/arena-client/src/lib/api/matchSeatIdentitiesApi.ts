/**
 * matchSeatIdentitiesApi.ts — fetch wrapper for the finished-match seat-identities
 * read (INFRA: endgame seat names).
 *
 * Wraps `GET /api/match/:matchId/seat-identities`, which returns the per-seat
 * display roster (`{ playerId, isBot, handle }` per seat) for a FINISHED match. The
 * endgame co-op VP recap uses it to label seats "Player N (@handle)" / "(Bot)" for
 * matches that were never competitively scored (guest / local) — the competitive
 * report card already gets the same roster ride-along on its submit response
 * (WP-593).
 *
 * PUBLIC endpoint (no bearer): a finished match's roster is the same public surface
 * the result-lagn twin already exposes, so this wrapper sends no `Authorization`
 * header and works for a guest seat too. Mirrors `matchLagnApi.ts`'s never-throws
 * shape: a non-200 or a malformed / network failure resolves to `null` (the recap
 * then falls back to plain "Player N"), so it never blocks the endgame panel.
 *
 * Authority: WP-593 / D-24402 (the `seatIdentities` projection); D-24446 (public
 * read); WP-361 / matchLagnApi.ts (never-throws wrapper precedent).
 */

import { buildApiUrl } from './apiBaseUrl';
import type { CompetitiveSeatIdentity } from './competitionApi';

/**
 * Fetch a finished match's per-seat identities from
 * `GET /api/match/:matchId/seat-identities`.
 *
 * @param matchId - The match id (from the `?match=` URL parameter).
 * @returns The per-seat roster on 200, or `null` on any non-200 (including the
 *   404 `match_not_finished` before gameover), a malformed body, or a network
 *   failure. Never throws.
 */
export async function fetchMatchSeatIdentities(
  matchId: string,
): Promise<readonly CompetitiveSeatIdentity[] | null> {
  let response: Response;
  try {
    response = await fetch(
      buildApiUrl(`/api/match/${encodeURIComponent(matchId)}/seat-identities`),
      { method: 'GET' },
    );
  } catch {
    // why: a thrown fetch is a network/transport failure with no HTTP status;
    // the wrapper never throws, so it maps to null (the recap shows "Player N").
    return null;
  }
  if (response.status !== 200) {
    return null;
  }
  try {
    // why: parse the body INSIDE the guarded region so a malformed 200 body maps
    // to null rather than throwing out of this never-throws wrapper.
    const body = (await response.json()) as {
      seatIdentities?: readonly CompetitiveSeatIdentity[];
    };
    return Array.isArray(body.seatIdentities) ? body.seatIdentities : null;
  } catch {
    return null;
  }
}
