/**
 * Bot-Ally Routes — server-side create-with-bot endpoint + driver wiring
 * (WP-375 / EC-404).
 *
 * Registers `POST /api/match/create-with-bot`: a signed-in human asks for a
 * cooperative N-seat match whose non-human seats are filled and driven by a
 * bot ally. The handler, server-side and BEFORE it returns `matchId`:
 *
 *   1. creates the match (loopback native create, internal-delegation secret),
 *   2. secret-joins ONLY the bot seats "1"…"botCount" (never seat 0; never a
 *      `match_seat_accounts` row for a bot — D-24120),
 *   3. registers a per-match {@link createBotAllyDriver} + persists the
 *      `botSeats` tag to the `legendary.match_bot_ally` side-table, then
 *   4. auto-readies the bot seats but never starts the match itself — the human
 *      readying seat 0 is what starts it.
 *
 * The human then joins seat 0 through the existing authed `/api/match/join`
 * (WP-376, client) so seat 0 keeps its account row + own credential.
 *
 * This module owns the boardgame.io `Master` move submission and the `pg`
 * side-table persistence (the framework/database seam); the orchestration lives
 * in `botAllyDriver.mjs`, which imports neither. Server layer: it wires the
 * engine + framework, it never decides gameplay.
 *
 * Authority: WP-375; EC-404; DESIGN-SOLO-BOT-ALLY §4a/§4b/§5/§7; D-24170
 * (poll turn-detection, boot re-registration, side-table metadata); D-24120
 * (bots have no seat-account row); D-24094 (internal-delegation secret);
 * D-24095 (bgio pg store); D-11804 (api-endpoints.md obligation); D-9905 auth.
 */

import { createRequire } from 'node:module';
import { LegendaryGame } from '@legendary-arena/game-engine';
import { INTERNAL_DELEGATION_HEADER } from '../match/nativeLobbyGuard.js';
import {
  createBotAllyDriver,
  decideBotMove,
  buildBotPolicy,
  botAllyDrivers,
  BOT_FAULTED_MESSAGE,
} from './botAllyDriver.mjs';
import koaBody from 'koa-body';

// why: boardgame.io v0.50 ships CJS-only bundles for /master and /internal;
// createRequire bridges ESM → CJS for these subpackage imports (mirrors
// autoplay.mjs).
const require = createRequire(import.meta.url);
const { Master } = require('boardgame.io/master');
const { ProcessGameConfig } = require('boardgame.io/internal');

const MAKE_MOVE = 'MAKE_MOVE';

/**
 * The valid bot policy names for the endpoint body.
 *
 * // why: closed set — `competent` (default) and `random` are the only policies
 * this packet ships (no tuned difficulty tiers in v1, DESIGN §10).
 */
const VALID_POLICY_NAMES = ['competent', 'random'];

/**
 * Per-match lifetime cap on how many times restart revival will re-register a
 * driver for a still-live faulted/exhausted match.
 *
 * // why: WP-414 / D-24230 — restart revival re-attaches a faulted/exhausted
 * driver that a server restart lost, but a genuinely-wedged match must not
 * re-register a doomed driver on every deploy. After MAX_REVIVALS revivals the
 * row is excluded from the revival set and stays `faulted`, so it settles to a
 * surfaced fault (the bot-ally-status endpoint + WP-415 banner) instead of
 * looping forever. 3 is generous headroom for transient losses without masking a
 * permanent wedge.
 */
export const MAX_REVIVALS = 3;

/**
 * Validates the create-with-bot request body. Pure — no I/O — so it is unit
 * testable and the handler stays thin.
 *
 * @param {unknown} rawBody - The parsed request body.
 * @returns {{ ok: true, value: { numPlayers: number, botCount: number, policy: string, setupData: object } } | { ok: false, error: string }}
 */
export function validateCreateWithBotBody(rawBody) {
  const body = (rawBody ?? {});
  const numPlayers = body.numPlayers;
  if (!Number.isInteger(numPlayers) || numPlayers < 2 || numPlayers > 5) {
    return {
      ok: false,
      error:
        'The "numPlayers" field is required and must be an integer from 2 to 5 ' +
        'for a bot-ally match (a solo match has no seat for a bot ally).',
    };
  }
  const botCount = body.botCount;
  if (!Number.isInteger(botCount) || botCount < 1 || botCount > numPlayers - 1) {
    return {
      ok: false,
      error:
        `The "botCount" field is required and must be an integer from 1 to ` +
        `${numPlayers - 1} (at least one seat must be left open for the human, ` +
        'so botCount must be strictly less than numPlayers).',
    };
  }
  if (typeof body.policy !== 'string' || !VALID_POLICY_NAMES.includes(body.policy)) {
    return {
      ok: false,
      error:
        'The "policy" field is required and must be either "competent" or ' +
        '"random".',
    };
  }
  if (body.setupData === null || typeof body.setupData !== 'object') {
    return {
      ok: false,
      error:
        'The "setupData" field is required and must be the match composition ' +
        'object (the 9-field MatchSetupConfig) the game server validates at setup.',
    };
  }
  return {
    ok: true,
    value: {
      numPlayers,
      botCount,
      policy: body.policy,
      setupData: body.setupData,
    },
  };
}

