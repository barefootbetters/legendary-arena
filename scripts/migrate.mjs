/**
 * Legendary Arena — Database Migration Runner
 *
 * Applies plain SQL migration files from data/migrations/ in filename order.
 * Tracks applied migrations in a public.schema_migrations table.
 * Idempotent: safe to re-run against a fully-migrated database.
 *
 * Run via: pnpm migrate (loads .env via node --env-file=.env)
 * Exit code 0 = success, 1 = failure (blocks Render deployment).
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// why: __dirname is not available in ESM. Reconstruct it from import.meta.url
// so we can resolve paths relative to the monorepo root.
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(currentDirectory, '..');
const migrationsDirectory = join(projectRoot, 'data', 'migrations');

/**
 * Creates a pg Pool by resolving the pg package from the apps/server workspace.
 * @returns {object} A pg Pool instance connected to DATABASE_URL.
 */
function createDatabasePool() {
  // why: pg is a dependency of apps/server, not the monorepo root. Node's
  // ESM import resolution cannot see apps/server/node_modules from this script.
  // Use createRequire pointed at the workspace's package.json to resolve it.
  const serverPackageJsonPath = join(projectRoot, 'apps', 'server', 'package.json');
  const workspaceRequire = createRequire(serverPackageJsonPath);
  const pgModule = workspaceRequire('pg');
  const Pool = pgModule.default?.Pool || pgModule.Pool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[migrate] DATABASE_URL is not set. Set it in .env or as an environment variable.');
    process.exit(1);
  }

  return new Pool({ connectionString: databaseUrl });
}

/**
 * Creates the schema_migrations tracking table if it does not already exist.
 * @param {object} client - A pg client from the pool.
 */
