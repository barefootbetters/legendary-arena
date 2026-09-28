/**
 * Guest Solo Route — a signed-out visitor can play one solo featured table
 * (WP-787 / EC-824 / D-24635).
 *
 * Registers `POST /api/match/create-guest-solo` (Auth `guest`). The handler:
 *
 *   1. spends one token from a per-connection rate limit (429 when empty),
 *   2. checks a process-wide cap on recently created guest solo matches (503 when
 *      full),
 *   3. creates a 1-player, unlisted match on the server-fixed featured table over
 *      the native-lobby loopback (the internal-delegation secret, D-24094),
 *   4. joins seat '0' as `Guest` over the same loopback — writing NO
 *      `match_seat_accounts` row (D-24120), so the match is Casual (D-24172 rule 2),
 *   5. returns `{ matchId, seat: '0', credentials }`.
 *
 * Steps 1 and 2 run before any `fetch`. The route never reads a session, never
 * reads the request body, never queries the pg pool, and never touches the bgio
 * store; the only rows it causes are the native lobby's own `bgio.matches` row.
 *
 * Layer: server wires the framework; it decides no gameplay. The engine validates
 * the setup and runs the match like any other.
 *
 * Authority: WP-787; EC-824; D-24635 (amends D-24092's ungated taste); D-24094
 * (internal-delegation secret); D-24120 (rowless seat); D-24172 (Casual);
 * D-24441 (guest-seat naming + the limiter pattern); D-11804 (api-endpoints.md).
 */

import { INTERNAL_DELEGATION_HEADER } from './nativeLobbyGuard.js';
import { createTokenBucketRateLimiter, resolveRateLimitKey } from './tokenBucketRateLimiter.mjs';

/**
 * The featured table a guest solo match is always played on.
 *
 * // why: server-fixed so an unauthenticated caller cannot choose a composition
 * (autoplay accepts client setupData; this route does not). Brotherhood is
 * Magneto's Always Leads group, and the 1-player row is 1 villain group /
 * 1 henchman group / 3 heroes (D-24165). Identical to WP-785's FEATURED_TABLE.
 */
export const GUEST_SOLO_FEATURED_TABLE = Object.freeze({
  schemeId: 'core/midtown-bank-robbery',
  mastermindId: 'core/magneto',
  villainGroupIds: Object.freeze(['core/brotherhood']),
  henchmanGroupIds: Object.freeze(['core/sentinel']),
  heroDeckIds: Object.freeze(['core/spider-man', 'core/hulk', 'core/wolverine']),
  bystandersCount: 30,
  woundsCount: 30,
  officersCount: 30,
  sidekicksCount: 12,
});

// why: one minute per rate-limit window, matching the join-as-guest limiter.
export const GUEST_SOLO_RATE_LIMIT_WINDOW_MS = 60_000;

// why: five solo creates a minute from one connection covers a real player who
// restarts a few times, and throttles a script. Overridable via context in tests.
export const DEFAULT_GUEST_SOLO_RATE_LIMIT_CAPACITY = 5;

// why: an in-process approximation of "live guest matches" — a creation counts
// against the cap for two hours, long enough to cover a typical solo game. The
// match reaper removes abandoned unfinished rows after 24 h regardless.
export const GUEST_SOLO_ACTIVE_WINDOW_MS = 7_200_000;

// why: the hard bound on hosting cost from unauthenticated play, whatever the rate
// limit key turns out to be. Overridable via context in tests.
export const DEFAULT_MAX_ACTIVE_GUEST_SOLO_MATCHES = 200;

const RATE_LIMITED_MESSAGE =
  'Too many guest matches were started from this connection. Please wait a minute and try again.';
const AT_CAPACITY_MESSAGE =
  'Guest play is at capacity right now. Please sign in to play, or try again in a few minutes.';
const NATIVE_FAILURE_PREFIX = 'The guest match could not be created. ';
const UNREACHABLE_MESSAGE =
  'The guest match could not be created because the game server did not respond. Please retry in a moment.';

/**
 * Drops creation timestamps that have aged out of the active window, then reports
 * whether the process-wide cap is already reached.
 *
 * @param {number[]} creationTimestamps - The closure's creation list (mutated).
 * @param {number} currentTime - The current clock reading.
 * @param {number} maxActiveMatches - The cap.
 * @returns {boolean} True when no new guest solo match may be created.
 */
function isAtCapacity(creationTimestamps, currentTime, maxActiveMatches) {
  const stillActive = creationTimestamps.filter(
    (createdAt) => currentTime - createdAt < GUEST_SOLO_ACTIVE_WINDOW_MS,
  );
  creationTimestamps.length = 0;
  creationTimestamps.push(...stillActive);
  return creationTimestamps.length >= maxActiveMatches;
}

/**
 * Posts one JSON request to the native lobby over the loopback, carrying the
 * internal-delegation secret. Throws only when the game server does not respond.
 *
 * @param {object} context - The bot-ally context bundle (serverUrl + secret).
 * @param {string} path - The native lobby path under `serverUrl`.
 * @param {object} payload - The JSON body to send.
 * @returns {Promise<Response>} The native response.
 */
