/**
 * Multiplayer-Play Authentication Gate — Server Layer (WP-307)
 *
 * Registers two guarded HTTP endpoints that sit in front of the
 * boardgame.io native lobby:
 *
 *   * `POST /api/match/create` — authenticated; delegates to the native
 *     lobby create and returns `{ matchID }`.
 *   * `POST /api/match/join`   — authenticated; delegates to the native
 *     lobby join and returns `{ playerCredentials }`.
 *
 * Each handler runs the authenticated-session check as the FIRST
 * business-logic step; an absent or invalid session returns HTTP 401 with
 * a full-sentence `{ error }` body. On success the handler is a thin proxy
 * — it makes a server-internal (loopback) request to the native lobby,
 * mirroring the WP-163/164 autoplay precedent, and returns the result. It
 * contains NO game logic (server wires, engine decides — D-24093).
 *
 * SOFT-GATE LIMITATION (D-24093, D-24092): the native
 * `/games/legendary-arena/*` create/join routes remain open, so this gate
 * enforces the official arena-client path only — a raw request to the
 * native routes bypasses it. This is the accepted v1 posture: it drives
 * account creation for normal UI users. A hard, unbypassable gate is a
 * documented follow-up, not this WP.
 *
 * Layer-boundary contract: this module imports nothing from
 * `boardgame.io`, `@legendary-arena/game-engine`,
 * `@legendary-arena/registry`, `@legendary-arena/preplan`, or any UI /
 * client package. The authenticated-session provider, `verifier`, and
 * `accountResolver` are caller-injected (WP-104 / WP-109 / WP-115
 * pattern); `serverUrl` is the in-process loopback origin.
 *
 * Authority: WP-307; EC-337; D-24092 (policy); D-24093 (mechanism +
 * soft-gate limitation); D-11202 (bearer header); D-11204 (fail-closed
 * unconfigured default).
 */

