/**
 * card-image-sizes-r2.mjs — Pull card-image originals from R2, and push the
 * generated size tiers and per-set manifests back (WP-888 / D-24840).
 *
 * Usage:
 *   pnpm images:sizes:pull --work-root <path> [--set <abbr>] [--dry-run]
 *   pnpm images:sizes:push --work-root <path> [--set <abbr>] [--dry-run]
 *
 * pull copies, per set, exactly the originals the card data references
 * (`data/cards/<set>.json`) into `<work-root>/r2-originals/<set>/`.
 * push copies `<work-root>/sizes/<set>/<tier>/` to `r2:legendary-images/<set>/<tier>/`
 * (Cache-Control immutable) and then the set's manifest to
 * `r2:legendary-images/metadata/image-sizes/<set>.json` (five-minute cache).
 *
 * Prerequisites (the scripts/upload-metadata-to-r2.mjs precedent, D-24674):
 *   - rclone on PATH with the `r2:` remote (`env_auth = true`).
 *   - AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in the environment, or in the
 *     repo's `.env`.
 *
 * Copy only, ever: this script never runs `rclone sync`, `move`, `delete`,
 * `deletefile` or `purge`, and never writes an original's key.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  MANIFEST_FILE_NAME,
  TIER_CONFIG,
  listCardDataSets,
  parseArguments,
  readSetImageList,
} from './build-card-image-sizes.mjs';
import { DEFAULT_CACHE_CONTROL, loadR2CredentialsFromDotEnv } from './upload-metadata-to-r2.mjs';

/** The rclone remote path of the card-image bucket. */
export const R2_BUCKET = 'r2:legendary-images';

// why: a tier's key is content-addressed like the original's (a key is never
// reused for new art; D-24840), so it can be cached for a year.
export const TIER_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * Builds the rclone arguments that pull one set's referenced originals.
 *
 * @param {{workRoot: string, setAbbr: string, filesFromPath: string, isDryRun: boolean}} options
 * @returns {string[]} The arguments after `rclone`.
 */
export function buildPullArguments({ workRoot, setAbbr, filesFromPath, isDryRun }) {
  const rcloneArguments = [
    'copy',
    `${R2_BUCKET}/${setAbbr}/`,
    join(workRoot, 'r2-originals', setAbbr),
    '--files-from',
    filesFromPath,
    '--s3-no-check-bucket',
  ];
  if (isDryRun) {
    rcloneArguments.push('--dry-run');
  }
  return rcloneArguments;
}

/**
 * Builds the rclone arguments that push one tier folder of one set.
 *
 * // why: `--checksum` compares MD5, so a re-run uploads only tiers whose bytes
 * changed (sharp's output is byte-identical across runs).
 *
 * @param {{workRoot: string, setAbbr: string, tier: string, isDryRun: boolean}} options
 * @returns {string[]} The arguments after `rclone`.
 */
export function buildPushTierArguments({ workRoot, setAbbr, tier, isDryRun }) {
  const rcloneArguments = [
    'copy',
    join(workRoot, 'sizes', setAbbr, tier),
    `${R2_BUCKET}/${setAbbr}/${tier}/`,
    '--checksum',
    '--header-upload',
    `Cache-Control: ${TIER_CACHE_CONTROL}`,
    '--s3-no-check-bucket',
  ];
  if (isDryRun) {
    rcloneArguments.push('--dry-run');
  }
  return rcloneArguments;
}

/**
 * Builds the rclone arguments that push one set's manifest.
 *
 * // why: the manifest lives under `metadata/`, not beside the tiers, because the
 * runbook's bulk commands stamp every set prefix `immutable` / `image/webp` and
 * exclude `metadata/*`; the manifest is rewritten in place, so it keeps the
 * five-minute cache of the other metadata files (D-24674).
 *
 * @param {{workRoot: string, setAbbr: string, isDryRun: boolean}} options
 * @returns {string[]} The arguments after `rclone`.
 */
export function buildPushManifestArguments({ workRoot, setAbbr, isDryRun }) {
  const rcloneArguments = [
    'copyto',
    join(workRoot, 'sizes', setAbbr, MANIFEST_FILE_NAME),
    `${R2_BUCKET}/metadata/image-sizes/${setAbbr}.json`,
    '--checksum',
    '--header-upload',
    `Cache-Control: ${DEFAULT_CACHE_CONTROL}`,
    '--s3-no-check-bucket',
  ];
  if (isDryRun) {
    rcloneArguments.push('--dry-run');
  }
  return rcloneArguments;
}

/**
 * Runs rclone with the given arguments, echoing the command first.
 *
 * @param {string[]} rcloneArguments - The arguments after `rclone`.
 * @returns {boolean} Whether rclone exited 0.
 */
function runRclone(rcloneArguments) {
  console.log(`rclone ${rcloneArguments.join(' ')}`);
  try {
    execFileSync('rclone', rcloneArguments, { stdio: 'inherit' });
    return true;
  } catch (error) {
    // why: the caller reports the failure with the set and step named, and the
    // run continues with the other sets.
    console.error(`rclone exited with an error (${error.message}).`);
    return false;
  }
}

