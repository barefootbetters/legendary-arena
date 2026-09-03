/**
 * Add-Guest Route — server-side host-initiated guest seat (WP-627 / EC-662).
 *
 * Registers `POST /api/match/add-guest`: a signed-in host adds ONE anonymous,
 * non-account "guest" seat to a match they are already in, so a walk-up player
 * with no account can take a seat and play (ewiki Guest Accounts, Candidate B;
 * D-24437). The handler, server-side:
 *
 *   1. authenticates the host (the same gate as /api/match/create),
 *   2. confirms the host is a participant in the match (has a seat-account row),
 *   3. reads the match's occupancy from the bgio metadata to find the next free
 *      seat and count existing guest seats (the per-match cap),
 *   4. secret-joins that seat via the WP-308 internal-delegation header exactly
 *      as create-with-bot does — writing NO `match_seat_accounts` row (D-24120),
 *      so the seat renders "Player N" and is generically demoted to Casual by
 *      `computeRankedEligibility` rule 2 (`roster.length !== seatCount`), then
 *   5. returns the seat id + credential for the host to hand to the guest.
 *
 * There is NO driver and NO auto-ready — a guest is a human who plays the seat
 * (unlike a bot ally). There is NO `match_bot_ally` row and NO migration: the
 * non-ranked demotion is computed at submit time from the seat's absence in
 * `match_seat_accounts`, so no durable "this match had a guest" marker exists.
 *
 * Scope is host hot-seat / physical hand-off only. A no-auth, device-bound
 * seat-bind handoff link is a separate future client WP, not this endpoint.
 *
 * Layer: server wires the framework; it decides no gameplay. It reads the bgio
 * match metadata (the framework store's own metadata surface, D-24095/D-24119
 * carve-out) — never a raw `G`/`ctx` blob.
 *
 * Authority: WP-627; EC-662; D-24437 (Candidate B); D-24120 (rowless non-account
 * seat); D-24094 (internal-delegation secret); D-24095/D-24119 (metadata read);
 * D-11804 (api-endpoints.md obligation); D-9905 (auth posture).
 */

import { INTERNAL_DELEGATION_HEADER } from './nativeLobbyGuard.js';
import { readSeatAccounts, readMatchBotSeats } from './seatAccount.logic.js';
import koaBody from 'koa-body';

/**
 * Per-match cap on host-added guest seats.
 *
 * // why: the largest match is 5 seats (create validation caps numPlayers at 5)
 * and the host occupies at least seat 0, so at most 4 seats can ever be guests.
 * The per-seat free-seat search is the hard bound (a full match has no free
 * seat); this constant is the explicit cap the WP requires so a host cannot
 * over-fill a match with guests.
 */
export const MAX_GUEST_SEATS_PER_MATCH = 4;

/**
 * Maps a session-validation failure code to its HTTP status: 500 for operator
 * faults, 401 otherwise (mirrors the matchGate / bot-ally mapping so an
 * account-existence probe cannot distinguish a missing account from an
 * unauthenticated request).
 *
 * @param {string} code - The orchestrator's session-validation failure code.
 * @returns {number} The HTTP status to return.
 */
function statusForSessionValidationCode(code) {
  if (code === 'session_verifier_not_configured' || code === 'lookup_failed') {
    return 500;
  }
  return 401;
}

// why: boardgame.io installs koa-body ONLY on its own /games/* routes — there is
// no global body parser — so this guarded route parses its own JSON body
// (mirrors matchGate.routes.ts / botAllyRoutes.mjs). Applied only when a real
// Node request stream is present, so the unit-test fake context (which injects
// request.body directly) short-circuits it.
const guardedRouteJsonBodyParser = koaBody();

/**
 * Parses the JSON request body into `koaContext.request.body` when a real Node
 * request stream is present; a no-op for the unit-test fake context.
 *
 * @param {object} koaContext - The request context.
 * @returns {Promise<void>}
 */
