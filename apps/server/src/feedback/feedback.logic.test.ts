/**
 * Tests for the feedback pure logic (WP-604 / EC-639).
 *
 * Pure: no database, no HTTP, no boardgame.io. Covers the submit-input validator
 * (accept + each reject branch), the FEEDBACK_TYPES / FEEDBACK_STATUSES drift
 * assertions (array ⇔ union, forward + backward + length), and the projection
 * shaper (renames feedbackType → type and strips author PII).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  toOperatorFeedbackItem,
  toPublicFeedbackItem,
  validateSubmitFeedbackInput,
  validateUpdateFeedbackStatusInput,
} from './feedback.logic.js';
import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  type FeedbackItemRecord,
  type FeedbackStatus,
  type FeedbackType,
} from './feedback.types.js';

const VALID_BODY = {
  type: 'enhancement',
  title: 'Add a dark mode',
  description: 'A dark theme would be easier on the eyes at night.',
};

describe('validateSubmitFeedbackInput (WP-604)', () => {
  test('accepts a well-formed body and trims title + description', () => {
    const result = validateSubmitFeedbackInput({
      type: 'bug',
      title: '  crash on reconnect  ',
      description: '  the client freezes  ',
    });
    assert.ok(result.ok === true);
    assert.deepEqual(result.value, {
      type: 'bug',
      title: 'crash on reconnect',
      description: 'the client freezes',
    });
  });

  test('accepts every FeedbackType', () => {
    for (const feedbackType of FEEDBACK_TYPES) {
      const result = validateSubmitFeedbackInput({ ...VALID_BODY, type: feedbackType });
      assert.ok(result.ok === true, feedbackType);
      assert.equal(result.value.type, feedbackType);
    }
  });

  test('rejects a non-object body with invalid_request', () => {
    for (const body of [null, undefined, 'string', 42, []]) {
      const result = validateSubmitFeedbackInput(body);
      assert.ok(result.ok === false);
      assert.equal(result.code, 'invalid_request');
    }
  });

  test('rejects an unknown type with invalid_type', () => {
    const result = validateSubmitFeedbackInput({ ...VALID_BODY, type: 'praise' });
    assert.ok(result.ok === false);
    assert.equal(result.code, 'invalid_type');
  });

  test('rejects a missing / blank / non-string / over-long title with invalid_title', () => {
    for (const title of [undefined, '', '   ', 42, 'x'.repeat(201)]) {
      const result = validateSubmitFeedbackInput({ ...VALID_BODY, title });
      assert.ok(result.ok === false, String(title));
      assert.equal(result.code, 'invalid_title');
    }
  });

  test('rejects a missing / blank / non-string / over-long description with invalid_description', () => {
    for (const description of [undefined, '', '   ', 42, 'x'.repeat(5001)]) {
      const result = validateSubmitFeedbackInput({ ...VALID_BODY, description });
      assert.ok(result.ok === false, String(description));
      assert.equal(result.code, 'invalid_description');
    }
  });

  test('accepts a title / description at the exact length bound', () => {
    const result = validateSubmitFeedbackInput({
      type: 'review',
      title: 'x'.repeat(200),
      description: 'y'.repeat(5000),
    });
    assert.ok(result.ok === true);
  });
});

describe('FEEDBACK_TYPES / FEEDBACK_STATUSES drift (WP-604)', () => {
  // why: an exhaustive switch fails at type-check time if a union member is added
  // without a case; the array-membership + length checks fail at runtime if the
  // array and union diverge. Both directions must hold (code-style §Drift Detection).
  function assertTypeExhaustive(value: FeedbackType): void {
    switch (value) {
      case 'bug':
      case 'enhancement':
      case 'review':
        return;
      default: {
        const unhandled: never = value;
        throw new Error(`Drift: unhandled FeedbackType ${String(unhandled)}`);
      }
    }
  }

  function assertStatusExhaustive(value: FeedbackStatus): void {
    switch (value) {
      case 'under_review':
      case 'planned':
      case 'in_progress':
      case 'shipped':
      case 'declined':
        return;
      default: {
        const unhandled: never = value;
        throw new Error(`Drift: unhandled FeedbackStatus ${String(unhandled)}`);
      }
    }
  }

  test('FEEDBACK_TYPES matches the FeedbackType union exactly', () => {
    FEEDBACK_TYPES.forEach(assertTypeExhaustive);
    assert.deepEqual([...FEEDBACK_TYPES], ['bug', 'enhancement', 'review']);
    assert.equal(FEEDBACK_TYPES.length, 3);
  });

  test('FEEDBACK_STATUSES matches the FeedbackStatus union exactly', () => {
    FEEDBACK_STATUSES.forEach(assertStatusExhaustive);
    assert.deepEqual(
      [...FEEDBACK_STATUSES],
      ['under_review', 'planned', 'in_progress', 'shipped', 'declined'],
    );
    assert.equal(FEEDBACK_STATUSES.length, 5);
  });
});

describe('toPublicFeedbackItem (WP-604)', () => {
  const RECORD: FeedbackItemRecord = {
    id: 7,
    feedbackType: 'enhancement',
    title: 'Add a dark mode',
    description: 'A dark theme would help.',
    authorExtId: '4f2219e4-secret-account',
    status: 'planned',
    resolutionReason: null,
    createdAt: '2026-08-25T00:00:00.000Z',
    updatedAt: '2026-08-25T01:00:00.000Z',
  };

  test('projects the public fields and renames feedbackType → type', () => {
    const item = toPublicFeedbackItem(RECORD, 12, true);
    assert.deepEqual(item, {
      id: 7,
      type: 'enhancement',
      title: 'Add a dark mode',
      description: 'A dark theme would help.',
      status: 'planned',
      voteCount: 12,
      viewerHasVoted: true,
      createdAt: '2026-08-25T00:00:00.000Z',
    });
  });

  test('never carries author PII, updatedAt, or resolutionReason across the boundary', () => {
    const item = toPublicFeedbackItem(RECORD, 0, false) as Record<string, unknown>;
    assert.equal('authorExtId' in item, false);
    assert.equal('updatedAt' in item, false);
    assert.equal('resolutionReason' in item, false);
  });
});

describe('validateUpdateFeedbackStatusInput (WP-605)', () => {
  test('accepts a non-Declined status and normalizes resolutionReason to null', () => {
    for (const status of FEEDBACK_STATUSES) {
      if (status === 'declined') {
        continue;
      }
      // why: a reason is ignored (forced to null) for every non-Declined status,
      // even when the body supplies one.
      const result = validateUpdateFeedbackStatusInput({
        status,
        resolutionReason: 'this should be dropped',
      });
      assert.ok(result.ok === true, status);
      assert.deepEqual(result.value, { status, resolutionReason: null });
    }
  });

  test('accepts Declined with a trimmed non-empty reason', () => {
    const result = validateUpdateFeedbackStatusInput({
      status: 'declined',
      resolutionReason: '  out of scope for the current vision  ',
    });
    assert.ok(result.ok === true);
    assert.deepEqual(result.value, {
      status: 'declined',
      resolutionReason: 'out of scope for the current vision',
    });
  });

  test('rejects a non-object body with invalid_request', () => {
    for (const body of [null, undefined, 'declined', 42, []]) {
      const result = validateUpdateFeedbackStatusInput(body);
      assert.ok(result.ok === false, String(body));
      assert.equal(result.code, 'invalid_request');
    }
  });

  test('rejects a missing / out-of-set status with invalid_status', () => {
    for (const status of [undefined, 'archived', 'DECLINED', 42]) {
      const result = validateUpdateFeedbackStatusInput({ status, resolutionReason: 'x' });
      assert.ok(result.ok === false, String(status));
      assert.equal(result.code, 'invalid_status');
    }
  });

  test('rejects Declined with a missing / blank / non-string / over-long reason', () => {
    for (const resolutionReason of [undefined, '', '   ', 42, 'x'.repeat(2001)]) {
      const result = validateUpdateFeedbackStatusInput({
        status: 'declined',
        resolutionReason,
      });
      assert.ok(result.ok === false, String(resolutionReason));
      assert.equal(result.code, 'resolution_reason_required');
    }
  });
});

describe('toOperatorFeedbackItem (WP-605)', () => {
  const OPERATOR_RECORD: FeedbackItemRecord = {
    id: 9,
    feedbackType: 'bug',
    title: 'Crash on reconnect',
    description: 'The client froze mid-match.',
    authorExtId: '4f2219e4-secret-account',
    status: 'under_review',
    resolutionReason: null,
    createdAt: '2026-08-25T00:00:00.000Z',
    updatedAt: '2026-08-25T02:00:00.000Z',
  };

  test('projects the full operator record + voteCount (retains authorExtId, unlike the public shaper)', () => {
    const item = toOperatorFeedbackItem(OPERATOR_RECORD, 4);
    assert.deepEqual(item, {
      id: 9,
      feedbackType: 'bug',
      title: 'Crash on reconnect',
      description: 'The client froze mid-match.',
      authorExtId: '4f2219e4-secret-account',
      status: 'under_review',
      resolutionReason: null,
      voteCount: 4,
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T02:00:00.000Z',
    });
  });
});
