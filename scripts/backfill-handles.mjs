/**
 * Legendary Arena — Handle Backfill Script (WP-500 / EC-535 / D-24303)
 *
 * One-time (idempotent, re-runnable) backfill that assigns an
 * auto-derived, CHANGEABLE `@handle` to every account that has none.
 * Invoked via:
 *
 *   node --env-file=.env scripts/backfill-handles.mjs
 *
 * The by-`@handle` friend-request / match-invite flows resolve against
 * `legendary.players.handle_canonical`, which is NULL for the entire
 * pre-WP-500 user base (the handle-claim feature was never wired). New
 * accounts get a handle at first-sign-in provisioning; this script heals
 * the existing NULL rows so they too become reachable by handle.
 *
 * It reuses the SAME server-layer `assignAutoHandle` (single source of
 * truth — no re-implemented slug logic in SQL), imported via the D-13405
 * tsx-register precedent (`apps/server` emits no dist).
 *
 * Two-phase lifecycle (D-13405):
 *   - Startup (exit 2 on fault): register tsx, import the handle module,
 *     construct the pg.Pool. Missing DATABASE_URL / connect failure exits
 *     non-zero so the operator is alerted.
 *   - Scan loop (exit 0 even on per-row faults): a per-account assignment
 *     error is logged to stderr and the loop continues. Prints
 *     `assigned: <N>, skipped: <M>, errors: <K>` to stdout.
 *
 * Pool teardown via a `try { … } finally { await pool.end(); }` envelope.
 *
 * Authority: WP-500 §Scope (In); EC-535 §Locked Values (backfill);
 * D-24303 (auto-assigned changeable handles); D-13405 (tsx-register
 * precedent + exit-code domain {0, 2}).
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(currentDirectory, '..');
const serverPackageJsonPath = join(projectRoot, 'apps', 'server', 'package.json');

// why: the backfill imports `assignAutoHandle` from the server's
// TypeScript identity module per D-13405. tsx is registered
// programmatically (rather than via `node --import tsx …`) so the
// spec'd `node --env-file=.env scripts/…mjs` command works as written;
// tsx is resolved from apps/server's devDependencies so the script uses
// the same tsx instance the server uses for tests and start-up.
const workspaceRequire = createRequire(serverPackageJsonPath);
const tsxApiPath = workspaceRequire.resolve('tsx/esm/api');
const { register } = await import(pathToFileURL(tsxApiPath).href);
register();

const handleLogicUrl = pathToFileURL(
  join(projectRoot, 'apps', 'server', 'src', 'identity', 'handle.logic.ts'),
).href;
const { assignAutoHandle } = await import(handleLogicUrl);

const pgModule = workspaceRequire('pg');
const Pool = pgModule.default?.Pool || pgModule.Pool;

// why: D-13405 startup-fatal posture — a missing connection string is an
// operator-actionable misconfiguration, so exit 2 (not 0) before any work.
const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined || connectionString.trim() === '') {
  console.error(
    'backfill-handles: DATABASE_URL is not set. Run as: node --env-file=.env scripts/backfill-handles.mjs',
  );
  process.exit(2);
}

const pool = new Pool({ connectionString });

let assigned = 0;
let skipped = 0;
let errors = 0;

try {
  const nullHandleRows = await pool.query(
    'SELECT ext_id, display_name FROM legendary.players ' +
      'WHERE handle_canonical IS NULL ' +
      'ORDER BY created_at ASC',
  );

  for (const row of nullHandleRows.rows) {
    try {
      const handle = await assignAutoHandle(row.ext_id, row.display_name, pool);
      if (handle === null) {
        // why: another concurrent path (a sign-in on the same account, or
        // an earlier row in this run) already assigned a handle, or no
        // candidate could be placed — either way nothing to do here.
        skipped += 1;
      } else {
        assigned += 1;
      }
    } catch (rowError) {
      // why: D-13405 scan-loop posture — a per-account fault is logged and
      // the loop continues so one bad row never aborts the whole backfill;
      // a persistent fault reappears on the next run (the row stays NULL).
      errors += 1;
      const cause =
        rowError instanceof Error ? rowError.message : String(rowError);
      console.error(
        `backfill-handles: failed to assign a handle for ext_id=${row.ext_id}: ${cause}`,
      );
    }
  }
} finally {
  await pool.end();
}

console.log(`assigned: ${assigned}, skipped: ${skipped}, errors: ${errors}`);