async function ensureJsonBodyParsed(koaContext) {
  const nodeRequest = koaContext.req;
  if (typeof nodeRequest.on !== 'function') {
    return;
  }
  await guardedRouteJsonBodyParser(koaContext, async () => {});
}

/**
 * Counts the seats that are occupied by a guest — a seat that has a bgio
 * credential (someone joined it) but is neither an authenticated account seat
 * nor a server-driven bot seat.
 *
 * @param {object} players - The bgio `metadata.players` object.
 * @param {ReadonlyArray<string>} accountSeatIds - Seat ids with a `match_seat_accounts` row.
 * @param {ReadonlyArray<string>} botSeatIds - Seat ids tagged in `match_bot_ally`.
 * @returns {number} The number of guest seats currently occupied.
 */
function countGuestSeats(players, accountSeatIds, botSeatIds) {
  const accountSet = new Set(accountSeatIds);
  const botSet = new Set(botSeatIds);
  let guestSeats = 0;
  for (const [seatId, seatMeta] of Object.entries(players)) {
    const isOccupied = seatMeta !== null && typeof seatMeta.credentials === 'string';
    if (isOccupied && !accountSet.has(seatId) && !botSet.has(seatId)) {
      guestSeats += 1;
    }
  }
  return guestSeats;
}

/**
 * Finds the lowest-index free seat (no bgio credential) in a match, or null when
 * every seat is occupied. A free seat is genuinely empty, so joining it displaces
 * no one — the host at seat 0 is never displaced (an occupied seat is never free).
 *
 * @param {object} players - The bgio `metadata.players` object.
 * @param {number} seatCount - The number of seats in the match.
 * @returns {string | null} The free seat id, or null when the match is full.
 */
function findFreeSeat(players, seatCount) {
  for (let seatIndex = 0; seatIndex < seatCount; seatIndex += 1) {
    const seatId = String(seatIndex);
    const seatMeta = players[seatId];
    const isFree = seatMeta === null || seatMeta === undefined || typeof seatMeta.credentials !== 'string';
    if (isFree) {
      return seatId;
    }
  }
  return null;
}

/**
 * Mints ONE anonymous, non-account guest seat in an existing match and returns a
 * discriminated outcome. This is the single place the rowless-seat invariant
 * (D-24120) lives: it reads occupancy from the bgio match metadata, enforces the
 * per-match guest cap, finds the lowest free seat, and secret-joins it via the
 * WP-308 internal-delegation header — writing NO `match_seat_accounts` row, so
 * `computeRankedEligibility` rule 2 demotes the match to Casual.
 *
 * Extracted from the `add-guest` handler (WP-630) so BOTH the host-gated
 * `POST /api/match/add-guest` and the public password `POST /api/match/join-as-guest`
 * mint a seat through one helper — neither may write a seat-account row, and the
 * cap is enforced identically on both.
 *
 * The caller owns authorization (the host participant gate, or the guest password
 * check) BEFORE calling this; `mintGuestSeat` performs no authentication.
 *
 * @param {object} context - The bot-ally context bundle.
 * @param {object} context.db - boardgame.io storage backend (for the metadata read).
 * @param {string} context.serverUrl - Loopback origin for the native-lobby join.
 * @param {string} context.internalDelegationSecret - The WP-308 native-lobby secret.
 * @param {object} context.database - The long-lived pg pool.
 * @param {string} matchId - The match to add the guest seat to.
 * @returns {Promise<object>} A discriminated outcome:
 *   `{ outcome: 'match-not-found' }`,
 *   `{ outcome: 'cap-reached' }`,
 *   `{ outcome: 'match-full' }`,
 *   `{ outcome: 'join-failed', status, detail }`, or
 *   `{ outcome: 'joined', seat, credentials }`.
 */
