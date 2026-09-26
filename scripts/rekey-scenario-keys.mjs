/**
 * Legendary Arena — Captured-Replay ScenarioKey Rekey (D-24597, one-time)
 *
 * Re-derives the ScenarioKey of every captured replay artifact with the
 * set-qualified derivation (non-core scheme / mastermind / villain ids keep their
 * `setAbbr/` qualifier) and rewrites rows still carrying the pre-D-24597 bare key,
 * which PAR-gated reprint matches (co2e Portals, msp1 Civil War, co2e Red Skull,
 * ...) against core's PAR. All-core matches re-derive unchanged and are untouched.
 *
 * The logic lives in `apps/server/src/replay/scenarioKeyRekey.logic.ts` (the
 * capture derivation, reused verbatim); this file is the CLI wrapper.
 *
 *   (no flag)          dry run — report candidates, write nothing
 *   --write            rekey bgio.replay_artifacts + legendary.replay_ownership
 *                      (stops pending reprint captures scoring against core PAR)
 *   --include-scores   with --write, also rekey legendary.competitive_scores
 *                      (moves already-accepted reprint scores off core's boards,
 *                      gauntlet progress, and badges — D-24597 §3)
 *
 * Idempotent; passes compose in any order. Run from the repo root:
 *   node --env-file=.env --import ./apps/server/node_modules/tsx/dist/loader.mjs scripts/rekey-scenario-keys.mjs [--write [--include-scores]]
 * Exit code 0 = success (including "nothing to do"), 1 = failure.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// why: __dirname is not available in ESM; resolve the apps/server workspace from
// this file so pg and the rekey logic load regardless of the caller's cwd.
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(currentDirectory, '..');
const serverRoot = join(projectRoot, 'apps', 'server');

/**
 * Creates a pg Pool by resolving the pg package from the apps/server workspace
 * (the backfill-team-key.mjs precedent — pg is not a root dependency).
 * @returns {object} A pg Pool connected to DATABASE_URL.
 */
function createDatabasePool() {
  const workspaceRequire = createRequire(join(serverRoot, 'package.json'));
  const pgModule = workspaceRequire('pg');
  const Pool = pgModule.default?.Pool || pgModule.Pool;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      '[rekey-scenario-keys] DATABASE_URL is not set. Set it in .env or as an environment variable.',
    );
    process.exit(1);
  }
  return new Pool({ connectionString: databaseUrl });
}

/**
 * Prints the pass report.
 * @param {import('../apps/server/src/replay/scenarioKeyRekey.logic.ts').ScenarioKeyRekeyReport} report
 */
function printReport(report) {
  console.log(
    `[rekey-scenario-keys] scanned ${report.scanned} artifact(s): ` +
      `${report.unchanged} unchanged, ${report.candidates.length} to rekey, ` +
      `${report.failures.length} failed to reduce.`,
  );
  for (const candidate of report.candidates) {
    console.log(
      `  ${candidate.replayHash}: "${candidate.storedScenarioKey}" -> "${candidate.derivedScenarioKey}" ` +
        `(artifact ${candidate.isArtifactStale ? 'stale' : 'current'}, ` +
        `${candidate.staleOwnershipRows} ownership row(s), ${candidate.staleScoreRows} score row(s))`,
    );
  }
  for (const failure of report.failures) {
    console.log(`  FAILED ${failure.replayHash}: ${failure.reason}`);
  }
  if (!report.wroteArtifactsAndOwnership) {
    console.log('[rekey-scenario-keys] dry run — nothing written. Pass --write to apply.');
    return;
  }
  console.log(
    report.wroteScores
      ? '[rekey-scenario-keys] wrote artifacts, ownership, and competitive scores.'
      : '[rekey-scenario-keys] wrote artifacts and ownership; score rows left as-is (pass --include-scores to rekey them).',
  );
}

/**
 * Entry point.
 */
async function main() {
  const argv = process.argv.slice(2);
  const write = argv.includes('--write');
  const includeScores = argv.includes('--include-scores');
  if (includeScores && !write) {
    console.error('[rekey-scenario-keys] --include-scores requires --write.');
    process.exit(1);
  }
  const logicUrl = pathToFileURL(join(serverRoot, 'src', 'replay', 'scenarioKeyRekey.logic.ts')).href;
  const { rekeyCapturedScenarioKeys } = await import(logicUrl);
  const pool = createDatabasePool();
  try {
    const report = await rekeyCapturedScenarioKeys(pool, { write, includeScores });
    printReport(report);
  } catch (error) {
    console.error(
      `[rekey-scenario-keys] The rekey pass failed: ${error instanceof Error ? error.message : String(error)}. ` +
        'Check DATABASE_URL and that the server packages are built (pnpm -r build).',
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

await main();
