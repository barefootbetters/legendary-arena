/**
 * Legendary Arena — boardgame.io Game Server
 *
 * Wiring layer: loads rules, creates the boardgame.io Server(), configures
 * CORS, exposes a /health endpoint, and listens on the configured port.
 *
 * This file must not contain game logic. It connects pieces — it does not
 * decide what happens in the game.
 */

import { Server } from 'boardgame.io/server';
import { loadRules, getRules } from './rules/loader.mjs';
import { LegendaryGame } from './game/legendary.mjs';

/**
 * Registers the /health endpoint on the boardgame.io koa router.
 * Returns { status: 'ok' } for Render health checks and pnpm check.
 *
 * @param {import('@koa/router')} router - The boardgame.io server's koa router.
 */
function registerHealthRoute(router) {
  router.get('/health', (koaContext) => {
    koaContext.body = { status: 'ok' };
  });
}

/**
 * Starts the boardgame.io server after loading rules from PostgreSQL.
 * On failure, logs a full-sentence error and exits.
 *
 * @returns {Promise<import('http').Server>} The running HTTP server instance.
 */
export async function startServer() {
  await loadRules();

  const rules = getRules();
  const rulesCount = Object.keys(rules.rules).length;

  // why: boardgame.io Server() is the authoritative game server. On Render,
  // it handles both HTTP (health checks, lobby API) and WebSocket (real-time
  // game state sync) traffic on a single port. Render's load balancer
  // upgrades WebSocket connections automatically — no separate WS port needed.
  const server = Server({
    games: [LegendaryGame],
    // why: CORS origins are written as a literal array per code style Rule 7.
    // Only the production SPA and local Vite dev server are allowed.
    origins: [
      'https://cards.barefootbetters.com',
      'http://localhost:5173',
    ],
  });

  registerHealthRoute(server.router);

  // why: Render.com injects PORT automatically. The fallback 8000 is for
  // local development only. Do not set PORT in the Render dashboard —
  // Render will override it anyway and double-setting causes confusion.
  const port = process.env.PORT ?? '8000';

  const { appServer } = await server.run({ port: Number(port) });

  console.log(
    `[server] Legendary Arena server listening on port ${port} ` +
    `(${rulesCount} rules loaded, NODE_ENV=${process.env.NODE_ENV ?? 'development'})`
  );

  return appServer;
}
