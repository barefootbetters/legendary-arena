/**
 * build-card-image-sizes.mjs — Generate thumb / phone / large WebP tiers of every
 * card face, plus one byte-count manifest per set (WP-888 / D-24840).
 *
 * Every card face is served today as one full-resolution WebP from R2
 * (https://images.legendary-arena.com/{set}/{file}.webp). This script writes three
 * smaller copies of each face beside a local mirror of those originals:
 *
 *   <work-root>/r2-originals/<set>/<file>.webp        pulled originals (input, never written)
 *   <work-root>/sizes/<set>/<tier>/<file>.webp        tiers (output)
 *   <work-root>/sizes/<set>/image-sizes.json          manifest (output)
 *
 * The published URL of a tier is a path rule off the card's existing image URL
 * (`tierUrlFor`), so no card JSON, registry or UIState field changes.
 *
 * The three steps are separate commands:
 *   pnpm images:sizes:pull --work-root <path> [--set <abbr>]   (card-image-sizes-r2.mjs)
 *   pnpm images:sizes      --work-root <path> [--set <abbr>] [--dry-run]
 *   pnpm images:sizes:push --work-root <path> [--set <abbr>] [--dry-run]
 *
 * Generation is incremental: a tier file newer than its source is skipped.
 */

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

// why: libvips' operation cache keeps the files it read open, which on Windows
// blocks overwriting a regenerated tier and deleting the work root. Every file
// here is read once per run, so the cache buys nothing.
sharp.cache(false);

// why: sizes are capped by the LONG edge and never enlarged. 78% of the library
// has a long edge under 840 px, so a fixed box would upscale most cards, and the
// 58 landscape cards would be squeezed into a portrait box. A tier name that has
// been pushed to R2 is served `immutable` for a year, so its settings never
// change: new sizes ship as a NEW tier name with a new D-entry (D-24840). Before
// the first push only, an edit here means deleting `sizes/<set>/<tier>/` so the
// next run regenerates it (freshness is by mtime and does not see this object).
export const TIER_CONFIG = {
  thumb: { longEdge: 280, quality: 80 },
  phone: { longEdge: 840, quality: 80 },
  large: { longEdge: 1680, quality: 80 },
};

/** The public origin every card image URL starts with. */
export const IMAGE_BASE_URL = 'https://images.legendary-arena.com';

/** The manifest format version; a breaking change to its shape needs a new one. */
export const MANIFEST_SCHEMA_VERSION = 1;

/** The manifest's file name inside `<work-root>/sizes/<set>/`. */
export const MANIFEST_FILE_NAME = 'image-sizes.json';

/** The folder under the repo root that holds the per-set card data. */
export const CARD_DATA_FOLDER = join('data', 'cards');

/**
 * Returns the URL of one size tier of a card image: `/<tier>` is inserted
 * before the final path segment.
 *
 * @param {string} imageUrl - The original image URL, e.g. `.../core/core-hr-x.webp`.
 * @param {string} tier - A tier name from TIER_CONFIG, e.g. `thumb`.
 * @returns {string} The tier URL, e.g. `.../core/thumb/core-hr-x.webp`.
 */
export function tierUrlFor(imageUrl, tier) {
  const lastSlashIndex = imageUrl.lastIndexOf('/');
  return `${imageUrl.slice(0, lastSlashIndex)}/${tier}${imageUrl.slice(lastSlashIndex)}`;
}

/**
 * Collects every string value of a key named `imageUrl`, at any depth.
 *
 * @param {unknown} value - Parsed JSON.
 * @param {Set<string>} imageUrls - Receives the values found.
 */
function gatherImageUrls(value, imageUrls) {
  if (Array.isArray(value)) {
    for (const item of value) {
      gatherImageUrls(item, imageUrls);
    }
    return;
  }
  if (value === null || typeof value !== 'object') {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'imageUrl' && typeof child === 'string') {
      imageUrls.add(child);
    } else {
      gatherImageUrls(child, imageUrls);
    }
  }
}

