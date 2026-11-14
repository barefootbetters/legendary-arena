/**
 * Tests for the card image size-tier generator (WP-888 / D-24840).
 *
 * The encode test writes sharp-generated sources into an os.tmpdir() work root;
 * it reads no card data and touches no network.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
  IMAGE_BASE_URL,
  TIER_CONFIG,
  buildSetManifest,
  collectSetImageUrls,
  isTierOutputFresh,
  parseArguments,
  processSet,
  serializeManifest,
  tierUrlFor,
} from './build-card-image-sizes.mjs';

test('TIER_CONFIG locks thumb 280, phone 840 and large 1680 at quality 80, in that order', () => {
  assert.deepEqual(Object.keys(TIER_CONFIG), ['thumb', 'phone', 'large']);
  assert.deepEqual(TIER_CONFIG, {
    thumb: { longEdge: 280, quality: 80 },
    phone: { longEdge: 840, quality: 80 },
    large: { longEdge: 1680, quality: 80 },
  });
  assert.equal(IMAGE_BASE_URL, 'https://images.legendary-arena.com');
});

test('tierUrlFor inserts the tier before the final path segment', () => {
  assert.equal(
    tierUrlFor('https://images.legendary-arena.com/core/core-hr-x.webp', 'thumb'),
    'https://images.legendary-arena.com/core/thumb/core-hr-x.webp',
  );
  assert.equal(
    tierUrlFor('https://images.legendary-arena.com/co2e/co2e-hr-a.webp', 'large'),
    'https://images.legendary-arena.com/co2e/large/co2e-hr-a.webp',
  );
});

test('collectSetImageUrls walks nested physicalCards, dedupes and sorts', () => {
  const cardData = {
    abbr: 'core',
    heroes: [
      { name: 'B', physicalCards: [{ imageUrl: 'https://images.legendary-arena.com/core/core-hr-b.webp' }] },
      {
        name: 'A',
        physicalCards: [
          { imageUrl: 'https://images.legendary-arena.com/core/core-hr-a.webp' },
          { imageUrl: 'https://images.legendary-arena.com/core/core-hr-b.webp' },
        ],
      },
    ],
    villains: [{ cards: [{ imageUrl: 'https://images.legendary-arena.com/core/core-vi-z.webp' }] }],
    masterminds: [{ imageUrl: 'https://images.legendary-arena.com/core/core-mm-m.webp' }],
  };
  const result = collectSetImageUrls(cardData, 'core');
  assert.deepEqual(result.files, ['core-hr-a.webp', 'core-hr-b.webp', 'core-mm-m.webp', 'core-vi-z.webp']);
  assert.deepEqual(result.failures, []);
});

test('collectSetImageUrls reports a cross-set URL, a nested path and a non-base URL as failures', () => {
  const crossSet = 'https://images.legendary-arena.com/wwhk/wwhk-hr-a.webp';
  const nestedPath = 'https://images.legendary-arena.com/core/thumb/core-hr-a.webp';
  const nonBase = 'https://example.com/core/core-hr-a.webp';
  const cardData = {
    heroes: [{ physicalCards: [{ imageUrl: crossSet }, { imageUrl: nestedPath }, { imageUrl: nonBase }] }],
    henchmen: [{ imageUrl: 'https://images.legendary-arena.com/core/core-hm-h.webp' }],
  };
  const result = collectSetImageUrls(cardData, 'core');
  assert.deepEqual(result.files, ['core-hm-h.webp']);
  assert.deepEqual(
    result.failures.map((failure) => failure.imageUrl).sort(),
    [crossSet, nestedPath, nonBase].sort(),
  );
  for (const failure of result.failures) {
    assert.match(failure.reason, /^The URL is not of the form .+\.$/);
  }
});

test('isTierOutputFresh: newer and equal outputs are fresh; older and missing are not', () => {
  assert.equal(isTierOutputFresh(1000, 2000), true);
  assert.equal(isTierOutputFresh(1000, 1000), true);
  assert.equal(isTierOutputFresh(2000, 1000), false);
  assert.equal(isTierOutputFresh(1000, null), false);
});

/**
 * Builds a measurement for one card with the given tier byte sizes.
 *
 * @param {string} file - The file name.
 * @param {number[]} tierBytes - thumb, phone and large byte sizes.
 * @returns {object}
 */
