/**
 * Legendary Arena — Vision Alignment Audit: Determinism
 *
 * Scans the engine for sources of nondeterminism that would violate
 * Vision §3 (Trust & Fairness), §22 (Deterministic & Reproducible
 * Evaluation), and §26 (Simulation-Calibrated PAR Determination).
 *
 * Each rule pairs a grep pattern with the clause it protects and a
 * severity. The runner shells out to `git grep` so only tracked files
 * are scanned (gitignored paths and `.claude/worktrees/` are excluded
 * automatically).
 *
 * DET-001 additionally applies a comment-aware filter so the gate fires
 * only on executable `Math.random(` use. Doc-comment hits are recorded
 * separately by the orchestrator (`run-all.mjs`) against a fixed
 * allowlist. See `isDocCommentLine` below and WP-085 Scope (In) §B.
 *
 * Run via: node scripts/audit/vision/determinism.greps.mjs
 *
 * Exit code 0 = no critical findings. Exit code 1 = at least one
 * critical finding. Warnings never fail the run.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);

/**
 * Rule definitions for determinism violations.
 *
 * Pattern dialect: PCRE (passed to `git grep -P`). Each rule limits its
 * scan to `paths` and excludes any path matching `excludePaths`.
 */
export const RULES = [
  {
    id: 'DET-001',
    pattern: 'Math\\.random\\(',
    clause: 'Vision §22',
    severity: 'critical',
    paths: ['packages/game-engine/src/'],
    excludePaths: ['**/*.test.ts'],
    description:
      'Engine runtime must use ctx.random.* exclusively. Math.random breaks replay determinism.',
  },
  {
    id: 'DET-002',
    pattern: 'Date\\.now\\(',
    clause: 'Vision §22',
    severity: 'critical',
    paths: ['packages/game-engine/src/'],
    excludePaths: ['**/*.test.ts'],
    description:
      'Wall-clock reads in engine code break replay determinism. Use deterministic counters instead.',
  },
  {
    id: 'DET-003',
    pattern: 'performance\\.now\\(',
    clause: 'Vision §22',
    severity: 'critical',
    paths: ['packages/game-engine/src/'],
    excludePaths: ['**/*.test.ts'],
    description:
      'High-resolution timing is nondeterministic and must not appear in engine runtime.',
  },
  {
    id: 'DET-004',
    pattern: '\\b(setTimeout|setInterval)\\(',
    clause: 'Vision §22',
    severity: 'critical',
    paths: ['packages/game-engine/src/'],
    excludePaths: ['**/*.test.ts'],
    description:
      'Timers introduce wall-clock dependence. Engine moves and rules must run synchronously.',
  },
  {
    id: 'DET-005',
    pattern: 'crypto\\.randomUUID\\(',
    clause: 'Vision §22',
    severity: 'critical',
    paths: ['packages/game-engine/src/'],
    excludePaths: ['**/*.test.ts'],
    description:
      'crypto.randomUUID is nondeterministic. Use ctx.random.* derived identifiers instead.',
  },
  {
    id: 'DET-006',
    pattern: 'process\\.env',
    clause: 'Vision §22',
    severity: 'critical',
    paths: ['packages/game-engine/src/moves/', 'packages/game-engine/src/rules/'],
    excludePaths: ['**/*.test.ts'],
    description:
      'Environment reads inside moves or rules make replay outcomes machine-dependent.',
  },
  {
    id: 'DET-007',
    pattern: 'new Date\\(',
    clause: 'Vision §22',
    severity: 'warning',
    paths: ['packages/game-engine/src/'],
    excludePaths: ['**/*.test.ts'],
    description:
      'Date construction in engine code is suspicious; verify any hit has a // why: comment.',
  },
];

/**
 * Returns true when a `git grep -n` output line describes a JSDoc or
 * single-line comment. The line is expected in the form
 * `path:lineno:content`; the content portion (after the second colon) is
 * trimmed of leading whitespace and inspected for a `//`, `/*`, or `*`
 * prefix.
 *
 * @param {string} rawLine - One line of `git grep -n` output.
 * @returns {boolean} True when the content portion is comment markup.
 */
export function isDocCommentLine(rawLine) {
  const firstColon = rawLine.indexOf(':');
  if (firstColon < 0) {
    return false;
  }
  const secondColon = rawLine.indexOf(':', firstColon + 1);
  if (secondColon < 0) {
    return false;
  }
  const content = rawLine.slice(secondColon + 1);
  const trimmed = content.replace(/^\s+/, '');
  if (trimmed.startsWith('//')) {
    return true;
  }
  if (trimmed.startsWith('/*')) {
    return true;
  }
  if (trimmed.startsWith('*')) {
    return true;
  }
  return false;
}

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

  let lines = stdout.split('\n').filter((line) => line.length > 0);
  if (rule.id === 'DET-001') {
    // why: DET-001 protects the executable determinism invariant (Vision §22).
    // Doc-comment occurrences of the forbidden call are pure documentation
    // warnings ("never use ...") and must not trip the gate; only executable
    // use breaks replay. DET-007 is asymmetric and does NOT apply this
    // filter: a comment line reading "snapshotAt uses ..." is the canonical
    // site documentation and carries equal audit meaning to the executable
    // hit one or two lines below. Filtering DET-007 would destroy audit
    // signal. The six doc-comment hits DET-001 removes here are verified
    // by the orchestrator (`run-all.mjs`) against a fixed file:line
    // allowlist per WP-085 AC-3.
    lines = lines.filter((rawLine) => !isDocCommentLine(rawLine));
  }
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
  console.log(`determinism.greps.mjs — ${totalCritical} critical, ${totalWarning} warning`);
  return totalCritical;
}

const invokedDirectly = import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  runRules().then((criticalCount) => {
    process.exit(criticalCount > 0 ? 1 : 0);
  });
}
