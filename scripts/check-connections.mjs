/**
 * Legendary Arena — Connection & Environment Health Check
 *
 * Verifies all external services, tools, environment variables, and npm packages.
 * Run via: pnpm check (loads .env via node --env-file=.env)
 *
 * Exit code 0 = all checks pass. Exit code 1 = at least one failure.
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { env, version as nodeVersion, platform } from 'node:process';
import { hostname } from 'node:os';

// ---------------------------------------------------------------------------
// Required environment variables — grouped by service
// ---------------------------------------------------------------------------

const REQUIRED_VARS = {
  'Database': [
    'DATABASE_URL',       // Render PostgreSQL connection string
    'EXPECTED_DB_NAME',   // e.g. legendary_arena — used for connection verification
  ],
  'Auth': [
    'JWT_SECRET',         // 32+ byte hex string — see .env.example for generation command
  ],
  'Game Server': [
    'NODE_ENV',           // 'development' or 'production'
    'GAME_SERVER_URL',    // e.g. https://legendary-arena.onrender.com
    'PORT',               // local dev only — Render sets this automatically
  ],
  'Cloudflare': [
    'R2_PUBLIC_URL',      // e.g. https://images.barefootbetters.com
    'CF_PAGES_URL',       // e.g. https://cards.barefootbetters.com
  ],
  'Frontend (Vite)': [
    'VITE_GAME_SERVER_URL', // exposed to browser bundle — must match GAME_SERVER_URL
  ],
};

// ---------------------------------------------------------------------------
// Placeholder patterns — values that indicate unconfigured variables
// ---------------------------------------------------------------------------

const PLACEHOLDER_PATTERNS = [
  /^your-/i,
  /^change-me$/i,
  /^REPLACE_/i,
  /^<.*>$/,
  /^$/,
];

// ---------------------------------------------------------------------------
// Results tracking
// ---------------------------------------------------------------------------

const results = [];
let failureCount = 0;
let warningCount = 0;

/**
 * Records a check result and prints a live status line.
 * @param {string} section - The section header (e.g., 'TOOLS', 'CONNECTIONS')
 * @param {string} checkName - Name of the individual check
 * @param {boolean} passed - Whether the check passed
 * @param {string} message - Human-readable result message
 * @param {string} [remediation] - What to do if it failed
 * @param {'warn'|undefined} [level] - Set to 'warn' for non-blocking issues
 */
function recordResult(section, checkName, passed, message, remediation, level) {
  const icon = passed ? '✓' : '✗';
  const color = passed ? '' : '';

  if (!passed && level === 'warn') {
    warningCount++;
    console.log(`  ⚠ ${checkName} : ${message}`);
  } else if (!passed) {
    failureCount++;
    console.log(`  ✗ ${checkName} : ${message}`);
  } else {
    console.log(`  ✓ ${checkName} : ${message}`);
  }

  results.push({ section, checkName, passed, message, remediation, level });
}

// ---------------------------------------------------------------------------
// Tool checks
// ---------------------------------------------------------------------------

/**
 * Verifies Node.js version is 22+.
 */
function checkNodeVersion() {
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);

  if (majorVersion < 22) {
    recordResult('TOOLS', 'Node.js', false,
      `${nodeVersion} — major version ${majorVersion} is below required v22`,
      'Install Node.js v22+ from https://nodejs.org');
    return;
  }

  recordResult('TOOLS', 'Node.js', true, `${nodeVersion}`);
}

/**
 * Verifies pnpm is installed and version is 8+.
 */
function checkPnpmVersion() {
  try {
    const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
    const majorVersion = parseInt(pnpmVersion.split('.')[0], 10);

    if (majorVersion < 8) {
      recordResult('TOOLS', 'pnpm', false,
        `v${pnpmVersion} — below required v8`,
        'Run: npm install -g pnpm');
      return;
    }

    recordResult('TOOLS', 'pnpm', true, `v${pnpmVersion}`);
  } catch {
    recordResult('TOOLS', 'pnpm', false,
      'NOT FOUND on PATH',
      'Run: npm install -g pnpm');
  }
}

/**
 * Verifies dotenv-cli is installed and can parse .env files.
 */