function makeMeasurement(file: string, tierBytes: number[]) {
  return {
    file,
    original: { bytes: 9000, width: 1000, height: 1400 },
    thumb: { bytes: tierBytes[0], width: 200, height: 280 },
    phone: { bytes: tierBytes[1], width: 600, height: 840 },
    large: { bytes: tierBytes[2], width: 1000, height: 1400 },
  };
}

test('buildSetManifest keeps the contract key order, sums totals and rebuilds byte-identically', () => {
  const measurements = [makeMeasurement('3dtc-a.webp', [10, 100, 1000]), makeMeasurement('3dtc-b.webp', [20, 200, 2000])];
  const manifest = buildSetManifest('3dtc', measurements);
  assert.deepEqual(Object.keys(manifest), ['schemaVersion', 'setAbbr', 'baseUrl', 'tiers', 'totals', 'cards']);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.baseUrl, IMAGE_BASE_URL);
  assert.deepEqual(manifest.tiers, TIER_CONFIG);
  assert.deepEqual(manifest.totals, { thumb: 30, phone: 300, large: 3000 });
  assert.deepEqual(Object.keys(manifest.totals), ['thumb', 'phone', 'large']);
  const firstCard = manifest.cards[0];
  assert.deepEqual(Object.keys(firstCard), ['file', 'original', 'thumb', 'phone', 'large']);
  assert.deepEqual(Object.keys(firstCard.thumb), ['url', 'bytes', 'width', 'height']);
  assert.equal(firstCard.original.url, 'https://images.legendary-arena.com/3dtc/3dtc-a.webp');
  assert.equal(firstCard.phone.url, 'https://images.legendary-arena.com/3dtc/phone/3dtc-a.webp');
  const firstBytes = serializeManifest(manifest);
  const secondBytes = serializeManifest(buildSetManifest('3dtc', measurements));
  assert.equal(firstBytes, secondBytes);
  assert.ok(firstBytes.endsWith('}\n'));
  assert.ok(!firstBytes.includes('\r'));
  assert.ok(firstBytes.includes('\n  "schemaVersion": 1,'), 'two-space indentation');
});

test('parseArguments: a missing --work-root and an unknown --set give full-sentence errors', () => {
  const missingRoot = parseArguments(['--set', 'core'], ['core']);
  assert.match(missingRoot.errorMessage ?? '', /^The --work-root <path> argument is required.+\.$/);
  const unknownSet = parseArguments(['--work-root', 'w', '--set', 'nope'], ['core']);
  assert.match(unknownSet.errorMessage ?? '', /^No card data file data\/cards\/nope\.json exists.+\.$/);
});

test('parseArguments ignores a bare --, resolves --work-root, and sorts sets in code-unit order', () => {
  const parsed = parseArguments(['--', '--work-root', 'some/root', '--dry-run'], ['core', '3dtc', 'Zeta', 'amwp']);
  assert.equal(parsed.errorMessage, null);
  assert.equal(parsed.isDryRun, true);
  assert.equal(parsed.workRoot, path.resolve('some/root'));
  assert.deepEqual(parsed.setAbbrs, ['3dtc', 'Zeta', 'amwp', 'core']);
  const absoluteRaw = path.join(tmpdir(), 'x', '..', 'y');
  assert.equal(parseArguments(['--work-root', absoluteRaw], []).workRoot, path.resolve(absoluteRaw));
  const single = parseArguments(['--work-root', 'w', '--set', 'core'], ['3dtc', 'core']);
  assert.deepEqual(single.setAbbrs, ['core']);
});

test('a doubled-backslash Windows path (pnpm argument forwarding) resolves to the plain path', () => {
  assert.equal(path.win32.resolve('C:\\\\x\\\\y'), 'C:\\x\\y');
});

