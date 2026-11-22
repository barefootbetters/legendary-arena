/**
 * Feedback API Client tests (WP-813 / EC-850).
 *
 * Exercises `validateFeedbackDraft` at its length boundaries and
 * `submitFeedback` against a stubbed `globalThis.fetch`: the POST contract
 * (URL + the three headers + the exact body keys), the 201 success, the typed
 * 400 code read from `body.error`, the 401 and 500 status paths, and the
 * network-throw path. Plus runtime mirror pins that assert the client-local
 * error-code subset, `FEEDBACK_TYPES`, and the two length constants against a
 * hand-written copy of the WP-604 server contract (they do not read the server
 * code). Pure `node:test` + `node:assert`; no network, no database, no
 * boardgame.io.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateFeedbackDraft,
  submitFeedback,
  FEEDBACK_API_ERROR_CODES,
  FEEDBACK_TYPES,
  FEEDBACK_TITLE_MAX_LENGTH,
  FEEDBACK_DESCRIPTION_MAX_LENGTH,
  type FeedbackDraftValue,
} from './feedbackApi';

interface CapturedRequest {
  readonly url: string;
  readonly init: RequestInit;
}

/**
 * Install a `globalThis.fetch` stub that records every call and resolves to a
 * minimal Response-like object with the given status and JSON body.
 */
function installFetchStub(
  status: number,
  jsonBody: unknown,
): { calls: CapturedRequest[]; restore: () => void } {
  const originalFetch = globalThis.fetch;
  const calls: CapturedRequest[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return { status, json: async () => jsonBody } as Response;
  }) as typeof globalThis.fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

/**
 * Install a `globalThis.fetch` stub that throws, simulating a network failure.
 */
function installThrowingFetchStub(): { restore: () => void } {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('Simulated network failure for the feedback API test.');
  }) as typeof globalThis.fetch;
  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

const sampleValue: FeedbackDraftValue = {
  type: 'enhancement',
  title: 'A better tutorial',
  description: 'Please add an interactive first-match tutorial.',
};

test('validateFeedbackDraft trims the title and description', () => {
  const result = validateFeedbackDraft({
    type: 'bug',
    title: '  spacey title  ',
    description: '  spacey body  ',
  });
  assert.ok(result.ok === true);
  assert.equal(result.value.title, 'spacey title');
  assert.equal(result.value.description, 'spacey body');
  assert.equal(result.value.type, 'bug');
});

test('validateFeedbackDraft rejects an empty or whitespace-only title', () => {
  const empty = validateFeedbackDraft({ type: 'bug', title: '', description: 'ok' });
  assert.ok(empty.ok === false);
  assert.equal(empty.field, 'title');

  const whitespace = validateFeedbackDraft({ type: 'bug', title: '   ', description: 'ok' });
  assert.ok(whitespace.ok === false);
  assert.equal(whitespace.field, 'title');
});

test('validateFeedbackDraft rejects an empty or whitespace-only description', () => {
  const empty = validateFeedbackDraft({ type: 'bug', title: 'ok', description: '' });
  assert.ok(empty.ok === false);
  assert.equal(empty.field, 'description');

  const whitespace = validateFeedbackDraft({ type: 'bug', title: 'ok', description: '   ' });
  assert.ok(whitespace.ok === false);
  assert.equal(whitespace.field, 'description');
});

test('validateFeedbackDraft accepts a title of exactly 200 and rejects 201', () => {
  const at = validateFeedbackDraft({
    type: 'review',
    title: 'x'.repeat(200),
    description: 'ok',
  });
  assert.ok(at.ok === true);

  const over = validateFeedbackDraft({
    type: 'review',
    title: 'x'.repeat(201),
    description: 'ok',
  });
  assert.ok(over.ok === false);
  assert.equal(over.field, 'title');
});

test('validateFeedbackDraft accepts a description of exactly 5000 and rejects 5001', () => {
  const at = validateFeedbackDraft({
    type: 'review',
    title: 'ok',
    description: 'y'.repeat(5000),
  });
  assert.ok(at.ok === true);

  const over = validateFeedbackDraft({
    type: 'review',
    title: 'ok',
    description: 'y'.repeat(5001),
  });
  assert.ok(over.ok === false);
  assert.equal(over.field, 'description');
});

