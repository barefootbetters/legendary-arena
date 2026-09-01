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
 * Creates a cooperative match whose non-human seats are filled and driven by a
 * bot ally, via the authenticated `POST /api/match/create-with-bot` endpoint
 * (WP-375). The server reserves + secret-joins + auto-readies seats
 * `"1".."botCount"` and returns only `{ matchId }` — seat `"0"` is left OPEN for
 * the human, who then joins it with {@link joinMatch} (so seat 0 gets its own
 * `match_seat_accounts` row + credential). The bot is an ally, never an opponent
 * (co-op, VISION §23(b)).
 *
 * @param config  Nine-field MatchSetupConfig used as boardgame.io setupData.
 * @param seatCount  Total seats to allocate (2..5).
 * @param botCount  How many seats the bot ally fills (1..seatCount-1).
 * @param policy  Bot policy: `'competent'` (default heuristic) or `'random'`.
 * @param authToken  Bearer token for the authenticated session.
 * @returns The server-assigned matchId.
 * @throws Error with a full-sentence message on non-2xx responses.
 */
export async function createMatchWithBot(
  config: MatchSetupConfig,
  seatCount: number,
  botCount: number,
  policy: 'competent' | 'random',
  authToken: string,
): Promise<{ matchId: string }> {
  const endpoint = `${serverUrl}/api/match/create-with-bot`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      numPlayers: seatCount,
      botCount,
      policy,
      setupData: config,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to create a bot-ally match at ${endpoint}: server returned HTTP ${response.status}. ${errorBody}`,
    );
  }

  const body = (await response.json()) as { matchId: string };
  return { matchId: body.matchId };
}

/**
 * Fetches the read-only per-player-count setup requirements from the server
 * (WP-371). Used by the lobby to warn + disable Create before submit when a
 * composition does not match the player count. Guest endpoint (public rules
 * data); the caller treats a failure as "pre-check unavailable" and falls back
 * to the authoritative engine block.
 *
 * why: WP-525 / D-24338 — an optional `schemeId` makes the required hero count
 * scheme-aware (Secret Invasion requires 6), so the play lobby agrees with the
 * engine. Omitting it returns the base table (byte-identical to pre-WP-525).
 *
 * @param schemeId The selected scheme ext_id, so the server can project the
 *   scheme-aware hero count; omit for the base table.
 * @returns the requirements table keyed by player count.
 * @throws Error with a full-sentence message on a non-2xx response.
 */
export async function fetchSetupRequirements(schemeId?: string): Promise<SetupRequirements> {
  const trimmedSchemeId = schemeId?.trim() ?? '';
  const endpoint =
    trimmedSchemeId === ''
      ? `${serverUrl}/api/match/setup-requirements`
      : `${serverUrl}/api/match/setup-requirements?schemeId=${encodeURIComponent(trimmedSchemeId)}`;
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

/**
 * Adds an anonymous guest seat to a match the signed-in host is already in
 * (WP-628 / D-24438 — the client half of guest play). Calls the WP-627
 * host-gated `POST /api/match/add-guest`, which secret-joins one non-account
 * seat and returns its bgio `credentials` so the host can hand off a guest play
 * link. Mirrors {@link joinMatch}.
 *
 * @param matchId    ID of the match to add the guest to.
 * @param authToken  Bearer token for the host's authenticated session.
 * @returns The minted seat id and its bgio credential.
 * @throws Error (with the numeric HTTP `status` attached) on a non-2xx response.
 */
export async function addGuest(
  matchId: string,
  authToken: string,
): Promise<{ matchId: string; seat: string; credentials: string }> {
  const endpoint = `${serverUrl}/api/match/add-guest`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ matchId }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    // why: attach the HTTP status so the caller can map 409 (no open seat — the
    // cap or a full match) to a specific message while every other non-2xx
    // falls through to a generic one. joinMatch does not need this; the guest
    // button does, to give the host an actionable "match is full" line.
    throw Object.assign(
      new Error(
        `Failed to add a guest to match ${matchId} at ${endpoint}: server returned HTTP ${response.status}. ${errorBody}`,
      ),
      { status: response.status },
    );
  }

  const body = (await response.json()) as {
    matchId: string;
    seat: string;
    credentials: string;
  };
  return {
    matchId: body.matchId,
    seat: body.seat,
    credentials: body.credentials,
  };
}

/**
 * The lobby-safe guest-access metadata for one match (WP-631 / D-24441): the
 * host-set display name (or null) and whether the match accepts a password
 * guest join. NEVER carries the stored password / derived key.
 */
export interface GuestAccessMeta {
  gameName: string | null;
  hasGuestPassword: boolean;
}

/**
 * Sets (or updates) a match's guest **game name** and/or guest **password** via
 * the WP-630 host-gated `POST /api/match/set-guest-access` (D-24441). The host's
 * bearer token authorizes it; the server confirms the host is a participant.
 * Per-field: an `undefined` field is left unchanged server-side; an empty string
 * clears it (so a rename never wipes the password) — `JSON.stringify` drops the
 * `undefined` fields, and empty strings are sent through. Mirrors {@link addGuest}.
 *
 * @param matchId    ID of the match to set guest access on.
 * @param update     `{ gameName?, password? }` — omit a field to leave it as-is.
 * @param authToken  Bearer token for the host's authenticated session.
 * @returns The lobby-safe meta the server echoes (never the password).
 * @throws Error (with the numeric HTTP `status` attached) on a non-2xx response.
 */
export async function setGuestAccess(
  matchId: string,
  update: { gameName?: string; password?: string },
  authToken: string,
): Promise<{ matchId: string } & GuestAccessMeta> {
  const endpoint = `${serverUrl}/api/match/set-guest-access`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      matchId,
      gameName: update.gameName,
      password: update.password,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    // why: attach the HTTP status so the caller can map 403 (not a participant)
    // to a specific line and every other non-2xx to a generic one.
    throw Object.assign(
      new Error(
        `Failed to set guest access on match ${matchId} at ${endpoint}: server returned HTTP ${response.status}. ${errorBody}`,
      ),
      { status: response.status },
    );
  }

  const body = (await response.json()) as {
    matchId: string;
    gameName: string | null;
    hasGuestPassword: boolean;
  };
  return {
    matchId: body.matchId,
    gameName: body.gameName,
    hasGuestPassword: body.hasGuestPassword,
  };
}

/**
 * Joins a match as an anonymous guest by typing the host-set password, via the
 * WP-630 **public** `POST /api/match/join-as-guest` (D-24441). No account, no
 * bearer token — the password + the server's per-IP rate limit are the gate. On
 * a match the server mints a rowless Casual seat and returns its bgio credential,
 * which the caller turns into a play URL via {@link buildGuestPlayUrl}.
 *
 * @param matchId   ID of the match to join.
 * @param password  The guest password the host shared.
 * @returns The minted seat id + its bgio credential.
 * @throws Error (with the numeric HTTP `status` attached) on a non-2xx response —
 *   401 wrong password, 409 no password set / match full, 429 rate-limited.
 */
export async function joinAsGuest(
  matchId: string,
  password: string,
): Promise<{ matchId: string; seat: string; credentials: string }> {
  const endpoint = `${serverUrl}/api/match/join-as-guest`;
  // why: no Authorization header — a guest has no account; this endpoint is
  // public by necessity and defended by the password + server rate limit.
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId, password }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    // why: attach the HTTP status so the caller can map 401 (wrong password),
    // 429 (too many tries), and 409 (no password set / full) to co-op copy.
    throw Object.assign(
      new Error(
        `Failed to join match ${matchId} as a guest at ${endpoint}: server returned HTTP ${response.status}. ${errorBody}`,
      ),
      { status: response.status },
    );
  }

  const body = (await response.json()) as {
    matchId: string;
    seat: string;
    credentials: string;
  };
  return {
    matchId: body.matchId,
    seat: body.seat,
    credentials: body.credentials,
  };
}

/**
 * Reads a match's lobby-safe guest-access metadata via the WP-630 **public**
 * `GET /api/match/:matchId/guest-access` (D-24441): the game name + whether it
 * accepts a password guest join. Public read (no auth), like {@link listMatches}.
 * A failure is treated as "no guest access" (null name, no password) rather than
 * thrown, so a meta hiccup never blocks the match list from rendering.
 *
 * @param matchId  ID of the match to read.
 * @returns The `{ gameName, hasGuestPassword }` meta; a safe empty default on failure.
 */
export async function readGuestAccessMeta(matchId: string): Promise<GuestAccessMeta> {
  const endpoint = `${serverUrl}/api/match/${encodeURIComponent(matchId)}/guest-access`;
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      return { gameName: null, hasGuestPassword: false };
    }
    const body = (await response.json()) as {
      gameName?: unknown;
      hasGuestPassword?: unknown;
    };
    // why: defensively coerce — a malformed/absent field must not crash the
    // list; only a real string name and a real boolean flag are surfaced.
    return {
      gameName: typeof body.gameName === 'string' ? body.gameName : null,
      hasGuestPassword: body.hasGuestPassword === true,
    };
  } catch {
    // why: a transport failure on the meta read is non-fatal — the match still
    // lists and joins for account holders; only the guest affordance is hidden.
    return { gameName: null, hasGuestPassword: false };
  }
}

/**
 * Builds the guest play URL for a minted guest seat (WP-628 / WP-629). Opening it
 * lands the guest directly in the seat via the arena-client's unguarded `live`
 * route (`createLiveClient` connects with `credentials` only — no Hanko session).
 * Same `?match&player&credentials` shape every join path builds. Hot-seat /
 * physical hand-off only (D-24438).
 *
 * @param matchId      The match id.
 * @param seat         The minted guest seat id.
 * @param credentials  The seat's bgio playerCredentials.
 * @returns An absolute play URL the host hands to the guest.
 */
export function buildGuestPlayUrl(
  matchId: string,
  seat: string,
  credentials: string,
): string {
  return (
    `${window.location.origin}/?match=${encodeURIComponent(matchId)}` +
    `&player=${encodeURIComponent(seat)}` +
    `&credentials=${encodeURIComponent(credentials)}`
  );
}

/**
 * Fetches a single match by ID from the boardgame.io lobby's per-match route
 * (`GET /games/legendary-arena/:id`). This is a public read like
 * {@link listMatches} (no Authorization header) and, unlike the list route,
 * does NOT filter unlisted matches — so a match reached by a pasted ID or
 * invite link is resolvable even when it is absent from the public list.
 *
 * The per-match response is the bare match object (not wrapped in
 * `{ matches: [...] }`); it is normalized to the same {@link LobbyMatchSummary}
 * shape the list uses — `matchID` from the argument, stringified seat ids,
 * explicit null for `gameover`/`setupData`.
 *
 * @param matchID  ID of the match to fetch.
 * @returns The normalized summary, or `null` when no such match exists (404).
 * @throws Error with a full-sentence message on a non-404 error response.
 */
export async function fetchMatch(
  matchID: string,
): Promise<LobbyMatchSummary | null> {
  const endpoint = `${serverUrl}/games/legendary-arena/${encodeURIComponent(matchID)}`;
  const response = await fetch(endpoint);

  if (response.status === 404) {
    // why: an unknown match ID is a normal "not found" the caller renders as
    // inline copy ("no match found with that ID"), not an exception — distinct
    // from a transport or 5xx failure below, which throws so it surfaces.
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch match ${matchID} at ${endpoint}: server returned HTTP ${response.status}. Check the match ID or link and try again.`,
    );
  }

  const raw = (await response.json()) as {
    players: Array<{ id: number; name?: string }>;
    setupData?: MatchSetupConfig | null;
    gameover?: unknown;
  };

  const players: { id: string; name?: string }[] = [];
  for (const seat of raw.players) {
    const mapped: { id: string; name?: string } = { id: String(seat.id) };
    if (typeof seat.name === 'string') {
      mapped.name = seat.name;
    }
    players.push(mapped);
  }

  return {
    matchID,
    players,
    setupData: raw.setupData ?? null,
    gameover: raw.gameover ?? null,
  };
}
