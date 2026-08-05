/**
 * Legendary Arena — Wait For SPA Deploy To Go Live
 *
 * Companion to `scripts/check-spa-assets.mjs`. That probe fetches (and thereby
 * warms) the assets a deployed SPA references; this script tells a post-deploy
 * workflow WHEN the new deploy is actually live at the edge, so the warm runs
 * against the new bundle rather than the outgoing one.
 *
 * The signal is `version.json` — the tiny `{ "gitSha": "<short>" }` file emitted
 * into every arena-client build (WP-418). This script polls
 * `<baseUrl>/version.json` (cache-busted, no-store) until the served `gitSha`
 * is a prefix of the commit SHA that triggered the deploy, or a timeout
 * expires.
 *
 * Why a prefix match: `version.json` stamps `git rev-parse --short HEAD`
 * (typically 7 hex chars, but git lengthens it when a short SHA would be
 * ambiguous), while a CI runner knows the full 40-char SHA. A full SHA that
 * starts with the served short SHA is the same commit.
 *
 * Cloudflare Pages auto-deploys on push and takes minutes to build and
 * propagate; a fetch error or an old `gitSha` during that window is expected
 * and simply retried until the timeout.
 *
 * Usage:
 *   node scripts/wait-for-spa-deploy.mjs --url https://play.legendary-arena.com --sha <fullGitSha>
 *   node scripts/wait-for-spa-deploy.mjs --url <baseUrl> --sha <sha> --timeout-seconds 600 --interval-seconds 15
 *
 * Exit codes:
 *   0 — the deploy of <sha> is live (served version.json gitSha matched)
 *   1 — the deploy did not go live within the timeout
 *   2 — unexpected internal error (bad arguments)
 */

// why: Cloudflare Pages builds and propagates a push in a few minutes, so the
// default budget is generous enough to cover a normal build without hanging a
// workflow indefinitely when a deploy is stuck or was never triggered.
const DEFAULT_TIMEOUT_SECONDS = 600;
const DEFAULT_INTERVAL_SECONDS = 15;

// why: a single version.json fetch is tiny; a short per-request timeout keeps a
// dead host from stalling the whole poll budget on one hung connection.
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Fetches `<baseUrl>/version.json` with caches bypassed and returns the served
 * short git SHA, or `null` when the deploy is still building (any non-200,
 * network error, timeout, or unparseable body — all expected mid-rollout).
 *
 * @param {string} baseUrl - Origin of the deployed SPA, without a trailing slash.
 * @param {number} cacheBuster - A changing value appended to defeat edge caching.
 * @returns {Promise<string | null>} The served `gitSha`, or `null` if not yet readable.
 */