test('submitFeedback POSTs to /api/feedback with the three headers and exact body keys', async () => {
  const stub = installFetchStub(201, { id: 7 });
  try {
    await submitFeedback('token-abc', sampleValue);
    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/feedback'));
    assert.equal(call.init.method, 'POST');
    const headers = (call.init.headers ?? {}) as Record<string, string>;
    assert.equal(headers['Content-Type'], 'application/json');
    assert.equal(headers.Accept, 'application/json');
    assert.equal(headers.Authorization, 'Bearer token-abc');
    assert.deepEqual(JSON.parse(String(call.init.body)), {
      type: 'enhancement',
      title: 'A better tutorial',
      description: 'Please add an interactive first-match tutorial.',
    });
  } finally {
    stub.restore();
  }
});

test('submitFeedback returns { ok: true, value: { id } } on 201', async () => {
  const stub = installFetchStub(201, { id: 42 });
  try {
    const result = await submitFeedback('t', sampleValue);
    assert.ok(result.ok === true);
    assert.equal(result.value.id, 42);
  } finally {
    stub.restore();
  }
});

test('submitFeedback maps a 400 invalid_title to the typed code', async () => {
  const stub = installFetchStub(400, { error: 'invalid_title' });
  try {
    const result = await submitFeedback('t', sampleValue);
    assert.ok(result.ok === false);
    assert.equal(result.status, 400);
    assert.equal(result.code, 'invalid_title');
  } finally {
    stub.restore();
  }
});

test('submitFeedback returns status 401 on an unauthorized response', async () => {
  const stub = installFetchStub(401, { error: 'missing_token' });
  try {
    const result = await submitFeedback('t', sampleValue);
    assert.ok(result.ok === false);
    assert.equal(result.status, 401);
    // why: a 401 carries a session-validation code outside the submit set, so
    // it narrows to null; the section maps 401 to copy by status, not by code.
    assert.equal(result.code, null);
  } finally {
    stub.restore();
  }
});

test('submitFeedback returns { status: 500, code: null } on a 500 lookup_failed', async () => {
  const stub = installFetchStub(500, { error: 'lookup_failed' });
  try {
    const result = await submitFeedback('t', sampleValue);
    assert.ok(result.ok === false);
    assert.equal(result.status, 500);
    // why: lookup_failed is not in the submit-path subset, so it narrows to
    // null; the section shows the generic banner for any 500.
    assert.equal(result.code, null);
  } finally {
    stub.restore();
  }
});

test('submitFeedback returns { status: 0, code: null } on a rejected fetch', async () => {
  const stub = installThrowingFetchStub();
  try {
    const result = await submitFeedback('t', sampleValue);
    assert.deepEqual(result, { ok: false, status: 0, code: null });
  } finally {
    stub.restore();
  }
});

test('FEEDBACK_API_ERROR_CODES set-equals the hand-written submit-path subset (mirror pin)', () => {
  // why: a hand-written copy of the WP-604 submit route's error-code subset. A
  // failure here means FEEDBACK_API_ERROR_CODES was edited without updating this
  // list. The test cannot see the server union, so a server-side change passes
  // silently until both lists are updated by hand.
  const expectedSubmitCodes = [
    'invalid_request',
    'invalid_type',
    'invalid_title',
    'invalid_description',
    'internal_error',
  ];
  assert.equal(FEEDBACK_API_ERROR_CODES.length, expectedSubmitCodes.length);
  assert.equal(new Set(FEEDBACK_API_ERROR_CODES).size, expectedSubmitCodes.length);
  assert.deepEqual(
    [...FEEDBACK_API_ERROR_CODES].sort(),
    [...expectedSubmitCodes].sort(),
  );
});

test('FEEDBACK_TYPES equals the hand-written kind list in order (mirror pin)', () => {
  assert.deepEqual([...FEEDBACK_TYPES], ['bug', 'enhancement', 'review']);
});

test('the two length constants equal the server bounds (mirror pin)', () => {
  assert.equal(FEEDBACK_TITLE_MAX_LENGTH, 200);
  assert.equal(FEEDBACK_DESCRIPTION_MAX_LENGTH, 5000);
});