function postToNativeLobby(context, path, payload) {
  return fetch(`${context.serverUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [INTERNAL_DELEGATION_HEADER]: context.internalDelegationSecret,
    },
    body: JSON.stringify(payload),
  });
}

/**
 * Creates the 1-player guest solo match on the featured table.
 *
 * @param {object} context - The bot-ally context bundle.
 * @returns {Promise<{ ok: true, matchId: string } | { ok: false, status: number, detail: string }>}
 */
async function createGuestSoloMatch(context) {
  // why: unlisted — a guest solo table never appears in the public join list.
  const createResponse = await postToNativeLobby(context, '/games/legendary-arena/create', {
    numPlayers: 1,
    setupData: GUEST_SOLO_FEATURED_TABLE,
    unlisted: true,
  });
  if (!createResponse.ok) {
    return { ok: false, status: createResponse.status, detail: await createResponse.text() };
  }
  const createResult = await createResponse.json();
  return { ok: true, matchId: createResult.matchID };
}

/**
 * Joins seat '0' of the new match as `Guest`. No seat-account row is written
 * (D-24120), so the match is Casual.
 *
 * @param {object} context - The bot-ally context bundle.
 * @param {string} matchId - The match just created.
 * @returns {Promise<{ ok: true, credentials: string } | { ok: false, status: number, detail: string }>}
 */
async function joinGuestSoloSeat(context, matchId) {
  const joinResponse = await postToNativeLobby(context, `/games/legendary-arena/${matchId}/join`, {
    playerID: '0',
    playerName: 'Guest',
  });
  if (!joinResponse.ok) {
    return { ok: false, status: joinResponse.status, detail: await joinResponse.text() };
  }
  const joinResult = await joinResponse.json();
  return { ok: true, credentials: joinResult.playerCredentials };
}

/**
 * Creates the match, joins the guest seat, and writes the HTTP response. Records
 * a capacity entry only after a successful join.
 *
 * @param {object} koaContext - The Koa request context.
 * @param {object} context - The bot-ally context bundle.
 * @param {() => void} recordCreation - Adds one capacity entry.
 * @returns {Promise<void>}
 */
async function createAndJoinGuestSolo(koaContext, context, recordCreation) {
  try {
    const createOutcome = await createGuestSoloMatch(context);
    if (!createOutcome.ok) {
      koaContext.status = createOutcome.status;
      koaContext.body = { error: `${NATIVE_FAILURE_PREFIX}${createOutcome.detail}` };
      return;
    }
    const joinOutcome = await joinGuestSoloSeat(context, createOutcome.matchId);
    if (!joinOutcome.ok) {
      koaContext.status = joinOutcome.status;
      koaContext.body = { error: `${NATIVE_FAILURE_PREFIX}${joinOutcome.detail}` };
      return;
    }
    recordCreation();
    koaContext.status = 200;
    koaContext.body = { matchId: createOutcome.matchId, seat: '0', credentials: joinOutcome.credentials };
  } catch (networkError) {
    // why: a thrown fetch means the loopback game server did not answer; the
    // caller gets a retryable 502 and no capacity entry is recorded.
    koaContext.status = 502;
    koaContext.body = { error: UNREACHABLE_MESSAGE };
    console.error(`[guest-solo] the native lobby did not respond: ${networkError.message}`);
  }
}

/**
 * Registers `POST /api/match/create-guest-solo` on the boardgame.io Koa router.
 * The limiter, the capacity list, and the key-source log flag are created here
 * (a closure, never module scope) so each registration starts clean.
 *
 * @param {import('@koa/router')} router - The boardgame.io server's koa router.
 * @param {object} context - The bot-ally context bundle.
 * @param {string} context.serverUrl - Loopback origin for the native lobby.
 * @param {string} context.internalDelegationSecret - The WP-308 native-lobby secret.
 * @param {number} [context.guestSoloRateLimitCapacity] - Test override for the rate limit.
 * @param {number} [context.maxActiveGuestSoloMatches] - Test override for the cap.
 * @param {() => number} [context.now] - Test override for the clock.
 */
export function registerGuestSoloRoutes(router, context) {
  const now = context.now ?? (() => Date.now());
  const rateLimiter = createTokenBucketRateLimiter({
    capacity: context.guestSoloRateLimitCapacity ?? DEFAULT_GUEST_SOLO_RATE_LIMIT_CAPACITY,
    windowMs: GUEST_SOLO_RATE_LIMIT_WINDOW_MS,
    now,
  });
  const maxActiveMatches = context.maxActiveGuestSoloMatches ?? DEFAULT_MAX_ACTIVE_GUEST_SOLO_MATCHES;
  const creationTimestamps = [];
  let hasLoggedKeySource = false;

  // why: bodyless — the route never parses or reads the request body (every
  // input is server-fixed), so it needs no body parser (api-endpoints.md
  // §Body-Parsing Convention) and a client body can never reach the native calls.
  router.post('/api/match/create-guest-solo', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');

    const { key, source } = resolveRateLimitKey(koaContext);
    if (!hasLoggedKeySource) {
      // why: the WP-787 live check reads this line to learn whether
      // cf-connecting-ip reaches Node. It names the source only, never the IP.
      hasLoggedKeySource = true;
      console.log(`[guest-solo] rate-limit key source: ${source}`);
    }
    if (rateLimiter.consume(key, 1) === false) {
      koaContext.status = 429;
      koaContext.body = { error: RATE_LIMITED_MESSAGE };
      return;
    }
    if (isAtCapacity(creationTimestamps, now(), maxActiveMatches)) {
      koaContext.status = 503;
      koaContext.body = { error: AT_CAPACITY_MESSAGE };
      return;
    }

    await createAndJoinGuestSolo(koaContext, context, () => {
      creationTimestamps.push(now());
    });
  });
}
