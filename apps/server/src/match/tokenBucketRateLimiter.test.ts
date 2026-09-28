/**
 * Tests for the WP-787 shared token-bucket limiter and request-key resolver.
 *
 * Pure unit tests: an injected clock and plain fake Koa contexts. No network,
 * no live server.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createTokenBucketRateLimiter, resolveRateLimitKey } from './tokenBucketRateLimiter.mjs';

/** A controllable clock for the limiter. */
function makeClock(start: number): { now: () => number; advance: (milliseconds: number) => void } {
  let currentTime = start;
  return {
    now: () => currentTime,
    advance: (milliseconds: number) => {
      currentTime += milliseconds;
    },
  };
}

describe('tokenBucketRateLimiter (WP-787)', () => {
  test('consumes up to capacity, then refuses', () => {
    const clock = makeClock(1_000);
    const limiter = createTokenBucketRateLimiter({ capacity: 3, windowMs: 60_000, now: clock.now });
    assert.equal(limiter.consume('203.0.113.7', 1), true);
    assert.equal(limiter.consume('203.0.113.7', 1), true);
    assert.equal(limiter.consume('203.0.113.7', 1), true);
    assert.equal(limiter.consume('203.0.113.7', 1), false);
  });

  test('refills to full capacity once the whole window has passed', () => {
    const clock = makeClock(1_000);
    const limiter = createTokenBucketRateLimiter({ capacity: 2, windowMs: 60_000, now: clock.now });
    assert.equal(limiter.consume('203.0.113.7', 2), true);
    clock.advance(59_999);
    assert.equal(limiter.consume('203.0.113.7', 1), false, 'no refill before the window ends');
    clock.advance(1);
    assert.equal(limiter.consume('203.0.113.7', 2), true, 'full refill at the window boundary');
  });

  test('keeps an independent bucket per key', () => {
    const clock = makeClock(1_000);
    const limiter = createTokenBucketRateLimiter({ capacity: 1, windowMs: 60_000, now: clock.now });
    assert.equal(limiter.consume('203.0.113.7', 1), true);
    assert.equal(limiter.consume('203.0.113.7', 1), false);
    assert.equal(limiter.consume('198.51.100.4', 1), true);
  });

  test('resolveRateLimitKey prefers a non-empty cf-connecting-ip header', () => {
    const resolved = resolveRateLimitKey({
      req: { headers: { 'cf-connecting-ip': '198.51.100.4' } },
      request: { ip: '10.0.0.1' },
    });
    assert.deepEqual(resolved, { key: '198.51.100.4', source: 'cf-connecting-ip' });
  });

  test('resolveRateLimitKey falls back to request.ip, then to unknown', () => {
    const fromRequestIp = resolveRateLimitKey({
      req: { headers: { 'cf-connecting-ip': '' } },
      request: { ip: '10.0.0.1' },
    });
    assert.deepEqual(fromRequestIp, { key: '10.0.0.1', source: 'request.ip' });

    const fromNothing = resolveRateLimitKey({ req: { headers: {} }, request: { ip: '' } });
    assert.deepEqual(fromNothing, { key: 'unknown', source: 'unknown' });
  });
});
