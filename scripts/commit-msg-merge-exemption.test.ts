/**
 * Tests for the commit-msg hook's merge-from-main exemption (D-24632).
 *
 * Runs the real `.githooks/commit-msg` against a temp message file, the same way
 * the commit-hygiene CI job does, with `COMMIT_HYGIENE_IS_MERGE` standing in for
 * the CI job's parent-count check. Only git's default merge-from-main subject on
 * a genuine merge is exempt; everything else still needs an EC-### / SPEC: /
 * INFRA: prefix.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Run the commit-msg hook on a one-line message.
 *
 * @param subject - The commit subject.
 * @param isMerge - Whether to flag the commit as a merge (CI's parent-count signal).
 * @returns The hook's exit status.
 */
function runHook(subject: string, isMerge: boolean): number | null {
  const directory = mkdtempSync(join(tmpdir(), 'commit-msg-'));
  const messageFile = join(directory, 'COMMIT_EDITMSG');
  writeFileSync(messageFile, subject + '\n');
  try {
    const result = spawnSync('sh', ['.githooks/commit-msg', messageFile], {
      env: { ...process.env, COMMIT_HYGIENE_IS_MERGE: isMerge ? '1' : '0' },
      encoding: 'utf8',
    });
    return result.status;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('git default merge-from-main subjects pass on a genuine merge', () => {
  const subjects = [
    "Merge remote-tracking branch 'origin/main' into claude/expired-session-score-submit",
    "Merge branch 'main' into claude/fix-debug-panel",
    "Merge branch 'main' of https://github.com/barefootbetters/legendary-arena into feature",
    "Merge remote-tracking branch 'origin/main'",
  ];
  for (const subject of subjects) {
    assert.equal(runHook(subject, true), 0, subject);
  }
});

test('the same subject on a non-merge commit is still rejected', () => {
  // why: this test runs outside a merge, so no MERGE_HEAD exists; only the flag
  // could exempt it, and it is off.
  assert.equal(
    runHook("Merge remote-tracking branch 'origin/main' into claude/some-branch", false),
    1,
  );
});

test('a merge of any other branch still needs a prefix', () => {
  assert.equal(runHook("Merge branch 'feature/x' into main", true), 1);
  assert.equal(runHook("Merge remote-tracking branch 'origin/release' into claude/x", true), 1);
});

test('a hand-written merge subject still needs a prefix', () => {
  assert.equal(runHook('Merge main and fix the ledger rows', true), 1);
  assert.equal(runHook("Merge branch 'main' into claude/x and resolve conflicts", true), 1);
});

test('prefixed subjects are unaffected by the merge flag', () => {
  assert.equal(runHook('INFRA: merge origin/main into claude/some-branch', true), 0);
  assert.equal(runHook('INFRA: merge origin/main into claude/some-branch', false), 0);
});
