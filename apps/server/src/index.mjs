/**
 * Legendary Arena -- Process Entrypoint
 *
 * Starts the game server and handles graceful shutdown on SIGTERM.
 * This is the file referenced in render.yaml startCommand.
 */

// why: index.mjs is the process entrypoint -- it owns process lifecycle
// (startup, shutdown, error handling). server.mjs is the configuration
// module -- it assembles the boardgame.io Server() with the correct game,
// registry, and middleware. Separating the two keeps server.mjs testable
// without triggering process-level side effects.

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { startServer } from './server.mjs';
import { closePool } from './db/database.js';
import {
  startMatchReaper,
  MATCH_REAPER_INTERVAL_MS,
  GAMEOVER_GRACE_MS,
  ABANDONED_TTL_MS,
} from './db/matchReaper.js';
import {
  startCaptureHarvester,
  CAPTURE_HARVESTER_INTERVAL_MS,
} from './replay/captureHarvester.js';
import {
  isLegendsPublisherEnabled,
  getLegendsPublisherIntervalMs,
  startLegendsPublisher,
} from './legends/legends.scheduler.js';
// why: WP-420 / D-24240 — on a graceful shutdown (Render's redeploy SIGTERM) mark
// the bot-ally matches this process was actively driving so boot revival can
// re-attach them past the MAX_REVIVALS cap. `botAllyDrivers` is the in-process
// live-driver registry; its keys ARE exactly those matches.
import { botAllyDrivers } from './bot-ally/botAllyDriver.mjs';
import { markInProgressBotAllyMatchesInterrupted } from './bot-ally/botAllyRoutes.mjs';

/**
 * Initialises the server and registers the shutdown handler.
 */
