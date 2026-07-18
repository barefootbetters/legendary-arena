/**
 * Legendary Arena — SPA Asset-Masking Gate
 *
 * Both public SPAs (`apps/arena-client`, `apps/legends-board`) ship a
 * Cloudflare Pages catch-all in `public/_redirects`:
 *
 *     /*  /index.html  200
 *
 * That rule is required for client-side routing, but it has a nasty
 * side effect: when a hashed bundle referenced by `index.html` is MISSING
 * from the deploy, the request does not 404. It falls through the catch-all
 * and returns `index.html` with HTTP 200 and `Content-Type: text/html`.
 * The browser receives HTML where it expected JavaScript, the module never
 * executes, the app never mounts, and the page sits on its no-JS fallback
 * forever. No 404, no console error, no failed request — a silent white page.
 *
 * This was observed live on legends.legendary-arena.com on 2026-07-18, where
 * `index.html` referenced a bundle hash that was not present on the deploy.
 * A reachability probe (`pnpm check:domains`) reports a healthy 200 for that
 * state, because the HTML itself serves fine — which is exactly why this
 * separate gate exists.
 *
 * Two modes:
 *
 *   --dist <directory>   Hermetic. Reads `<directory>/index.html`, resolves
 *                        every referenced same-origin asset against the
 *                        directory, and fails when one is absent or empty.
 *                        Catches a build whose HTML points at an artifact the
 *                        build did not emit. Runs in PR CI; no network.
 *
 *   --url <baseUrl>      Live. Fetches `index.html` over HTTP (cache-busted),
 *                        then fetches every referenced asset and fails when a
 *                        response is HTML-masked. Catches deploy/edge drift —
 *                        the failure class actually observed. Runs nightly.
 *
 * Both flags are repeatable, and may be combined in one invocation.
 *
 * Usage:
 *   node scripts/check-spa-assets.mjs --dist apps/legends-board/dist
 *   node scripts/check-spa-assets.mjs --url https://legends.legendary-arena.com
 *   pnpm check:spa-assets
 *   pnpm check:spa-assets:live
 *
 * Exit codes:
 *   0 — every referenced asset resolved to real, non-HTML content
 *   1 — at least one asset is missing, empty, or HTML-masked
 *   2 — unexpected internal error (bad arguments, unreadable index.html)
 */

import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

// why: a live deploy rollout can briefly serve new HTML against not-yet-
// propagated assets. That state self-heals within seconds, so a single
// failed probe would produce false nightly alarms. Only a state that
// persists across all attempts is treated as a real failure.
const LIVE_ATTEMPT_COUNT = 3;
const LIVE_RETRY_DELAY_MS = 5_000;

// why: generous for a static asset fetch but short enough that a dead host
// fails the run instead of hanging the workflow.
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Extracts every same-origin JavaScript and stylesheet path referenced by an
 * HTML document. Only root-relative paths are returned — cross-origin
 * references (the brand-tokens stylesheet on www) are deliberately excluded
 * because they are governed by their own fallback contract and are not
 * subject to this SPA catch-all.
 *
 * @param {string} htmlText - The full text of an index.html document.
 * @returns {string[]} Unique root-relative asset paths, in document order.
 */
function extractSameOriginAssetPaths(htmlText) {
  const referencePattern = /(?:src|href)\s*=\s*"(\/[^"]+?\.(?:js|mjs|css))"/g;
  const foundPaths = [];
  for (const match of htmlText.matchAll(referencePattern)) {
    const assetPath = match[1];
    if (!foundPaths.includes(assetPath)) {
      foundPaths.push(assetPath);
    }
  }
  return foundPaths;
}

/**
 * Decides whether a response body is the SPA catch-all HTML rather than the
 * asset that was requested. Checks the declared content type first, then
 * sniffs the body, because a misconfigured host can serve HTML under a
 * JavaScript content type.
 *
 * @param {string} contentType - The response `Content-Type` header value.
 * @param {string} bodyText - The first bytes of the response body.
 * @returns {boolean} True when the response is an HTML document.
 */
function isHtmlMasked(contentType, bodyText) {
  if (contentType.toLowerCase().includes('text/html')) {
    return true;
  }
  const bodyStart = bodyText.trimStart().slice(0, 200).toLowerCase();
  return bodyStart.startsWith('<!doctype html') || bodyStart.startsWith('<html');
}