/**
 * Maps a session-validation failure code to its HTTP status: 500 for operator
 * faults, 401 otherwise (mirrors the WP-307 match-gate mapping so an
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

// why: boardgame.io installs koa-body ONLY on its own /games/* routes — there
// is no global body parser — so this guarded route parses its own JSON body
// (mirrors matchGate.routes.ts). Applied only when a real Node request stream
// is present, so the unit-test fake context (which injects request.body
// directly) short-circuits it.
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
 * Submits a single move for one seat via boardgame.io's Master (in-process,
 * server-authoritative). Mirrors autoplay's submit path.
 *
 * @param {object} params - Move + framework parameters.
 * @returns {Promise<unknown>}
 */
async function submitBotMove({
  processedGame,
  db,
  transport,
  auth,
  matchId,
  seat,
  credentials,
  moveName,
  moveArgs,
}) {
  const { state } = await db.fetch(matchId, { state: true });
  if (!state) {
    return { error: 'match not found' };
  }
  const action = {
    type: MAKE_MOVE,
    payload: {
      type: moveName,
      args: moveArgs !== undefined ? [moveArgs] : [],
      credentials,
      playerID: seat,
    },
  };
  const transportAPI = {
    send() {},
    sendAll(payload) {
      transport.pubSub.publish(`MATCH-${matchId}`, payload);
    },
  };
  const master = new Master(processedGame, db, transportAPI, auth);
  return master.onUpdate(action, state._stateID, matchId, seat);
}

/**
 * Inserts (or re-stamps) the bot-ally metadata row for a match. The
 * non-empty `bot_seats` tag is the durable signal WP-377's ranked guard reads.
 *
 * @param {object} database - The pg pool.
 * @param {string} matchId - The match id.
 * @param {ReadonlyArray<string>} botSeats - The bot seat ids.
 * @param {string} decisionSeed - The bot's own decision seed.
 * @param {string} policy - The policy name.
 * @returns {Promise<void>}
 */
async function insertBotAllyMatch(database, matchId, botSeats, decisionSeed, policy) {
  // why: botSeats tag write — this row (non-empty bot_seats) is the durable
  // Casual-never-ranked signal EC-406/WP-377 consumes (DESIGN §5b/§5c). It is
  // written at creation, BEFORE the match starts, and persists for the match's
  // lifetime (only its status field changes on teardown).
  await database.query(
    'INSERT INTO legendary.match_bot_ally ' +
      '(match_id, bot_seats, decision_seed, policy, status) ' +
      'VALUES ($1, $2, $3, $4, $5) ' +
      'ON CONFLICT (match_id) DO UPDATE SET ' +
      'bot_seats = EXCLUDED.bot_seats, decision_seed = EXCLUDED.decision_seed, ' +
      'policy = EXCLUDED.policy, status = EXCLUDED.status, updated_at = now()',
    [matchId, botSeats, decisionSeed, policy, 'active'],
  );
}

/**
 * Updates a bot-ally match's status (and fault message) on driver teardown.
 * The `bot_seats` row itself is never deleted — only its status advances.
 *
 * @param {object} database - The pg pool.
 * @param {string} matchId - The match id.
 * @param {string} status - The terminal status.
 * @param {string | undefined} faultMessage - The public-safe fault message, if any.
 * @returns {Promise<void>}
 */
async function updateBotAllyMatchStatus(database, matchId, status, faultMessage) {
  await database.query(
    'UPDATE legendary.match_bot_ally ' +
      'SET status = $2, fault_message = $3, updated_at = now() WHERE match_id = $1',
    [matchId, status, faultMessage ?? null],
  );
}

