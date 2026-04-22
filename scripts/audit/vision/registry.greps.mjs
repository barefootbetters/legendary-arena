/**
 * Legendary Arena — Vision Alignment Audit: Registry & Content Boundary
 *
 * Scans the codebase for content-as-data violations defined in
 * Vision §1 (Rules Authenticity), §2 (Content Authenticity), and
 * §10 (Content as Data — expansions must not require new engine logic).
 *
 * The engine must source card data from the registry exclusively.
 * Hardcoded card identifiers, image URLs, or direct R2 fetches in
 * engine code couple gameplay to specific content and break §10.
 *
 * Run via: node scripts/audit/vision/registry.greps.mjs
 *
 * Exit code 0 = no critical findings. Exit code 1 = at least one
 * critical finding. Warnings never fail the run.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);

/**
 * Rule definitions for registry / content-boundary violations.
 *
 * Pattern dialect: PCRE (passed to `git grep -P`).
 */
export const RULES = [
  {
    id: 'REG-001',
    pattern: 'https://images\\.barefootbetters\\.com',
    clause: 'Vision §10',
    severity: 'critical',
    paths: ['packages/game-engine/src/'],
    excludePaths: ['**/*.test.ts'],
    description:
      'Engine must not hardcode R2 image URLs. Images are a UI/registry concern — engine never sees them.',
  },
  {
    id: 'REG-002',
    pattern: '\\bfetch\\(',
    clause: 'Vision §8, §10',
    severity: 'critical',
    paths: ['packages/game-engine/src/'],
    excludePaths: ['**/*.test.ts'],
    description:
      'Engine must not perform network I/O. Registry data is loaded once at setup time and passed in.',
  },
  {
    id: 'REG-003',
    pattern: 'readFile|readFileSync|createReadStream',
    clause: 'Vision §8, §10',
    severity: 'critical',
    paths: ['packages/game-engine/src/'],
    excludePaths: ['**/*.test.ts'],
    description:
      'Engine must not read from the filesystem. Loading is a registry/server concern.',
  },
  {
    id: 'REG-004',
    pattern: 'from [\'"]@legendary-arena/registry[\'"]',
    clause: 'Vision §7, §10',
    severity: 'warning',
    paths: ['packages/game-engine/src/'],
    excludePaths: ['**/*.test.ts', 'packages/game-engine/src/setup/'],
    description:
      'Runtime engine code should not import the registry. Registry data flows in via Game.setup() arguments.',
  },
];

/**
 * Runs a single rule via git grep and prints any findings.
 *
 * @param {object} rule - One entry from the RULES array.
 * @returns {Promise<{ critical: number, warning: number }>} finding counts.
 */
async function runRule(rule) {
  const args = ['grep', '-n', '-P', '-e', rule.pattern, '--'];
  for (const path of rule.paths) {
    args.push(path);
  }
  for (const exclude of rule.excludePaths) {
    args.push(`:(exclude,glob)${exclude}`);
  }

  let stdout = '';
  try {
    const result = await execFileAsync('git', args, { maxBuffer: 8 * 1024 * 1024 });
    stdout = result.stdout;
  } catch (error) {
    // why: git grep exits 1 when no matches are found — treat that as zero findings.
    if (error.code === 1 && (!error.stdout || error.stdout.length === 0)) {
      return { critical: 0, warning: 0 };
    }
    throw error;
  }

  const lines = stdout.split('\n').filter((line) => line.length > 0);
  for (const line of lines) {
    console.log(`[${rule.severity.toUpperCase()}] ${rule.id} (${rule.clause}): ${line}`);
    console.log(`    ${rule.description}`);
  }

  if (rule.severity === 'critical') {
    return { critical: lines.length, warning: 0 };
  }
  return { critical: 0, warning: lines.length };
}

/**
 * Runs every rule in RULES and prints a summary footer.
 *
 * @returns {Promise<number>} total critical-finding count.
 */
export async function runRules() {
  let totalCritical = 0;
  let totalWarning = 0;

  for (const rule of RULES) {
    const counts = await runRule(rule);
    totalCritical += counts.critical;
    totalWarning += counts.warning;
  }

  console.log('---');
  console.log(`registry.greps.mjs — ${totalCritical} critical, ${totalWarning} warning`);
  return totalCritical;
}

const invokedDirectly = import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  runRules().then((criticalCount) => {
    process.exit(criticalCount > 0 ? 1 : 0);
  });
}
