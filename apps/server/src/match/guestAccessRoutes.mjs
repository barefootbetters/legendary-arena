/**
 * Guest-Access Routes — per-match guest password + game name (WP-630 / EC-665 /
 * D-24441).
 *
 * Registers the server half of the per-match guest password model:
 *
 *   1. `POST /api/match/set-guest-access` (authenticated-session-required) — a
 *      host in the match sets an optional game NAME and an optional PASSWORD.
 *      Per-field merge: an absent field is left unchanged; an empty string clears
 *      it (so a rename never wipes the password).
 *   2. `POST /api/match/join-as-guest` (public, per-IP rate-limited) — a walk-up
 *      guest with no account types the password; on a match the endpoint mints an
 *      anonymous Casual seat via the shared `mintGuestSeat` (the same rowless
 *      secret-join as add-guest, D-24120) and returns `{ matchId, seat, credentials }`.
 *   3. `GET /api/match/:matchId/guest-access` (public) — the lobby-safe meta read
 *      (`{ gameName, hasGuestPassword }`); NEVER the derived key.
 *
 * Security posture (D-24441): the password is stored only as a scrypt derived key
 * (see guestAccess.logic.ts); the public join endpoint is rate-limited BEFORE any
 * DB/hash work so a brute-force attempt is a cheap reject; the plaintext and the
 * derived key are never logged or returned; the granted seat is rowless → Casual.
 *
 * Layer: server wires the framework; it decides no gameplay. The seat mint reads
 * only the bgio match metadata (D-24095/D-24119 carve-out) via `mintGuestSeat`.
 *
 * Authority: WP-630; EC-665; D-24441 (Candidate B password variant); D-24120
 * (rowless non-account seat); D-24094 (internal-delegation secret, via
 * mintGuestSeat); D-11804 (api-endpoints.md obligation); D-9905 (auth posture);
 * D-20503 (the per-IP token-bucket pattern this copies).
 */

import koaBody from 'koa-body';
import { mintGuestSeat, releaseUnclaimedGuestSeats } from './addGuestRoutes.mjs';
import { readSeatAccounts } from './seatAccount.logic.js';
import {
  setGuestAccess,
  verifyGuestPassword,
  readGuestAccessMeta,
} from './guestAccess.logic.js';

// why: D-20503 — per-IP token-bucket window. A guest's join attempts refill once
// the window expires (whole-window reset, matching the analytics limiter mental
// model). Process-local; a multi-instance deploy shares no state (a redis-backed
// limiter is a future hardening WP, the same caveat as the analytics limiter).
const GUEST_JOIN_RATE_LIMIT_WINDOW_MS = 60_000;

// why: 10 join attempts per minute per IP is generous for a real grandchild
// mistyping a short password but throttles automated password guessing. Lower
// than the analytics 60/min because a wrong guess here is a security event, not
// a page view. Overridable via context for the at-limit test.
const DEFAULT_GUEST_JOIN_RATE_LIMIT_CAPACITY = 10;

/**
 * Maps a session-validation failure code to its HTTP status: 500 for operator
 * faults, 401 otherwise (mirrors addGuestRoutes / matchGate so an
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

/**
 * A per-IP token-bucket rate limiter. COPIED (not imported) from the analytics
 * `makeRateLimiter` pattern — that one is module-local to analytics.routes.ts and
 * is not exported, and copying avoids a cross-module dependency for a tiny helper.
 * Buckets reset to full capacity once the window expires.
 *
 * @param {number} capacity - Tokens per window per IP.
 * @param {() => number} now - Injected clock (for tests).
 * @returns {{ consume: (ip: string, count: number) => boolean }}
 */
function makeGuestJoinRateLimiter(capacity, now) {
  const buckets = new Map();
  return {
    consume(ip, count) {
      const currentTime = now();
      const existing = buckets.get(ip);
      let state;
      if (existing === undefined) {
        state = { tokens: capacity, lastRefill: currentTime };
        buckets.set(ip, state);
      } else {
        state = existing;
        const elapsed = currentTime - state.lastRefill;
        if (elapsed >= GUEST_JOIN_RATE_LIMIT_WINDOW_MS) {
          // why: whole-window reset once the minute has passed (the analytics
          // limiter's deliberate simplicity — harder to game with bursts than a
          // linear sub-window refill).
          state.tokens = capacity;
          state.lastRefill = currentTime;
        }
      }
      if (state.tokens < count) {
        return false;
      }
      state.tokens = state.tokens - count;
      return true;
    },
  };
}

// why: boardgame.io installs koa-body ONLY on its own /games/* routes — there is
// no global body parser — so each guarded POST route parses its own JSON body
// (mirrors addGuestRoutes.mjs / matchGate.routes.ts). Applied only when a real
// Node request stream is present, so the unit-test fake context short-circuits it.
const guestAccessJsonBodyParser = koaBody();

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
  await guestAccessJsonBodyParser(koaContext, async () => {});
}