/**
 * Reads the bot-ally match records eligible for restart re-registration: every
 * still-`active` row PLUS every still-under-cap `faulted`/`exhausted` row.
 *
 * // why: WP-414 / D-24230 — the revival set widened beyond `status = 'active'`
 * because a faulted/exhausted driver LOST to a server restart (its in-memory
 * driver gone) must be revived, not left frozen. The `revive_count < MAX_REVIVALS`
 * bound keeps a permanently-wedged match from re-registering a doomed driver on
 * every deploy — a capped row is excluded here and stays as-is.
 *
 * // why (2026-07-23 hotfix): the cap now covers `active` rows too, not just
 * faulted/exhausted. An `active` row that never reaches a terminal status —
 * because its driver's teardown write kept failing (tonight's read-only DB
 * chaos left match `atcewRhk_cA` stuck `active`) — was re-registered on EVERY
 * boot with NO cap. On a memory-tight instance that resurrected driver's polling
 * OOM-killed the process ~2 min in, BEFORE the driver's 20-min idle timeout
 * could tear it down, so it resurrected next boot → a restart loop. Capping
 * every status at `revive_count < MAX_REVIVALS` guarantees a stuck match stops
 * being re-registered after a bounded number of restarts. A healthy match only
 * hits the cap if it spans MAX_REVIVALS server restarts — rare, and preferable
 * to an unbounded resurrection loop.
 *
 * // why (WP-420 / D-24240): the revival set ALSO includes any row a graceful
 * shutdown marked `shutdown_interrupted = true`, REGARDLESS of the cap. A match
 * that was healthy and being driven when a clean deploy (SIGTERM) destroyed its
 * in-process driver is recoverable — it burns the cap across restarts without ever
 * completing a turn, so without this it would strand→faulted (WP-419). The flag is
 * cleared on revival (see {@link markBotAllyMatchRevived}), so it is a one-boot
 * exemption. An UNgraceful loss (OOM / crash — no SIGTERM, so the flag stays false)
 * is never included past the cap, so the OOM restart loop above cannot return.
 *
 * @param {object} database - The pg pool.
 * @returns {Promise<Array<{ matchId: string, botSeats: string[], decisionSeed: string, policy: string, status: string, reviveCount: number, shutdownInterrupted: boolean }>>}
 */
export async function readRevivableBotAllyMatches(database) {
  const result = await database.query(
    'SELECT match_id, bot_seats, decision_seed, policy, status, revive_count, shutdown_interrupted ' +
      'FROM legendary.match_bot_ally ' +
      "WHERE status IN ('active', 'faulted', 'exhausted') " +
      'AND (revive_count < $1 OR shutdown_interrupted = true)',
    [MAX_REVIVALS],
  );
  return result.rows.map((row) => ({
    matchId: row.match_id,
    botSeats: row.bot_seats,
    decisionSeed: row.decision_seed,
    policy: row.policy,
    status: row.status,
    reviveCount: row.revive_count,
    shutdownInterrupted: row.shutdown_interrupted === true,
  }));
}

/**
 * Reads still-`active` rows that are PAST the revival cap — the stranded set.
 *
 * // why: WP-419 / D-24239 — a match that keeps losing its in-process driver
 * before completing a single bot turn burns all MAX_REVIVALS revivals (the
 * driver's reset-on-first-turn never fires), then {@link readRevivableBotAllyMatches}
 * excludes it (`revive_count < MAX_REVIVALS`). It is then never revived AGAIN yet
 * stays `active` — the worst state: un-revived and, before the liveness fix,
 * un-surfaced (it reported driving:true forever). This reads exactly that
 * stranded set so `rehydrateBotAllyDrivers` can settle each to a surfaced
 * terminal status. `exhausted` rows are NOT included — they hit the 400-turn cap
 * (a long game, not a fault) and already report driving:false.
 *
 * @param {object} database - The pg pool.
 * @returns {Promise<Array<{ matchId: string, botSeats: string[] }>>}
 */
export async function readStrandedActiveBotAllyMatches(database) {
  const result = await database.query(
    'SELECT match_id, bot_seats FROM legendary.match_bot_ally ' +
      "WHERE status = 'active' AND revive_count >= $1",
    [MAX_REVIVALS],
  );
  return result.rows.map((row) => ({
    matchId: row.match_id,
    botSeats: row.bot_seats,
  }));
}