export async function mintGuestSeat(context, matchId) {
  const { db, serverUrl, internalDelegationSecret, database } = context;

  // why: read occupancy from the bgio match metadata (the framework store's own
  // metadata surface, D-24095/D-24119 carve-out — never a raw G/ctx read),
  // mirroring readBotSeatCredentials. players is keyed "0".."N-1".
  const { metadata } = await db.fetch(matchId, { metadata: true });
  if (metadata === null || metadata === undefined || metadata.players === undefined) {
    return { outcome: 'match-not-found' };
  }
  const players = metadata.players;
  const seatCount = Object.keys(players).length;

  // why: enforce the per-match guest cap. A guest seat is an occupied seat that
  // is neither an account seat nor a bot seat; count them and reject once the cap
  // is reached (a full match is also rejected below). Both callers share this cap.
  const accountSeats = await readSeatAccounts(matchId, database);
  const botSeats = await readMatchBotSeats(matchId, database);
  const accountSeatIds = accountSeats.map((seat) => seat.playerId);
  if (countGuestSeats(players, accountSeatIds, botSeats) >= MAX_GUEST_SEATS_PER_MATCH) {
    return { outcome: 'cap-reached' };
  }

  const freeSeat = findFreeSeat(players, seatCount);
  if (freeSeat === null) {
    return { outcome: 'match-full' };
  }

  // why: secret-join the free seat exactly as create-with-bot joins a bot seat —
  // the WP-308 internal-delegation secret admits the loopback join, and the seat
  // is NEVER written to match_seat_accounts (D-24120). A rowless seat renders
  // "Player N" and shortens the account roster below the seat count, which is what
  // makes computeRankedEligibility rule 2 demote the match to Casual.
  const joinResponse = await fetch(
    `${serverUrl}/games/legendary-arena/${matchId}/join`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [INTERNAL_DELEGATION_HEADER]: internalDelegationSecret,
      },
      body: JSON.stringify({ playerID: freeSeat, playerName: 'Guest' }),
    },
  );
  if (!joinResponse.ok) {
    const nativeErrorBody = await joinResponse.text();
    return { outcome: 'join-failed', status: joinResponse.status, detail: nativeErrorBody };
  }
  const joinResult = await joinResponse.json();
  return { outcome: 'joined', seat: freeSeat, credentials: joinResult.playerCredentials };
}

/**
 * Releases every UNCLAIMED guest seat in a match and returns the seat ids freed
 * (D-24448). An unclaimed guest seat is one that is (a) occupied by a guest — a
 * seat with credentials that is neither an account seat nor a bot seat — and
 * (b) NOT yet connected (`isConnected !== true`), i.e. a `mintGuestSeat`
 * placeholder that "Add guest" filled but no real person ever opened.
 *
 * Called when a host sets a guest PASSWORD (the lobby-join model): that model
 * needs the seat left OPEN so a walk-up guest can claim it from the lobby, but
 * "Add guest" (the link-handoff model) may have already minted-and-filled it. We
 * release each such placeholder via boardgame.io's native `leave`, authenticated
 * with the seat's OWN stored credentials — read from the framework match metadata
 * (`db.fetch(..., { metadata: true })`, the same D-24095/D-24119 framework-store
 * read `mintGuestSeat` uses; the loopback `leave` is a framework-owned mutation,
 * not an application write to a domain table). A CONNECTED guest (a real person
 * already on the link) keeps their seat.
 *
 * Best-effort and non-throwing: a failed metadata read or `leave` is logged and
 * skipped so a transient bgio hiccup never fails the caller's password save.
 *
 * @param {object} context - The bot-ally context bundle (db, serverUrl,
 *   internalDelegationSecret, database).
 * @param {string} matchId - The match whose unclaimed guest seats to release.
 * @returns {Promise<string[]>} The seat ids that were released (possibly empty).
 */
