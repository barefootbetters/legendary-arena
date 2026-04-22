/**
 * Legendary Arena — Vision Alignment Audit: Monetization Boundary
 *
 * Scans the codebase for patterns that would cross any of the Vision
 * Non-Goals (NG-1 Pay-to-Win, NG-2 Gacha/Loot Boxes, NG-3 Content
 * Withholding, NG-4 Energy/Timers, NG-5 Ads, NG-6 Dark Patterns,
 * NG-7 Apologetic Monetization).
 *
 * Most rules are expected to produce zero findings on the current
 * codebase — that is the point. They exist to fail loudly the first
 * time someone introduces a payer-tier check, gacha mechanic, or
 * cosmetic-flag misuse into engine or move logic.
 *
 * Run via: node scripts/audit/vision/monetization.greps.mjs
 *
 * Exit code 0 = no critical findings. Exit code 1 = at least one
 * critical finding. Warnings never fail the run.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);

/**
 * Rule definitions for monetization-boundary violations.
 *
 * Pattern dialect: PCRE (passed to `git grep -P`). Engine and move
 * paths are scanned strictly; UI and server paths use looser matching
 * because legitimate cosmetic/billing logic may live there in future.
 */
export const RULES = [
  {
    id: 'MON-001',
    pattern: '\\b(lootBox|loot_box|gacha|randomDraw|mysteryPack)\\b',
    clause: 'Vision NG-2',
    severity: 'critical',
    paths: ['packages/', 'apps/'],
    excludePaths: ['**/*.test.ts', '**/*.test.mjs'],
    description:
      'Gacha and loot-box patterns are permanently disallowed (NG-2). All purchasable content must be deterministic.',
  },
  {
    id: 'MON-002',
    pattern: '\\b(payWall|paywall|paidTier|payerOnly|supporterOnly|premiumOnly)\\b',
    clause: 'Vision NG-1',
    severity: 'critical',
    paths: ['packages/game-engine/', 'packages/preplan/'],
    excludePaths: ['**/*.test.ts'],
    description:
      'Engine and preplan must not gate behavior on pay tiers (NG-1). Cosmetic/access logic belongs in apps/server only.',
  },
  {
    id: 'MON-003',
    pattern: '\\b(accountType|subscriptionType|ownershipLevel)\\s*===',
    clause: 'Vision §3, NG-1',
    severity: 'critical',
    paths: ['packages/game-engine/'],
    excludePaths: ['**/*.test.ts'],
    description:
      'Engine gating on account type breaks neutrality (§3) and risks pay-to-win (NG-1).',
  },
  {
    id: 'MON-004',
    pattern: '\\b(isPayer|hasSupporter|hasPaidAccess)\\(',
    clause: 'Vision §3, NG-1',
    severity: 'critical',
    paths: ['packages/game-engine/', 'packages/preplan/'],
    excludePaths: ['**/*.test.ts'],
    description:
      'Engine must never branch on payer status. Apply such checks at the server boundary if needed.',
  },
  {
    id: 'MON-005',
    pattern: '\\b(energyCost|cooldownExpiresAt|skipTimerCost)\\b',
    clause: 'Vision NG-4',
    severity: 'critical',
    paths: ['packages/', 'apps/'],
    excludePaths: ['**/*.test.ts'],
    description:
      'Energy systems and pay-to-skip timers are permanently disallowed (NG-4).',
  },
  {
    id: 'MON-006',
    pattern: '\\b(adImpression|sponsorSlot|brandedCard)\\b',
    clause: 'Vision NG-5',
    severity: 'critical',
    paths: ['packages/', 'apps/'],
    excludePaths: ['**/*.test.ts'],
    description:
      'In-gameplay advertising and sponsor surfaces are permanently disallowed (NG-5).',
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
  console.log(`monetization.greps.mjs — ${totalCritical} critical, ${totalWarning} warning`);
  return totalCritical;
}

const invokedDirectly = import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  runRules().then((criticalCount) => {
    process.exit(criticalCount > 0 ? 1 : 0);
  });
}