/**
 * Pulls one set's referenced originals and checks every listed file arrived.
 *
 * @param {string} repoRoot - The repository root.
 * @param {string} setAbbr - The set's abbreviation.
 * @param {{workRoot: string, isDryRun: boolean}} options - Parsed arguments.
 * @param {string} listFolder - A temp folder for the `--files-from` list.
 * @returns {boolean} Whether the set pulled completely.
 */
function pullSet(repoRoot, setAbbr, options, listFolder) {
  const { files } = readSetImageList(repoRoot, setAbbr);
  const filesFromPath = join(listFolder, `${setAbbr}.txt`);
  writeFileSync(filesFromPath, `${files.join('\n')}\n`);
  const rcloneArguments = buildPullArguments({ workRoot: options.workRoot, setAbbr, filesFromPath, isDryRun: options.isDryRun });
  if (!runRclone(rcloneArguments)) {
    console.error(`The pull of set ${setAbbr} failed; check the rclone output above and re-run with --set ${setAbbr}.`);
    return false;
  }
  if (options.isDryRun) {
    return true;
  }
  // why: `--files-from` skips a listed file that is missing on R2 silently (exit
  // 0), so presence is counted locally after the copy.
  let presentCount = 0;
  for (const file of files) {
    if (existsSync(join(options.workRoot, 'r2-originals', setAbbr, file))) {
      presentCount++;
    }
  }
  console.log(`${setAbbr}: listed ${files.length}, present ${presentCount}`);
  if (presentCount !== files.length) {
    console.error(`Set ${setAbbr} is missing ${files.length - presentCount} original(s) on R2; its card data names images R2 does not hold.`);
    return false;
  }
  return true;
}

/**
 * Pushes one set's tiers, then its manifest. A failed tier push holds back the
 * manifest, so a manifest is never published while its tiers are missing.
 *
 * @param {string} setAbbr - The set's abbreviation.
 * @param {{workRoot: string, isDryRun: boolean}} options - Parsed arguments.
 * @returns {boolean} Whether the set pushed completely (or was skipped with a warning).
 */
function pushSet(setAbbr, options) {
  const manifestPath = join(options.workRoot, 'sizes', setAbbr, MANIFEST_FILE_NAME);
  if (!existsSync(manifestPath)) {
    console.warn(`Set ${setAbbr} has no manifest at ${manifestPath}, so it was never generated; skipping it (run images:sizes for it first).`);
    return true;
  }
  // why: tiers go first and the manifest last, so a client that reads the
  // manifest never finds a tier URL that is not on R2 yet.
  for (const tier of Object.keys(TIER_CONFIG)) {
    const tierArguments = buildPushTierArguments({ workRoot: options.workRoot, setAbbr, tier, isDryRun: options.isDryRun });
    if (!runRclone(tierArguments)) {
      console.error(`The push of set ${setAbbr} tier ${tier} failed, so its manifest was not pushed; re-run with --set ${setAbbr}.`);
      return false;
    }
  }
  const manifestArguments = buildPushManifestArguments({ workRoot: options.workRoot, setAbbr, isDryRun: options.isDryRun });
  if (!runRclone(manifestArguments)) {
    console.error(`The push of set ${setAbbr}'s manifest failed; re-run with --set ${setAbbr}.`);
    return false;
  }
  return true;
}

/**
 * Runs pull or push over the requested sets.
 *
 * @param {string[]} argv - The process arguments.
 * @returns {number} The exit code.
 */
function main(argv) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const remaining = argv.filter((argument) => argument !== '--');
  const mode = remaining[0];
  if (mode !== 'pull' && mode !== 'push') {
    console.error(`The first argument must be pull or push, but it was "${mode}".`);
    return 1;
  }
  const options = parseArguments(remaining.slice(1), listCardDataSets(repoRoot));
  if (options.errorMessage !== null) {
    console.error(options.errorMessage);
    return 1;
  }
  loadR2CredentialsFromDotEnv(repoRoot);
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('R2 credentials are missing: set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or add them to the repo .env.');
    return 1;
  }
  const failedSets = runMode(repoRoot, mode, options);
  if (options.isDryRun) {
    console.log('\nDry run: nothing was copied.');
  }
  if (failedSets.length > 0) {
    console.error(`${mode} failed for ${failedSets.length} set(s): ${failedSets.join(', ')}.`);
    return 1;
  }
  return 0;
}

/**
 * Runs one mode over every requested set, continuing past failures.
 *
 * @param {string} repoRoot - The repository root.
 * @param {'pull' | 'push'} mode - The mode.
 * @param {{workRoot: string, setAbbrs: string[], isDryRun: boolean}} options - Parsed arguments.
 * @returns {string[]} The sets that failed.
 */
function runMode(repoRoot, mode, options) {
  const failedSets = [];
  const listFolder = mkdtempSync(join(tmpdir(), 'card-image-sizes-'));
  try {
    for (const setAbbr of options.setAbbrs) {
      let isSetComplete;
      if (mode === 'pull') {
        isSetComplete = pullSet(repoRoot, setAbbr, options, listFolder);
      } else {
        isSetComplete = pushSet(setAbbr, options);
      }
      if (!isSetComplete) {
        failedSets.push(setAbbr);
      }
    }
  } finally {
    rmSync(listFolder, { recursive: true, force: true });
  }
  return failedSets;
}

// why: the module also exports pure argument builders for its test; only run
// rclone when executed directly.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
