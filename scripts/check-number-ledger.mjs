/**
 * check-number-ledger.mjs — the WP / EC / D allocation-lock validator.
 *
 * The problem this guards (see D-24242): WP / EC / D numbers are allocated by
 * reading the current frontier of WORK_INDEX / EC_INDEX / DECISIONS, but that
 * read is NOT atomic against a concurrent session that merges first. Two
 * sessions can both pick the same free number; whoever merges first wins and
 * the other collides — discovered late, at merge time (this happened with
 * WP-419 → renumbered to WP-421).
 *
 * The lock is `docs/ai/NUMBER-LEDGER.md`: an append-only reservation ledger with
 * a `high-water` per space and one line per allocation AT OR ABOVE it. Three
 * layers of protection, honestly scoped:
 *   1. `.gitattributes` marks the ledger `merge=union`, so concurrent DISTINCT
 *      reservations auto-merge (no conflict) on local rebase/merge — this cuts
 *      the friction that makes the big prose indices conflict.
 *   2. This `--check` gate (wired into CI) fails LOUDLY on a DUPLICATE
 *      reservation (two sessions picking the same number → two identical lines,
 *      which union-merge keeps) and on DRIFT (a frontier number used in an index
 *      without a matching ledger reservation). Late-and-silent becomes
 *      early-and-loud.
 *   3. The protocol (docs/ai/REFERENCE/01.0a-wp-drafting-phase.md): reserve the
 *      number in the ledger in the SPEC commit and get that tiny append merged
 *      FIRST, shrinking the race window to near-zero.
 *
 * Union-merge is a LOCAL git driver; it does not run on GitHub's server-side
 * squash. That is fine: the dup-check is the real safety net and catches a
 * same-number race regardless of how the merge happened.
 *
 * Usage:
 *   node scripts/check-number-ledger.mjs --check          # CI gate (exit 1 on any problem)
 *   node scripts/check-number-ledger.mjs --next wp|ec|d    # print the next free number
 *   node scripts/check-number-ledger.mjs                   # summary: next free per space
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = join(repoRoot, 'docs/ai/NUMBER-LEDGER.md');
const WORK_INDEX = join(repoRoot, 'docs/ai/work-packets/WORK_INDEX.md');
const EC_INDEX = join(repoRoot, 'docs/ai/execution-checklists/EC_INDEX.md');
const DECISIONS = join(repoRoot, 'docs/ai/DECISIONS.md');

// The three number spaces. `prefix` is the ledger/reference token; `index`
// enumerates the ALLOCATION lines (headings / checkbox rows / table rows — not
// mere in-prose mentions) in that space's index file.
const SPACES = [
  {
    key: 'wp',
    prefix: 'WP',
    indexFile: WORK_INDEX,
    // why: a WP is allocated by a WORK_INDEX checkbox row (`- [x]`/`- [ ]`),
    // never by an in-prose "see WP-123" mention.
    indexRe: /^- \[[x ]\] (WP-\d+(?:\.\d+)?)\b/gm,
  },
  {
    key: 'ec',
    prefix: 'EC',
    indexFile: EC_INDEX,
    // why: an EC is allocated by a table row that starts `| EC-NNN`.
    indexRe: /^\| (EC-\d+)\b/gm,
  },
  {
    key: 'd',
    prefix: 'D',
    indexFile: DECISIONS,
    // why: a decision is allocated by an `### D-NNNNN —` heading, never by an
    // in-prose "per D-123" back-reference.
    indexRe: /^### (D-\d+)\b/gm,
  },
];

/** Numeric value of a token like `WP-042.1` → 42.1, `D-24241` → 24241. */
function numOf(token) {
  return Number(token.replace(/^[A-Z]+-/, ''));
}

