/**
 * Tests for the WP-787 shared token-bucket limiter and request-key resolver.
 *
 * Pure unit tests: an injected clock and plain fake Koa contexts. No network,
 * no live server.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  createTokenBucketRateLimiter,
  normalizeRateLimitAddress,
  resolveRateLimitKey,
} from './tokenBucketRateLimiter.mjs';

/** A fake Koa context carrying only a cf-connecting-ip header. */
function contextWithConnectingIp(address: string): object {
  return { req: { headers: { 'cf-connecting-ip': address } }, request: { ip: '10.0.0.1' } };
}

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

  test('two IPv6 addresses in one /64 share a key; compressed and expanded forms agree (D-24642)', () => {
    const compressed = resolveRateLimitKey(contextWithConnectingIp('2607:fb90:8704:ead::1'));
    const rotated = resolveRateLimitKey(contextWithConnectingIp('2607:fb90:8704:ead:a1b2:c3d4:e5f6:789'));
    const expanded = resolveRateLimitKey(contextWithConnectingIp('2607:FB90:8704:0EAD:0000:0000:0000:0001'));
    assert.deepEqual(compressed, { key: '2607:fb90:8704:ead::/64', source: 'cf-connecting-ip' });
    assert.equal(rotated.key, compressed.key);
    assert.equal(expanded.key, compressed.key);
  });

  test('IPv6 addresses in different /64s get different keys (D-24642)', () => {
    const first = normalizeRateLimitAddress('2607:fb90:8704:ead::1');
    const neighbour = normalizeRateLimitAddress('2607:fb90:8704:eae::1');
    const prefixOnly = normalizeRateLimitAddress('2001:db8::1');
    assert.notEqual(first, neighbour);
    assert.equal(neighbour, '2607:fb90:8704:eae::/64');
    assert.equal(prefixOnly, '2001:db8:0:0::/64');
  });

  test('a /64 key shares one bucket across rotated addresses (D-24642)', () => {
    const clock = makeClock(1_000);
    const limiter = createTokenBucketRateLimiter({ capacity: 1, windowMs: 60_000, now: clock.now });
    const first = resolveRateLimitKey(contextWithConnectingIp('2607:fb90:8704:ead::1'));
    const rotated = resolveRateLimitKey(contextWithConnectingIp('2607:fb90:8704:ead::2'));
    assert.equal(limiter.consume(first.key, 1), true);
    assert.equal(limiter.consume(rotated.key, 1), false, 'rotating inside the /64 does not mint a fresh bucket');
  });

  test('IPv4 keys are unchanged (D-24642)', () => {
    assert.deepEqual(resolveRateLimitKey(contextWithConnectingIp('198.51.100.4')), {
      key: '198.51.100.4',
      source: 'cf-connecting-ip',
    });
    assert.equal(normalizeRateLimitAddress('203.0.113.7'), '203.0.113.7');
    assert.equal(normalizeRateLimitAddress('unknown'), 'unknown');
  });

  test('an IPv4-mapped IPv6 address is keyed as its IPv4 address (D-24642)', () => {
    assert.equal(normalizeRateLimitAddress('::ffff:198.51.100.4'), '198.51.100.4');
    assert.equal(normalizeRateLimitAddress('::FFFF:c633:6404'), '198.51.100.4');
    assert.equal(normalizeRateLimitAddress('0:0:0:0:0:ffff:198.51.100.4'), '198.51.100.4');
    const fromSocket = resolveRateLimitKey({ req: { headers: {} }, request: { ip: '::ffff:10.0.0.1' } });
    assert.deepEqual(fromSocket, { key: '10.0.0.1', source: 'request.ip' });
  });

  test('malformed IPv6-looking input is left as-is (D-24642)', () => {
    const malformed = [
      '2607:fb90::8704::1',
      '2607:fb90:8704:ead:1:2:3:4:5',
      '2607:fb90:8704',
      '2607:zzzz::1',
      '12345::1',
      ':::1',
      '::ffff:198.51.100.400',
      '1:2:3:4:5:6:7::8',
    ];
    for (const address of malformed) {
      assert.equal(normalizeRateLimitAddress(address), address, `${address} is kept as its own key`);
    }
  });
});
