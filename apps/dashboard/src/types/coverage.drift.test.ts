import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEDGER_STATUSES, LIVE_VERIFY_STATES } from './coverage.js';

// Drift detection: the canonical readonly array must match the LedgerStatus
// union exactly (mirrors `types/roadmap.drift.test.ts` and the
// `.claude/rules/code-style.md §Drift Detection` rule).
test('LEDGER_STATUSES matches the LedgerStatus union exactly', () => {
  assert.deepEqual(
    [...LEDGER_STATUSES],
    ['executable', 'deferred', 'condition', 'unsupported', 'unmarked', 'subsystem'],
  );
});

test('LIVE_VERIFY_STATES matches the LiveVerifyState union exactly', () => {
  assert.deepEqual([...LIVE_VERIFY_STATES], ['verified', 'partial', 'pending']);
});
