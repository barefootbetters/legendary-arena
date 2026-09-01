/**
 * Tests for the reward-integrity commit guard (D-24444).
 *
 * Exercises the pure `evaluateCommitForRewardIntegrity()` and `parseNameStatus()`
 * with crafted inputs — no git state required — so both enforcement sites
 * (`.githooks/commit-msg` and the `reward-integrity` CI job) share verified logic.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateCommitForRewardIntegrity,
  parseNameStatus,
} from './commit-reward-integrity-guard.mjs';

/**
 * Builds a commit input, defaulting the message to empty.
 *
 * @param {string} subject - The commit subject line.
 * @param {Array<{status: string, path: string}>} files - Changed files.
 * @param {string} message - Full commit message (for trailer detection).
 * @returns {{ subject: string, message: string, files: Array<{status: string, path: string}> }}
 */
function makeCommit(
  subject: string,
  files: Array<{ status: string; path: string }>,
  message = '',
) {
  return { subject, message, files };
}

// --- Guard A: enforcement/permission files on EC commits ---

test('Guard A blocks an EC commit that edits a git hook', () => {
  const result = evaluateCommitForRewardIntegrity(
    makeCommit('EC-123: fix the widget', [{ status: 'M', path: '.githooks/commit-msg' }]),
  );
  assert.equal(result.ok, false);
  assert.match(result.violations[0], /enforcement or permission/);
});

test('Guard A blocks an EC commit that edits a CI workflow', () => {
  const result = evaluateCommitForRewardIntegrity(
    makeCommit('EC-123: fix the widget', [{ status: 'M', path: '.github/workflows/ci.yml' }]),
  );
  assert.equal(result.ok, false);
});

test('Guard A blocks an EC commit that edits a .claude rule', () => {
  const result = evaluateCommitForRewardIntegrity(
    makeCommit('EC-7a: adjust behavior', [{ status: 'M', path: '.claude/rules/architecture.md' }]),
  );
  assert.equal(result.ok, false);
});

test('Guard A blocks an EC commit that edits CLAUDE.md', () => {
  const result = evaluateCommitForRewardIntegrity(
    makeCommit('EC-7: adjust behavior', [{ status: 'M', path: '.claude/CLAUDE.md' }]),
  );
  assert.equal(result.ok, false);
});

test('Guard A blocks an EC commit that edits a .claude settings file', () => {
  const result = evaluateCommitForRewardIntegrity(
    makeCommit('EC-7: adjust behavior', [{ status: 'M', path: '.claude/settings.json' }]),
  );
  assert.equal(result.ok, false);
});

test('Guard A allows an INFRA commit to edit a git hook', () => {
  const result = evaluateCommitForRewardIntegrity(
    makeCommit('INFRA: harden the commit-msg hook', [
      { status: 'M', path: '.githooks/commit-msg' },
    ]),
  );
  assert.equal(result.ok, true);
});

test('Guard A allows a SPEC commit to edit a .claude rule', () => {
  const result = evaluateCommitForRewardIntegrity(
    makeCommit('SPEC: clarify architecture rule', [
      { status: 'M', path: '.claude/rules/architecture.md' },
    ]),
  );
  assert.equal(result.ok, true);
});

// --- Guard B: test-only modification on EC commits ---

test('Guard B blocks an EC commit that modifies a test with no source change', () => {
  const result = evaluateCommitForRewardIntegrity(
    makeCommit('EC-9: make the suite pass', [
      { status: 'M', path: 'packages/game-engine/src/foo.test.ts' },
    ]),
  );
  assert.equal(result.ok, false);
  assert.match(result.violations[0], /weaken|assertion/i);
});

test('Guard B allows a test change accompanied by a source change', () => {
  const result = evaluateCommitForRewardIntegrity(
    makeCommit('EC-9: fix foo and update its test', [
      { status: 'M', path: 'packages/game-engine/src/foo.ts' },
      { status: 'M', path: 'packages/game-engine/src/foo.test.ts' },
    ]),
  );
  assert.equal(result.ok, true);
});

test('Guard B allows a test-only change with a Tests-changed trailer', () => {
  const result = evaluateCommitForRewardIntegrity(
    makeCommit(
      'EC-9: re-record fixture after engine change',
      [{ status: 'M', path: 'packages/game-engine/src/foo.test.ts' }],
      'EC-9: re-record fixture after engine change\n\nTests-changed: fixture re-recorded after the WP-9 engine change.\n',
    ),
  );
  assert.equal(result.ok, true);
});

test('Guard B ignores a newly-added test file (adding coverage is fine)', () => {
  const result = evaluateCommitForRewardIntegrity(
    makeCommit('EC-9: add coverage for foo', [
      { status: 'A', path: 'packages/game-engine/src/foo.test.ts' },
    ]),
  );
  assert.equal(result.ok, true);
});

// --- Exemptions and clean cases ---

test('non-EC commits are entirely exempt', () => {
  const result = evaluateCommitForRewardIntegrity(
    makeCommit('INFRA: change everything', [
      { status: 'M', path: '.githooks/commit-msg' },
      { status: 'M', path: 'packages/game-engine/src/foo.test.ts' },
    ]),
  );
  assert.equal(result.ok, true);
});

test('a normal EC code change passes', () => {
  const result = evaluateCommitForRewardIntegrity(
    makeCommit('EC-9: implement foo', [{ status: 'M', path: 'packages/game-engine/src/foo.ts' }]),
  );
  assert.equal(result.ok, true);
});

test('an EC commit that both silences a monitor and weakens a test reports both', () => {
  const result = evaluateCommitForRewardIntegrity(
    makeCommit('EC-9: get it green', [
      { status: 'M', path: '.github/workflows/ci.yml' },
      { status: 'M', path: 'packages/game-engine/src/foo.test.ts' },
    ]),
  );
  assert.equal(result.ok, false);
  assert.equal(result.violations.length, 2);
});

// --- parseNameStatus ---

test('parseNameStatus reads status and path for simple changes', () => {
  const records = parseNameStatus('M\tpackages/a/src/foo.ts\nA\tpackages/a/src/bar.ts\n');
  assert.deepEqual(records, [
    { status: 'M', path: 'packages/a/src/foo.ts' },
    { status: 'A', path: 'packages/a/src/bar.ts' },
  ]);
});

test('parseNameStatus takes the destination path of a rename', () => {
  const records = parseNameStatus('R100\told/name.ts\tnew/name.ts\n');
  assert.deepEqual(records, [{ status: 'R', path: 'new/name.ts' }]);
});

test('parseNameStatus ignores blank lines', () => {
  const records = parseNameStatus('\nM\tfoo.ts\n\n');
  assert.deepEqual(records, [{ status: 'M', path: 'foo.ts' }]);
});