async function ensureMigrationsTable(client) {
  // why: schema_migrations is intentionally in the public schema, not
  // legendary.*, so it exists before the legendary schema is created
  // and is visible to any PostgreSQL user without schema path changes.
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_id   bigserial primary key,
        filename       text unique not null,
        applied_at     timestamptz not null default now()
      );
    `);
  } catch (error) {
    console.error(
      `[migrate] Failed to create schema_migrations table. ` +
      `Database error: ${error.message}. ` +
      'Check that DATABASE_URL is correct and the database is reachable.'
    );
    throw error;
  }
}

/**
 * Loads the set of already-applied migration filenames from schema_migrations.
 * @param {object} client - A pg client from the pool.
 * @returns {Promise<Set<string>>} Set of filenames that have already been applied.
 */
async function loadAppliedMigrations(client) {
  try {
    const result = await client.query('SELECT filename FROM schema_migrations;');
    const appliedFilenames = new Set();
    for (const row of result.rows) {
      appliedFilenames.add(row.filename);
    }
    return appliedFilenames;
  } catch (error) {
    console.error(
      `[migrate] Failed to query schema_migrations table. ` +
      `Database error: ${error.message}. ` +
      'The schema_migrations table may be corrupted or inaccessible.'
    );
    throw error;
  }
}

/**
 * Reads a SQL migration file, resolving any \i directives to inline the
 * referenced file content. Strips existing BEGIN/COMMIT transaction wrappers
 * so the runner can manage transactions consistently.
 * @param {string} filePath - Absolute path to the migration SQL file.
 * @returns {Promise<string>} The resolved SQL content ready for execution.
 */
async function readMigrationSql(filePath) {
  let sqlFileContent;
  try {
    sqlFileContent = await readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(
      `[migrate] Failed to read migration file "${filePath}". ` +
      `Filesystem error: ${error.message}. ` +
      'Check that the file exists and is readable.'
    );
    throw error;
  }

  // why: \i is a psql metacommand that cannot be executed via pg.Client.query().
  // The runner resolves \i directives by reading the referenced file and inlining
  // its content, so migration files can reference shared SQL sources like
  // data/schema-server.sql and data/seed_rules.sql without duplicating them.
  const resolvedLines = [];
  const lines = sqlFileContent.split('\n');
  for (const line of lines) {
    const includeMatch = line.match(/^\\i\s+(.+)$/);
    if (includeMatch) {
      const includePath = join(projectRoot, includeMatch[1].trim());
      try {
        const includedContent = await readFile(includePath, 'utf-8');
        resolvedLines.push(includedContent);
      } catch (error) {
        console.error(
          `[migrate] Failed to read included file "${includePath}" ` +
          `referenced by \\i directive in migration. ` +
          `Filesystem error: ${error.message}. ` +
          'Check that the referenced file exists at the expected path.'
        );
        throw error;
      }
    } else {
      resolvedLines.push(line);
    }
  }

  let resolvedSql = resolvedLines.join('\n');

  // why: Some source SQL files (e.g., data/seed_rules.sql) contain their own
  // BEGIN/COMMIT transaction wrappers. The runner manages transactions itself,
  // so embedded transaction control must be stripped to avoid nested transaction
  // issues in PostgreSQL (where a nested BEGIN is a warning and an inner COMMIT
  // would commit the outer transaction prematurely).
  //
  // Safety: These regexes match only standalone "begin;" or "commit;" lines
  // (full-line match with optional whitespace). PL/pgSQL function bodies use
  // "begin" without a semicolon, so they are not affected. If a future
  // migration uses PL/pgSQL, ensure the block opener is bare "begin" (no
  // semicolon) — this is standard PL/pgSQL style.
  resolvedSql = resolvedSql.replace(/^\s*begin\s*;\s*$/gim, '');
  resolvedSql = resolvedSql.replace(/^\s*commit\s*;\s*$/gim, '');

  return resolvedSql;
}

/**
 * Applies a single migration file inside a transaction and records it in
 * schema_migrations. Rolls back the entire file on any error.
 * @param {object} client - A pg client from the pool.
 * @param {string} migrationFileName - The filename (e.g., "001_server_schema.sql").
 * @param {string} sqlContent - The resolved SQL content to execute.
 */
async function applyMigration(client, migrationFileName, sqlContent) {
  // why: wrapping each migration file in a transaction means a partial
  // failure rolls back cleanly. Without this, a failed migration halfway
  // through would leave the schema in an undefined state.
  try {
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1)',
      [migrationFileName]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(
      `[migrate] Migration "${migrationFileName}" failed and was rolled back. ` +
      `Database error: ${error.message}. ` +
      'Fix the SQL in the migration file and re-run pnpm migrate.'
    );
    throw error;
  }
}

/**
 * Main entrypoint: connects to the database, applies pending migrations in
 * filename order, logs a summary, and exits with the appropriate code.
 */
async function main() {
  const pool = createDatabasePool();
  let client;

  try {
    client = await pool.connect();
  } catch (error) {
    console.error(
      `[migrate] Failed to connect to the database. ` +
      `Connection error: ${error.message}. ` +
      'Check that DATABASE_URL is correct and PostgreSQL is running.'
    );
    // why: exit code 1 signals to Render's build system that the migration
    // failed and the deployment should not proceed to startCommand. Without
    // a non-zero exit, Render would start the server with a broken schema.
    process.exit(1);
  }

  let appliedCount = 0;
  let skippedCount = 0;
  let hasFailed = false;

  try {
    await ensureMigrationsTable(client);
    const appliedMigrations = await loadAppliedMigrations(client);

    let migrationFileNames;
    try {
      const allFiles = await readdir(migrationsDirectory);
      migrationFileNames = allFiles.filter(
        (fileName) => fileName.endsWith('.sql')
      );
    } catch (error) {
      console.error(
        `[migrate] Failed to read migrations directory "${migrationsDirectory}". ` +
        `Filesystem error: ${error.message}. ` +
        'Check that data/migrations/ exists and contains .sql files.'
      );
      hasFailed = true;
      return;
    }

    // why: filename sort works because all migration files use a zero-padded
    // numeric prefix (001_, 002_, etc.). Relying on filename order rather than
    // a sequence column keeps the runner simple and the intent visible.
    migrationFileNames.sort();

    for (const migrationFileName of migrationFileNames) {
      if (appliedMigrations.has(migrationFileName)) {
        console.log(`[migrate] skipped ${migrationFileName} (already applied)`);
        skippedCount += 1;
        continue;
      }

      const migrationFilePath = join(migrationsDirectory, migrationFileName);
      const sqlContent = await readMigrationSql(migrationFilePath);

      await applyMigration(client, migrationFileName, sqlContent);
      console.log(`[migrate] applied ${migrationFileName}`);
      appliedCount += 1;
    }
  } catch (error) {
    hasFailed = true;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }

  console.log(
    `[migrate] ${appliedCount} migrations applied, ${skippedCount} skipped.`
  );

  if (hasFailed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