/**
 * Verifies every asset referenced by a built `index.html` exists on disk and
 * is non-empty.
 *
 * @param {string} distDirectory - Path to a built SPA output directory.
 * @returns {Promise<string[]>} Full-sentence failure messages; empty when healthy.
 */
async function checkDistDirectory(distDirectory) {
  const indexPath = join(distDirectory, 'index.html');
  const htmlText = await readFile(indexPath, 'utf8');
  const assetPaths = extractSameOriginAssetPaths(htmlText);
  if (assetPaths.length === 0) {
    return [
      `No same-origin script or stylesheet references were found in ${indexPath}. ` +
        `Confirm the build emitted a real index.html rather than a placeholder.`,
    ];
  }

  const failures = [];
  for (const assetPath of assetPaths) {
    const assetAbsolutePath = join(distDirectory, assetPath);
    try {
      const assetStats = await stat(assetAbsolutePath);
      if (assetStats.size === 0) {
        failures.push(
          `The asset ${assetPath} referenced by ${indexPath} exists but is empty. ` +
            `Re-run the build for this app and confirm the bundler completed without errors.`,
        );
      }
    } catch {
      failures.push(
        `The asset ${assetPath} referenced by ${indexPath} does not exist in the build output. ` +
          `Deploying this build would break the app: on a surface that ships the SPA catch-all ` +
          `(arena-client, legends-board) the request returns index.html with HTTP 200 and the app ` +
          `silently never mounts; on one that does not (registry-viewer, dashboard) it 404s. ` +
          `Re-run the build for this app.`,
      );
    }
  }
  console.log(
    `  ${distDirectory} — checked ${assetPaths.length} asset(s): ${assetPaths.join(', ')}`,
  );
  return failures;
}

/**
 * Fetches a URL with a timeout, returning its status, content type, and body.
 * Network errors surface as a thrown Error with a full-sentence message
 * naming the URL.
 *
 * why `keepFullBody`: asset probes only need the first bytes to tell HTML from
 * JavaScript, but an index.html MUST be read in full — the <script> tag sits
 * several kilobytes past the contractual brand-token comment block, so a
 * truncated read finds zero references and the check passes vacuously.
 *
 * @param {string} url - The absolute URL to fetch.
 * @param {boolean} [keepFullBody] - Read the whole body instead of a sniff slice.
 * @returns {Promise<{status: number, contentType: string, bodyText: string}>}
 */