/**
 * Lists the image files one set's card data references.
 *
 * // why: the list comes from the card data, never from a directory listing: R2
 * holds unreferenced objects left by earlier renames, and the pCloud staging tree
 * is stale (883 of 3,104 names missing; WP-888 Assumes 3).
 *
 * @param {unknown} cardData - The parsed `data/cards/<set>.json`.
 * @param {string} setAbbr - The set's abbreviation (the file's basename).
 * @returns {{files: string[], failures: {imageUrl: string, reason: string}[]}}
 *   `files` is the sorted bare filenames; `failures` the URLs that cannot be sized.
 */
export function collectSetImageUrls(cardData, setAbbr) {
  const imageUrls = new Set();
  gatherImageUrls(cardData, imageUrls);
  const expectedPrefix = `${IMAGE_BASE_URL}/${setAbbr}/`;
  const escapedSetAbbr = setAbbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sameSetPattern = new RegExp(`^https://images\\.legendary-arena\\.com/${escapedSetAbbr}/[^/]+\\.webp$`);
  const files = [];
  const failures = [];
  for (const imageUrl of [...imageUrls].sort()) {
    if (sameSetPattern.test(imageUrl)) {
      files.push(imageUrl.slice(expectedPrefix.length));
    } else {
      failures.push({
        imageUrl,
        reason: `The URL is not of the form ${expectedPrefix}<file>.webp, so it has no place under this set's R2 prefix.`,
      });
    }
  }
  files.sort();
  return { files, failures };
}

/**
 * Decides whether a tier output can be skipped.
 *
 * // why: freshness is by mtime. rclone keeps the R2 object time on pull, so an
 * original replaced on R2 arrives newer than its tiers. A TIER_CONFIG edit is NOT
 * seen here: delete that tier's folder instead (before first push only).
 *
 * @param {number} sourceMtimeMs - The original's modification time.
 * @param {number | null} outputMtimeMs - The tier file's time, or null when missing.
 * @returns {boolean} True when the output exists and is at least as new as the source.
 */
export function isTierOutputFresh(sourceMtimeMs, outputMtimeMs) {
  if (outputMtimeMs === null || outputMtimeMs === undefined) {
    return false;
  }
  return outputMtimeMs >= sourceMtimeMs;
}

/**
 * Builds one set's manifest object. Key order is part of the contract (schema 1);
 * it holds no timestamp, so an unchanged set produces identical bytes.
 *
 * @param {string} setAbbr - The set's abbreviation.
 * @param {{file: string, original: {bytes: number, width: number, height: number},
 *   thumb: object, phone: object, large: object}[]} cardMeasurements - Per card, in
 *   image-list order, the byte size and pixel size of the original and each tier.
 * @returns {object} The manifest.
 */
export function buildSetManifest(setAbbr, cardMeasurements) {
  const tiers = {};
  const totals = {};
  for (const [tier, settings] of Object.entries(TIER_CONFIG)) {
    tiers[tier] = { longEdge: settings.longEdge, quality: settings.quality };
    totals[tier] = 0;
  }
  const cards = [];
  for (const measurement of cardMeasurements) {
    const originalUrl = `${IMAGE_BASE_URL}/${setAbbr}/${measurement.file}`;
    const card = { file: measurement.file, original: describeImage(originalUrl, measurement.original) };
    for (const tier of Object.keys(TIER_CONFIG)) {
      card[tier] = describeImage(tierUrlFor(originalUrl, tier), measurement[tier]);
      totals[tier] += measurement[tier].bytes;
    }
    cards.push(card);
  }
  return { schemaVersion: MANIFEST_SCHEMA_VERSION, setAbbr, baseUrl: IMAGE_BASE_URL, tiers, totals, cards };
}

/**
 * Returns one manifest image entry with its keys in contract order.
 *
 * @param {string} url - The image's public URL.
 * @param {{bytes: number, width: number, height: number}} measurement - Its sizes.
 * @returns {{url: string, bytes: number, width: number, height: number}}
 */
function describeImage(url, measurement) {
  return { url, bytes: measurement.bytes, width: measurement.width, height: measurement.height };
}

/**
 * Serializes a manifest: 2-space JSON, LF line endings, trailing newline.
 *
 * @param {object} manifest - A manifest from buildSetManifest.
 * @returns {string} The file contents.
 */