import type {
  AccountResolver,
  DatabaseClient,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';
import { INTERNAL_DELEGATION_HEADER } from './nativeLobbyGuard.js';
import { recordSeatAccount } from './seatAccount.logic.js';
import type { AccountId } from '../identity/identity.types.js';
import koaBody from 'koa-body';

/**
 * Closed-set re-statement of the orchestrator's session-validation result
 * codes. Declared locally so this module does not couple to the teams
 * feature's re-export; the codes match the WP-112 orchestrator verbatim.
 */
type SessionValidationCode =
  | 'missing_token'
  | 'invalid_token'
  | 'expired_token'
  | 'unknown_account'
  | 'session_verifier_not_configured'
  | 'lookup_failed';

type RequireAuthenticatedSessionResult =
  | { ok: true; value: string }
  | { ok: false; reason: string; code: SessionValidationCode };

/**
 * Caller-injected dependency bundle for {@link registerMatchGateRoutes}.
 * The authenticated-session provider is the WP-112 orchestrator (or a test
 * fake); `verifier` and `accountResolver` are the broker-specific
 * implementations threaded through to it. `serverUrl` is the server's own
 * loopback origin used to reach the native lobby.
 */
export interface MatchGateDependencies {
  readonly requireAuthenticatedSession: (
    req: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<RequireAuthenticatedSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
  // why: the server-internal origin (e.g. http://localhost:8000) the
  // guarded handler calls to reach the boardgame.io native lobby. This is
  // a same-process loopback request — mirroring the autoplay precedent —
  // never a public egress.
  readonly serverUrl: string;
  // why: WP-308 / D-24094 — the process-local secret the native-lobby guard
  // requires on its two POST create/join routes. This loopback delegation
  // attaches it so the hard gate admits the server-internal call while
  // rejecting external unauthenticated callers.
  readonly internalDelegationSecret: string;
}

/**
 * Minimal structural shape of the Koa context surface this module reads.
 * Mirrors the WP-104 / WP-109 local-interface precedent so the module does
 * not need a direct `@koa/router` dependency.
 */
interface KoaMatchGateContext {
  readonly req: SessionTokenRequest;
  request: { body?: unknown };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

/**
 * Minimal structural shape of the Koa router surface this module uses —
 * only `post`, matching the two registration sites below.
 */
interface KoaRouter {
  post(
    path: string,
    handler: (koaContext: KoaMatchGateContext) => Promise<void> | void,
  ): unknown;
}

/**
 * Map a session-validation code to its HTTP status. Operator-facing
 * failures (`session_verifier_not_configured`, `lookup_failed`) return
 * 500; every other code returns 401. Mirrors the WP-109 mapping so an
 * account-existence probe cannot distinguish a missing account from an
 * unauthenticated request.
 *
 * @param code The orchestrator's session-validation failure code.
 * @returns The HTTP status to return.
 */
function statusForSessionValidationCode(code: SessionValidationCode): number {
  if (code === 'session_verifier_not_configured' || code === 'lookup_failed') {
    return 500;
  }
  return 401;
}

/**
 * Run the authenticated-session check and, on failure, set the response
 * status and a full-sentence error body. Returns the resolved server-verified
 * `AccountId` when the caller holds a valid session, or `null` otherwise (the
 * response is already populated). This is the FIRST business-logic step of
 * every guarded handler — the D-24092 gate. The join handler uses the returned
 * `AccountId` to record the seat→account mapping (WP-333); the create handler
 * only needs the non-`null` check.
 *
 * @param koaContext The request context.
 * @param database The pg pool the orchestrator uses to resolve the account.
 * @param deps The caller-injected dependency bundle.
 * @returns The server-verified `AccountId` if authenticated; `null` if rejected.
 */
async function resolveAuthenticatedAccountId(
  koaContext: KoaMatchGateContext,
  database: DatabaseClient,
  deps: MatchGateDependencies,
): Promise<AccountId | null> {
  const sessionResult = await deps.requireAuthenticatedSession(koaContext.req, {
    verifier: deps.verifier,
    accountResolver: deps.accountResolver,
    database,
  });
  if (sessionResult.ok === true) {
    // why: the orchestrator's `value` is the branded AccountId (= the account's
    // ext_id, D-5201); it is typed loosely as `string` on the local result
    // re-statement, so the brand is reapplied here at the single trust boundary.
    return sessionResult.value as AccountId;
  }
  koaContext.status = statusForSessionValidationCode(sessionResult.code);
  koaContext.body = {
    error:
      'A signed-in account is required to play a seat in a multiplayer match; ' +
      `the session could not be validated (reason code: ${sessionResult.code}). ` +
      'Sign in and try again.',
  };
  return null;
}

// why: boardgame.io installs koa-body ONLY on its own /games/* routes — there
// is no global body parser (same note as billing/sweep/handoff/inspection/
// analytics/autoplay) — so these guarded routes must parse their own JSON body.
// Without it, koaContext.request.body is undefined, the client's setupData is
// forwarded to the native lobby as undefined, and Game.setup rejects the create
// with "Missing setupData". This gap was latent: the unit tests inject
// request.body directly and the WP-307 live-verify only exercised the 401 paths.
const guardedRouteJsonBodyParser = koaBody();

/**
 * Parse the JSON request body into `koaContext.request.body` when a real Node
 * request stream is present. A no-op for the unit-test fake context (which
 * injects `request.body` directly and exposes no stream), so the same handler
 * works in production and under `node:test` — mirroring the billing/sweep
 * `parseCheckoutSessionJsonBody` test-friendly short-circuit.
 *
 * @param koaContext The guarded-route request context.
 */
async function ensureJsonBodyParsed(
  koaContext: KoaMatchGateContext,
): Promise<void> {
  const nodeRequest = koaContext.req as { on?: unknown };
  if (typeof nodeRequest.on !== 'function') {
    return;
  }
  await (
    guardedRouteJsonBodyParser as unknown as (
      koaContext: KoaMatchGateContext,
      next: () => Promise<void>,
    ) => Promise<void>
  )(koaContext, async () => {});
}

/**
 * Register the two guarded multiplayer-play endpoints on the Koa router.
 *
 * @param router The boardgame.io `Server({...}).router`.
 * @param database The long-lived pg pool (passed to the session check).
 * @param deps The caller-injected authenticated-session provider,
 *   broker bindings, and loopback `serverUrl`.
 */
export function registerMatchGateRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: MatchGateDependencies,
): void {
  // why: playing a seat requires a free account (D-24092). Authenticate
  // first, then delegate match creation to the native lobby over loopback
  // (the autoplay precedent). No game logic here — server wires, engine
  // decides.
  router.post('/api/match/create', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    // why: create only needs the authenticated/rejected verdict; it opens no
    // seat, so the resolved accountId is not used here (seat→account mapping is
    // recorded at join time — WP-333).
    if ((await resolveAuthenticatedAccountId(koaContext, database, deps)) === null) {
      return;
    }
    await ensureJsonBodyParsed(koaContext);

    const requestBody = (koaContext.request.body ?? {}) as {
      numPlayers?: unknown;
      setupData?: unknown;
    };

    try {
      const createResponse = await fetch(
        `${deps.serverUrl}/games/legendary-arena/create`,
        {
          method: 'POST',
          // why: WP-308 / D-24094 — carry the internal-delegation secret so the
          // native-lobby guard admits this loopback create; the header value is
          // never sent to a client and never logged.
          headers: {
            'Content-Type': 'application/json',
            [INTERNAL_DELEGATION_HEADER]: deps.internalDelegationSecret,
          },
          body: JSON.stringify({
            numPlayers: requestBody.numPlayers,
            setupData: requestBody.setupData,
          }),
        },
      );
      if (!createResponse.ok) {
        const nativeErrorBody = await createResponse.text();
        koaContext.status = createResponse.status;
        koaContext.body = {
          error:
            `The match could not be created by the game server ` +
            `(it responded HTTP ${createResponse.status}: ${nativeErrorBody}). ` +
            'Check the match configuration and try again.',
        };
        return;
      }
      const createResult = (await createResponse.json()) as { matchID: string };
      koaContext.status = 200;
      koaContext.body = { matchID: createResult.matchID };
    } catch (networkError) {
      koaContext.status = 502;
      koaContext.body = {
        error:
          'The match could not be created because the game server was ' +
          'unreachable. Please retry in a moment.',
      };
    }
  });

  // why: joining a playable seat is gated identically. `matchID` arrives in
  // the request body here (the native route carries it in the URL path);
  // the guarded endpoint keeps a single body-only contract for the client.
  router.post('/api/match/join', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    // why: capture the server-verified accountId — the join records the
    // seat→account mapping (WP-333) using this session value, never a
    // client-supplied field.
    const accountId = await resolveAuthenticatedAccountId(
      koaContext,
      database,
      deps,
    );
    if (accountId === null) {
      return;
    }
    await ensureJsonBodyParsed(koaContext);

    const requestBody = (koaContext.request.body ?? {}) as {
      matchID?: unknown;
      playerID?: unknown;
      playerName?: unknown;
    };
    const matchId =
      typeof requestBody.matchID === 'string' ? requestBody.matchID : '';
    if (matchId === '') {
      koaContext.status = 400;
      koaContext.body = {
        error:
          'The "matchID" field is required to join a match and must be a ' +
          'non-empty string.',
      };
      return;
    }

    try {
      const joinResponse = await fetch(
        `${deps.serverUrl}/games/legendary-arena/${matchId}/join`,
        {
          method: 'POST',
          // why: WP-308 / D-24094 — same internal-delegation secret as the
          // create call above; admits this loopback join past the hard gate.
          headers: {
            'Content-Type': 'application/json',
            [INTERNAL_DELEGATION_HEADER]: deps.internalDelegationSecret,
          },
          body: JSON.stringify({
            playerID: requestBody.playerID,
            playerName: requestBody.playerName,
          }),
        },
      );
      if (!joinResponse.ok) {
        const nativeErrorBody = await joinResponse.text();
        koaContext.status = joinResponse.status;
        koaContext.body = {
          error:
            `The seat could not be joined on the game server ` +
            `(it responded HTTP ${joinResponse.status}: ${nativeErrorBody}). ` +
            'The match may be full or no longer exist.',
        };
        return;
      }
      const joinResult = (await joinResponse.json()) as {
        playerCredentials: string;
      };
      koaContext.status = 200;
      koaContext.body = { playerCredentials: joinResult.playerCredentials };

      // why: WP-333 / D-24120 — record the server-verified accountId behind this
      // seat so the D-24119 capture step can attribute the finished match. This
      // runs only after the native join succeeded (the player is seated), and is
      // best-effort: a record failure is logged and swallowed (mirroring the
      // fire-and-forget issueTier1BadgesForSubmission precedent) so a bookkeeping
      // fault never turns a successful join into an error response. The playerID
      // is taken from the request body (the seat the client joined); when it is
      // absent the seat cannot be attributed, so the mapping is skipped with a
      // warning rather than guessed.
      const playerId =
        typeof requestBody.playerID === 'string' ? requestBody.playerID : '';
      if (playerId !== '') {
        try {
          await recordSeatAccount(matchId, playerId, accountId, database);
        } catch (seatRecordError) {
          console.error(
            `Failed to record the seat-to-account mapping for match ${matchId} ` +
              `seat ${playerId}; this seat's future competitive result may not be ` +
              'attributable. The join itself succeeded and the player is seated.',
            seatRecordError,
          );
        }
      } else {
        console.warn(
          `Join for match ${matchId} supplied no playerID, so the ` +
            'seat-to-account mapping was not recorded and this seat cannot be ' +
            'attributed to an account.',
        );
      }
    } catch (networkError) {
      koaContext.status = 502;
      koaContext.body = {
        error:
          'The seat could not be joined because the game server was ' +
          'unreachable. Please retry in a moment.',
      };
    }
  });
}
