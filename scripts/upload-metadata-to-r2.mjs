/**
 * upload-metadata-to-r2.mjs — Publish the cards-site metadata to R2 with a
 * short Cache-Control.
 *
 * The registry viewer (cards.legendary-arena.com) and the loadout builder read
 * card data at runtime from `{metadataBaseUrl}/metadata/*.json`. That one R2
 * prefix is fed by two disjoint local folders:
 *   - data/cards/*.json     — the per-set card files (core.json, 2099.json, …)
 *   - data/metadata/*.json  — taxonomy / pattern / index files (sets.json, …)
 *
 * Before this script those files were uploaded with a bare `rclone copy`, so the
 * objects carried NO Cache-Control and every browser picked its own heuristic
 * freshness. After WP-797 (#2639) re-uploaded core.json with Dr. Doom's corrected
 * Always Leads, a returning visitor's browser kept the old copy and the loadout
 * builder still locked Masters of Evil to Dr. Doom until a hard reload (D-24674).
 *
 * Every upload now sets `Cache-Control: public, max-age=300, must-revalidate`
 * (the same recipe as scripts/upload-move-sfx-to-r2.mjs): a data fix reaches
 * every browser within five minutes, and the revalidation is a cheap 304
 * against the object's ETag.
 *
 * Prerequisites:
 *   - rclone on PATH with the `r2:` remote (`env_auth = true`).
 *   - AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in the environment. When they
 *     are missing the script reads just those two keys from the repo's `.env`.
 *
 * What it publishes: the COMMITTED files at a git ref (default HEAD), staged into
 * a temp folder byte-for-byte from git — never the working tree, which on Windows
 * is CRLF and may hold uncommitted edits. Run it from an up-to-date `main`.
 *
 * Usage:
 *   pnpm metadata:upload [--dry-run] [--backfill] [--ref <git-ref>] [--cache-control <v>]
 *
 *   --dry-run          Show what rclone would upload; change nothing.
 *   --backfill         Re-upload EVERY file (rclone --ignore-times) so objects
 *                      already in R2 get the Cache-Control header. Plain runs
 *                      compare MD5 checksums and upload only changed files.
 *   --ref <git-ref>    Publish a different commit (default HEAD).
 *   --cache-control v  Override the header value.
 *
 * Never use `rclone sync` here: the R2 prefix is the union of two local folders,
 * so syncing either one would delete the other's files (r2-data-checklist §A.8).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// why: the files have FIXED names (core.json) that are replaced in place, so a
// long or immutable max-age would pin stale card data; five minutes plus
// revalidation lets a fix land on its own (the D-24674 stale-lead incident).
export const DEFAULT_CACHE_CONTROL = 'public, max-age=300, must-revalidate';

/** The R2 destination both local folders publish into. */
export const R2_METADATA_DESTINATION = 'r2:legendary-images/metadata';

/** The public URL used to read a published object back for verification. */
export const PUBLIC_METADATA_BASE_URL = 'https://images.legendary-arena.com/metadata';

/** The local source folders, relative to the repo root, in upload order. */
export const METADATA_SOURCE_FOLDERS = ['data/metadata', 'data/cards'];

/**
 * Builds the rclone argument list for one source folder.
 *
 * @param {object} options
 * @param {string} options.sourceFolder - Absolute or relative local folder.
 * @param {string} options.cacheControl - The Cache-Control value to set.
 * @param {boolean} options.isBackfill - Re-upload unchanged files so they get the header.
 * @param {boolean} options.isDryRun - Report only; change nothing.
 * @returns {string[]} The arguments after `rclone`.
 */
export function buildRcloneCopyArgs({ sourceFolder, cacheControl, isBackfill, isDryRun }) {
  const args = [
    'copy',
    sourceFolder,
    R2_METADATA_DESTINATION,
    '--include',
    '*.json',
    '--s3-no-check-bucket',
    '--header-upload',
    `Cache-Control: ${cacheControl}`,
  ];
  if (isBackfill) {
    // why: a backfill must rewrite every object so each one gets the header, even
    // when its content is unchanged.
    args.push('--ignore-times');
  } else {
    // why: the staged files get fresh modtimes on every run, so compare by MD5 —
    // only files whose committed content changed are uploaded.
    args.push('--checksum');
  }
  if (isDryRun) {
    args.push('--dry-run');
  }
  return args;
}

/**
 * Writes the committed JSON files of one repo folder into a staging folder,
 * byte-for-byte as git stores them.
 *
 * // why: a Windows checkout has CRLF line endings, while R2 holds the LF bytes
 * git stores; uploading the working tree would push bloated, different copies of
 * every file. Publishing committed blobs also keeps uncommitted local edits from
 * reaching production.
 *
 * @param {string} repoRoot - The repository root.
 * @param {string} gitRef - The commit to publish, e.g. `HEAD`.
 * @param {string} folder - The repo-relative folder, e.g. `data/cards`.
 * @param {string} stagingFolder - Where the files are written.
 * @returns {number} How many files were staged.
 */
