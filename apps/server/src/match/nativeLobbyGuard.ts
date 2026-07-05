/**
 * Native-Lobby Hard Gate — Server Layer (WP-308)
 *
 * An app-layer Koa middleware that closes the WP-307 / D-24093 soft-gate
 * bypass. The boardgame.io *native* lobby routes
 * (`POST /games/legendary-arena/create` and
 * `POST /games/legendary-arena/{matchID}/join`) are mounted by `Server()`
 * with no auth, so before this guard a raw API request created or joined a
 * match with no account, sidestepping the D-24092 policy. This guard sits
 * in front of those two POST routes and admits a request only when it
 * carries **either**:
 *
 *   * a valid **authenticated session** (the same Bearer → Hanko-verifier →
 *     accountResolver path the WP-307 `/api/match/*` guard uses), OR
 *   * the **process-local internal-delegation secret** header (the loopback
 *     `fetch` from the WP-307 matchGate and the WP-163/164 autoplay loop).
 *
 * Anything else gets HTTP `401` with a full-sentence `{ error }` body. Every
 * other path and method — the `GET` match list, spectating, socket traffic,
 * and every `/api/*` route — passes straight through untouched.
 *
 * Server wires, engine decides (ARCHITECTURE §Layer Boundary): the guard
 * authenticates/authorizes and then passes through or rejects. It contains
 * NO game / move / phase / rule logic, imports nothing from `boardgame.io`,
 * `@legendary-arena/game-engine`, `@legendary-arena/registry`, or any UI /
 * client package. The internal secret, the session provider, `verifier`,
 * and `accountResolver` are all caller-injected (the WP-104 / WP-109 /
 * WP-307 pattern).
 *
 * Authority: WP-308; EC-338; D-24094 (hard-gate mechanism, supersedes the
 * D-24093 soft-gate limitation); D-24092 (policy); D-11202 (bearer header).
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';

import type {
  AccountResolver,
  DatabaseClient,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';

/**
 * The request header carrying the internal-delegation secret. Defined once
 * here and imported by the delegating call sites (`matchGate.routes.ts`,
 * `autoplay.mjs`) so the name is never re-typed as a string literal. Lower
 * case because HTTP header names are case-insensitive and Koa's `ctx.get`
 * normalizes to lower case.
 */
export const INTERNAL_DELEGATION_HEADER = 'x-legendary-internal-delegation';

/**
 * Closed-set re-statement of the orchestrator's session-validation result —
 * the guard reads only the `ok` discriminant. Declared locally so this
 * module does not couple to any feature's re-export (the matchGate route
 * module declares the same shape for the same reason).
 */
type RequireAuthenticatedSessionResult =
  | { ok: true; value: string }
  | { ok: false; reason: string; code: string };

/**
 * Caller-injected dependency bundle for {@link createNativeLobbyGuard}. The
 * authenticated-session provider is the WP-112 orchestrator (or a test
 * fake); `verifier` and `accountResolver` are the broker-specific
 * implementations threaded through to it (undefined in dev-mode missing-env,
 * exactly as the WP-307 matchGate wiring passes them). `internalSecret` is
 * the process-local value generated at startup by
 * {@link generateInternalDelegationSecret}.
 */
