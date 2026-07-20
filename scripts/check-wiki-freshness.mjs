/**
 * Legendary Arena — Ewiki Deploy-Freshness Gate
 *
 * The ewiki (`ewiki.legendary-arena.com`, Render static site
 * `legendary-arena-wiki`) has `autoDeploy` disabled. The `wiki-viewer`
 * GitHub Actions workflow is the SOLE deploy trigger: it runs the
 * link-integrity, Hugo build, determinism, and JS-free gates, and only on
 * a pass does its `deploy` job fire Render's deploy hook. That design is
 * deliberate — it keeps broken wiki content off the live site — but it
 * means the live wiki silently freezes whenever the workflow does not
 * complete, with no signal anywhere except the page not being there.
 *
 * Observed 2026-07-19: a GitHub Actions incident left every run on the
 * repository stuck in `queued` for roughly an hour. Four commits landed on
 * `main`, including a new wiki page, and the live site stayed on the
 * previous build. Nothing was broken, nothing was red, and the only way to
 * notice was to visit the page and find it missing.
 *
 * This check answers one question: **is the live ewiki built from the
 * newest commit that should have triggered a build?** It compares the most
 * recent commit on `origin/main` touching any of the workflow's trigger
 * paths against the newest successful `wiki-viewer` run, and reports what
 * is holding up the deploy when the two disagree.
 *
 * why: this probe deliberately does NOT fetch the live site. The ewiki sits
 * behind Cloudflare Access, so an unauthenticated request returns a 302
 * login redirect for every path — a deployed page and a missing one are
 * indistinguishable from outside. The workflow's run history is the only
 * observable that actually reflects deploy state.
 *
 * why: this is an operator-run probe, not a scheduled workflow. The failure
 * class it detects is "GitHub Actions is not running our workflows," and a
 * nightly job would be queued behind exactly the same outage it is meant to
 * report. Run it from a workstation when a wiki edit does not appear.
 *
 * KNOWN LIMITATION — a manual deploy produces a false STALE. This probe
 * answers "did CI deploy this commit?", NOT "is the live site current?".
 * Those diverge whenever someone publishes from the Render dashboard's
 * Manual Deploy button, which is the documented workaround when Actions is
 * down: the site becomes current while CI run history still shows nothing
 * successful, so this check keeps reporting STALE against a site that is in
 * fact up to date. Observed twice on 2026-07-19 during a multi-hour Actions
 * incident. The error is in the safe direction — it over-reports staleness
 * rather than hiding a frozen site — and it is not cheaply fixable: Render's
 * deploy state needs a RENDER_API_KEY this script deliberately does not take,
 * and the live site cannot be read directly because Cloudflare Access returns
 * a 302 for every path. Treat a STALE verdict as "CI has not published this"
 * and check Render's deploy log before concluding the page is missing.
 *
 * Usage:
 *   node scripts/check-wiki-freshness.mjs
 *   node scripts/check-wiki-freshness.mjs --no-fetch
 *   pnpm check:wiki
 *
 * Requires the `gh` CLI, authenticated against this repository. The
 * workflow-run history is not public, so an unauthenticated HTTP fetch
 * cannot substitute.
 *
 * Exit codes:
 *   0 — the live ewiki reflects the newest triggering commit
 *   1 — the live ewiki is stale (a triggering commit has no successful run)
 *   2 — unexpected internal error (missing `gh`, no upstream, bad state)
 */

import { execFileSync } from 'node:child_process';

const REPOSITORY = 'barefootbetters/legendary-arena';
const WORKFLOW_FILE = 'wiki-viewer.yml';
const BRANCH = 'main';

// why: this list MIRRORS the `paths:` filter in
// .github/workflows/wiki-viewer.yml. If a path is added there and not here,
// this check reports "fresh" for a commit that did trigger a build, which is
// the exact false reassurance the probe exists to prevent. Keep both in sync;
// the workflow file is authoritative.
const TRIGGER_PATHS = [
  'wiki/',
  'ewiki/',
  'apps/wiki-viewer/',
  '.github/workflows/wiki-viewer.yml',
  'docs/09-CHANGELOG.md',
];

// why: the deploy job only fires for runs that reached a successful
// conclusion, so any other state — queued, in progress, failed, cancelled —
// means Render was never told to rebuild.
const RUN_HISTORY_LIMIT = 30;