async function fetchWithTimeout(url, keepFullBody = false) {
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: abortController.signal,
      // why: the edge may hold a cached index.html that references a bundle
      // hash the current deploy no longer has. Revalidating is the whole
      // point of this probe, so caches are bypassed explicitly.
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    const rawBody = await response.text();
    const bodyText = keepFullBody ? rawBody : rawBody.slice(0, 500);
    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      bodyText,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `The request to ${url} failed before a response was received. Underlying reason: ${reason}. ` +
        `Check that the host is reachable and that the deploy has finished.`,
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Runs one live probe pass against a deployed SPA: fetches index.html, then
 * every asset it references, reporting any that are missing or HTML-masked.
 *
 * @param {string} baseUrl - Origin of the deployed SPA, without a trailing slash.
 * @returns {Promise<string[]>} Full-sentence failure messages; empty when healthy.
 */
async function runLiveProbePass(baseUrl) {
  const cacheBuster = `spa-assets-${process.pid}-${globalThis.performance.now()}`;
  const indexResponse = await fetchWithTimeout(`${baseUrl}/?cb=${cacheBuster}`, true);
  if (indexResponse.status !== 200) {
    return [
      `${baseUrl}/ returned HTTP ${indexResponse.status} instead of 200, so its assets could not be checked.`,
    ];
  }

  const assetPaths = extractSameOriginAssetPaths(indexResponse.bodyText);
  // why: zero references is a FAILURE, never a pass. A served index.html
  // always references at least its own bundle, so an empty result means the
  // document was truncated, replaced, or is not the real app shell — and
  // silently returning "OK" there would make this gate vacuously green,
  // which is the exact class of bug it exists to catch.
  if (assetPaths.length === 0) {
    return [
      `${baseUrl}/ served a document with no same-origin script or stylesheet references ` +
        `(${indexResponse.bodyText.length} bytes read). A healthy SPA shell always references its ` +
        `own bundle, so this is either a truncated read or a placeholder page. Open the URL and ` +
        `confirm it returns the real application shell.`,
    ];
  }

  const failures = [];
  for (const assetPath of assetPaths) {
    const assetUrl = `${baseUrl}${assetPath}`;
    const assetResponse = await fetchWithTimeout(assetUrl);
    if (assetResponse.status !== 200) {
      failures.push(`${assetUrl} returned HTTP ${assetResponse.status} instead of 200.`);
      continue;
    }
    if (isHtmlMasked(assetResponse.contentType, assetResponse.bodyText)) {
      failures.push(
        `${assetUrl} returned an HTML document (content-type "${assetResponse.contentType}") ` +
          `instead of the asset itself. The SPA catch-all in public/_redirects is masking a ` +
          `missing file: the browser receives HTML where it expects a module, so the app never ` +
          `mounts and the page sits on its no-JS fallback. Redeploy this app and confirm the ` +
          `hashed assets referenced by index.html are present in the deploy.`,
      );
    }
  }
  console.log(`  ${baseUrl} — checked ${assetPaths.length} asset(s)`);
  return failures;
}

/**
 * Probes a live deployment, retrying to absorb the brief window during a
 * rollout when new HTML can be served against not-yet-propagated assets.
 * Only a failure that persists across every attempt is reported.
 *
 * @param {string} baseUrl - Origin of the deployed SPA, without a trailing slash.
 * @returns {Promise<string[]>} Full-sentence failure messages; empty when healthy.
 */
async function checkLiveUrl(baseUrl) {
  let lastFailures = [];
  for (let attempt = 1; attempt <= LIVE_ATTEMPT_COUNT; attempt += 1) {
    lastFailures = await runLiveProbePass(baseUrl);
    if (lastFailures.length === 0) {
      return [];
    }
    if (attempt < LIVE_ATTEMPT_COUNT) {
      console.log(
        `  ${baseUrl} — attempt ${attempt} found ${lastFailures.length} problem(s); ` +
          `retrying in ${LIVE_RETRY_DELAY_MS / 1000}s in case a deploy is mid-rollout.`,
      );
      await new Promise((resolve) => setTimeout(resolve, LIVE_RETRY_DELAY_MS));
    }
  }
  return lastFailures;
}

/**
 * Parses repeatable `--dist` and `--url` flags from the argument vector.
 *
 * @param {string[]} argumentVector - Arguments after the script name.
 * @returns {{distDirectories: string[], baseUrls: string[]}}
 */
function parseArguments(argumentVector) {
  const distDirectories = [];
  const baseUrls = [];
  for (let index = 0; index < argumentVector.length; index += 1) {
    const flag = argumentVector[index];
    const value = argumentVector[index + 1];
    if (flag === '--dist' || flag === '--url') {
      if (value === undefined || value.startsWith('--')) {
        throw new Error(
          `The ${flag} flag requires a value. Example: node scripts/check-spa-assets.mjs ` +
            `--dist apps/legends-board/dist`,
        );
      }
      const collection = flag === '--dist' ? distDirectories : baseUrls;
      collection.push(flag === '--url' ? value.replace(/\/+$/, '') : value);
      index += 1;
    } else {
      throw new Error(
        `Unrecognized argument "${flag}". Supported flags are --dist <directory> and --url <baseUrl>, ` +
          `both repeatable.`,
      );
    }
  }
  return { distDirectories, baseUrls };
}

/**
 * Entry point: runs every requested check and exits non-zero on any failure.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const { distDirectories, baseUrls } = parseArguments(process.argv.slice(2));
  if (distDirectories.length === 0 && baseUrls.length === 0) {
    throw new Error(
      `No targets were supplied. Pass at least one --dist <directory> or --url <baseUrl>. ` +
        `Example: node scripts/check-spa-assets.mjs --dist apps/legends-board/dist`,
    );
  }

  const allFailures = [];
  if (distDirectories.length > 0) {
    console.log('SPA asset check — build output');
    for (const distDirectory of distDirectories) {
      allFailures.push(...(await checkDistDirectory(distDirectory)));
    }
  }
  if (baseUrls.length > 0) {
    console.log('SPA asset check — live deployments');
    for (const baseUrl of baseUrls) {
      allFailures.push(...(await checkLiveUrl(baseUrl)));
    }
  }

  if (allFailures.length > 0) {
    console.error(`\nFAIL — ${allFailures.length} problem(s) found:\n`);
    for (const failure of allFailures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }
  console.log('\nOK — every referenced asset resolved to real, non-HTML content.');
}

main().catch((error) => {
  console.error(`check-spa-assets failed: ${error.message}`);
  process.exit(2);
});