async function main() {
  let httpServer;
  let pool;
  let legendsPublisherHandle;
  let matchReaperHandle;
  let captureHarvesterHandle;

  try {
    const started = await startServer();
    httpServer = started.appServer;
    pool = started.pool;

    // why: conditionally start the legends publisher only when
    // LEGENDS_PUBLISHER_ENABLED=true (kill switch per D-14202).
    // If pool is unavailable or undefined, the scheduler MUST NOT
    // start (fail closed). The R2 client is constructed here as
    // the S3Client → LegendsR2Client adapter.
    if (isLegendsPublisherEnabled() && pool !== undefined) {
      const s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
        },
      });

      /** @type {import('./legends/legends.types.js').LegendsR2Client} */
      const r2Client = {
        async putObject(params) {
          const command = new PutObjectCommand({
            Bucket: params.bucket,
            Key: params.key,
            Body: params.body,
            ContentType: params.contentType,
          });
          await s3Client.send(command, { abortSignal: params.signal });
        },
      };

      legendsPublisherHandle = startLegendsPublisher({
        bucket: process.env.R2_LEGENDS_BUCKET ?? '',
        database: pool,
        // why: WP-342 / D-24131 — the startup-built gauntlet catalog; the
        // publisher emits gauntlet boards + gauntlet-index alongside the
        // WP-142 boards when this is present.
        gauntletCatalog: started.gauntletCatalog,
        intervalMs: getLegendsPublisherIntervalMs(),
        leaderboardDeps: started.leaderboardDeps,
        r2Client,
      });
    } else if (isLegendsPublisherEnabled() && pool === undefined) {
      console.warn(
        '[legends-publisher] LEGENDS_PUBLISHER_ENABLED=true but pool is unavailable. Publisher not started.',
      );
    } else {
      console.log(
        '[legends-publisher] Disabled (set LEGENDS_PUBLISHER_ENABLED=true to enable).',
      );
    }

    // why: WP-327 / D-24113 — start the bgio match reaper so abandoned and
    // finished matches are periodically deleted from bgio.matches (durable since
    // WP-309 / D-24095), keeping the framework store bounded and the lobby list
    // clean. Mirrors the legends publisher: started here when the pool is
    // available, stopped on SIGTERM. If the pool is unavailable the reaper does
    // not start (fail closed) and stale rows simply are not cleaned up.
    if (pool !== undefined) {
      matchReaperHandle = startMatchReaper({
        database: pool,
        intervalMs: MATCH_REAPER_INTERVAL_MS,
        gameoverGraceMs: GAMEOVER_GRACE_MS,
        abandonedTtlMs: ABANDONED_TTL_MS,
      });
      // why: WP-335 / D-24122 — start the capture harvester so finished matches
      // are reconstructed, stored as durable replay artifacts, and made
      // competitively submittable (ownership assigned per authenticated seat)
      // before the reaper's captured_at guard would ever let them be deleted.
      // Same pool, same start-when-available / stop-on-SIGTERM lifecycle as the
      // reaper. Its 5-min cadence sits well inside the reaper's 1-hr gameover grace.
      captureHarvesterHandle = startCaptureHarvester({
        database: pool,
        intervalMs: CAPTURE_HARVESTER_INTERVAL_MS,
      });
    } else {
      console.warn(
        '[match-reaper] pool is unavailable; reaper not started. Stale bgio.matches rows will not be cleaned up.',
      );
    }
  } catch (error) {
    // why: startServer() may throw non-Error values (e.g. from boardgame.io
    // or pg internals). Coercing to String avoids logging "undefined".
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[server] Failed to start the Legendary Arena server. ` +
      `Error: ${errorMessage}. ` +
      `Check that DATABASE_URL is set and PostgreSQL is reachable.`
    );
    process.exit(1);
  }

  // why: Render.com sends SIGTERM when deploying a new version or scaling down.
  // Graceful shutdown lets in-flight WebSocket frames complete and database
  // connections close cleanly, preventing client-side errors during deploys.
  // why: WP-115 — closePool(pool) MUST run AFTER httpServer.close()'s
  // callback resolves. Closing the pool before HTTP shutdown completes
  // would sever in-flight handlers mid-query (any leaderboard request
  // already past the Cache-Control set() but not yet returned would
  // surface a `pg` "Cannot use a pool after calling end" error to the
  // client, defeating the graceful-shutdown contract).
  process.on('SIGTERM', async () => {
    console.log('[server] SIGTERM received -- shutting down gracefully.');
    // why: WP-420 / D-24240 — BEFORE the pool closes, flag the bot-ally matches
    // this process is actively driving as cleanly interrupted, so boot revival
    // re-attaches them past the cap (a healthy match must not be lost to a routine
    // deploy). Best-effort: awaited (the pool is still open) but fully guarded — a
    // mark failure is logged and shutdown proceeds; it is a single small batch
    // write, so it cannot materially delay the grace window. An OOM / crash sends
    // no SIGTERM, so this never runs for the ungraceful case (the OOM-loop guard).
    try {
      await markInProgressBotAllyMatchesInterrupted(pool, [...botAllyDrivers.keys()]);
    } catch (markError) {
      const markMessage = markError instanceof Error ? markError.message : String(markError);
      console.error(
        `[server] Could not mark in-progress bot-ally matches interrupted during SIGTERM. ` +
        `Error: ${markMessage}. Continuing shutdown; those matches fall back to the capped revival path.`
      );
    }
    if (legendsPublisherHandle !== undefined) {
      legendsPublisherHandle.stop();
    }
    // why: WP-327 — stop the match reaper's interval before the pool closes so
    // no reap query fires against a closing pool during shutdown.
    if (matchReaperHandle !== undefined) {
      matchReaperHandle.stop();
    }
    // why: WP-335 — stop the capture harvester's interval before the pool closes
    // so no capture query fires against a closing pool during shutdown.
    if (captureHarvesterHandle !== undefined) {
      captureHarvesterHandle.stop();
    }
    httpServer.close(async () => {
      console.log('[server] HTTP server closed. Closing pg.Pool.');
      try {
        await closePool(pool);
        console.log('[server] pg.Pool closed. Exiting.');
      } catch (error) {
        // why: pool.end() may reject if a checked-out client never
        // returned; log the failure and exit anyway since the HTTP
        // server has already closed and holding the process open
        // serves no recovery purpose.
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `[server] pg.Pool close failed during SIGTERM. ` +
          `Error: ${errorMessage}. Exiting anyway.`
        );
      }
      process.exit(0);
    });
  });
}

main();
