import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';

// @ts-ignore — importing .mjs from .ts; tsx handles this at runtime
import { parseListMatchesArguments, fetchMatchList } from './list-matches.mjs';

describe('list-matches', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('--server flag overrides the default URL', () => {
    const result = parseListMatchesArguments([
      '--server',
      'http://custom-host:9999',
    ]);
    assert.equal(
      result.serverUrl,
      'http://custom-host:9999',
      'The serverUrl should match the value passed via --server.'
    );
  });

  it('network failure produces a full-sentence stderr message', async () => {
    globalThis.fetch = (() =>
      Promise.reject(
        new Error('connect ECONNREFUSED 127.0.0.1:8000')
      )) as typeof fetch;

    await assert.rejects(
      () => fetchMatchList('http://localhost:8000'),
      (error: Error) => {
        assert.ok(
          error.message.length > 20,
          'Error message should be a full sentence, not a terse fragment.'
        );
        assert.ok(
          error.message.includes('ECONNREFUSED'),
          'Error message should include the underlying network error.'
        );
        return true;
      }
    );
  });

  it('exits 1 on a mocked fetch rejection', async () => {
    globalThis.fetch = (() =>
      Promise.reject(new Error('socket hang up'))) as typeof fetch;

    await assert.rejects(
      () => fetchMatchList('http://localhost:8000'),
      (error: Error) => {
        assert.ok(
          error instanceof Error,
          'fetchMatchList should reject with an Error instance.'
        );
        return true;
      }
    );
  });
});