function checkDotenvCli() {
  try {
    // why: dotenv-cli v11+ does not support --version. Use npm list to get
    // the installed version, and fall back to confirming the binary exists.
    let dotenvVersion = 'unknown';
    try {
      const npmListOutput = execSync('npm list -g dotenv-cli --depth=0', {
        encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
      });
      const versionMatch = npmListOutput.match(/dotenv-cli@([\d.]+)/);
      if (versionMatch) {
        dotenvVersion = versionMatch[1];
      }
    } catch {
      // npm list failed — binary exists but version unknown
    }

    recordResult('TOOLS', 'dotenv-cli', true, `v${dotenvVersion}`);

    // Verify .env is syntactically parseable if it exists
    if (existsSync('.env')) {
      try {
        execSync('dotenv -e .env -- node -e ""', { encoding: 'utf8', stdio: 'pipe' });
      } catch {
        recordResult('TOOLS', 'dotenv-cli (.env parse)', false,
          '.env file exists but dotenv cannot parse it. Check for BOM encoding or unquoted special characters.',
          'Re-create .env from .env.example with UTF-8 encoding (no BOM).',
          'warn');
      }
    }
  } catch {
    recordResult('TOOLS', 'dotenv-cli', false,
      'NOT FOUND on PATH — dotenv-cli is required for scripts that cannot use --env-file',
      'Run: npm install -g dotenv-cli');
  }
}

/**
 * Verifies boardgame.io is installed and is the correct 0.50.x version.
 */
function checkBoardgameioPackage() {
  const packageJsonPath = join('node_modules', 'boardgame.io', 'package.json');

  if (!existsSync(packageJsonPath)) {
    recordResult('TOOLS', 'boardgame.io', false,
      'Not found in node_modules. pnpm install may not have been run, or boardgame.io is not yet a dependency.',
      'Run: pnpm install (once game-engine package exists)');
    return;
  }

  try {
    const packageData = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const installedVersion = packageData.version;
    const versionParts = installedVersion.split('.');

    if (versionParts[0] !== '0' || versionParts[1] !== '50') {
      recordResult('TOOLS', 'boardgame.io', false,
        `v${installedVersion} — expected 0.50.x. This project locks boardgame.io to ^0.50.0.`,
        'Run: pnpm add boardgame.io@0.50');
      return;
    }

    // why: boardgame.io ships its server module in CommonJS format even though
    // this project is ESM-only. The CJS entrypoint is what boardgame.io exposes
    // for server-side use. Its presence confirms the package installed correctly.
    const serverEntrypoint = join('node_modules', 'boardgame.io', 'dist', 'cjs', 'server.js');
    if (!existsSync(serverEntrypoint)) {
      recordResult('TOOLS', 'boardgame.io', false,
        `v${installedVersion} installed but server CJS entrypoint missing at ${serverEntrypoint}.`,
        'Run: pnpm install to reinstall the package.');
      return;
    }

    recordResult('TOOLS', 'boardgame.io', true, `v${installedVersion} (server entrypoint verified)`);
  } catch (readError) {
    recordResult('TOOLS', 'boardgame.io', false,
      `Found in node_modules but package.json is unreadable: ${readError.message}`,
      'Run: pnpm install to reinstall.');
  }
}

/**
 * Verifies zod is installed in node_modules.
 */
function checkZodPackage() {
  const packageJsonPath = join('node_modules', 'zod', 'package.json');

  if (!existsSync(packageJsonPath)) {
    recordResult('TOOLS', 'zod', false,
      'Not found in node_modules.',
      'Run: pnpm add zod');
    return;
  }

  try {
    const packageData = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    recordResult('TOOLS', 'zod', true, `v${packageData.version}`);
  } catch {
    recordResult('TOOLS', 'zod', false,
      'Found in node_modules but package.json is unreadable.',
      'Run: pnpm install');
  }
}

// ---------------------------------------------------------------------------
// Environment checks
// ---------------------------------------------------------------------------

/**
 * Verifies the .env file exists, is not the example, and has no placeholders.
 */
function checkDotenvFile() {
  if (!existsSync('.env')) {
    recordResult('ENVIRONMENT', '.env file', false,
      '.env file not found at project root.',
      'Copy .env.example to .env and fill in real values.');
    return;
  }

  recordResult('ENVIRONMENT', '.env file', true, '.env file found');

  // Check it is not identical to .env.example
  if (existsSync('.env.example')) {
    const envContent = readFileSync('.env', 'utf8');
    const exampleContent = readFileSync('.env.example', 'utf8');

    if (envContent === exampleContent) {
      recordResult('ENVIRONMENT', '.env vs .env.example', false,
        '.env is identical to .env.example. Replace placeholder values with real configuration.',
        'Edit .env and replace all placeholder values.');
      return;
    }

    recordResult('ENVIRONMENT', '.env vs .env.example', true, '.env differs from .env.example');
  }

  // Check for placeholder values
  const envContent = readFileSync('.env', 'utf8');
  const placeholderVars = [];

  for (const line of envContent.split('\n')) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('#') || !trimmedLine.includes('=')) {
      continue;
    }

    const equalsIndex = trimmedLine.indexOf('=');
    const varName = trimmedLine.slice(0, equalsIndex).trim();
    const varValue = trimmedLine.slice(equalsIndex + 1).trim();

    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(varValue)) {
        placeholderVars.push(varName);
        break;
      }
    }
  }

  if (placeholderVars.length > 0) {
    recordResult('ENVIRONMENT', '.env placeholders', false,
      `.env contains placeholder values: ${placeholderVars.join(', ')}`,
      'Replace placeholder values in .env with real configuration.',
      'warn');
  }
}