export async function releaseUnclaimedGuestSeats(context, matchId) {
  const { db, serverUrl, internalDelegationSecret, database } = context;
  const releasedSeatIds = [];
  // why: without the framework store there is nothing to read or release — a
  // clean no-op (keeps the caller's password save unaffected). In production the
  // shared bot-ally context always carries `db`.
  if (db === undefined || db === null) {
    return releasedSeatIds;
  }
  try {
    const { metadata } = await db.fetch(matchId, { metadata: true });
    if (metadata === null || metadata === undefined || metadata.players === undefined) {
      return releasedSeatIds;
    }
    const players = metadata.players;
    const accountSeats = await readSeatAccounts(matchId, database);
    const botSeats = await readMatchBotSeats(matchId, database);
    const accountSeatSet = new Set(accountSeats.map((seat) => seat.playerId));
    const botSeatSet = new Set(botSeats);

    for (const [seatId, seatMeta] of Object.entries(players)) {
      const isOccupied = seatMeta !== null && typeof seatMeta.credentials === 'string';
      const isGuestSeat = isOccupied && !accountSeatSet.has(seatId) && !botSeatSet.has(seatId);
      // why: leave ONLY an unconnected guest placeholder — a real guest already on
      // the link (isConnected === true) keeps their seat (the accepted edge case).
      if (!isGuestSeat || seatMeta.isConnected === true) {
        continue;
      }
      // why: boardgame.io's native `leave` frees the seat (clears its name +
      // credentials) when given the seat's own credentials; the internal-delegation
      // header admits the loopback call exactly as the `mintGuestSeat` join does.
      const leaveResponse = await fetch(
        `${serverUrl}/games/legendary-arena/${matchId}/leave`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [INTERNAL_DELEGATION_HEADER]: internalDelegationSecret,
          },
          body: JSON.stringify({ playerID: seatId, credentials: seatMeta.credentials }),
        },
      );
      if (leaveResponse.ok) {
        releasedSeatIds.push(seatId);
      } else {
        console.error(
          `[release-guest-seat] leave failed for match ${matchId} seat ${seatId}: ` +
            `HTTP ${leaveResponse.status}.`,
        );
      }
    }
  } catch (releaseError) {
    // why: releasing seats is best-effort — the password has already been saved by
    // the caller, so a failure here must not fail the request. Log and return what
    // was freed so the seat simply stays as-is (the host can retry the save).
    console.error(
      `[release-guest-seat] failed for match ${matchId}: ${releaseError.message}`,
    );
  }
  return releasedSeatIds;
}

/**
 * Registers `POST /api/match/add-guest` on the boardgame.io Koa router.
 *
 * @param {import('@koa/router')} router - The boardgame.io server's koa router.
 * @param {object} context - Server context (shares the bot-ally context bundle).
 * @param {object} context.db - boardgame.io storage backend (for the metadata read).
 * @param {string} context.serverUrl - Loopback origin for the native-lobby join.
 * @param {string} context.internalDelegationSecret - The WP-308 native-lobby secret.
 * @param {object} context.database - The long-lived pg pool.
 * @param {Function} context.requireAuthenticatedSession - The WP-112 session check.
 * @param {object} [context.verifier] - Hanko verifier (undefined in dev-mode).
 * @param {object} [context.accountResolver] - Account resolver.
 */