export interface NativeLobbyGuardDependencies {
  readonly internalSecret: string;
  readonly requireAuthenticatedSession: (
    req: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<RequireAuthenticatedSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
  readonly database: DatabaseClient;
}

/**
 * Minimal structural shape of the Koa context surface this guard reads.
 * Mirrors the WP-104 / WP-307 local-interface precedent so the module does
 * not need a direct `@koa/router` / Koa dependency. `req` is the raw Node
 * request the session orchestrator reads headers from.
 */
interface KoaGuardContext {
  readonly method: string;
  readonly path: string;
  readonly req: SessionTokenRequest;
  get(field: string): string;
  status: number;
  body: unknown;
}

/**
 * The Koa `next` continuation. Awaiting it hands control to the downstream
 * middleware (ultimately the boardgame.io lobby router).
 */
type KoaNext = () => Promise<unknown>;

// why: the join match id is a single non-empty path segment; the pattern
// pins the game name and the create/join suffix so ONLY the two native
// create/join POST routes match — never the `GET` list or an `/api/*` route.
const NATIVE_JOIN_PATH_PATTERN = /^\/games\/legendary-arena\/[^/]+\/join$/;

/**
 * Reports whether a request targets one of the two guarded native
 * create/join routes. POST only — the `GET` list, spectating, sockets, and
 * every other method or path return `false` and pass through untouched.
 *
 * @param method The request method.
 * @param path The request path (no query string).
 * @returns `true` only for POST create / POST join on the native lobby.
 */
function isGuardedNativeLobbyPath(method: string, path: string): boolean {
  if (method !== 'POST') {
    return false;
  }
  if (path === '/games/legendary-arena/create') {
    return true;
  }
  return NATIVE_JOIN_PATH_PATTERN.test(path);
}

/**
 * Value-exact, constant-time comparison of the provided internal-delegation
 * header against the process secret. Possession of the header *name* grants
 * nothing — the exact process-generated value is required. A length mismatch
 * short-circuits to `false` because `timingSafeEqual` throws on unequal-length
 * buffers; the length of the secret is not itself a secret.
 *
 * @param providedValue The header value the caller supplied (empty when absent).
 * @param expectedSecret The process-local secret generated at startup.
 * @returns `true` only when the values are byte-for-byte equal.
 */
function isValidInternalSecret(
  providedValue: string,
  expectedSecret: string,
): boolean {
  if (providedValue.length === 0) {
    return false;
  }
  const providedBuffer = Buffer.from(providedValue, 'utf8');
  const expectedBuffer = Buffer.from(expectedSecret, 'utf8');
  // why: timingSafeEqual requires equal-length buffers (throws otherwise); an
  // unequal length is already a definitive non-match, so return early.
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Generates the process-local internal-delegation secret. Called exactly
 * once at server startup; the value lives only in memory, is never sent to a
 * client, never logged, never persisted, and never env-configured. A process
 * restart regenerates it, rotating the guard and both delegating call sites
 * atomically (they share the one in-memory value).
 *
 * @returns A 256-bit random secret as a hex string.
 */
export function generateInternalDelegationSecret(): string {
  // why: process-generated (not a configured env var) so it can never leak
  // via deployment config, and a restart rotates it with zero coordination —
  // the guard and both delegating call sites read the same in-memory value.
  return randomBytes(32).toString('hex');
}

/**
 * Builds the native-lobby guard middleware from its injected dependencies.
 *
 * The returned middleware is mounted (in `server.mjs`) via
 * `server.app.middleware.unshift(guard)` so it runs BEFORE the boardgame.io
 * lobby router — the ordering that lets it reject a native create/join before
 * the framework handles it (verified against the installed boardgame.io
 * version by the EC-338 / PS-1 scaffold).
 *
 * @param deps The injected secret + session-check bundle.
 * @returns A Koa middleware `(ctx, next) => Promise<void>`.
 */
export function createNativeLobbyGuard(
  deps: NativeLobbyGuardDependencies,
): (ctx: KoaGuardContext, next: KoaNext) => Promise<void> {
  return async function nativeLobbyGuard(
    ctx: KoaGuardContext,
    next: KoaNext,
  ): Promise<void> {
    if (!isGuardedNativeLobbyPath(ctx.method, ctx.path)) {
      await next();
      return;
    }
    // why: allow-if-secret-OR-session — the server-internal loopback
    // delegations (matchGate + autoplay) carry the process secret; a genuine
    // signed-in caller carries a valid session. Either one admits the request;
    // everything else is rejected, so the D-24092 account gate holds by every
    // path (D-24094).
    const providedSecret = ctx.get(INTERNAL_DELEGATION_HEADER);
    if (isValidInternalSecret(providedSecret, deps.internalSecret)) {
      await next();
      return;
    }
    const sessionResult = await deps.requireAuthenticatedSession(ctx.req, {
      verifier: deps.verifier,
      accountResolver: deps.accountResolver,
      database: deps.database,
    });
    if (sessionResult.ok === true) {
      await next();
      return;
    }
    ctx.status = 401;
    ctx.body = {
      error:
        'A signed-in account is required to create or join a multiplayer ' +
        'match; this native lobby route accepts only a valid authenticated ' +
        'session or a server-internal delegation. Sign in and try again.',
    };
  };
}