/**
 * Runs a command and returns its trimmed stdout, throwing a full-sentence
 * error naming the command when it fails.
 *
 * @param {string} command - Executable to run.
 * @param {string[]} commandArguments - Arguments passed to the executable.
 * @returns {string} The command's stdout with surrounding whitespace removed.
 */
function runCommand(command, commandArguments) {
  try {
    return execFileSync(command, commandArguments, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (commandFailure) {
    const details = commandFailure.stderr?.trim() || commandFailure.message;
    throw new Error(
      `The command "${command} ${commandArguments.join(' ')}" failed. ` +
        `Check that ${command} is installed and available on PATH, and that ` +
        `you are authenticated if it talks to GitHub. Underlying error: ${details}`,
    );
  }
}

/**
 * Finds the newest commit on the tracked branch that touched any path the
 * wiki-viewer workflow watches.
 *
 * @returns {{ sha: string, subject: string, committedAt: string } | null}
 *   The triggering commit, or null when no commit in history touched a
 *   trigger path.
 */
function findNewestTriggeringCommit() {
  const output = runCommand('git', [
    'log',
    `origin/${BRANCH}`,
    '-1',
    '--format=%H%x00%s%x00%cI',
    '--',
    ...TRIGGER_PATHS,
  ]);

  if (output === '') {
    return null;
  }

  const [sha, subject, committedAt] = output.split('\0');
  return { sha, subject, committedAt };
}

/**
 * Fetches recent wiki-viewer workflow runs for the tracked branch, newest
 * first.
 *
 * @returns {Array<{ sha: string, status: string, conclusion: string | null, createdAt: string, url: string }>}
 *   The run history, newest first.
 */
function fetchWorkflowRuns() {
  const endpoint =
    `repos/${REPOSITORY}/actions/workflows/${WORKFLOW_FILE}/runs` +
    `?branch=${BRANCH}&per_page=${RUN_HISTORY_LIMIT}`;

  const output = runCommand('gh', [
    'api',
    endpoint,
    '--jq',
    '.workflow_runs[] | [.head_sha, .status, (.conclusion // ""), .created_at, .html_url] | @tsv',
  ]);

  if (output === '') {
    return [];
  }

  const runs = [];
  for (const line of output.split('\n')) {
    const [sha, status, conclusion, createdAt, url] = line.split('\t');
    runs.push({
      sha,
      status,
      conclusion: conclusion === '' ? null : conclusion,
      createdAt,
      url,
    });
  }
  return runs;
}

/**
 * Reports whether one commit is an ancestor of another (or the same commit).
 * A successful run covers a triggering commit when the commit is reachable
 * from the run's head, because a later build includes every earlier change.
 *
 * @param {string} ancestorSha - The commit that must be contained.
 * @param {string} descendantSha - The commit that may contain it.
 * @returns {boolean} True when ancestorSha is reachable from descendantSha.
 */
function isAncestor(ancestorSha, descendantSha) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestorSha, descendantSha], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    // why: `--is-ancestor` exits non-zero both for "not an ancestor" and for
    // an unknown object (a run whose commit was never fetched locally, e.g.
    // from a deleted branch). Both mean the run cannot be shown to cover the
    // triggering commit, which is the conservative answer for a staleness
    // probe — better a false "stale" the operator can dismiss than a false
    // "fresh" that hides a frozen site.
    return false;
  }
}

/**
 * Describes what a pending or failed run means for the operator, so the
 * output says what to do rather than only what is wrong.
 *
 * @param {{ status: string, conclusion: string | null }} run - The run to describe.
 * @returns {string} A full-sentence explanation of the run's state.
 */
function describeRunState(run) {
  if (run.status === 'queued') {
    return (
      'The run is still queued — GitHub Actions has accepted it but not started it. ' +
      'This is the signature of an Actions incident or a runner backlog; check ' +
      'https://www.githubstatus.com before assuming a repository problem.'
    );
  }
  if (run.status === 'in_progress') {
    return 'The run is in progress. Wait for it to finish; the deploy fires on success.';
  }
  if (run.conclusion === 'failure') {
    return (
      'The run FAILED, so the deploy hook never fired. Read the run log — the ' +
      'link-integrity, Hugo build, determinism, and JS-free gates all block the deploy.'
    );
  }
  if (run.conclusion === 'cancelled') {
    return 'The run was cancelled, so the deploy hook never fired. Re-run it from the Actions tab.';
  }
  return `The run ended as "${run.conclusion ?? run.status}", which is not a success, so no deploy was triggered.`;
}

