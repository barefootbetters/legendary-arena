import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { describeApiError } from './apiErrorMessage.js';

describe('describeApiError', () => {
  it('maps a 403 to an actionable admin-session message, not the raw status', () => {
    const message = describeApiError({
      message: 'Request failed with status 403.',
      code: '403',
    });
    assert.match(message, /Admin session required/);
    assert.doesNotMatch(message, /403/);
  });

  it('maps a 401 to the same admin-session message', () => {
    const message = describeApiError({
      message: 'Request failed with status 401.',
      code: '401',
    });
    assert.match(message, /Admin session required/);
  });

  it('adds a retry hint for retryable errors and keeps the original message', () => {
    const message = describeApiError({
      message: 'Request failed with status 503.',
      code: '503',
      retryable: true,
    });
    assert.match(message, /503/);
    assert.match(message, /Please retry/);
  });

  it('returns the raw message for non-retryable, non-auth errors', () => {
    const message = describeApiError({ message: 'Not found.', code: '404' });
    assert.equal(message, 'Not found.');
  });

  it('handles a null error', () => {
    assert.equal(describeApiError(null), 'Data could not be loaded.');
  });
});
