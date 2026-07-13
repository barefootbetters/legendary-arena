/**
 * joinMatchFromInvite — Arena Client (WP-366)
 *
 * The seat-selecting join used by the `?route=me` game-invites panel once an
 * invite is accepted. It reuses the lobby primitives (`listMatches` +
 * `joinMatch`) rather than reimplementing any join: find the invited match,
 * pick its first open seat, join it, and navigate into play with the same
 * `?match&player&credentials` query the lobby's own `joinExisting` builds.
 *
 * Side effects (the list fetch, the join fetch, the navigation) are injected as
 * `deps` so this stays a pure, deterministic orchestration that is unit-testable
 * without a live server or a jsdom navigation. NO `boardgame.io` import; NO
 * `accountId` (FR-2).
 *
 * Authority: WP-366 §Scope; D-24158; mirrors `LobbyView.joinExisting`.
 */

import type { LobbyMatchSummary } from '../lobby/lobbyApi';

/**
 * The side-effecting collaborators, injected so the orchestration can be tested
 * with fakes. In production these are the real `lobbyApi` functions plus a
 * `window.location` navigation.
 */
export interface JoinMatchFromInviteDeps {
  listMatches(): Promise<LobbyMatchSummary[]>;
  joinMatch(
    matchID: string,
    seatId: string,
    playerName: string,
    authToken: string,
  ): Promise<{ playerCredentials: string }>;
  navigate(query: string): void;
}

/**
 * Outcome of a join-from-invite attempt. `not_joinable` = the match is gone
 * (ended, or no longer listed); `full` = the match is listed but has no open
 * seat; `error` = the list or join call failed.
 */
export type JoinMatchFromInviteResult =
  | { ok: true }
  | { ok: false; reason: 'not_joinable' | 'full' | 'error' };

/**
 * Find the invited match's first open seat and join it, then navigate into play.
 *
 * @param matchId The match the accepted invite pointed at.
 * @param playerName The display name to show for the joined seat.
 * @param authToken The invitee's bearer token (non-null — the caller guards guests).
 * @param deps The injected list/join/navigate collaborators.
 * @returns `{ ok: true }` after navigation, or a typed failure reason.
 */
export async function joinMatchFromInvite(
  matchId: string,
  playerName: string,
  authToken: string,
  deps: JoinMatchFromInviteDeps,
): Promise<JoinMatchFromInviteResult> {
  let matches: LobbyMatchSummary[];
  try {
    matches = await deps.listMatches();
  } catch {
    // why: a failed list fetch is a transport problem, not a "match gone" — the
    // caller shows a generic retry line rather than "no longer joinable".
    return { ok: false, reason: 'error' };
  }

  const invitedMatch = matches.find((candidate) => candidate.matchID === matchId);
  if (invitedMatch === undefined) {
    // why: `listMatches` drops finished matches (?isGameover=false), so an
    // absent match means it ended or was removed — no longer joinable.
    return { ok: false, reason: 'not_joinable' };
  }

  // why: an open seat is one with no display name yet (the lobby's isOpenSeat
  // rule). Take the first, mirroring the lobby's own seat pick.
  let openSeatId: string | null = null;
  for (const seat of invitedMatch.players) {
    if (typeof seat.name !== 'string') {
      openSeatId = seat.id;
      break;
    }
  }
  if (openSeatId === null) {
    return { ok: false, reason: 'full' };
  }

  try {
    const joined = await deps.joinMatch(matchId, openSeatId, playerName, authToken);
    const query =
      `?match=${encodeURIComponent(matchId)}` +
      `&player=${encodeURIComponent(openSeatId)}` +
      `&credentials=${encodeURIComponent(joined.playerCredentials)}`;
    deps.navigate(query);
    return { ok: true };
  } catch {
    // why: the seat may have been claimed between the list and the join; surface
    // a generic retry rather than a stale "full" (the list said it was open).
    return { ok: false, reason: 'error' };
  }
}