/** Body of the `## <PREFIX>` section: its lines up to the next `## ` heading or EOF. */
function sectionBody(lines, prefix) {
  const start = lines.findIndex((l) => new RegExp(`^## ${prefix}\\b`).test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n');
}

/** Parses the ledger into { wp, ec, d } each = { highWater, reservations: [{token, num, line}] }. */
function parseLedger() {
  const lines = readFileSync(LEDGER, 'utf8').split(/\r?\n/);
  const out = {};
  for (const space of SPACES) {
    const body = sectionBody(lines, space.prefix);
    if (body === null) {
      throw new Error(`NUMBER-LEDGER.md is missing the "## ${space.prefix}" section.`);
    }
    const hw = body.match(/^high-water:\s*(\d+)\s*$/m);
    if (hw === null) {
      throw new Error(`NUMBER-LEDGER.md "## ${space.prefix}" section has no "high-water: N" line.`);
    }
    const reservations = [];
    const resRe = new RegExp(`^-\\s*(${space.prefix}-\\d+(?:\\.\\d+)?)\\b`, 'gm');
    for (const m of body.matchAll(resRe)) {
      reservations.push({ token: m[1], num: numOf(m[1]), line: m[0] });
    }
    out[space.key] = { highWater: Number(hw[1]), reservations };
  }
  return out;
}

/** The allocation tokens actually used in a space's index file. */
function indexAllocations(space) {
  const text = readFileSync(space.indexFile, 'utf8');
  return [...text.matchAll(space.indexRe)].map((m) => m[1]);
}

function nextFree(key, ledger) {
  const space = SPACES.find((s) => s.key === key);
  const l = ledger[key];
  const reservedMax = l.reservations.reduce((max, r) => Math.max(max, Math.floor(r.num)), 0);
  return `${space.prefix}-${Math.max(l.highWater, reservedMax) + 1}`;
}

function runCheck() {
  const ledger = parseLedger();
  const problems = [];

  for (const space of SPACES) {
    const l = ledger[space.key];

    // 1) Duplicate reservations — the double-allocation catch.
    const seen = new Map();
    for (const r of l.reservations) {
      seen.set(r.token, (seen.get(r.token) ?? 0) + 1);
    }
    for (const [token, count] of seen) {
      if (count > 1) {
        problems.push(
          `[${space.prefix}] DUPLICATE reservation ${token} (x${count}) — two sessions allocated the same number; one must renumber to ${nextFree(space.key, ledger)}.`,
        );
      }
    }

    // 2) Drift — a frontier allocation used in the index with no reservation.
    const reserved = new Set(l.reservations.map((r) => r.token));
    for (const token of indexAllocations(space)) {
      if (numOf(token) > l.highWater && !reserved.has(token)) {
        problems.push(
          `[${space.prefix}] UNRESERVED ${token} appears in ${space.indexFile.replace(repoRoot + '/', '')} but not in NUMBER-LEDGER.md (add a reservation line under "## ${space.prefix}").`,
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error('Number-ledger check FAILED:\n');
    for (const p of problems) console.error(`  - ${p}`);
    console.error('\nSee docs/ai/REFERENCE/01.0a-wp-drafting-phase.md (allocation protocol) and D-24245.');
    process.exit(1);
  }
  console.log('Number-ledger check passed. Next free:',
    SPACES.map((s) => nextFree(s.key, ledger)).join('  '));
}

// ── Entry ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (argv.includes('--check')) {
  runCheck();
} else if (argv.includes('--next')) {
  const key = (argv[argv.indexOf('--next') + 1] ?? '').toLowerCase();
  if (!SPACES.some((s) => s.key === key)) {
    console.error('Usage: --next wp|ec|d');
    process.exit(2);
  }
  console.log(nextFree(key, parseLedger()));
} else {
  const ledger = parseLedger();
  console.log('Next free WP / EC / D allocation:');
  for (const s of SPACES) console.log(`  ${nextFree(s.key, ledger)}`);
  console.log('\nReserve in docs/ai/NUMBER-LEDGER.md (SPEC commit), then run --check.');
}