/**
 * Flips a revived match back to `active` and increments its lifetime
 * `revive_count` in a single update.
 *
 * // why: WP-414 / D-24230 + the 2026-07-23 hotfix — called on EVERY
 * re-registration (see `rehydrateBotAllyDrivers`), so the bounded revival cap
 * advances by exactly one per restart, including an already-`active` row (a stuck
 * active match must not resurrect uncapped forever).
 *
 * // why: WP-420 / D-24240 — this ALSO clears `shutdown_interrupted`, so a
 * deploy-marked row earns exactly ONE past-cap revival (a one-boot exemption); the
 * next loss must be cleanly marked again to be free-revived. Clearing it for a
 * not-flagged row is a harmless no-op (it was already false).
 *
 * @param {object} database - The pg pool.
 * @param {string} matchId - The match id.
 * @returns {Promise<void>}
 */
async function markBotAllyMatchRevived(database, matchId) {
  await database.query(
    'UPDATE legendary.match_bot_ally ' +
      "SET status = 'active', revive_count = revive_count + 1, " +
      'shutdown_interrupted = false, updated_at = now() ' +
      'WHERE match_id = $1',
    [matchId],
  );
}

/**
 * Marks the given matches as cleanly interrupted by a graceful shutdown, so boot
 * revival re-attaches them past the `MAX_REVIVALS` cap (WP-420 / D-24240).
 *
 * // why: called from the `index.mjs` SIGTERM handler with the ids currently in
 * `botAllyDrivers` — exactly the matches this process was ACTIVELY driving when a
 * clean deploy arrived. A wedged match has already faulted and left the registry,
 * so it is never marked; an OOM / crash sends no SIGTERM, so it is never marked
 * either. Only a healthy, actively-driven match earns the past-cap revival — this
 * is what keeps the OOM restart loop from returning. A single batch UPDATE; an
 * empty id list is a no-op (no query).
 *
 * @param {object} database - The pg pool.
 * @param {ReadonlyArray<string>} matchIds - The match ids being driven at shutdown.
 * @returns {Promise<void>}
 */
export async function markInProgressBotAllyMatchesInterrupted(database, matchIds) {
  if (matchIds.length === 0) {
    return;
  }
  await database.query(
    'UPDATE legendary.match_bot_ally ' +
      'SET shutdown_interrupted = true, updated_at = now() ' +
      'WHERE match_id = ANY($1)',
    [Array.from(matchIds)],
  );
}

/**
 * Clears a match's lifetime `revive_count` back to 0.
 *
 * // why: WP-414 / D-24233 — called by the driver after a REVIVED match completes
 * its first bot turn (proof it is still drivable), so repeated
 * Postgres-instability restarts of a healthy match do not accumulate toward the
 * D-24230 revival cap and strand it as permanently `faulted`. The `revive_count
 * <> 0` guard makes it a true no-op when nothing needs clearing.
 *
 * @param {object} database - The pg pool.
 * @param {string} matchId - The match id.
 * @returns {Promise<void>}
 */
async function resetBotAllyRevivalCount(database, matchId) {
  await database.query(
    'UPDATE legendary.match_bot_ally ' +
      'SET revive_count = 0, updated_at = now() ' +
      'WHERE match_id = $1 AND revive_count <> 0',
    [matchId],
  );
}

/**
 * Reads a single match's bot-ally status row for the read-only status surface.
 * Reads ONLY the side-table — never the bgio blob, never `G`/`ctx`.
 *
 * @param {object} database - The pg pool.
 * @param {string} matchId - The match id.
 * @returns {Promise<{ status: string, faultMessage: string | null } | null>} the
 *   row's status + fault message, or null when there is no row (not a bot-ally match).
 */
