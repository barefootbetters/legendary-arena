/**
 * comicvine-cover-fetcher.mjs — Fetches comic cover image URLs from Comic Vine API
 *
 * Reads theme JSON files, extracts the primaryStory issue reference, searches
 * the Comic Vine API for matching issues, and writes the best cover image URL
 * into the theme's `comicImageUrl` field.
 *
 * Prerequisites:
 *   - COMICVINE_API_KEY in .env or environment
 *   - Node.js 22+ (uses built-in fetch)
 *
 * Usage:
 *   node --env-file=.env scripts/comicvine-cover-fetcher.mjs                    # all themes
 *   node --env-file=.env scripts/comicvine-cover-fetcher.mjs dark-phoenix-saga  # single theme
 *   node --env-file=.env scripts/comicvine-cover-fetcher.mjs --dry-run          # preview only
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const themesDirectory = join(projectRoot, 'content', 'themes');

// ── Configuration ───────────────────────────────────────────────────────────

const API_KEY = process.env.COMICVINE_API_KEY;
if (!API_KEY) {
  console.error('ERROR: COMICVINE_API_KEY not set. Add it to .env and run with:');
  console.error('  node --env-file=.env scripts/comicvine-cover-fetcher.mjs');
  process.exit(1);
}

const API_BASE = 'https://comicvine.gamespot.com/api';
const USER_AGENT = 'LegendaryArenaCoverFetcher/1.0';
// why: Comic Vine rate limits to ~200 requests/hour for API key holders.
// 2 seconds between requests keeps us well under the limit.
const DELAY_BETWEEN_REQUESTS_MS = 2000;
const REQUEST_TIMEOUT_MS = 15000;

// ── CLI argument parsing ────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose') || isDryRun;
const skipExisting = args.includes('--skip-existing');
const themeFilter = args.find((argument) =>
  !argument.startsWith('--'),
);

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Pauses execution for the specified number of milliseconds.
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Cleans an issue string for use as a Comic Vine search query.
 * Removes tie-in suffixes, parenthetical notes, and normalizes whitespace.
 * @param {string} issueString - e.g. "X-Men Alpha #1 + tie-ins"
 * @returns {{ seriesTitle: string, issueNumber: string | null, cleanQuery: string }}
 */
function parseIssueString(issueString) {
  let cleaned = issueString
    .replace(/\s*\+\s*tie-?ins?/i, '')
    .replace(/\s*\(tie-?ins?\)/i, '')
    .replace(/\s*crossover$/i, '')
    .replace(/\s*\+ various$/i, '')
    .replace(/\s*\+ cosmic ray stories$/i, '')
    .replace(/\s*status quo.*$/i, '')
    .trim();

  // Try to extract series title and issue number
  // Patterns: "Title #1", "Title #1–6", "Title Vol 2 #25"
  const issueMatch = cleaned.match(
    /^(.+?)\s*#(\d+)(?:\s*[–-]\s*\d+)?$/,
  );

  if (issueMatch) {
    return {
      seriesTitle: issueMatch[1].trim(),
      issueNumber: issueMatch[2],
      cleanQuery: issueMatch[1].trim() + ' ' + issueMatch[2],
    };
  }

  // No issue number found — use the whole string as query
  return {
    seriesTitle: cleaned,
    issueNumber: null,
    cleanQuery: cleaned,
  };
}

/**
 * Searches the Comic Vine API for issues matching a query.
 * @param {string} query - Search query string
 * @returns {Promise<Array<object>>} Array of issue results
 */
async function searchComicVine(query) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    format: 'json',
    resources: 'issue',
    query: query,
    limit: '10',
  });

  const url = `${API_BASE}/search/?${params.toString()}`;

  if (isVerbose) {
    console.log(`    API query: "${query}"`);
  }

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Comic Vine API returned 401/403 — check your API key.');
  }

  if (response.status === 429) {
    throw new Error('Comic Vine API rate limited (429). Wait and retry.');
  }

  if (!response.ok) {
    throw new Error(`Comic Vine API returned HTTP ${response.status}.`);
  }

  const body = await response.json();

  if (body.status_code !== 1) {
    throw new Error(`Comic Vine API error: ${body.error} (status_code: ${body.status_code})`);
  }

  return body.results || [];
}

/**
 * Scores a Comic Vine search result against the expected issue.
 * Higher score = better match.
 * @param {object} result - Comic Vine API result
 * @param {string} seriesTitle - Expected series title
 * @param {string|null} issueNumber - Expected issue number
 * @param {number|undefined} expectedYear - Expected publication year
 * @returns {number} Match score (0–100)
 */