function stageCommittedJson(repoRoot, gitRef, folder, stagingFolder) {
  mkdirSync(stagingFolder, { recursive: true });
  const listing = execFileSync('git', ['ls-tree', '--name-only', gitRef, `${folder}/`], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  let stagedCount = 0;
  for (const repoPath of listing.split('\n')) {
    if (!repoPath.endsWith('.json')) {
      continue;
    }
    const bytes = execFileSync('git', ['show', `${gitRef}:${repoPath}`], {
      cwd: repoRoot,
      maxBuffer: 64 * 1024 * 1024,
    });
    writeFileSync(join(stagingFolder, basename(repoPath)), bytes);
    stagedCount++;
  }
  return stagedCount;
}

/**
 * Stages one folder's committed files and copies them to R2.
 *
 * @param {string} repoRoot - The repository root.
 * @param {string} gitRef - The commit to publish.
 * @param {string} folder - The repo-relative folder.
 * @param {string} stagingFolder - The temp folder to stage into.
 * @param {{cacheControl: string, isBackfill: boolean, isDryRun: boolean}} options
 * @returns {boolean} Whether staging and the copy succeeded.
 */
function publishFolder(repoRoot, gitRef, folder, stagingFolder, options) {
  let stagedCount;
  try {
    stagedCount = stageCommittedJson(repoRoot, gitRef, folder, stagingFolder);
  } catch (error) {
    console.error(`Could not read ${folder} at ${gitRef} from git (${error.message}). Check that --ref names a commit.`);
    return false;
  }
  console.log(`\nStaged ${stagedCount} committed file(s) from ${folder} at ${gitRef}.`);
  const args = buildRcloneCopyArgs({ sourceFolder: stagingFolder, ...options });
  console.log(`rclone ${args.join(' ')}`);
  try {
    execFileSync('rclone', args, { stdio: 'inherit' });
  } catch (error) {
    console.error(`rclone copy of ${folder} failed (${error.message}). Check that rclone is on PATH and the r2: remote works (rclone lsd r2:legendary-images).`);
    return false;
  }
  return true;
}

/**
 * Reads one `--flag value` pair from argv.
 *
 * @param {string[]} argv - The process arguments.
 * @param {string} name - The flag name, e.g. `--cache-control`.
 * @param {string} fallback - The value when the flag is absent.
 * @returns {string} The flag value.
 */
function readFlag(argv, name, fallback) {
  const index = argv.indexOf(name);
  if (index === -1 || index === argv.length - 1) {
    return fallback;
  }
  return argv[index + 1];
}

/**
 * Loads AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from the repo `.env` when they
 * are not already in the environment. Only those two keys are read.
 *
 * @param {string} repoRoot - The repository root.
 */
function loadR2CredentialsFromDotEnv(repoRoot) {
  const wantedKeys = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
  let hasAllKeys = true;
  for (const key of wantedKeys) {
    if (!process.env[key]) {
      hasAllKeys = false;
    }
  }
  if (hasAllKeys) {
    return;
  }
  const dotEnvPath = join(repoRoot, '.env');
  if (!existsSync(dotEnvPath)) {
    return;
  }
  for (const line of readFileSync(dotEnvPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && wantedKeys.includes(match[1]) && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

/**
 * Reads core.json back from the public URL (cache-busted) and reports its
 * Cache-Control, so a publish is verified, not assumed.
 *
 * @param {string} expectedCacheControl - The value the upload set.
 * @returns {Promise<boolean>} Whether the header matches.
 */
async function verifyPublishedHeader(expectedCacheControl) {
  const url = `${PUBLIC_METADATA_BASE_URL}/core.json?t=${Date.now()}`;
  try {
    const response = await fetch(url, { method: 'GET' });
    const actual = response.headers.get('cache-control') ?? '';
    console.log(`Verify: ${url} → HTTP ${response.status}, Cache-Control: "${actual}"`);
    return actual === expectedCacheControl;
  } catch (error) {
    console.error(`Verify failed: could not fetch ${url} (${error.message}). Check the network, then re-run.`);
    return false;
  }
}

/**
 * Runs the upload for both source folders, then verifies the header.
 *
 * @param {string[]} argv - The process arguments.
 */
async function main(argv) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const isDryRun = argv.includes('--dry-run');
  const isBackfill = argv.includes('--backfill');
  const cacheControl = readFlag(argv, '--cache-control', DEFAULT_CACHE_CONTROL);

  loadR2CredentialsFromDotEnv(repoRoot);
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('R2 credentials are missing: set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or add them to the repo .env.');
    process.exit(1);
  }

  const gitRef = readFlag(argv, '--ref', 'HEAD');
  const stagingRoot = mkdtempSync(join(tmpdir(), 'metadata-upload-'));
  let isPublished = false;
  try {
    for (const folder of METADATA_SOURCE_FOLDERS) {
      const options = { cacheControl, isBackfill, isDryRun };
      isPublished = publishFolder(repoRoot, gitRef, folder, join(stagingRoot, basename(folder)), options);
      if (!isPublished) {
        break;
      }
    }
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
  if (!isPublished) {
    process.exit(1);
  }

  if (isDryRun) {
    console.log('\nDry run: nothing was uploaded.');
    return;
  }
  const isVerified = await verifyPublishedHeader(cacheControl);
  if (!isVerified) {
    console.error('core.json does not carry the expected Cache-Control. If core.json was unchanged, re-run with --backfill.');
    process.exit(1);
  }
}

// why: the module also exports pure helpers for its test; only run the upload
// when executed directly.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
