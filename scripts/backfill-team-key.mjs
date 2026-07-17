/**
 * Legendary Arena — team_key Backfill (WP-384 / D-24187 §2, one-time)
 *
 * Fills `legendary.competitive_scores.team_key` for rows inserted before
 * migration 034, by reading each row's stored replay artifact
 * (`bgio.replay_artifacts.initial_state`) and extracting the match's
 * configured hero ids. The extraction and the value format are locked by
 * D-24187 §1: the set-qualified hero ids, sorted ASC, joined `+` — the
 * same value the submission pipeline's step 14d writes for new rows.
 *
 * This read of the framework-store blob is authorized by the D-24187 §2
 * team-key carve-out (ARCHITECTURE.md §Persistence Boundary): a derived,
 * write-once domain value; never a state/log interpretation; never
 * written back to the blob.
 *
 * Dry-run by default — reports what WOULD be written and touches nothing.
 * Pass --write to apply. Idempotent: only `team_key IS NULL` rows are
 * candidates, so a second --write run is a no-op. Rows whose artifact is
 * missing (reaped before WP-335, or never captured) are reported and left
 * NULL — they stay open-division-only per D-24187 §1.
 *
 * Run via: node --env-file=.env scripts/backfill-team-key.mjs [--write]
 * Exit code 0 = success (including "nothing to do"), 1 = failure.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// why: __dirname is not available in ESM. Reconstruct it from import.meta.url
// so we can resolve the apps/server workspace relative to the monorepo root.
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(currentDirectory, '..');

/**
 * Creates a pg Pool by resolving the pg package from the apps/server
 * workspace (the migrate.mjs precedent — pg is not a root dependency).
 * @returns {object} A pg Pool instance connected to DATABASE_URL.
 */
function createDatabasePool() {
  const serverPackageJsonPath = join(projectRoot, 'apps', 'server', 'package.json');
  const workspaceRequire = createRequire(serverPackageJsonPath);
  const pgModule = workspaceRequire('pg');
  const Pool = pgModule.default?.Pool || pgModule.Pool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      '[backfill-team-key] DATABASE_URL is not set. Set it in .env or as an environment variable.',
    );
    process.exit(1);
  }

  return new Pool({ connectionString: databaseUrl });
}

// why: the team_key value is computed INSIDE PostgreSQL from the artifact's
// initial_state jsonb — no state reconstruction, no Node-side reduction. The
// string_agg ORDER BY pins COLLATE "C" (byte order) so the SQL sort is
// byte-equivalent to the submission path's JavaScript Array.prototype.sort
// (code-unit order) — hero ids are lowercase set-qualified slugs, so the two
// orders agree only when neither applies locale collation rules; forcing "C"
// removes the locale variable entirely. The equivalence is pinned by a test
// in competition.logic.test.ts.
const TEAM_KEY_EXPRESSION =
  "(SELECT string_agg(hero_id, '+' ORDER BY hero_id COLLATE \"C\") " +
  "FROM jsonb_array_elements_text(ra.initial_state->'G'->'matchConfiguration'->'heroDeckIds') AS hero_id)";

/**
 * Counts the backfill candidates: NULL-team_key rows split into those with
 * a usable artifact (heroDeckIds present) and those without.
 * @param {object} client - A pg client from the pool.
 * @returns {Promise<{ nullRows: number, fillable: number, missingArtifact: number }>}
 */
async function countCandidates(client) {
  const nullRowsResult = await client.query(
    'SELECT COUNT(*)::int AS total FROM legendary.competitive_scores WHERE team_key IS NULL',
  );
  const fillableResult = await client.query(
    'SELECT COUNT(*)::int AS total ' +
      'FROM legendary.competitive_scores cs ' +
      'JOIN bgio.replay_artifacts ra ON ra.replay_hash = cs.replay_hash ' +
      'WHERE cs.team_key IS NULL ' +
      "  AND jsonb_typeof(ra.initial_state->'G'->'matchConfiguration'->'heroDeckIds') = 'array' " +
      "  AND jsonb_array_length(ra.initial_state->'G'->'matchConfiguration'->'heroDeckIds') > 0",
  );
  const nullRows = nullRowsResult.rows[0].total;
  const fillable = fillableResult.rows[0].total;
  return { nullRows, fillable, missingArtifact: nullRows - fillable };
}

/**
 * Applies the backfill: one UPDATE joining scores to artifacts, writing
 * ONLY the team_key column, ONLY where it is NULL and the artifact carries
 * a non-empty heroDeckIds array.
 * @param {object} client - A pg client from the pool.
 * @returns {Promise<number>} The number of rows updated.
 */
async function applyBackfill(client) {
  const updateResult = await client.query(
    'UPDATE legendary.competitive_scores cs ' +
      `SET team_key = ${TEAM_KEY_EXPRESSION} ` +
      'FROM bgio.replay_artifacts ra ' +
      'WHERE ra.replay_hash = cs.replay_hash ' +
      '  AND cs.team_key IS NULL ' +
      "  AND jsonb_typeof(ra.initial_state->'G'->'matchConfiguration'->'heroDeckIds') = 'array' " +
      "  AND jsonb_array_length(ra.initial_state->'G'->'matchConfiguration'->'heroDeckIds') > 0",
  );
  return updateResult.rowCount ?? 0;
}

/**
 * Main entrypoint: reports candidates, applies the backfill when --write
 * is passed, and exits 0 on success / 1 on failure.
 */
async function main() {
  const isWriteMode = process.argv.includes('--write');
  const pool = createDatabasePool();
  let client;

  try {
    client = await pool.connect();
  } catch (error) {
    console.error(
      '[backfill-team-key] Failed to connect to the database. ' +
        `Connection error: ${error.message}. ` +
        'Check that DATABASE_URL is correct and PostgreSQL is running.',
    );
    process.exit(1);
  }

  let hasFailed = false;
  try {
    const before = await countCandidates(client);
    console.log(
      `[backfill-team-key] ${before.nullRows} rows with NULL team_key; ` +
        `${before.fillable} fillable from replay artifacts; ` +
        `${before.missingArtifact} have no usable artifact and will stay NULL ` +
        '(open-division-only per D-24187 §1).',
    );

    if (!isWriteMode) {
      console.log(
        '[backfill-team-key] Dry run — nothing written. Pass --write to apply.',
      );
      return;
    }

    const updatedCount = await applyBackfill(client);
    const after = await countCandidates(client);
    console.log(
      `[backfill-team-key] Backfilled ${updatedCount} rows. ` +
        `${after.nullRows} rows remain NULL (no usable artifact).`,
    );
  } catch (error) {
    hasFailed = true;
    console.error(
      '[backfill-team-key] Backfill failed. ' +
        `Database error: ${error.message}. ` +
        'No partial state to clean up — the single UPDATE is atomic; ' +
        'fix the error and re-run.',
    );
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }

  process.exit(hasFailed ? 1 : 0);
}

main();