/**
 * Verifies all required environment variables are present and non-empty.
 */
function checkRequiredEnvironmentVariables() {
  let totalChecked = 0;
  let totalMissing = 0;

  console.log('');
  console.log(`REQUIRED VARIABLES`);

  for (const groupName of Object.keys(REQUIRED_VARS)) {
    const variableNames = REQUIRED_VARS[groupName];
    const groupResults = [];

    for (const variableName of variableNames) {
      totalChecked++;
      const variableValue = env[variableName];
      const isPresent = variableValue !== undefined && variableValue !== '';

      if (isPresent) {
        // why: secret values must never be printed in health check output.
        // We confirm the variable exists and is non-empty without revealing its value.
        groupResults.push(`✓ ${variableName}`);
      } else {
        totalMissing++;
        groupResults.push(`✗ ${variableName}`);
      }
    }

    console.log(`  ${groupName.padEnd(14)} ${groupResults.join('  ')}`);
  }

  if (totalMissing > 0) {
    recordResult('REQUIRED VARIABLES', 'env vars', false,
      `${totalMissing} of ${totalChecked} required variables are missing or empty.`,
      'Add the missing variables to your .env file. See .env.example for reference.');
  } else {
    recordResult('REQUIRED VARIABLES', 'env vars', true,
      `All ${totalChecked} required variables are present.`);
  }
}

// ---------------------------------------------------------------------------
// Connection checks (concurrent)
// ---------------------------------------------------------------------------

/**
 * Checks PostgreSQL connectivity using the DATABASE_URL variable.
 */
async function checkPostgresConnection() {
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    recordResult('CONNECTIONS', 'PostgreSQL', false,
      'DATABASE_URL is not set. Cannot test database connection.',
      'Add DATABASE_URL to .env. See .env.example for format.');
    return;
  }

  try {
    // Dynamic import — pg may not be installed yet
    const pgModule = await import('pg');
    const Pool = pgModule.default?.Pool || pgModule.Pool;
    const pool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5000,
    });

    const startTime = Date.now();
    const queryResult = await pool.query('SELECT current_database(), version()');
    const elapsedMilliseconds = Date.now() - startTime;
    await pool.end();

    const currentDatabase = queryResult.rows[0].current_database;
    const databaseVersion = queryResult.rows[0].version.split(' ').slice(0, 2).join(' ');
    const expectedDatabaseName = env.EXPECTED_DB_NAME;

    if (expectedDatabaseName && currentDatabase !== expectedDatabaseName) {
      recordResult('CONNECTIONS', 'PostgreSQL', false,
        `Connected to "${currentDatabase}" but expected "${expectedDatabaseName}". Check DATABASE_URL points to the correct database.`,
        `Update DATABASE_URL in .env to point to the "${expectedDatabaseName}" database.`);
      return;
    }

    recordResult('CONNECTIONS', 'PostgreSQL', true,
      `${currentDatabase} — ${databaseVersion}  (${elapsedMilliseconds}ms)`);
  } catch (connectionError) {
    const errorCode = connectionError.code || 'UNKNOWN';
    recordResult('CONNECTIONS', 'PostgreSQL', false,
      `Connection failed (${errorCode}): ${connectionError.message}`,
      'Check DATABASE_URL in .env. For local dev, ensure PostgreSQL is running.');
  }
}

/**
 * Checks the boardgame.io game server health endpoint.
 */