export function serializeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Parses the CLI arguments shared by the generator and the R2 wrapper.
 *
 * @param {string[]} argv - The arguments (after the R2 wrapper's mode, if any).
 * @param {string[]} knownSetAbbrs - The basenames of `data/cards/*.json`.
 * @returns {{workRoot: string | null, setAbbrs: string[], isDryRun: boolean,
 *   errorMessage: string | null}} `errorMessage` is a full sentence when invalid.
 */
export function parseArguments(argv, knownSetAbbrs) {
  const result = { workRoot: null, setAbbrs: [...knownSetAbbrs].sort(), isDryRun: false, errorMessage: null };
  let requestedSet = null;
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (argument === '--') {
      // why: pnpm may or may not forward a bare `--` depending on the shell.
      continue;
    }
    if (argument === '--dry-run') {
      result.isDryRun = true;
    } else if ((argument === '--work-root' || argument === '--set') && i + 1 < argv.length) {
      i++;
      if (argument === '--work-root') {
        result.workRoot = resolve(argv[i]);
      } else {
        requestedSet = argv[i];
      }
    } else {
      result.errorMessage = `The argument "${argument}" is not recognized; use --work-root <path>, --set <abbr> and --dry-run.`;
      return result;
    }
  }
  return finishArguments(result, requestedSet, knownSetAbbrs);
}

/**
 * Applies the required-argument and known-set checks to parsed arguments.
 *
 * @param {{workRoot: string | null, setAbbrs: string[], isDryRun: boolean,
 *   errorMessage: string | null}} result - The partly parsed arguments.
 * @param {string | null} requestedSet - The `--set` value, if given.
 * @param {string[]} knownSetAbbrs - The basenames of `data/cards/*.json`.
 * @returns {object} The same result, completed.
 */
function finishArguments(result, requestedSet, knownSetAbbrs) {
  if (result.workRoot === null) {
    result.errorMessage = 'The --work-root <path> argument is required; it names the folder that holds r2-originals/ and sizes/.';
    return result;
  }
  if (requestedSet !== null) {
    if (!knownSetAbbrs.includes(requestedSet)) {
      result.errorMessage = `No card data file data/cards/${requestedSet}.json exists, so --set ${requestedSet} names no set; use one of the basenames of data/cards/*.json.`;
      return result;
    }
    result.setAbbrs = [requestedSet];
  }
  return result;
}

/**
 * Returns a file's modification time, or null when it does not exist.
 *
 * @param {string} filePath - The file to check.
 * @returns {number | null}
 */
function readMtimeOrNull(filePath) {
  try {
    return statSync(filePath).mtimeMs;
  } catch (error) {
    // why: a missing file is an expected state here (an output not yet written,
    // or a source not pulled); the caller decides what that means.
    if (error.code === 'ENOENT') {
      return null;
    }
    throw new Error(`Could not read the modification time of ${filePath} (${error.message}). Check the file's permissions.`);
  }
}

/**
 * Reads an image file's byte size and pixel size.
 *
 * @param {string} filePath - The image file.
 * @returns {Promise<{bytes: number, width: number, height: number}>}
 */
async function measureImage(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    return { bytes: statSync(filePath).size, width: metadata.width, height: metadata.height };
  } catch (error) {
    throw new Error(`Could not measure the image ${filePath} (${error.message}). Check that it is a readable WebP file.`);
  }
}

/**
 * Encodes one tier of one card from its original.
 *
 * @param {string} sourcePath - The original.
 * @param {string} outputPath - The tier file to write.
 * @param {{longEdge: number, quality: number}} settings - The tier's TIER_CONFIG entry.
 * @returns {Promise<void>}
 */
async function encodeTier(sourcePath, outputPath, settings) {
  try {
    mkdirSync(dirname(outputPath), { recursive: true });
    await sharp(sourcePath)
      .resize({ width: settings.longEdge, height: settings.longEdge, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: settings.quality })
      .toFile(outputPath);
  } catch (error) {
    throw new Error(`Could not encode ${outputPath} from ${sourcePath} (${error.message}). Check that the original is a readable image.`);
  }
}