async function readDeployedGitSha(baseUrl, cacheBuster) {
  const versionUrl = `${baseUrl}/version.json?cb=${cacheBuster}`;
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(versionUrl, {
      signal: abortController.signal,
      // why: the whole point is to observe the NEW deploy, so a stale cached
      // version.json must never be accepted — caches are bypassed explicitly.
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (response.status !== 200) {
      return null;
    }
    const body = await response.json();
    if (typeof body.gitSha !== 'string' || body.gitSha.length === 0) {
      return null;
    }
    return body.gitSha;
  } catch {
    // why: a fetch error mid-rollout is normal, not fatal — the caller retries
    // until the timeout, so swallowing and returning null is safe here.
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Polls the deploy signal until the expected commit is live or the timeout
 * expires.
 *
 * @param {string} baseUrl - Origin of the deployed SPA, without a trailing slash.
 * @param {string} expectedFullSha - The full commit SHA that triggered the deploy.
 * @param {number} timeoutSeconds - Total budget before giving up.
 * @param {number} intervalSeconds - Delay between poll attempts.
 * @returns {Promise<boolean>} True when the deploy went live within the budget.
 */
async function waitForDeploy(baseUrl, expectedFullSha, timeoutSeconds, intervalSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    const servedGitSha = await readDeployedGitSha(baseUrl, attempt);
    if (servedGitSha !== null && expectedFullSha.startsWith(servedGitSha)) {
      console.log(
        `  ${baseUrl} — deploy of ${servedGitSha} is live (attempt ${attempt}).`,
      );
      return true;
    }
    const servedLabel = servedGitSha === null ? 'unreadable' : servedGitSha;
    console.log(
      `  ${baseUrl} — attempt ${attempt}: served gitSha ${servedLabel}, ` +
        `waiting for ${expectedFullSha.slice(0, 7)}; retrying in ${intervalSeconds}s.`,
    );
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
  }
  return false;
}

/**
 * Parses `--url`, `--sha`, `--timeout-seconds`, and `--interval-seconds` flags.
 *
 * @param {string[]} argumentVector - Arguments after the script name.
 * @returns {{baseUrl: string, expectedFullSha: string, timeoutSeconds: number, intervalSeconds: number}}
 */
function parseArguments(argumentVector) {
  let baseUrl = null;
  let expectedFullSha = null;
  let timeoutSeconds = DEFAULT_TIMEOUT_SECONDS;
  let intervalSeconds = DEFAULT_INTERVAL_SECONDS;
  for (let index = 0; index < argumentVector.length; index += 1) {
    const flag = argumentVector[index];
    const value = argumentVector[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(
        `The ${flag} flag requires a value. Example: node scripts/wait-for-spa-deploy.mjs ` +
          `--url https://play.legendary-arena.com --sha <fullGitSha>`,
      );
    }
    if (flag === '--url') {
      baseUrl = value.replace(/\/+$/, '');
    } else if (flag === '--sha') {
      expectedFullSha = value.trim();
    } else if (flag === '--timeout-seconds') {
      timeoutSeconds = Number.parseInt(value, 10);
    } else if (flag === '--interval-seconds') {
      intervalSeconds = Number.parseInt(value, 10);
    } else {
      throw new Error(
        `Unrecognized argument "${flag}". Supported flags are --url <baseUrl>, --sha <fullGitSha>, ` +
          `--timeout-seconds <n>, and --interval-seconds <n>.`,
      );
    }
    index += 1;
  }
  if (baseUrl === null || expectedFullSha === null) {
    throw new Error(
      `Both --url <baseUrl> and --sha <fullGitSha> are required. Example: ` +
        `node scripts/wait-for-spa-deploy.mjs --url https://play.legendary-arena.com --sha $GITHUB_SHA`,
    );
  }
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error('The --timeout-seconds value must be a positive integer number of seconds.');
  }
  if (!Number.isInteger(intervalSeconds) || intervalSeconds <= 0) {
    throw new Error('The --interval-seconds value must be a positive integer number of seconds.');
  }
  return { baseUrl, expectedFullSha, timeoutSeconds, intervalSeconds };
}

/**
 * Entry point: waits for the deploy and exits non-zero if it never goes live.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const { baseUrl, expectedFullSha, timeoutSeconds, intervalSeconds } = parseArguments(
    process.argv.slice(2),
  );
  console.log(
    `Waiting for ${baseUrl} to serve commit ${expectedFullSha.slice(0, 7)} ` +
      `(up to ${timeoutSeconds}s, polling every ${intervalSeconds}s).`,
  );
  const wentLive = await waitForDeploy(baseUrl, expectedFullSha, timeoutSeconds, intervalSeconds);
  if (!wentLive) {
    console.error(
      `\nFAIL — ${baseUrl} did not serve commit ${expectedFullSha.slice(0, 7)} within ` +
        `${timeoutSeconds}s. The Cloudflare Pages deploy may have failed, been skipped, or be ` +
        `unusually slow. Check the Pages deployment for this commit before warming its assets.`,
    );
    process.exit(1);
  }
  console.log('\nOK — the expected deploy is live.');
}

main().catch((error) => {
  console.error(`wait-for-spa-deploy failed: ${error.message}`);
  process.exit(2);
});