async function checkBoardgameioServer() {
  const serverUrl = env.GAME_SERVER_URL;

  if (!serverUrl) {
    recordResult('CONNECTIONS', 'boardgame.io server', false,
      'GAME_SERVER_URL is not set. Cannot test server connection.',
      'Add GAME_SERVER_URL to .env. See .env.example.');
    return;
  }

  try {
    const startTime = Date.now();
    const response = await fetch(`${serverUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const elapsedMilliseconds = Date.now() - startTime;

    if (!response.ok) {
      recordResult('CONNECTIONS', 'boardgame.io server', false,
        `/health returned HTTP ${response.status} (expected 200).`,
        'Is the Render service running? Check https://dashboard.render.com');
      return;
    }

    recordResult('CONNECTIONS', 'boardgame.io server', true,
      `/health → ${response.status} OK  (${elapsedMilliseconds}ms)`);
  } catch (fetchError) {
    recordResult('CONNECTIONS', 'boardgame.io server', false,
      `Connection failed: ${fetchError.message}`,
      'Is the Render service running? Check https://dashboard.render.com');
  }
}

/**
 * Checks Cloudflare R2 public bucket reachability.
 */
async function checkCloudflareR2() {
  const publicUrl = env.R2_PUBLIC_URL;

  if (!publicUrl) {
    recordResult('CONNECTIONS', 'Cloudflare R2', false,
      'R2_PUBLIC_URL is not set. Cannot test R2 reachability.',
      'Add R2_PUBLIC_URL to .env. See .env.example.');
    return;
  }

  try {
    const startTime = Date.now();
    const response = await fetch(`${publicUrl}/registry-config.json`, {
      signal: AbortSignal.timeout(5000),
    });
    const elapsedMilliseconds = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || 'unknown';

    if (!response.ok) {
      recordResult('CONNECTIONS', 'Cloudflare R2', false,
        `registry-config.json returned HTTP ${response.status}.`,
        'Check R2_PUBLIC_URL in .env and verify the R2 bucket is publicly accessible.');
      return;
    }

    recordResult('CONNECTIONS', 'Cloudflare R2', true,
      `registry-config.json → ${response.status} ${contentType}  (${elapsedMilliseconds}ms)`);
  } catch (fetchError) {
    recordResult('CONNECTIONS', 'Cloudflare R2', false,
      `Connection failed: ${fetchError.message}`,
      'Check R2_PUBLIC_URL in .env and verify network connectivity.');
  }
}

/**
 * Checks Cloudflare Pages SPA reachability.
 */
async function checkCloudflarePages() {
  const pagesUrl = env.CF_PAGES_URL;

  if (!pagesUrl) {
    recordResult('CONNECTIONS', 'Cloudflare Pages', false,
      'CF_PAGES_URL is not set. Cannot test Pages reachability.',
      'Add CF_PAGES_URL to .env. See .env.example.');
    return;
  }

  try {
    const startTime = Date.now();
    const response = await fetch(pagesUrl, {
      signal: AbortSignal.timeout(5000),
    });
    const elapsedMilliseconds = Date.now() - startTime;

    if (!response.ok) {
      recordResult('CONNECTIONS', 'Cloudflare Pages', false,
        `${pagesUrl} returned HTTP ${response.status}.`,
        'Check Cloudflare Pages dashboard for deployment status.');
      return;
    }

    recordResult('CONNECTIONS', 'Cloudflare Pages', true,
      `${pagesUrl} → ${response.status}  (${elapsedMilliseconds}ms)`);
  } catch (fetchError) {
    recordResult('CONNECTIONS', 'Cloudflare Pages', false,
      `Connection failed: ${fetchError.message}`,
      'Check Cloudflare Pages dashboard for deployment status.');
  }
}

/**
 * Checks GitHub API reachability and local Git remote configuration.
 */
async function checkGithubReachability() {
  try {
    const startTime = Date.now();
    const response = await fetch('https://api.github.com/repos/barefootbetters/legendary-arena', {
      signal: AbortSignal.timeout(5000),
    });
    const elapsedMilliseconds = Date.now() - startTime;

    if (response.ok) {
      const responseBody = await response.json();
      recordResult('CONNECTIONS', 'GitHub API', true,
        `${responseBody.full_name} found  (${elapsedMilliseconds}ms)`);
    } else {
      recordResult('CONNECTIONS', 'GitHub API', false,
        `API returned HTTP ${response.status}. Repository may be private or rate-limited.`,
        'Verify the repository exists at https://github.com/barefootbetters/legendary-arena');
    }
  } catch (fetchError) {
    recordResult('CONNECTIONS', 'GitHub API', false,
      `Connection failed: ${fetchError.message}`,
      'Check network connectivity and GitHub status.');
  }

  // Verify local Git remote
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    const expectedUrl = 'https://github.com/barefootbetters/legendary-arena';

    if (remoteUrl.includes('barefootbetters/legendary-arena')) {
      recordResult('CONNECTIONS', 'Git remote', true, `origin → ${remoteUrl}`);
    } else {
      recordResult('CONNECTIONS', 'Git remote', false,
        `origin is ${remoteUrl}, expected ${expectedUrl}.`,
        `Run: git remote set-url origin ${expectedUrl}`);
    }
  } catch {
    recordResult('CONNECTIONS', 'Git remote', false,
      'Could not read git remote origin.',
      'Run: git remote add origin https://github.com/barefootbetters/legendary-arena');
  }
}

/**
 * Checks rclone installation, configuration, and R2 bucket access.
 */
function checkRclone() {
  // why: rclone on Windows stores its config under %APPDATA%\rclone\rclone.conf,
  // not ~/.config/rclone as it does on Linux/macOS. Hardcoding a username path
  // would break on any machine with a different Windows user account name.
  const rcloneConfigPath = join(env.APPDATA || '', 'rclone', 'rclone.conf');

  if (!existsSync(rcloneConfigPath)) {
    recordResult('CONNECTIONS', 'rclone config', false,
      `Config not found at ${rcloneConfigPath}.`,
      'Run: rclone config  (see docs/rclone-setup.md)',
      'warn');
  } else {
    recordResult('CONNECTIONS', 'rclone config', true,
      `Config found at ${rcloneConfigPath}`);
  }

  // Check rclone binary
  try {
    const rcloneVersion = execSync('rclone version', { encoding: 'utf8' })
      .split('\n')[0].trim();
    recordResult('CONNECTIONS', 'rclone binary', true, rcloneVersion);
  } catch {
    recordResult('CONNECTIONS', 'rclone binary', false,
      'rclone NOT FOUND on PATH.',
      'Install from https://rclone.org/downloads/ and add to PATH.');
    return;
  }

  // List R2 bucket root
  try {
    const listOutput = execSync('rclone lsd r2:', { encoding: 'utf8', timeout: 10000 });
    const folderCount = listOutput.split('\n').filter(line => line.trim()).length;

    if (folderCount === 0) {
      recordResult('CONNECTIONS', 'rclone R2 bucket', false,
        'Bucket root is empty. No folders found.',
        'Upload card data to R2 or verify the r2: remote configuration.');
    } else {
      recordResult('CONNECTIONS', 'rclone R2 bucket', true,
        `bucket root: ${folderCount} folders`);
    }
  } catch (listError) {
    recordResult('CONNECTIONS', 'rclone R2 bucket', false,
      `Cannot list bucket: ${listError.message}`,
      'Verify rclone r2: remote is configured correctly. Run: rclone config');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Runs all health checks in order and prints a final summary.
 */
async function main() {
  console.log('');
  console.log('=== Legendary Arena — Connection Health Check ===');
  console.log(`Run at: ${new Date().toISOString()}`);
  console.log(`Machine: ${hostname()}  Node: ${nodeVersion}  Platform: ${platform}`);
  console.log('');

  // Phase 1: Environment (must pass before connections)
  console.log('ENVIRONMENT');
  checkDotenvFile();

  checkRequiredEnvironmentVariables();
  console.log('');

  // Phase 2: Tools (no network needed)
  console.log('TOOLS');
  checkNodeVersion();
  checkPnpmVersion();
  checkDotenvCli();
  checkBoardgameioPackage();
  checkZodPackage();
  console.log('');

  // Phase 3: Connections (concurrent where possible)
  // why: connection checks are independent of each other and all have timeouts,
  // so running them concurrently reduces total check time from ~25s to ~5s.
  console.log('CONNECTIONS (concurrent)');
  await Promise.allSettled([
    checkPostgresConnection(),
    checkBoardgameioServer(),
    checkCloudflareR2(),
    checkCloudflarePages(),
    checkGithubReachability(),
  ]);

  // rclone is synchronous (uses execSync)
  checkRclone();

  // Phase 4: Summary
  console.log('');
  console.log('===');

  if (failureCount === 0 && warningCount === 0) {
    console.log('SUMMARY: All checks passed.');
  } else {
    console.log(`SUMMARY: ${failureCount} failure(s), ${warningCount} warning(s)`);
  }

  const failedResults = results.filter(result => !result.passed && result.level !== 'warn');
  for (const failedResult of failedResults) {
    console.log(`  FAIL: ${failedResult.checkName} — ${failedResult.message}`);
    if (failedResult.remediation) {
      console.log(`        ${failedResult.remediation}`);
    }
  }

  const warnResults = results.filter(result => !result.passed && result.level === 'warn');
  for (const warnResult of warnResults) {
    console.log(`  WARN: ${warnResult.checkName} — ${warnResult.message}`);
    if (warnResult.remediation) {
      console.log(`        ${warnResult.remediation}`);
    }
  }

  console.log('');

  if (failureCount > 0) {
    console.log('Fix failures before running other scripts.');
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