async function readBotAllyStatusRow(database, matchId) {
  const result = await database.query(
    'SELECT status, fault_message FROM legendary.match_bot_ally WHERE match_id = $1',
    [matchId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return {
    status: result.rows[0].status,
    faultMessage: result.rows[0].fault_message,
  };
}

/**
 * Reads each bot seat's credential from a boardgame.io match metadata blob so a
 * re-registered driver can submit that seat's moves after a restart.
 *
 * // why: the bot-seat credentials captured at join live only in the original
 * request's memory; on restart they must be re-read from the persisted match
 * metadata (the framework store's own metadata surface — not a raw `G` blob
 * read). Returns null when any bot seat's credential is missing so the caller
 * skips (rather than half-drives) that match.
 *
 * @param {object | null | undefined} metadata - The bgio match metadata.
 * @param {ReadonlyArray<string>} botSeats - The bot seat ids.
 * @returns {Record<string, string> | null}
 */
export function readBotSeatCredentials(metadata, botSeats) {
  if (metadata === null || metadata === undefined || metadata.players === undefined) {
    return null;
  }
  const credentials = {};
  for (const seat of botSeats) {
    const seatMeta = metadata.players[seat];
    if (seatMeta === undefined || typeof seatMeta.credentials !== 'string') {
      return null;
    }
    credentials[seat] = seatMeta.credentials;
  }
  return credentials;
}

/**
 * Resolves the move-submission factory for a context: a `(matchId, credentials)
 * → ({ seat, moveName, moveArgs }) => Promise` factory. Production uses the
 * real boardgame.io Master; a test may inject `context.createSubmit` to observe
 * dispatches without a live match store.
 *
 * @param {object} context - Server context.
 * @param {object} processedGame - The processed game config.
 * @returns {(matchId: string, credentials: Record<string, string>) => (move: object) => Promise<unknown>}
 */
function resolveCreateSubmit(context, processedGame) {
  if (typeof context.createSubmit === 'function') {
    return context.createSubmit;
  }
  const { db, transport, auth } = context;
  return (matchId, credentials) => ({ seat, moveName, moveArgs }) =>
    submitBotMove({
      processedGame,
      db,
      transport,
      auth,
      matchId,
      seat,
      credentials: credentials[seat],
      moveName,
      moveArgs,
    });
}

/**
 * Builds the injected driver dependencies + starts a per-match bot-ally driver.
 * Shared by the create handler and the boot re-registration path.
 *
 * @param {object} params
 * @param {string} params.matchId - The match id.
 * @param {ReadonlyArray<string>} params.botSeats - The bot seat ids.
 * @param {string} params.decisionSeed - The bot decision seed.
 * @param {string} params.policyName - The policy name (`competent`/`random`).
 * @param {(move: object) => Promise<unknown>} params.submit - The bound
 *   move-submission closure for this match's bot seats.
 * @param {object} params.context - Server context (db, database).
 * @param {number} [params.initialReviveCount=0] - The match's current side-table
 *   `revive_count` (WP-414 / D-24233). A revived match (> 0) has its count reset
 *   to 0 after the driver's first successful bot turn; a fresh create passes 0.
 * @returns {object} The started driver.
 */
function startDriverForMatch({ matchId, botSeats, decisionSeed, policyName, submit, context, initialReviveCount }) {
  const { db, database } = context;
  const policy = buildBotPolicy(decisionSeed, policyName);
  const deps = {
    fetchState: async (id) => {
      const { state } = await db.fetch(id, { state: true });
      return state ?? null;
    },
    submitMove: submit,
    persistStatus: (id, status, faultMessage) =>
      updateBotAllyMatchStatus(database, id, status, faultMessage),
    // why: WP-414 / D-24233 — the driver calls this after a revived match's first
    // successful turn to clear the lifetime revival count (see maybeResetRevivalCount).
    resetRevivalCount: (id) => resetBotAllyRevivalCount(database, id),
    decide: (state, seat) => decideBotMove(state, seat, policy),
  };
  return createBotAllyDriver({ matchId, botSeats, deps, initialReviveCount });
}

/**
 * Registers `POST /api/match/create-with-bot` on the boardgame.io Koa router.
 *
 * @param {import('@koa/router')} router - The boardgame.io server's koa router.
 * @param {object} context - Server context.
 * @param {object} context.db - boardgame.io storage backend.
 * @param {object} context.transport - boardgame.io SocketIO transport.
 * @param {object} context.auth - boardgame.io Auth instance.
 * @param {string} context.serverUrl - Loopback origin for native lobby calls.
 * @param {string} context.internalDelegationSecret - The WP-308 native-lobby secret.
 * @param {object} context.database - The long-lived pg pool.
 * @param {Function} context.requireAuthenticatedSession - The WP-112 session check.
 * @param {object} [context.verifier] - Hanko verifier (undefined in dev-mode).
 * @param {object} [context.accountResolver] - Account resolver.
 */
export function registerBotAllyRoutes(router, context) {
  const {
    serverUrl,
    internalDelegationSecret,
    database,
    requireAuthenticatedSession,
    verifier,
    accountResolver,
  } = context;

  const processedGame = ProcessGameConfig(LegendaryGame);
  const createSubmit = resolveCreateSubmit(context, processedGame);

  router.post('/api/match/create-with-bot', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');

    // why: authenticated-session-required — a bot-ally match is owned by a
    // signed-in human (the same gate as /api/match/create). Run the session
    // check as the first business-logic step; reject before any match work.
    const sessionResult = await requireAuthenticatedSession(koaContext.req, {
      verifier,
      accountResolver,
      database,
    });
    if (sessionResult.ok !== true) {
      koaContext.status = statusForSessionValidationCode(sessionResult.code);
      koaContext.body = {
        error:
          'A signed-in account is required to start a match with a bot ally; ' +
          `the session could not be validated (reason code: ${sessionResult.code}). ` +
          'Sign in and try again.',
      };
      return;
    }

    await ensureJsonBodyParsed(koaContext);
    const validation = validateCreateWithBotBody(koaContext.request.body);
    if (!validation.ok) {
      koaContext.status = 400;
      koaContext.body = { error: validation.error };
      return;
    }
    const { numPlayers, botCount, policy, setupData } = validation.value;

    try {
      // Step 1: create the match (loopback native create, secret header).
      const createResponse = await fetch(`${serverUrl}/games/legendary-arena/create`, {
        method: 'POST',
        // why: WP-308 / D-24094 — carry the internal-delegation secret so the
        // native-lobby hard gate admits this loopback create.
        headers: {
          'Content-Type': 'application/json',
          [INTERNAL_DELEGATION_HEADER]: internalDelegationSecret,
        },
        body: JSON.stringify({ numPlayers, setupData }),
      });
      if (!createResponse.ok) {
        const nativeErrorBody = await createResponse.text();
        koaContext.status = createResponse.status;
        koaContext.body = {
          error:
            `The bot-ally match could not be created by the game server ` +
            `(it responded HTTP ${createResponse.status}: ${nativeErrorBody}). ` +
            'Check the match configuration and try again.',
        };
        return;
      }
      const createResult = await createResponse.json();
      const matchId = createResult.matchID;

      // Step 2: secret-join ONLY the bot seats "1"…"botCount"; capture each
      // seat's credential. Seat 0 is NEVER joined here.
      // why: seat 0 stays open for the human, who joins it through the authed
      // /api/match/join (WP-376) so seat 0 gets its own match_seat_accounts row
      // + credential hand-off; the server joining seat 0 would break that
      // seat→account mapping (attribution + ranked eligibility).
      const botSeats = [];
      const credentials = {};
      for (let seatIndex = 1; seatIndex <= botCount; seatIndex++) {
        const seat = String(seatIndex);
        const joinResponse = await fetch(
          `${serverUrl}/games/legendary-arena/${matchId}/join`,
          {
            method: 'POST',
            // why: WP-308 / D-24094 — the internal-delegation secret admits each
            // bot join. The bot seat is NEVER written to match_seat_accounts
            // (D-24120): a bot has no session and must stay absent from that
            // table, which is load-bearing for WP-377's ranked guard (a rowless
            // seat must not count toward the roster).
            headers: {
              'Content-Type': 'application/json',
              [INTERNAL_DELEGATION_HEADER]: internalDelegationSecret,
            },
            body: JSON.stringify({ playerID: seat, playerName: `Bot Ally ${seatIndex}` }),
          },
        );
        if (!joinResponse.ok) {
          const nativeErrorBody = await joinResponse.text();
          koaContext.status = joinResponse.status;
          koaContext.body = {
            error:
              `A bot ally seat could not be joined on the game server ` +
              `(it responded HTTP ${joinResponse.status}: ${nativeErrorBody}). ` +
              'Please try again.',
          };
          return;
        }
        const joinResult = await joinResponse.json();
        botSeats.push(seat);
        credentials[seat] = joinResult.playerCredentials;
      }

      // Step 3: persist the botSeats tag + register + start the driver. The
      // decision seed is the match id — deterministic, unique, and clock-free
      // (no Date.now), so a bot-ally match is reproducible.
      const decisionSeed = matchId;
      await insertBotAllyMatch(database, matchId, botSeats, decisionSeed, policy);
      const submit = createSubmit(matchId, credentials);
      startDriverForMatch({
        matchId,
        botSeats,
        decisionSeed,
        policyName: policy,
        submit,
        context,
      });

      // Step 4: auto-ready each bot seat. The endpoint MUST NOT start the match
      // itself.
      // why: the human readying seat 0 is what reaches readyCount ===
      // requiredPlayers and starts the match (lobby.validate.ts:63). Bot seats
      // are readied here (before the human arrives) so, once seat 0 readies,
      // the match starts immediately and the human never sees "1 of 2". Ready is
      // dispatched as each bot playerID (setPlayerReady keys off the dispatching
      // seat, not ctx.currentPlayer — lobby.moves.ts:37).
      for (const seat of botSeats) {
        await submit({ seat, moveName: 'setPlayerReady', moveArgs: { ready: true } });
      }

      koaContext.status = 200;
      koaContext.body = { matchId };
    } catch (faultError) {
      koaContext.status = 500;
      koaContext.body = {
        error:
          'The bot-ally match could not be created because of an unexpected ' +
          'server error. Please retry in a moment.',
      };
      console.error(`[bot-ally] create-with-bot failed unexpectedly: ${faultError.message}`);
    }
  });

  // why: guest — the unguessable matchId is the capability, so the play surface
  // (WP-415) can poll a match's bot-ally status without a session; the response
  // carries only { driving, status, message } — never identity, G, ctx, or seat
  // credentials. why side-table-only: the human-facing status is derived
  // entirely from legendary.match_bot_ally; this route NEVER reads the bgio blob
  // and never inspects G/ctx (D-24095 store-only discipline).
  router.get('/api/match/:matchId/bot-ally-status', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    const matchId = koaContext.params.matchId;
    try {
      const row = await readBotAllyStatusRow(database, matchId);
      if (row === null) {
        // why: absent (200, not 404) — there is no bot-ally row, so this is not
        // a bot-ally match; WP-415 shows nothing. A rowless match is a normal
        // read, not an error, so it must not be a 4xx.
        koaContext.status = 200;
        koaContext.body = { driving: false, status: 'absent', message: null };
        return;
      }
      // why: fault_message is surfaced VERBATIM — it is already the public-safe,
      // co-op-framed sentence the driver persisted (WP-261 / D-24037); the route
      // never re-decorates it with an exception, id, or path. It is carried only
      // when the status is `faulted`; every other status has no message.
      //
      // why: WP-419 / D-24239 — `driving` is LIVENESS-aware: it is true only when
      // the row is `active` AND a live in-process driver actually exists for this
      // match. The side-table `active` flag alone is NOT proof the bot is driving:
      // `active` is the CREATION status, and a redeploy that destroys the
      // in-process driver leaves the row `active` with nobody driving it. Deriving
      // `driving` from the flag alone reported that dead-but-active match as
      // healthy, so the WP-415 stall banner (which needs driving:false) never
      // showed and the human sat frozen on the bot's turn with no signal — the
      // reported "froze again". `botAllyDrivers` is this process's live-driver
      // registry (set on create/revive, deleted on EVERY teardown), so `.has` is
      // the liveness signal. Single-instance deployment assumed — the status route
      // and the driver run in the same process; a DB heartbeat would be the
      // multi-instance answer.
      koaContext.status = 200;
      koaContext.body = {
        driving: row.status === 'active' && botAllyDrivers.has(matchId),
        status: row.status,
        message: row.status === 'faulted' ? row.faultMessage : null,
      };
    } catch (statusError) {
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
      console.error(
        `[bot-ally] bot-ally-status read failed for match ${matchId}: ${statusError.message}`,
      );
    }
  });
}