/**
 * Registers the host-gated `POST /api/match/set-guest-access` route.
 *
 * @param {import('@koa/router')} router - The boardgame.io server's koa router.
 * @param {object} context - The bot-ally context bundle.
 */
function registerSetGuestAccessRoute(router, context) {
  const { database, requireAuthenticatedSession, verifier, accountResolver } = context;
  // why: D-24448 — reopening a reserved guest seat on password-set needs the same
  // framework-store + loopback bundle mintGuestSeat uses (db / serverUrl /
  // internalDelegationSecret); it is threaded through the shared bot-ally context.

  router.post('/api/match/set-guest-access', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');

    // why: authenticated-session-required — only a signed-in host may set a
    // match's guest name/password. Run the session check first and capture the
    // host's AccountId for the participant check.
    const sessionResult = await requireAuthenticatedSession(koaContext.req, {
      verifier,
      accountResolver,
      database,
    });
    if (sessionResult.ok !== true) {
      koaContext.status = statusForSessionValidationCode(sessionResult.code);
      koaContext.body = {
        error:
          'A signed-in account is required to set a match guest password; ' +
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
          'The "matchId" field is required to set guest access and must be a ' +
          'non-empty string identifying the match.',
      };
      return;
    }
    // why: gameName / password are optional three-state fields — undefined leaves
    // the stored value, '' clears it. Reject only a present-but-non-string field
    // (a malformed client), never an absent one.
    if (requestBody.gameName !== undefined && typeof requestBody.gameName !== 'string') {
      koaContext.status = 400;
      koaContext.body = {
        error: 'The "gameName" field, when present, must be a string (empty string clears it).',
      };
      return;
    }
    if (requestBody.password !== undefined && typeof requestBody.password !== 'string') {
      koaContext.status = 400;
      koaContext.body = {
        error: 'The "password" field, when present, must be a string (empty string clears it).',
      };
      return;
    }

    try {
      // why: the host must be a participant in this match (has a seat-account
      // row), so a signed-in stranger cannot set a password on someone else's
      // match. readSeatAccounts returns only authenticated account seats.
      const accountSeats = await readSeatAccounts(matchId, database);
      const isHostParticipant = accountSeats.some((seat) => seat.accountId === hostAccountId);
      if (!isHostParticipant) {
        koaContext.status = 403;
        koaContext.body = {
          error:
            'Only a player already in the match may set its guest password. ' +
            'Join the match first, then set the guest access.',
        };
        return;
      }

      await setGuestAccess(
        matchId,
        { gameName: requestBody.gameName, password: requestBody.password },
        database,
      );

      // why: D-24448 — a host who sets a PASSWORD has chosen the lobby-join guest
      // model, which needs an OPEN seat. If "Add guest" already minted-and-filled
      // the seat with an unclaimed "Guest" placeholder, that placeholder hides the
      // match from the lobby (no open seat), so release it here to reopen the seat.
      // Only fires when a real password is being set (not a name-only save), and is
      // best-effort — the password is already saved, so a release failure never
      // fails this request. A CONNECTED guest keeps their seat.
      if (typeof requestBody.password === 'string' && requestBody.password !== '') {
        await releaseUnclaimedGuestSeats(context, matchId);
      }

      // why: the response echoes only the lobby-safe meta — never the plaintext
      // or the derived key.
      const meta = await readGuestAccessMeta(matchId, database);
      koaContext.status = 200;
      koaContext.body = { matchId, gameName: meta.gameName, hasGuestPassword: meta.hasGuestPassword };
    } catch (faultError) {
      koaContext.status = 500;
      koaContext.body = {
        error:
          'The guest access could not be saved because of an unexpected server ' +
          'error. Please retry in a moment.',
      };
      console.error(`[set-guest-access] failed unexpectedly: ${faultError.message}`);
    }
  });
}

/**
 * Registers the public, rate-limited `POST /api/match/join-as-guest` route.
 *
 * @param {import('@koa/router')} router - The boardgame.io server's koa router.
 * @param {object} context - The bot-ally context bundle.
 * @param {{ consume: (ip: string, count: number) => boolean }} rateLimiter - The per-IP limiter.
 */