function scoreResult(result, seriesTitle, issueNumber, expectedYear) {
  let score = 0;

  // Issue number match (highest weight)
  if (issueNumber && result.issue_number === issueNumber) {
    score += 40;
  }

  // Volume/series name similarity
  const volumeName = result.volume?.name?.toLowerCase() || '';
  const expectedTitle = seriesTitle.toLowerCase();
  if (volumeName === expectedTitle) {
    score += 30;
  } else if (volumeName.includes(expectedTitle) || expectedTitle.includes(volumeName)) {
    score += 20;
  }

  // Year match
  if (expectedYear && result.cover_date) {
    const resultYear = parseInt(result.cover_date.slice(0, 4), 10);
    if (resultYear === expectedYear) {
      score += 20;
    } else if (Math.abs(resultYear - expectedYear) <= 1) {
      score += 10;
    }
  }

  // Has an image (bonus)
  if (result.image?.original_url) {
    score += 10;
  }

  return score;
}

/**
 * Extracts the best cover image URL from a Comic Vine result.
 * @param {object} result - Comic Vine API result
 * @returns {string|null} Image URL or null
 */
function extractImageUrl(result) {
  return result.image?.original_url
    || result.image?.super_url
    || result.image?.medium_url
    || null;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('=== Comic Vine Cover Fetcher ===');
  if (isDryRun) console.log('  Mode: DRY RUN (no files will be modified)');
  if (skipExisting) console.log('  Skipping themes that already have a comicImageUrl');
  console.log('');

  // Load theme files
  const allFiles = readdirSync(themesDirectory)
    .filter((filename) => filename.endsWith('.json') && filename !== 'index.json')
    .sort();

  const filesToProcess = themeFilter
    ? allFiles.filter((filename) => filename.includes(themeFilter))
    : allFiles;

  if (filesToProcess.length === 0) {
    console.log('No matching theme files found.');
    process.exit(0);
  }

  console.log(`Processing ${filesToProcess.length} theme(s)...`);
  console.log('');

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const filename of filesToProcess) {
    const filePath = join(themesDirectory, filename);
    const themeData = JSON.parse(readFileSync(filePath, 'utf8'));
    const themeId = themeData.themeId;

    // Skip if already has an image and --skip-existing is set
    if (skipExisting && themeData.comicImageUrl) {
      if (isVerbose) console.log(`  SKIP: ${themeId} (already has image)`);
      skipCount++;
      continue;
    }

    const issueString = themeData.references?.primaryStory?.issue;
    const expectedYear = themeData.references?.primaryStory?.year;

    if (!issueString) {
      console.log(`  SKIP: ${themeId} — no issue reference`);
      skipCount++;
      continue;
    }

    const parsed = parseIssueString(issueString);

    console.log(`  ${themeId}`);
    if (isVerbose) {
      console.log(`    Issue: "${issueString}" → query: "${parsed.cleanQuery}"`);
    }

    try {
      const results = await searchComicVine(parsed.cleanQuery);

      if (results.length === 0) {
        console.log(`    ⚠ No results found`);
        failCount++;
        await sleep(DELAY_BETWEEN_REQUESTS_MS);
        continue;
      }

      // Score and rank results
      const scored = results.map((result) => ({
        result,
        score: scoreResult(result, parsed.seriesTitle, parsed.issueNumber, expectedYear),
      }));
      scored.sort((a, b) => b.score - a.score);

      const best = scored[0];
      const imageUrl = extractImageUrl(best.result);

      if (!imageUrl) {
        console.log(`    ⚠ Best match has no image (score: ${best.score})`);
        failCount++;
        await sleep(DELAY_BETWEEN_REQUESTS_MS);
        continue;
      }

      const volumeName = best.result.volume?.name || 'unknown';
      const issueNum = best.result.issue_number || '?';
      console.log(`    ✓ ${volumeName} #${issueNum} (score: ${best.score})`);
      console.log(`      ${imageUrl}`);

      if (!isDryRun) {
        themeData.comicImageUrl = imageUrl;
        writeFileSync(filePath, JSON.stringify(themeData, null, 2) + '\n', 'utf8');
      }

      successCount++;
    } catch (apiError) {
      console.log(`    ✗ ERROR: ${apiError.message}`);
      failCount++;
    }

    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  console.log('');
  console.log('=== Summary ===');
  console.log(`  Success: ${successCount}`);
  console.log(`  Skipped: ${skipCount}`);
  console.log(`  Failed:  ${failCount}`);
  console.log(`  Total:   ${filesToProcess.length}`);
  if (isDryRun) console.log('  (dry run — no files were modified)');
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