/**
 * Re-registers a bot-ally driver for every still-active match after a server
 * restart (D-24170 restart policy). In-memory drivers are lost on restart; this
 * scans the side-table, re-reads each bot seat's credential from the persisted
 * match metadata, and re-attaches a driver to any match that is not yet
 * terminal — so a bot-ally match survives a deploy instead of freezing.
 *
 * Best-effort and fully guarded: any per-match failure is logged and skipped so
 * one bad row never blocks startup.
 *
 * @param {object} context - Server context (db, transport, auth, database).
 * @returns {Promise<void>}
 */
export async function rehydrateBotAllyDrivers(context) {
  const { db, database } = context;
  let revivableMatches;
  try {
    revivableMatches = await readRevivableBotAllyMatches(database);
  } catch (readError) {
    console.error(
      `[bot-ally] could not read revivable bot-ally matches for re-registration: ${readError.message}`,
    );
    return;
  }

  const processedGame = ProcessGameConfig(LegendaryGame);
  const createSubmit = resolveCreateSubmit(context, processedGame);
  let reregistered = 0;
  for (const record of revivableMatches) {
    try {
      const { state } = await db.fetch(record.matchId, { state: true });
      if (!state || state.ctx.gameover !== undefined) {
        // why: the match is gone from the store or already finished — mark it
        // completed so it is not scanned again, and skip re-registration. A
        // faulted match whose game already ended is NEVER revived (D-24230).
        await updateBotAllyMatchStatus(database, record.matchId, 'completed', undefined);
        continue;
      }
      const { metadata } = await db.fetch(record.matchId, { metadata: true });
      const credentials = readBotSeatCredentials(metadata, record.botSeats);
      if (credentials === null) {
        console.warn(
          `[bot-ally] match ${record.matchId} could not be re-registered: bot-seat credentials were not found in match metadata.`,
        );
        continue;
      }
      startDriverForMatch({
        matchId: record.matchId,
        botSeats: record.botSeats,
        decisionSeed: record.decisionSeed,
        policyName: record.policy,
        submit: createSubmit(record.matchId, credentials),
        context,
        // why: WP-414 / D-24233 — every re-registration increments revive_count
        // (see markBotAllyMatchRevived below), so this driver's effective count is
        // record.reviveCount + 1. Pass it so the driver resets the count to 0 after
        // its first successful turn: a match that keeps driving fine across restarts
        // never accumulates toward the D-24230 cap and cannot be stranded.
        initialReviveCount: record.reviveCount + 1,
      });
      // why: WP-414 / D-24230 + 2026-07-23 hotfix — EVERY re-registration now
      // consumes one revival (flip to `active` + increment revive_count),
      // including a row that was already `active`. Previously an active row was
      // re-registered without incrementing, so a stuck `active` match (whose
      // teardown write never landed) resurrected UNCAPPED every boot and drove a
      // restart loop on a memory-tight instance. Counting active re-registrations
      // means the `readRevivableBotAllyMatches` cap eventually excludes a match
      // that never makes it to a terminal status.
      await markBotAllyMatchRevived(database, record.matchId);
      reregistered += 1;
      // why: WP-420 / D-24240 — a shutdown_interrupted row was revived PAST the
      // cap (a clean deploy interrupted a healthy match); log it distinctly so a
      // deploy-recovery is visible in the operational log and its flag-clear
      // (in markBotAllyMatchRevived) is traceable.
      if (record.shutdownInterrupted === true) {
        console.log(
          `[bot-ally] match ${record.matchId} recovered past the revival cap after a clean shutdown (deploy-interrupted).`,
        );
      }
    } catch (rehydrateError) {
      console.error(
        `[bot-ally] match ${record.matchId} failed to re-register after restart: ${rehydrateError.message}`,
      );
    }
  }
  if (reregistered > 0) {
    console.log(`[bot-ally] re-registered ${reregistered} in-flight bot-ally match driver(s) after restart.`);
  }

  await settleStrandedActiveMatches(context);
}