/**
 * Writes a solid-colour WebP source of the given size.
 *
 * @param {string} filePath - Where to write it.
 * @param {number} width - Pixel width.
 * @param {number} height - Pixel height.
 */
async function writeSource(filePath: string, width: number, height: number) {
  await sharp({ create: { width, height, channels: 3, background: { r: 120, g: 40, b: 200 } } })
    .webp({ quality: 90 })
    .toFile(filePath);
}

/**
 * Creates a temp work root holding three sources for set `test`.
 *
 * @returns {Promise<string>} The work root.
 */
async function makeWorkRoot() {
  const workRoot = mkdtempSync(path.join(tmpdir(), 'card-image-sizes-test-'));
  const originals = path.join(workRoot, 'r2-originals', 'test');
  mkdirSync(originals, { recursive: true });
  await writeSource(path.join(originals, 'big-portrait.webp'), 2000, 2800);
  await writeSource(path.join(originals, 'small-portrait.webp'), 100, 140);
  await writeSource(path.join(originals, 'landscape.webp'), 2800, 2000);
  return workRoot;
}

const ENCODE_FILES = ['big-portrait.webp', 'landscape.webp', 'small-portrait.webp'];

test('processSet encodes by long edge, never enlarges, then skips everything on a re-run', async () => {
  const workRoot = await makeWorkRoot();
  try {
    const first = await processSet({ workRoot, setAbbr: 'test', files: ENCODE_FILES, isDryRun: false });
    assert.deepEqual(first.failures, []);
    assert.equal(first.written, 9);
    assert.equal(first.skipped, 0);
    const byFile = new Map(first.manifest.cards.map((card: { file: string }) => [card.file, card]));
    const big = byFile.get('big-portrait.webp');
    assert.deepEqual([big.thumb.width, big.thumb.height], [200, 280]);
    assert.deepEqual([big.phone.width, big.phone.height], [600, 840]);
    assert.deepEqual([big.large.width, big.large.height], [1200, 1680]);
    const small = byFile.get('small-portrait.webp');
    for (const tier of ['thumb', 'phone', 'large']) {
      assert.deepEqual([small[tier].width, small[tier].height], [100, 140], `${tier} is never enlarged`);
    }
    const landscape = byFile.get('landscape.webp');
    assert.deepEqual([landscape.thumb.width, landscape.thumb.height], [280, 200]);
    assert.deepEqual(first.manifest.cards.map((card: { file: string }) => card.file), ENCODE_FILES);
    assert.ok(existsSync(path.join(workRoot, 'sizes', 'test', 'image-sizes.json')));

    const second = await processSet({ workRoot, setAbbr: 'test', files: ENCODE_FILES, isDryRun: false });
    assert.equal(second.written, 0);
    assert.equal(second.skipped, 9);
    assert.equal(serializeManifest(second.manifest), serializeManifest(first.manifest));
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
});

test('processSet --dry-run on a fresh work root counts 9 writes, writes nothing and returns no manifest', async () => {
  const workRoot = await makeWorkRoot();
  try {
    const result = await processSet({ workRoot, setAbbr: 'test', files: ENCODE_FILES, isDryRun: true });
    assert.equal(result.written, 9);
    assert.equal(result.skipped, 0);
    assert.equal(result.manifest, null);
    assert.equal(existsSync(path.join(workRoot, 'sizes')), false);
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
});

test('processSet reports a missing source as a failure and omits it from the manifest', async () => {
  const workRoot = await makeWorkRoot();
  try {
    const result = await processSet({ workRoot, setAbbr: 'test', files: ['absent.webp', 'small-portrait.webp'], isDryRun: false });
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].imageUrl, 'https://images.legendary-arena.com/test/absent.webp');
    assert.match(result.failures[0].reason, /is missing; run images:sizes:pull for this set first\.$/);
    assert.deepEqual(result.manifest.cards.map((card: { file: string }) => card.file), ['small-portrait.webp']);
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
});
