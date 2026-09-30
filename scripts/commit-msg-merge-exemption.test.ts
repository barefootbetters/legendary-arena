/**
 * Tests for the commit-msg hook's merge-from-main exemption (D-24632).
 *
 * Runs the real `.githooks/commit-msg` against a temp message file, the same way
 * the commit-hygiene CI job does, with `COMMIT_HYGIENE_IS_MERGE` standing in for
 * the CI job's parent-count check. Only git's default merge-from-main subject on
 * a genuine merge is exempt; everything else still needs an EC-### / SPEC: /
 * INFRA: prefix.
 *
 * Each run happens inside a fresh throwaway git repository, so the result never
 * depends on the state of the checkout running the tests (a merge in progress
 * there leaves a MERGE_HEAD the hook would otherwise see).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK_PATH = fileURLToPath(new URL('../.githooks/commit-msg', import.meta.url));

interface HookRunOptions {
  /** CI's signal: the commit has 2+ parents. */
  readonly isMerge?: boolean;
  /** Local signal: the throwaway repo has a MERGE_HEAD, as while concluding a merge. */
  readonly hasMergeHead?: boolean;
}

/**
 * Build a child-process environment without inherited git location variables,
 * so every git call inside the hook resolves to the throwaway repository.
 *
 * @param isMerge - The value to pass as COMMIT_HYGIENE_IS_MERGE.
 * @returns The environment for the hook process.
 */
function buildHookEnvironment(isMerge: boolean): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env };
  // why: when the tests run from inside a git hook (or any git-spawned process),
  // these point at the outer repository and would override the throwaway repo.
  delete environment.GIT_DIR;
  delete environment.GIT_WORK_TREE;
  delete environment.GIT_INDEX_FILE;
  environment.COMMIT_HYGIENE_IS_MERGE = isMerge ? '1' : '0';
  return environment;
}

/**
 * Run a git command in `directory`, failing the test loudly if it fails.
 *
 * @param directory - The repository directory.
 * @param args - The git arguments.
 * @returns The command's trimmed stdout.
 */
function runGit(directory: string, args: readonly string[]): string {
  const result = spawnSync('git', [...args], {
    cwd: directory,
    env: buildHookEnvironment(false),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

/**
 * Run the commit-msg hook on a one-line message inside a fresh git repository.
 *
 * @param subject - The commit subject.
 * @param options - The merge signals to simulate.
 * @returns The hook's exit status.
 */
function runHook(subject: string, options: HookRunOptions = {}): number | null {
  const directory = mkdtempSync(join(tmpdir(), 'commit-msg-'));
  try {
    runGit(directory, ['init', '-q']);
    if (options.hasMergeHead === true) {
      runGit(directory, [
        '-c', 'user.name=test', '-c', 'user.email=test@example.com',
        'commit', '-q', '--allow-empty', '--no-verify', '-m', 'base',
      ]);
      const headSha = runGit(directory, ['rev-parse', 'HEAD']);
      writeFileSync(join(directory, '.git', 'MERGE_HEAD'), headSha + '\n');
    }
    const messageFile = join(directory, 'COMMIT_EDITMSG');
    writeFileSync(messageFile, subject + '\n');
    const result = spawnSync('sh', [HOOK_PATH, messageFile], {
      cwd: directory,
      env: buildHookEnvironment(options.isMerge === true),
      encoding: 'utf8',
    });
    return result.status;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('git default merge-from-main subjects pass on a genuine merge (CI flag)', () => {
  const subjects = [
    "Merge remote-tracking branch 'origin/main' into claude/expired-session-score-submit",
    "Merge branch 'main' into claude/fix-debug-panel",
    "Merge branch 'main' of https://github.com/barefootbetters/legendary-arena into feature",
    "Merge remote-tracking branch 'origin/main'",
  ];
  for (const subject of subjects) {
    assert.equal(runHook(subject, { isMerge: true }), 0, subject);
  }
});

test('the default subject passes while concluding a local merge (MERGE_HEAD present)', () => {
  assert.equal(
    runHook("Merge remote-tracking branch 'origin/main' into claude/some-branch", {
      hasMergeHead: true,
    }),
    0,
  );
});

test('the same subject on a non-merge commit is still rejected', () => {
  assert.equal(
    runHook("Merge remote-tracking branch 'origin/main' into claude/some-branch"),
    1,
  );
});

test('a merge of any other branch still needs a prefix', () => {
  assert.equal(runHook("Merge branch 'feature/x' into main", { isMerge: true }), 1);
  assert.equal(
    runHook("Merge remote-tracking branch 'origin/release' into claude/x", { isMerge: true }),
    1,
  );
});

test('a hand-written merge subject still needs a prefix', () => {
  assert.equal(runHook('Merge main and fix the ledger rows', { isMerge: true }), 1);
  assert.equal(
    runHook("Merge branch 'main' into claude/x and resolve conflicts", { isMerge: true }),
    1,
  );
});

test('prefixed subjects are unaffected by the merge flag', () => {
  assert.equal(runHook('INFRA: merge origin/main into claude/some-branch', { isMerge: true }), 0);
  assert.equal(runHook('INFRA: merge origin/main into claude/some-branch'), 0);
});
