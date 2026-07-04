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
 * status and a full-sentence error body. Returns `true` when the caller
 * holds a valid session, `false` otherwise (the response is already
 * populated). This is the FIRST business-logic step of every guarded
 * handler — the D-24092 gate.
 *
 * @param koaContext The request context.
 * @param database The pg pool the orchestrator uses to resolve the account.
 * @param deps The caller-injected dependency bundle.
 * @returns `true` if authenticated; `false` if the request was rejected.
 */
async function isRequestAuthenticated(
  koaContext: KoaMatchGateContext,
  database: DatabaseClient,
  deps: MatchGateDependencies,
): Promise<boolean> {
  const sessionResult = await deps.requireAuthenticatedSession(koaContext.req, {
    verifier: deps.verifier,
    accountResolver: deps.accountResolver,
    database,
  });
  if (sessionResult.ok === true) {
    return true;
  }
  koaContext.status = statusForSessionValidationCode(sessionResult.code);
  koaContext.body = {
    error:
      'A signed-in account is required to play a seat in a multiplayer match; ' +
      `the session could not be validated (reason code: ${sessionResult.code}). ` +
      'Sign in and try again.',
  };
  return false;
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
    if (!(await isRequestAuthenticated(koaContext, database, deps))) {
      return;
    }

    const requestBody = (koaContext.request.body ?? {}) as {
      numPlayers?: unknown;
      setupData?: unknown;
    };

    try {
      const createResponse = await fetch(
        `${deps.serverUrl}/games/legendary-arena/create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    if (!(await isRequestAuthenticated(koaContext, database, deps))) {
      return;
    }

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
          headers: { 'Content-Type': 'application/json' },
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
