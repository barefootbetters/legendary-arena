/**
 * Public Profile HTTP Routes — Server Layer (WP-102)
 *
 * Registers the single public, read-only HTTP endpoint
 * `GET /api/players/:handle/profile` on the existing Koa router
 * returned by boardgame.io's `Server({...})` instance. Mirrors the
 * `registerHealthRoute(router)` precedent at
 * `apps/server/src/server.mjs:30–34`. There is no Express in this
 * codebase per pre-flight 2026-04-28 PS-1.
 *
 * Layer-boundary contract: this module imports nothing from
 * `boardgame.io` directly (the router type is supplied as a
 * structural parameter), nothing from `@legendary-arena/game-engine`,
 * `@legendary-arena/registry`, `@legendary-arena/preplan`,
 * `@legendary-arena/vue-sfc-loader`, or any UI / client /
 * replay-producer package. The `pg` driver is reachable only
 * through the `DatabaseClient` alias.
 *
 * Production wiring deferred: route registration in
 * `apps/server/src/server.mjs` is deferred to the future
 * request-handler WP that owns the long-lived `pg.Pool` lifecycle
 * (per the WP-102 §H amendment landed in this packet's Commit B).
 * `registerProfileRoutes` is exported from this file but has no
 * production caller until that WP lands; the post-mortem §1
 * documents the deferral and the WP-053 `submitCompetitiveScore`
 * shipped-but-unwired precedent.
 *
 * Authority: WP-102 §Scope (In) §C; EC-117 §Locked Values; pre-flight
 * 2026-04-28 PS-1 (Koa, not Express); D-3103 (mid-execution amendment
 * precedent for the deferral); copilot-check 2026-04-28 RISK #16
 * (lifecycle prohibition).
 */

import type { DatabaseClient } from '../identity/identity.types.js';
import { getPublicProfileByHandle } from './profile.logic.js';

/**
 * Minimal structural shape of the Koa context surface this module
 * touches. Declared locally rather than imported from `@koa/router`
 * so `apps/server/package.json` does not need a direct
 * `@koa/router` dependency — `@koa/router` reaches us as a
 * transitive of `boardgame.io/server`, and structural typing matches
 * the `registerHealthRoute(router)` precedent at `server.mjs:30–34`.
 */
interface KoaProfileContext {
  params: { handle: string };
  status: number;
  body: unknown;
}

/**
 * Minimal structural shape of the Koa router surface this module
 * touches. Matches the `@koa/router` `Router#get` signature for the
 * single registration site below.
 */
interface KoaRouter {
  get(
    path: string,
    handler: (koaContext: KoaProfileContext) => Promise<void> | void,
  ): unknown;
}

// why: this route handler is a thin Koa adapter — all
// profile-composition logic lives in `profile.logic.ts` so it is
// independently testable via `node:test` without spinning up
// boardgame.io's `Server()` or any HTTP listener. The logic-layer
// test (`profile.logic.test.ts`) covers the success path + the 404
// path + the visibility / expiration filters; an optional follow-up
// `profile.routes.test.ts` may exercise the koa-router adapter
// surface but is not required by EC-117.
// why: this route is intentionally unauthenticated. Public profile
// visibility is governed solely by the WP-052 replay visibility flags
// + the WP-102 server-side filter (`visibility IN ('public', 'link')
// AND (expires_at IS NULL OR expires_at > now())`); no
// authenticated-session helper invocation, no auth-broker session
// check, no per-request authorization. A future WP that introduces
// an authenticated `/me/profile` companion surface (e.g., WP-104
// owner-edit) MUST register a separate handler — never bolt auth
// onto this route.
/**
 * Register the single `GET /api/players/:handle/profile` route on
 * the supplied Koa router. The router is mutated in place; the
 * function returns `void`. Callers pass the Koa router obtained from
 * boardgame.io's `Server({...})` (`server.router`) and the long-lived
 * `pg.Pool` instance.
 *
 * Production wiring deferred per the WP-102 §H amendment — the call
 * site in `apps/server/src/server.mjs` will be added by the future
 * request-handler WP that owns the `pg.Pool` lifecycle.
 */
export function registerProfileRoutes(
  router: KoaRouter,
  database: DatabaseClient,
): void {
  router.get(
    '/api/players/:handle/profile',
    async (koaContext) => {
      try {
        const result = await getPublicProfileByHandle(
          koaContext.params.handle,
          database,
        );
        if (result.ok === true) {
          koaContext.status = 200;
          koaContext.body = result.value;
          return;
        }
        if (result.code === 'player_not_found') {
          koaContext.status = 404;
          koaContext.body = { error: 'player_not_found' };
          return;
        }
        // why: unreachable today — `ProfileErrorCode` is the
        // single-value union `'player_not_found'` per WP-102
        // §Locked Values. If a future packet widens
        // `ProfileErrorCode`, this branch must be updated
        // explicitly so a new code surfaces a 500 rather than
        // silently leaking through the success path.
        koaContext.status = 500;
        koaContext.body = { error: 'internal_error' };
      } catch (caughtError) {
        // why: never re-throw to a global Koa handler — the existing
        // server has no error middleware beyond boardgame.io defaults
        // and an uncaught throw here would surface as a 500 without
        // a body, which is indistinguishable from this branch but
        // costs a stack-unwind. The caught value is intentionally
        // discarded here because the route does not log; future
        // observability work may attach a logger via the structural
        // `KoaRouter` parameter without changing this surface.
        void caughtError;
        koaContext.status = 500;
        koaContext.body = { error: 'internal_error' };
      }
    },
  );
}