/**
 * Settles every still-`active` match that is past the revival cap to a surfaced
 * terminal status (WP-419 / D-24239). Runs after the revival pass in
 * {@link rehydrateBotAllyDrivers}.
 *
 * // why: a stranded `active` row (cap-exhausted, never revived again) reports
 * driving:true forever — a silent freeze. Flip it to `faulted` (surfaced with the
 * public-safe co-op message) so the WP-415 banner shows, or to `completed` when
 * its game already ended. A row that this boot's revival just re-registered is
 * skipped via the live-driver guard: it genuinely has a driver, so it is not
 * stranded even if its incremented count now reads at the cap. Best-effort and
 * fully guarded — one bad row never blocks startup.
 *
 * @param {object} context - Server context (db, database).
 * @returns {Promise<void>}
 */
async function settleStrandedActiveMatches(context) {
  const { db, database } = context;
  let strandedMatches;
  try {
    strandedMatches = await readStrandedActiveBotAllyMatches(database);
  } catch (readError) {
    console.error(
      `[bot-ally] could not read stranded active bot-ally matches to settle: ${readError.message}`,
    );
    return;
  }

  let settled = 0;
  for (const record of strandedMatches) {
    // why: skip a match that THIS boot's revival just re-registered — it has a
    // live driver (so it is not actually stranded), even though its incremented
    // revive_count now reads at the cap.
    if (botAllyDrivers.has(record.matchId)) {
      continue;
    }
    try {
      const { state } = await db.fetch(record.matchId, { state: true });
      // why: a stranded match whose game already ended is `completed`, not
      // `faulted` — the fault framing is only for a match stopped mid-play.
      const isEnded = !state || state.ctx.gameover !== undefined;
      const terminalStatus = isEnded ? 'completed' : 'faulted';
      const faultMessage = isEnded ? undefined : BOT_FAULTED_MESSAGE;
      await updateBotAllyMatchStatus(database, record.matchId, terminalStatus, faultMessage);
      settled += 1;
    } catch (settleError) {
      console.error(
        `[bot-ally] match ${record.matchId} failed to settle a stranded active row: ${settleError.message}`,
      );
    }
  }
  if (settled > 0) {
    console.log(`[bot-ally] settled ${settled} stranded active bot-ally match(es) to a surfaced terminal status.`);
  }
}