export function registerAddGuestRoutes(router, context) {
  // why: serverUrl + internalDelegationSecret are read by mintGuestSeat straight
  // from `context`; the handler itself needs only db (the not-found precheck),
  // database (the participant gate), and the session-check trio.
  const {
    db,
    database,
    requireAuthenticatedSession,
    verifier,
    accountResolver,
  } = context;

  router.post('/api/match/add-guest', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');

    // why: authenticated-session-required — only a signed-in host may add a
    // guest seat. Run the session check as the first business-logic step and
    // capture the host's AccountId for the participant check below.
    const sessionResult = await requireAuthenticatedSession(koaContext.req, {
      verifier,
      accountResolver,
      database,
    });
    if (sessionResult.ok !== true) {
      koaContext.status = statusForSessionValidationCode(sessionResult.code);
      koaContext.body = {
        error:
          'A signed-in account is required to add a guest seat to a match; ' +
          `the session could not be validated (reason code: ${sessionResult.code}). ` +
          'Sign in and try again.',
      };
      return;
    }
    const hostAccountId = sessionResult.value;

    await ensureJsonBodyParsed(koaContext);
    const requestBody = koaContext.request.body ?? {};
    const matchId = typeof requestBody.matchId === 'string' ? requestBody.matchId : '';
    if (matchId === '') {
      koaContext.status = 400;
      koaContext.body = {
        error:
          'The "matchId" field is required to add a guest seat and must be a ' +
          'non-empty string identifying the match to add the guest to.',
      };
      return;
    }

    try {
      // why: read occupancy from the bgio match metadata (the framework store's
      // own metadata surface, D-24095/D-24119 carve-out — never a raw G/ctx
      // read), mirroring readBotSeatCredentials, so the host participant check
      // below sees the same roster mintGuestSeat will. players is keyed "0".."N-1".
      const { metadata } = await db.fetch(matchId, { metadata: true });
      if (metadata === null || metadata === undefined || metadata.players === undefined) {
        koaContext.status = 404;
        koaContext.body = {
          error:
            `No match with id "${matchId}" was found, so a guest seat could ` +
            'not be added. Check the match id and try again.',
        };
        return;
      }

      // why: the host must be a participant in this match (has a seat-account
      // row), so a signed-in stranger cannot seed guests into someone else's
      // match. readSeatAccounts returns only authenticated account seats. This
      // is the add-guest-only authorization; mintGuestSeat performs no auth.
      const accountSeats = await readSeatAccounts(matchId, database);
      const isHostParticipant = accountSeats.some((seat) => seat.accountId === hostAccountId);
      if (!isHostParticipant) {
        koaContext.status = 403;
        koaContext.body = {
          error:
            'Only a player already in the match may add a guest seat to it. ' +
            'Join the match first, then add a guest.',
        };
        return;
      }

      // why: mint the seat through the shared helper (occupancy read → per-match
      // cap → free seat → rowless secret-join, D-24120), then map its discriminated
      // outcome to the same HTTP statuses this endpoint has always returned.
      const mintResult = await mintGuestSeat(context, matchId);
      if (mintResult.outcome === 'cap-reached') {
        koaContext.status = 409;
        koaContext.body = {
          error:
            `This match already has the maximum of ${MAX_GUEST_SEATS_PER_MATCH} ` +
            'guest seats. Remove a guest or use a larger match to add another.',
        };
        return;
      }
      if (mintResult.outcome === 'match-full') {
        koaContext.status = 409;
        koaContext.body = {
          error:
            'The match is full, so a guest seat could not be added. Every seat ' +
            'is already occupied.',
        };
        return;
      }
      if (mintResult.outcome === 'match-not-found') {
        koaContext.status = 404;
        koaContext.body = {
          error:
            `No match with id "${matchId}" was found, so a guest seat could ` +
            'not be added. Check the match id and try again.',
        };
        return;
      }
      if (mintResult.outcome === 'join-failed') {
        koaContext.status = mintResult.status;
        koaContext.body = {
          error:
            `The guest seat could not be joined on the game server ` +
            `(it responded HTTP ${mintResult.status}: ${mintResult.detail}). ` +
            'The match may be full or no longer exist.',
        };
        return;
      }

      koaContext.status = 200;
      koaContext.body = {
        matchId,
        seat: mintResult.seat,
        credentials: mintResult.credentials,
      };
    } catch (faultError) {
      koaContext.status = 500;
      koaContext.body = {
        error:
          'The guest seat could not be added because of an unexpected server ' +
          'error. Please retry in a moment.',
      };
      console.error(`[add-guest] add-guest failed unexpectedly: ${faultError.message}`);
    }
  });
}
