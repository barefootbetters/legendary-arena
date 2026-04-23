#!/usr/bin/env node
// docs/ai/audits/sync-wp-status.mjs
//
// Ad-hoc audit — NOT a Work Packet, no lifecycle.
// Reads WORK_INDEX.md (authoritative) and rewrites the stale `**Status:**`
// header line in individual WP-*.md files when the file says `Ready` /
// `Ready for Implementation` but the index marks the WP `[x]` complete.
//
// Preserves:
//   - All text after the replaced phrase (amendment notes, dates, etc.)
//   - Other `**Status:**` lines deeper in the file (e.g. embedded policy docs)
//   - File line endings (LF or CRLF — we splice the one matched line only)
// Leaves untouched:
//   - Files whose first status token is Draft / Complete / Active Policy /
//     Not yet reviewed / anything other than Ready
//   - Files whose WP id is not present in WORK_INDEX.md
//   - Files whose index marker is `[ ]` (genuinely pending)
//
// Usage (from anywhere):
//   node docs/ai/audits/sync-wp-status.mjs            # dry-run (default)
//   node docs/ai/audits/sync-wp-status.mjs --apply    # write changes

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const packetsDir = join(repoRoot, 'docs', 'ai', 'work-packets');
const indexPath = join(packetsDir, 'WORK_INDEX.md');

const apply = process.argv.includes('--apply');

async function loadIndexStatus() {
  const indexText = await readFile(indexPath, 'utf8');
  const status = new Map();
  const lineRegex = /^- \[([x ])\] (WP-\d+[A-Z]?(?:\.\d+)?)\b/gm;
  let match;
  while ((match = lineRegex.exec(indexText)) !== null) {
    const [, mark, wpId] = match;
    status.set(wpId, mark === 'x' ? 'complete' : 'pending');
  }
  return status;
}

async function findWpFiles() {
  const entries = await readdir(packetsDir);
  return entries
    .filter((name) => /^WP-\d+[A-Z]?-.+\.md$/.test(name))
    .map((name) => ({
      name,
      wpId: name.match(/^(WP-\d+[A-Z]?)-/)[1],
      path: join(packetsDir, name),
    }));
}

function planRewrite(originalText, indexMark) {
  if (indexMark !== 'complete') return null;
  const headerRegex = /^\*\*Status:\*\*.*$/m;
  const match = headerRegex.exec(originalText);
  if (!match) return null;
  const line = match[0];
  const replaced = line.replace(
    /^(\*\*Status:\*\*\s+)(Ready for Implementation|Ready)(\b.*)$/,
    (_whole, head, _keyword, tail) => `${head}Complete${tail}`,
  );
  if (replaced === line) return null;
  const startIdx = match.index;
  const endIdx = startIdx + line.length;
  return {
    before: line,
    after: replaced,
    newText: originalText.slice(0, startIdx) + replaced + originalText.slice(endIdx),
  };
}

async function main() {
  const index = await loadIndexStatus();
  const files = await findWpFiles();

  const plans = [];
  const skippedNoIndexEntry = [];
  const skippedPending = [];
  const skippedNotReady = [];
  for (const file of files) {
    const indexMark = index.get(file.wpId);
    if (!indexMark) {
      skippedNoIndexEntry.push(file.name);
      continue;
    }
    const text = await readFile(file.path, 'utf8');
    const plan = planRewrite(text, indexMark);
    if (plan) {
      plans.push({ file, plan });
    } else if (indexMark === 'pending') {
      skippedPending.push(file.name);
    } else {
      skippedNotReady.push(file.name);
    }
  }

  console.log(
    `Scanned ${files.length} WP files. ` +
      `Rewrites planned: ${plans.length}. ` +
      `Skipped (pending in index): ${skippedPending.length}. ` +
      `Skipped (header not Ready): ${skippedNotReady.length}. ` +
      `Skipped (no index entry): ${skippedNoIndexEntry.length}.\n`,
  );

  for (const { file, plan } of plans) {
    console.log(file.name);
    console.log(`  - ${plan.before}`);
    console.log(`  + ${plan.after}`);
  }

  if (skippedNoIndexEntry.length > 0) {
    console.log('\nWP files with no WORK_INDEX entry (surface for review):');
    for (const name of skippedNoIndexEntry) console.log(`  ${name}`);
  }

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to write changes.');
    return;
  }

  for (const { file, plan } of plans) {
    await writeFile(file.path, plan.newText, 'utf8');
  }
  console.log(`\nApplied ${plans.length} changes.`);
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