/**
 * Writes (or counts, on a dry run) every stale tier of one card, then measures
 * the original and its tiers.
 *
 * @param {{sourcePath: string, sizesFolder: string, file: string, isDryRun: boolean}} card
 * @returns {Promise<{written: number, skipped: number, measurement: object | null}>}
 */
async function processCard({ sourcePath, sizesFolder, file, isDryRun }) {
  const sourceMtimeMs = readMtimeOrNull(sourcePath);
  if (sourceMtimeMs === null) {
    throw new Error(`The original ${sourcePath} is missing; run images:sizes:pull for this set first.`);
  }
  const encodes = [];
  let written = 0;
  let skipped = 0;
  for (const [tier, settings] of Object.entries(TIER_CONFIG)) {
    const outputPath = join(sizesFolder, tier, file);
    if (isTierOutputFresh(sourceMtimeMs, readMtimeOrNull(outputPath))) {
      skipped++;
      continue;
    }
    written++;
    if (!isDryRun) {
      // why: a card's tiers encode together (sharp runs off the main thread);
      // cards stay sequential so output order and memory stay predictable.
      encodes.push(encodeTier(sourcePath, outputPath, settings));
    }
  }
  await Promise.all(encodes);
  if (isDryRun) {
    return { written, skipped, measurement: null };
  }
  const measurement = { file, original: await measureImage(sourcePath) };
  for (const tier of Object.keys(TIER_CONFIG)) {
    measurement[tier] = await measureImage(join(sizesFolder, tier, file));
  }
  return { written, skipped, measurement };
}

/**
 * Generates the tiers and the manifest for one set. Reads only
 * `<workRoot>/r2-originals/<setAbbr>/`; never touches disk on a dry run.
 *
 * @param {{workRoot: string, setAbbr: string, files: string[], isDryRun: boolean}} options
 * @returns {Promise<{written: number, skipped: number,
 *   failures: {imageUrl: string, reason: string}[], manifest: object | null}>}
 */
export async function processSet({ workRoot, setAbbr, files, isDryRun }) {
  const originalsFolder = join(workRoot, 'r2-originals', setAbbr);
  const sizesFolder = join(workRoot, 'sizes', setAbbr);
  const outcome = { written: 0, skipped: 0, failures: [], manifest: null };
  const measurements = [];
  for (const file of files) {
    try {
      const cardResult = await processCard({ sourcePath: join(originalsFolder, file), sizesFolder, file, isDryRun });
      outcome.written += cardResult.written;
      outcome.skipped += cardResult.skipped;
      if (cardResult.measurement !== null) {
        measurements.push(cardResult.measurement);
      }
    } catch (error) {
      outcome.failures.push({ imageUrl: `${IMAGE_BASE_URL}/${setAbbr}/${file}`, reason: error.message });
    }
  }
  if (isDryRun) {
    return outcome;
  }
  outcome.manifest = buildSetManifest(setAbbr, measurements);
  writeManifest(join(sizesFolder, MANIFEST_FILE_NAME), outcome.manifest);
  return outcome;
}

/**
 * Writes a manifest file.
 *
 * @param {string} manifestPath - Where to write it.
 * @param {object} manifest - The manifest.
 */
function writeManifest(manifestPath, manifest) {
  try {
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, serializeManifest(manifest));
  } catch (error) {
    throw new Error(`Could not write the manifest ${manifestPath} (${error.message}). Check that the work root is writable.`);
  }
}

/**
 * Lists the set abbreviations: the basenames of `data/cards/*.json`, in
 * code-unit order.
 *
 * @param {string} repoRoot - The repository root.
 * @returns {string[]}
 */
export function listCardDataSets(repoRoot) {
  const cardsFolder = join(repoRoot, CARD_DATA_FOLDER);
  try {
    const setAbbrs = [];
    for (const entry of readdirSync(cardsFolder)) {
      if (entry.endsWith('.json')) {
        setAbbrs.push(basename(entry, '.json'));
      }
    }
    return setAbbrs.sort();
  } catch (error) {
    throw new Error(`Could not list the card data folder ${cardsFolder} (${error.message}). Run this from a repository checkout.`);
  }
}

