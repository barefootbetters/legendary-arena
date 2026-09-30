/**
 * Tests for the SessionStart hooks-path guard (D-24643).
 *
 * Each case builds a throwaway repository with a linked worktree and runs the
 * real script there as a subprocess, the way the SessionStart hook does. The
 * git environment variables are cleared so nothing points back at the outer
 * repository (the #2488 isolation pattern).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT_PATH = resolve('scripts/git/ensure-worktree-hooks-path.mjs');

/** The environment for child processes, with no git overrides inherited. */
function isolatedEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  delete environment.GIT_DIR;
  delete environment.GIT_WORK_TREE;
  delete environment.GIT_INDEX_FILE;
  return environment;
}

/** Runs git in a directory and returns trimmed stdout ('' when it exits non-zero). */
function git(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd, env: isolatedEnvironment(), encoding: 'utf8' });
  if (result.status !== 0) {
    return '';
  }
  return result.stdout.trim();
}

/** Runs the guard script in a directory. */
function runGuard(cwd: string): { status: number | null; stdout: string } {
  const result = spawnSync(process.execPath, [SCRIPT_PATH], { cwd, env: isolatedEnvironment(), encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout.trim() };
}

/**
 * Creates a repository (`main`, with worktreeConfig and the relative shared
 * hooks path) plus one linked worktree (`linked`).
 */
function makeRepository(): { base: string; mainCheckout: string; linkedCheckout: string } {
  const base = mkdtempSync(join(tmpdir(), 'hooks-path-'));
  const mainCheckout = join(base, 'main');
  const linkedCheckout = join(base, 'linked');
  mkdirSync(mainCheckout);
  git(mainCheckout, ['init', '-q', '-b', 'main']);
  git(mainCheckout, ['config', 'user.email', 'test@example.com']);
  git(mainCheckout, ['config', 'user.name', 'Test']);
  git(mainCheckout, ['config', 'extensions.worktreeConfig', 'true']);
  git(mainCheckout, ['config', 'core.hooksPath', '.githooks']);
  writeFileSync(join(mainCheckout, 'file.txt'), 'base\n');
  git(mainCheckout, ['add', 'file.txt']);
  git(mainCheckout, ['commit', '-q', '-m', 'base']);
  git(mainCheckout, ['worktree', 'add', '-q', linkedCheckout, '-b', 'feature']);
  return { base, mainCheckout, linkedCheckout };
}

test('a worktree override pointing at another checkout is reset to .githooks', () => {
  const { base, mainCheckout, linkedCheckout } = makeRepository();
  try {
    const canonicalHooks = join(mainCheckout, '.githooks');
    git(linkedCheckout, ['config', '--worktree', 'core.hooksPath', canonicalHooks]);
    const result = runGuard(linkedCheckout);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /reset it to \.githooks \(--worktree\)/);
    assert.equal(git(linkedCheckout, ['config', 'core.hooksPath']), '.githooks');
    assert.equal(git(mainCheckout, ['config', 'core.hooksPath']), '.githooks', 'the main checkout is untouched');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('a stale absolute shared value is overridden for this worktree only', () => {
  const { base, mainCheckout, linkedCheckout } = makeRepository();
  try {
    const canonicalHooks = join(mainCheckout, '.githooks');
    git(mainCheckout, ['config', 'core.hooksPath', canonicalHooks]);
    const result = runGuard(linkedCheckout);
    assert.equal(result.status, 0);
    assert.equal(git(linkedCheckout, ['config', 'core.hooksPath']), '.githooks');
    assert.equal(git(mainCheckout, ['config', '--local', 'core.hooksPath']), canonicalHooks, 'shared config is not rewritten');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('the relative .githooks, or an absolute path to this worktree own .githooks, is left alone silently', () => {
  const { base, linkedCheckout } = makeRepository();
  try {
    const relative = runGuard(linkedCheckout);
    assert.deepEqual(relative, { status: 0, stdout: '' });
    assert.equal(git(linkedCheckout, ['config', 'core.hooksPath']), '.githooks');

    const ownHooks = join(linkedCheckout, '.githooks');
    git(linkedCheckout, ['config', '--worktree', 'core.hooksPath', ownHooks]);
    const absoluteOwn = runGuard(linkedCheckout);
    assert.deepEqual(absoluteOwn, { status: 0, stdout: '' });
    assert.equal(git(linkedCheckout, ['config', 'core.hooksPath']), ownHooks);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('an unset hooks path is set to .githooks', () => {
  const { base, mainCheckout, linkedCheckout } = makeRepository();
  try {
    git(mainCheckout, ['config', '--unset', 'core.hooksPath']);
    const result = runGuard(linkedCheckout);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /was \(unset\)/);
    assert.equal(git(linkedCheckout, ['config', 'core.hooksPath']), '.githooks');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('outside a repository it exits 0 and prints nothing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hooks-path-norepo-'));
  try {
    assert.deepEqual(runGuard(directory), { status: 0, stdout: '' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
