#!/usr/bin/env node
// scripts/git/ensure-worktree-hooks-path.mjs
//
// SessionStart guard (D-24643): makes the current checkout run its OWN
// branch's `.githooks`, not another checkout's copy.
//
// The repo's documented setting is the relative `core.hooksPath = .githooks`
// (scripts/git/install-ec-hooks.ps1), which git resolves against each
// worktree's root. Worktrees have been found with an absolute override
// (`.git/worktrees/<name>/config.worktree`) pointing at the canonical
// checkout's `.githooks`. That checkout sits on whatever branch it was last
// left on, so every worktree silently ran its stale hooks — e.g. a commit-msg
// hook from before the D-24632 merge-from-main exemption, which rejected
// git's own merge subject during an Auto-fix conflict resolution.
//
// Behavior: when the effective `core.hooksPath` is unset or resolves to any
// directory other than `<this worktree>/.githooks`, set it back to the
// relative `.githooks` — per worktree (`--worktree`) when the repo has
// `extensions.worktreeConfig`, else in the repo config. Prints one line when it
// changes something; silent otherwise. Always exits 0, so it can never block a
// session from starting.

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXPECTED_HOOKS_PATH = '.githooks';

/**
 * Runs a git command and returns its trimmed stdout.
 *
 * @param {string[]} args - The git arguments.
 * @param {string} cwd - The directory to run in.
 * @returns {string | null} The output, or null when git exits non-zero.
 */
function runGit(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // why: `git config <key>` exits 1 when the key is unset, and `rev-parse`
    // exits non-zero outside a repo; both mean "nothing configured here".
    return null;
  }
}

/**
 * Normalizes an absolute path for comparison (forward slashes, no trailing
 * slash, case-folded on Windows).
 *
 * @param {string} absolutePath - The path to normalize.
 * @returns {string} The comparable form.
 */
function toComparablePath(absolutePath) {
  const normalized = resolve(absolutePath).replace(/\\/g, '/').replace(/\/+$/, '');
  if (process.platform === 'win32') {
    return normalized.toLowerCase();
  }
  return normalized;
}

/**
 * Decides whether a checkout's hooks path needs repair.
 *
 * @param {string} worktreeRoot - The checkout's top-level directory.
 * @param {string | null} currentHooksPath - The effective `core.hooksPath`.
 * @returns {boolean} True when hooks would not run from this checkout's `.githooks`.
 */
export function isHooksPathWrong(worktreeRoot, currentHooksPath) {
  if (currentHooksPath === null || currentHooksPath === '') {
    return true;
  }
  const resolvedCurrent = resolve(worktreeRoot, currentHooksPath);
  const resolvedExpected = resolve(worktreeRoot, EXPECTED_HOOKS_PATH);
  return toComparablePath(resolvedCurrent) !== toComparablePath(resolvedExpected);
}

/**
 * Points the checkout at `cwd` back at its own `.githooks` when it is not.
 *
 * @param {string} cwd - Any directory inside the checkout.
 * @returns {{ status: 'not-a-repo' | 'ok' | 'repaired' | 'failed', from?: string | null, scope?: string }}
 *   What happened, the previous value, and the config scope written.
 */
export function ensureWorktreeHooksPath(cwd) {
  const worktreeRoot = runGit(['rev-parse', '--show-toplevel'], cwd);
  if (worktreeRoot === null) {
    return { status: 'not-a-repo' };
  }
  const currentHooksPath = runGit(['config', 'core.hooksPath'], worktreeRoot);
  if (!isHooksPathWrong(worktreeRoot, currentHooksPath)) {
    return { status: 'ok' };
  }
  // why: with extensions.worktreeConfig, `--worktree` overrides both a stale
  // per-worktree value and a stale shared value without touching any other
  // checkout's config.
  const hasWorktreeConfig = runGit(['config', '--bool', 'extensions.worktreeConfig'], worktreeRoot) === 'true';
  const scope = hasWorktreeConfig ? '--worktree' : '--local';
  const writeResult = runGit(['config', scope, 'core.hooksPath', EXPECTED_HOOKS_PATH], worktreeRoot);
  if (writeResult === null) {
    return { status: 'failed', from: currentHooksPath, scope };
  }
  return { status: 'repaired', from: currentHooksPath, scope };
}

/**
 * Runs the guard for the current directory and reports any change.
 *
 * @returns {void}
 */
function main() {
  try {
    const result = ensureWorktreeHooksPath(process.cwd());
    const previous = result.from ?? '(unset)';
    if (result.status === 'repaired') {
      console.log(
        `Commit hooks: core.hooksPath was ${previous}, not this worktree's own .githooks — ` +
          `reset it to .githooks (${result.scope}) so commits run this branch's hooks (D-24643).`,
      );
    } else if (result.status === 'failed') {
      console.log(
        `Commit hooks: core.hooksPath is ${previous}, not this worktree's own .githooks, and resetting it failed. ` +
          `Run: git config ${result.scope} core.hooksPath .githooks (D-24643).`,
      );
    }
  } catch (error) {
    // why: a SessionStart hook must never block a session; report and move on.
    console.log(`Commit hooks: the hooks-path check could not run (${error.message}).`);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main();
}
