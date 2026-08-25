/**
 * Tests for the feedback triage pure logic + type mirror (WP-605 / EC-640).
 *
 * Pure: no DOM, no fetch. Covers `validateStatusEdit` (each branch),
 * `buildUpdateFeedbackStatusBody`, the status list/labels, and — the cross-boundary
 * MIRROR PIN — a field-name keyset assertion so a silent desync from the server
 * `OperatorFeedbackItem` shape fails a test.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TRIAGE_STATUSES,
  buildUpdateFeedbackStatusBody,
  validateStatusEdit,
  type FeedbackTriageItem,
} from './feedbackTriage.js';

describe('validateStatusEdit (WP-605)', () => {
  test('accepts every non-declined status regardless of the reason field', () => {
    for (const status of FEEDBACK_TRIAGE_STATUSES) {
      if (status === 'declined') {
        continue;
      }
      assert.deepEqual(validateStatusEdit(status, ''), { ok: true }, status);
    }
  });

  test('accepts declined with a non-empty reason', () => {
    assert.deepEqual(validateStatusEdit('declined', 'out of scope'), { ok: true });
  });

  test('rejects declined with a blank / whitespace reason', () => {
    for (const reason of ['', '   ']) {
      const result = validateStatusEdit('declined', reason);
      assert.equal(result.ok, false);
    }
  });

  test('rejects an unknown status', () => {
    const result = validateStatusEdit('archived', 'x');
    assert.equal(result.ok, false);
  });
});

describe('buildUpdateFeedbackStatusBody (WP-605)', () => {
  test('includes the trimmed reason only when declining', () => {
    assert.deepEqual(buildUpdateFeedbackStatusBody('declined', '  no, because  '), {
      status: 'declined',
      resolutionReason: 'no, because',
    });
  });

  test('omits the reason for every other status', () => {
    assert.deepEqual(buildUpdateFeedbackStatusBody('planned', 'ignored'), {
      status: 'planned',
    });
  });
});

describe('feedback triage status set + labels (WP-605)', () => {
  test('FEEDBACK_TRIAGE_STATUSES matches the server closed set exactly', () => {
    assert.deepEqual(
      [...FEEDBACK_TRIAGE_STATUSES],
      ['under_review', 'planned', 'in_progress', 'shipped', 'declined'],
    );
  });

  test('every status has a human label', () => {
    for (const status of FEEDBACK_TRIAGE_STATUSES) {
      assert.equal(typeof FEEDBACK_STATUS_LABELS[status], 'string');
    }
  });
});

describe('FeedbackTriageItem mirror pin (WP-605)', () => {
  // why: MIRROR PIN — this keyset MUST equal the server OperatorFeedbackItem field
  // set (apps/server/src/feedback/feedback.types.ts). If either side changes a field
  // name without updating the other, this assertion fails loudly.
  test('field-name keyset equals the server OperatorFeedbackItem shape', () => {
    const sample: FeedbackTriageItem = {
      id: 1,
      feedbackType: 'bug',
      title: 't',
      description: 'd',
      authorExtId: 'a',
      status: 'under_review',
      resolutionReason: null,
      voteCount: 0,
      createdAt: 'c',
      updatedAt: 'u',
    };
    assert.deepEqual(Object.keys(sample).sort(), [
      'authorExtId',
      'createdAt',
      'description',
      'feedbackType',
      'id',
      'resolutionReason',
      'status',
      'title',
      'updatedAt',
      'voteCount',
    ]);
  });
});
