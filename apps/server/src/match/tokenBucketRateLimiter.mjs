/**
 * Token-Bucket Rate Limiter — the shared in-process limiter and request-key
 * resolver (WP-787 / EC-824 / D-24635).
 *
 * Two exports:
 *
 *   1. `createTokenBucketRateLimiter({ capacity, windowMs, now })` — a per-key
 *      token bucket with a whole-window reset, the same semantics as the
 *      join-as-guest limiter (`makeGuestJoinRateLimiter`, D-24441) and the
 *      analytics limiter (D-20503).
 *   2. `resolveRateLimitKey(koaContext)` — picks the request key a limiter should
 *      count against, and names where it came from so a caller can log the source
 *      without ever logging the address itself.
 *
 * // why: this is the third token-bucket copy in apps/server (analytics,
 * join-as-guest, guest-solo), and the code-style rule is to abstract at the third
 * copy. The two older copies key on `request.ip` alone, so moving them here
 * changes how they key requests — that migration is a recorded follow-up
 * (D-24635 §4), not part of WP-787.
 *
 * Process-local: a restart resets every bucket, and a multi-instance deploy
 * shares no state (the D-20503 / D-24094 posture).
 *
 * Authority: WP-787; EC-824; D-24635; D-24441 and D-20503 (the pattern copied).
 */

/**
 * Creates a per-key token-bucket rate limiter. Each key starts with `capacity`
 * tokens; a key whose window has expired is refilled to full capacity on its
 * next request.
 *
 * @param {object} options - Limiter settings.
 * @param {number} options.capacity - Tokens per window per key.
 * @param {number} options.windowMs - Window length in milliseconds.
 * @param {() => number} options.now - Injected clock (for tests).
 * @returns {{ consume: (key: string, count: number) => boolean }} The limiter;
 *   `consume` returns true and spends `count` tokens, or false and spends nothing.
 */
export function createTokenBucketRateLimiter({ capacity, windowMs, now }) {
  const buckets = new Map();
  return {
    consume(key, count) {
      const currentTime = now();
      const existing = buckets.get(key);
      let state;
      if (existing === undefined) {
        state = { tokens: capacity, lastRefill: currentTime };
        buckets.set(key, state);
      } else {
        state = existing;
        const elapsed = currentTime - state.lastRefill;
        if (elapsed >= windowMs) {
          // why: whole-window reset once the window has passed, not a linear
          // sub-window refill — the analytics / join-as-guest limiters' deliberate
          // simplicity, and harder to game with timed bursts.
          state.tokens = capacity;
          state.lastRefill = currentTime;
        }
      }
      if (state.tokens < count) {
        return false;
      }
      state.tokens = state.tokens - count;
      return true;
    },
  };
}

/**
 * Resolves the key a rate limiter should count a request against, and the name
 * of the source it came from.
 *
 * @param {object} koaContext - The Koa request context.
 * @returns {{ key: string, source: 'cf-connecting-ip' | 'request.ip' | 'unknown' }}
 *   The key, and where it came from (safe to log; the key itself is not).
 */
export function resolveRateLimitKey(koaContext) {
  // why: the key order. Koa `app.proxy` is off, so `request.ip` is the address of
  // the last proxy hop (Cloudflare → Render), shared by every caller, not the
  // client. Cloudflare sets `cf-connecting-ip` to the real client address, but
  // whether it reaches Node, and whether a caller can forge it, is unverified
  // until the WP-787 live check (the direct onrender.com origin also answers
  // `Server: cloudflare`). So prefer the header, fall back to `request.ip`, and
  // rely on the caller's process-wide cap as the hard bound either way.
  const headers = koaContext.req?.headers ?? {};
  const connectingIp = headers['cf-connecting-ip'];
  if (typeof connectingIp === 'string' && connectingIp !== '') {
    return { key: connectingIp, source: 'cf-connecting-ip' };
  }
  const requestIp = koaContext.request?.ip;
  if (typeof requestIp === 'string' && requestIp !== '') {
    return { key: requestIp, source: 'request.ip' };
  }
  return { key: 'unknown', source: 'unknown' };
}
