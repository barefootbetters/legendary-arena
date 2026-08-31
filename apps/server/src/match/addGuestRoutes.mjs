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
  const {
    db,
    serverUrl,
    internalDelegationSecret,
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
      // read), mirroring readBotSeatCredentials. players is keyed "0".."N-1".
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
      const players = metadata.players;
      const seatCount = Object.keys(players).length;

      // why: the host must be a participant in this match (has a seat-account
      // row), so a signed-in stranger cannot seed guests into someone else's
      // match. readSeatAccounts returns only authenticated account seats.
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

      // why: enforce the per-match guest cap. A guest seat is an occupied seat
      // that is neither an account seat nor a bot seat; count them and reject a
      // new guest once the cap is reached (a full match is also rejected below).
      const botSeats = await readMatchBotSeats(matchId, database);
      const accountSeatIds = accountSeats.map((seat) => seat.playerId);
      if (countGuestSeats(players, accountSeatIds, botSeats) >= MAX_GUEST_SEATS_PER_MATCH) {
        koaContext.status = 409;
        koaContext.body = {
          error:
            `This match already has the maximum of ${MAX_GUEST_SEATS_PER_MATCH} ` +
            'guest seats. Remove a guest or use a larger match to add another.',
        };
        return;
      }

      const freeSeat = findFreeSeat(players, seatCount);
      if (freeSeat === null) {
        koaContext.status = 409;
        koaContext.body = {
          error:
            'The match is full, so a guest seat could not be added. Every seat ' +
            'is already occupied.',
        };
        return;
      }

      // why: secret-join the free seat exactly as create-with-bot joins a bot
      // seat — the WP-308 internal-delegation secret admits the loopback join,
      // and the seat is NEVER written to match_seat_accounts (D-24120). A rowless
      // seat renders "Player N" and shortens the account roster below the seat
      // count, which is what makes computeRankedEligibility rule 2 demote the
      // match to Casual (competition.logic.ts) — no marker, no migration needed.
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
        koaContext.status = joinResponse.status;
        koaContext.body = {
          error:
            `The guest seat could not be joined on the game server ` +
            `(it responded HTTP ${joinResponse.status}: ${nativeErrorBody}). ` +
            'The match may be full or no longer exist.',
        };
        return;
      }
      const joinResult = await joinResponse.json();

      koaContext.status = 200;
      koaContext.body = {
        matchId,
        seat: freeSeat,
        credentials: joinResult.playerCredentials,
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
