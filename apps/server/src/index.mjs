/**
 * Legendary Arena — Process Entrypoint
 *
 * Starts the game server and handles graceful shutdown on SIGTERM.
 * This is the file referenced in render.yaml startCommand.
 */

import { startServer } from './server.mjs';

/**
 * Initialises the server and registers the shutdown handler.
 */
async function main() {
  let httpServer;

  try {
    httpServer = await startServer();
  } catch (error) {
    console.error(
      `[server] Failed to start the Legendary Arena server. ` +
      `Error: ${error.message}. ` +
      `Check that DATABASE_URL is set and PostgreSQL is reachable.`
    );
    process.exit(1);
  }

  // why: Render.com sends SIGTERM when deploying a new version or scaling down.
  // Graceful shutdown lets in-flight WebSocket frames complete and database
  // connections close cleanly, preventing client-side errors during deploys.
  process.on('SIGTERM', () => {
    console.log('[server] SIGTERM received — shutting down gracefully.');
    httpServer.close(() => {
      console.log('[server] HTTP server closed. Exiting.');
      process.exit(0);
    });
  });
}

main();
