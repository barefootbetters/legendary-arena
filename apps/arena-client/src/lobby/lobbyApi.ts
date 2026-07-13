/**
 * HTTP helpers for the boardgame.io Lobby API.
 *
 * Three entrypoints — createMatch, listMatches, joinMatch — mirror the three
 * CLI scripts in `apps/server/scripts/` but target the browser runtime.
 *
 * Contracts verified against a running server during WP-090 Session Protocol;
 * see DECISIONS.md D-90xx ("Lobby Join & List Endpoint Contract") for raw
 * response evidence.
 */

import type { MatchSetupConfig } from '@legendary-arena/game-engine';
import type { SetupRequirements } from './playerCountRequirements.js';

// why: VITE_SERVER_URL is inlined at build time by Vite. The fallback is a
// dev-only convenience that matches the Vite dev server's default. Production
// builds (Cloudflare Pages) must set VITE_SERVER_URL via the Pages project's
// build-time environment variables; the fallback must never reach production.
// The `?.` guard handles the node:test runner (no Vite transform) where
// `import.meta.env` is undefined — the fallback string wins in that path.
export const serverUrl: string =
  import.meta.env?.VITE_SERVER_URL ?? 'http://localhost:8000';

/**
 * Per-match summary returned by the lobby list endpoint.
 *
 * Shape is mapped from the raw boardgame.io response (see D-90xx). `players`
 * is an array — never collapsed to a count — so a Join UI can disambiguate
 * open vs filled seats by checking whether each entry has a `name`.
 */
export interface LobbyMatchSummary {
  matchID: string;
  players: { id: string; name?: string }[];
  setupData: MatchSetupConfig | null;
  gameover: unknown | null;
}

/**
 * Creates a new match on the server via the authenticated match-gate
 * endpoint (WP-307). Playing a seat requires a signed-in account (D-24092),
 * so the caller must pass the bearer token from the auth store; the server
 * validates the session, then delegates to the boardgame.io lobby.
 *
 * @param config  Nine-field MatchSetupConfig used as boardgame.io setupData.
 * @param numPlayers  Number of seats to allocate (1..5).
 * @param authToken  Bearer token for the authenticated session.
 * @returns The server-assigned matchID.
 * @throws Error with a full-sentence message on non-2xx responses.
 */
export async function createMatch(
  config: MatchSetupConfig,
  numPlayers: number,
  authToken: string,
): Promise<{ matchID: string }> {
  const endpoint = `${serverUrl}/api/match/create`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ numPlayers, setupData: config }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to create match at ${endpoint}: server returned HTTP ${response.status}. ${errorBody}`,
    );
  }

  const body = (await response.json()) as { matchID: string };
  return { matchID: body.matchID };
}

/**
 * Fetches the read-only per-player-count setup requirements from the server
 * (WP-371). Used by the lobby to warn + disable Create before submit when a
 * composition does not match the player count. Guest endpoint (public rules
 * data); the caller treats a failure as "pre-check unavailable" and falls back
 * to the authoritative engine block.
 *
 * @returns the requirements table keyed by player count.
 * @throws Error with a full-sentence message on a non-2xx response.
 */
export async function fetchSetupRequirements(): Promise<SetupRequirements> {
  const endpoint = `${serverUrl}/api/match/setup-requirements`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch setup requirements at ${endpoint}: server returned HTTP ${response.status}.`,
    );
  }
  const body = (await response.json()) as { requirements?: unknown };
  // why: a response without a well-formed `requirements` object is treated as
  // a failure so the caller falls back to null (pre-check unavailable) rather
  // than storing `undefined` and tripping the length checks at runtime.
  if (body === null || typeof body !== 'object' || typeof body.requirements !== 'object' || body.requirements === null) {
    throw new Error(
      `The setup-requirements response from ${endpoint} did not contain a requirements object.`,
    );
  }
  return body.requirements as SetupRequirements;
}

/**
 * Fetches the list of currently-known matches from the server.
 *
 * The raw server response is `{ matches: Array<{ matchID, players, setupData,
 * gameover?, gameName, unlisted, createdAt, updatedAt }> }` with
 * `players[].id` as a number and `gameover` absent when the match is ongoing.
 * This helper normalizes to {@link LobbyMatchSummary} (stringified ids,
 * explicit null for gameover).
 *
 * @returns Array of normalized lobby summaries (may be empty).
 * @throws Error with a full-sentence message on non-2xx responses.
 */
export async function listMatches(): Promise<LobbyMatchSummary[]> {
  // why: `?isGameover=false` asks the boardgame.io lobby route to drop finished
  // matches server-side — it passes `where: { isGameover: false }` to the WP-309
  // store's `listMatches`, which returns only rows whose `metadata.gameover` is
  // absent. A server that ignores the param is harmless: the client-side
  // `filterJoinableMatches` still drops gameover rows via the normalized
  // `gameover` field. This is a bandwidth optimization; the client filter is the
  // guaranteed mechanism (WP-326 / D-24112).
  const endpoint = `${serverUrl}/games/legendary-arena?isGameover=false`;
  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(
      `Failed to list matches at ${endpoint}: server returned HTTP ${response.status}.`,
    );
  }

  const body = (await response.json()) as {
    matches: Array<{
      matchID: string;
      players: Array<{ id: number; name?: string }>;
      setupData?: MatchSetupConfig | null;
      gameover?: unknown;
    }>;
  };

  const summaries: LobbyMatchSummary[] = [];
  for (const raw of body.matches) {
    const players: { id: string; name?: string }[] = [];
    for (const seat of raw.players) {
      const mapped: { id: string; name?: string } = { id: String(seat.id) };
      if (typeof seat.name === 'string') {
        mapped.name = seat.name;
      }
      players.push(mapped);
    }
    summaries.push({
      matchID: raw.matchID,
      players,
      setupData: raw.setupData ?? null,
      gameover: raw.gameover ?? null,
    });
  }
  return summaries;
}

/**
 * Joins a match at the specified seat via the authenticated match-gate
 * endpoint (WP-307). Requires a signed-in account (D-24092); the caller
 * passes the bearer token and the server delegates to the boardgame.io
 * lobby. `matchID` travels in the request body here (the native route
 * carried it in the URL path).
 *
 * @param matchID  ID of the match to join.
 * @param playerID  Seat index, stringified (e.g. "0", "1").
 * @param playerName  Display name to show in the lobby list.
 * @param authToken  Bearer token for the authenticated session.
 * @returns The playerCredentials secret to pass to boardgame.io Client().
 * @throws Error with a full-sentence message on non-2xx responses.
 */
export async function joinMatch(
  matchID: string,
  playerID: string,
  playerName: string,
  authToken: string,
): Promise<{ playerCredentials: string }> {
  const endpoint = `${serverUrl}/api/match/join`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ matchID, playerID, playerName }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to join match ${matchID} at ${endpoint}: server returned HTTP ${response.status}. ${errorBody}`,
    );
  }

  const body = (await response.json()) as { playerCredentials: string };
  return { playerCredentials: body.playerCredentials };
}