/**
 * Entry point. Compares the newest triggering commit against wiki-viewer run
 * history and reports whether the live ewiki is current.
 *
 * @returns {number} The process exit code.
 */
function main() {
  const shouldFetch = !process.argv.includes('--no-fetch');

  if (shouldFetch) {
    // why: the comparison is against origin/main, so a stale remote-tracking
    // ref would silently compare against old history and report a frozen site
    // as fresh.
    runCommand('git', ['fetch', 'origin', BRANCH, '--quiet']);
  }

  const triggeringCommit = findNewestTriggeringCommit();
  if (triggeringCommit === null) {
    console.log('No commit on origin/main touches a wiki-viewer trigger path. Nothing to check.');
    return 0;
  }

  const shortSha = triggeringCommit.sha.slice(0, 8);
  console.log(`Newest triggering commit: ${shortSha} — ${triggeringCommit.subject}`);
  console.log(`  committed ${triggeringCommit.committedAt}`);

  const runs = fetchWorkflowRuns();
  if (runs.length === 0) {
    console.error(
      `\nSTALE: no ${WORKFLOW_FILE} runs exist for branch ${BRANCH}. The live ewiki ` +
        'cannot have been deployed by CI. Check that the workflow file is present and ' +
        'that Actions is enabled for this repository.',
    );
    return 1;
  }

  const newestSuccessfulRun = runs.find((run) => run.conclusion === 'success');

  if (newestSuccessfulRun && isAncestor(triggeringCommit.sha, newestSuccessfulRun.sha)) {
    console.log(
      `\nFRESH: the live ewiki was built from ${newestSuccessfulRun.sha.slice(0, 8)} ` +
        `(${newestSuccessfulRun.createdAt}), which contains ${shortSha}.`,
    );
    return 0;
  }

  console.error(`\nSTALE: the live ewiki does not reflect ${shortSha}.`);

  if (newestSuccessfulRun) {
    console.error(
      `  Newest successful run: ${newestSuccessfulRun.sha.slice(0, 8)} ` +
        `(${newestSuccessfulRun.createdAt}) — ${newestSuccessfulRun.url}`,
    );
  } else {
    console.error(`  No successful run appears in the last ${RUN_HISTORY_LIMIT} runs.`);
  }

  // why: name the run that SHOULD have deployed this commit, if one exists.
  // Its state is the actual answer to "why isn't my page up" — queued means
  // an Actions outage, failure means a content gate rejected the change.
  const runForCommit = runs.find((run) => run.sha === triggeringCommit.sha);
  if (runForCommit) {
    console.error(`  Run for ${shortSha}: status=${runForCommit.status}, conclusion=${runForCommit.conclusion ?? 'none'}`);
    console.error(`    ${describeRunState(runForCommit)}`);
    console.error(`    ${runForCommit.url}`);
  } else {
    console.error(
      `  No ${WORKFLOW_FILE} run exists for ${shortSha} at all. Either the push has not ` +
        'registered yet, or the commit changed only paths outside the workflow trigger ' +
        'filter while this check believes otherwise (compare TRIGGER_PATHS here against ' +
        'the paths filter in .github/workflows/wiki-viewer.yml).',
    );
  }

  console.error(
    '\n  To publish without waiting for CI: Render dashboard → legendary-arena-wiki → ' +
      'Manual Deploy. That bypasses the content gates, so run ' +
      '`pnpm wiki-viewer:project && pnpm wiki-viewer:check-links` locally first.',
  );

  // why: this probe reads CI run history, not Render's deploy state, so a
  // manual deploy leaves it reporting STALE against a site that is actually
  // current. Saying so here means the operator does not re-deploy a page that
  // is already live, or go hunting for a problem that no longer exists.
  console.error(
    '\n  NOTE: this check reads CI history, not Render. If the site was already ' +
      'published by a Manual Deploy, this STALE verdict is expected and the live ' +
      'page may be current — confirm in the Render deploy log.',
  );

  return 1;
}

try {
  process.exit(main());
} catch (unexpectedFailure) {
  console.error(`Ewiki freshness check could not complete. ${unexpectedFailure.message}`);
  process.exit(2);
}