function registerJoinAsGuestRoute(router, context, rateLimiter) {
  router.post('/api/match/join-as-guest', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');

    // why: rate-limit BEFORE any DB or scrypt work — a brute-force guess must be
    // rejected as cheaply as possible, never after a hash computation. This is the
    // ordering the no-plaintext-log + rate-limit-ordering tests pin.
    const requestIp = typeof koaContext.request.ip === 'string' ? koaContext.request.ip : 'unknown';
    if (rateLimiter.consume(requestIp, 1) === false) {
      koaContext.status = 429;
      koaContext.body = {
        error:
          'Too many guest join attempts from this location. Wait a minute and ' +
          'try the password again.',
      };
      return;
    }

    await ensureJsonBodyParsed(koaContext);
    const requestBody = koaContext.request.body ?? {};
    const matchId = typeof requestBody.matchId === 'string' ? requestBody.matchId : '';
    const password = typeof requestBody.password === 'string' ? requestBody.password : '';
    if (matchId === '' || password === '') {
      koaContext.status = 400;
      koaContext.body = {
        error:
          'Both "matchId" and "password" are required to join as a guest, and ' +
          'each must be a non-empty string.',
      };
      return;
    }

    try {
      const { database } = context;
      // why: verdict is discriminated — no-access (the match has no password) is a
      // 409, a wrong password is a 401; the two are distinct failures and must not
      // collapse. The plaintext is only ever passed to verifyGuestPassword; it is
      // never logged.
      const verdict = await verifyGuestPassword(matchId, password, database);
      if (verdict === 'no-access') {
        koaContext.status = 409;
        koaContext.body = {
          error:
            'This match is not accepting guest joins by password. Ask the host ' +
            'to set a guest password, or use the link they share.',
        };
        return;
      }
      if (verdict === 'mismatch') {
        koaContext.status = 401;
        koaContext.body = {
          error: 'That guest password is not correct for this match. Check it and try again.',
        };
        return;
      }

      // why: correct password — mint the anonymous seat through the shared helper
      // (rowless secret-join, D-24120 → Casual). Map its discriminated outcome to
      // HTTP exactly as add-guest does.
      const mintResult = await mintGuestSeat(context, matchId);
      if (mintResult.outcome === 'match-not-found') {
        koaContext.status = 404;
        koaContext.body = {
          error:
            `No match with id "${matchId}" was found, so the guest seat could ` +
            'not be joined. The match may have ended.',
        };
        return;
      }
      if (mintResult.outcome === 'cap-reached' || mintResult.outcome === 'match-full') {
        koaContext.status = 409;
        koaContext.body = {
          error:
            'The match is full, so a guest seat could not be joined. Every seat ' +
            'is already taken.',
        };
        return;
      }
      if (mintResult.outcome === 'join-failed') {
        koaContext.status = mintResult.status;
        koaContext.body = {
          error:
            `The guest seat could not be joined on the game server ` +
            `(it responded HTTP ${mintResult.status}). The match may be full or ` +
            'no longer exist.',
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
          'The guest seat could not be joined because of an unexpected server ' +
          'error. Please retry in a moment.',
      };
      console.error(`[join-as-guest] failed unexpectedly: ${faultError.message}`);
    }
  });
}

/**
 * Registers the public `GET /api/match/:matchId/guest-access` meta route.
 *
 * @param {import('@koa/router')} router - The boardgame.io server's koa router.
 * @param {object} context - The bot-ally context bundle.
 */
function registerReadGuestAccessRoute(router, context) {
  const { database } = context;

  router.get('/api/match/:matchId/guest-access', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    const matchId = koaContext.params.matchId ?? '';
    if (matchId === '') {
      koaContext.status = 400;
      koaContext.body = { error: 'A match id is required in the path to read guest access.' };
      return;
    }
    try {
      // why: readGuestAccessMeta returns only { gameName, hasGuestPassword } — the
      // derived key is never selected into the response.
      const meta = await readGuestAccessMeta(matchId, database);
      koaContext.status = 200;
      koaContext.body = { matchId, gameName: meta.gameName, hasGuestPassword: meta.hasGuestPassword };
    } catch (faultError) {
      koaContext.status = 500;
      koaContext.body = {
        error:
          'The match guest access could not be read because of an unexpected ' +
          'server error. Please retry in a moment.',
      };
      console.error(`[guest-access] read failed unexpectedly: ${faultError.message}`);
    }
  });
}

/**
 * Registers all three guest-access routes on the boardgame.io Koa router. Reuses
 * the bot-ally context bundle (db / serverUrl / internal-delegation secret / pg
 * pool / authenticated-session deps).
 *
 * @param {import('@koa/router')} router - The boardgame.io server's koa router.
 * @param {object} context - Server context (shares the bot-ally context bundle).
 * @param {number} [context.guestJoinRateLimitCapacity] - Test override for the join cap.
 * @param {() => number} [context.now] - Test override for the limiter clock.
 */
export function registerGuestAccessRoutes(router, context) {
  const now = context.now ?? (() => Date.now());
  const rateLimiter = makeGuestJoinRateLimiter(
    context.guestJoinRateLimitCapacity ?? DEFAULT_GUEST_JOIN_RATE_LIMIT_CAPACITY,
    now,
  );
  registerSetGuestAccessRoute(router, context);
  registerJoinAsGuestRoute(router, context, rateLimiter);
  registerReadGuestAccessRoute(router, context);
}