/**
 * Reads one set's card data and returns its image list.
 *
 * @param {string} repoRoot - The repository root.
 * @param {string} setAbbr - The set's abbreviation.
 * @returns {{files: string[], failures: {imageUrl: string, reason: string}[]}}
 */
export function readSetImageList(repoRoot, setAbbr) {
  const cardDataPath = join(repoRoot, CARD_DATA_FOLDER, `${setAbbr}.json`);
  let cardData;
  try {
    cardData = JSON.parse(readFileSync(cardDataPath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read the card data ${cardDataPath} (${error.message}). Check that it is valid JSON.`);
  }
  return collectSetImageUrls(cardData, setAbbr);
}

/**
 * Formats a byte count as MiB with one decimal (bytes ÷ 1,048,576).
 *
 * @param {number} bytes - The byte count.
 * @returns {string}
 */
export function formatMebibytes(bytes) {
  return (bytes / 1048576).toFixed(1);
}

/**
 * Runs the generator over the requested sets and prints the summary.
 *
 * @param {string[]} argv - The process arguments.
 * @returns {Promise<number>} The exit code.
 */
async function main(argv) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const options = parseArguments(argv, listCardDataSets(repoRoot));
  if (options.errorMessage !== null) {
    console.error(options.errorMessage);
    return 1;
  }
  const summary = { images: 0, failed: 0, written: 0, skipped: 0, tierBytes: {} };
  for (const tier of Object.keys(TIER_CONFIG)) {
    summary.tierBytes[tier] = 0;
  }
  for (const setAbbr of options.setAbbrs) {
    await runSet(repoRoot, setAbbr, options, summary);
  }
  printSummary(summary, options.isDryRun);
  if (summary.failed > 0) {
    return 1;
  }
  return 0;
}

/**
 * Processes one set for main, prints its line and adds it to the summary.
 *
 * @param {string} repoRoot - The repository root.
 * @param {string} setAbbr - The set's abbreviation.
 * @param {{workRoot: string, isDryRun: boolean}} options - Parsed arguments.
 * @param {object} summary - The running totals, updated in place.
 * @returns {Promise<void>}
 */
async function runSet(repoRoot, setAbbr, options, summary) {
  const imageList = readSetImageList(repoRoot, setAbbr);
  const outcome = await processSet({
    workRoot: options.workRoot,
    setAbbr,
    files: imageList.files,
    isDryRun: options.isDryRun,
  });
  const failures = [...imageList.failures, ...outcome.failures];
  const imageCount = imageList.files.length + imageList.failures.length;
  summary.images += imageCount;
  summary.failed += failures.length;
  summary.written += outcome.written;
  summary.skipped += outcome.skipped;
  if (outcome.manifest !== null) {
    for (const tier of Object.keys(TIER_CONFIG)) {
      summary.tierBytes[tier] += outcome.manifest.totals[tier];
    }
  }
  console.log(`${setAbbr}: images ${imageCount}, failed ${failures.length}, written ${outcome.written}, skipped ${outcome.skipped}`);
  for (const failure of failures) {
    console.log(`  failed ${failure.imageUrl}: ${failure.reason}`);
  }
}

/**
 * Prints the run summary: two count lines, then the size of each tier.
 *
 * @param {{images: number, failed: number, written: number, skipped: number,
 *   tierBytes: Record<string, number>}} summary - The totals.
 * @param {boolean} isDryRun - Whether nothing was written.
 */
function printSummary(summary, isDryRun) {
  console.log('');
  console.log(`images ${summary.images}, failed ${summary.failed}`);
  console.log(`tier outputs written ${summary.written}, skipped ${summary.skipped}`);
  if (isDryRun) {
    console.log('Dry run: nothing was written, so tier sizes were not measured.');
    return;
  }
  for (const [tier, bytes] of Object.entries(summary.tierBytes)) {
    console.log(`${tier} ${formatMebibytes(bytes)} MB`);
  }
}

// why: the module also exports pure helpers for its tests and for the R2
// wrapper; only run the generator when executed directly.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
