/**
 * Token-Bucket Rate Limiter — the shared in-process limiter and request-key
 * resolver (WP-787 / EC-824 / D-24635).
 *
 * Three exports:
 *
 *   1. `createTokenBucketRateLimiter({ capacity, windowMs, now })` — a per-key
 *      token bucket with a whole-window reset, the same semantics as the
 *      join-as-guest limiter (`makeGuestJoinRateLimiter`, D-24441) and the
 *      analytics limiter (D-20503).
 *   2. `resolveRateLimitKey(koaContext)` — picks the request key a limiter should
 *      count against, and names where it came from so a caller can log the source
 *      without ever logging the address itself.
 *   3. `normalizeRateLimitAddress(address)` — groups an IPv6 address to its /64
 *      prefix (D-24642), so a caller cannot mint fresh buckets by rotating
 *      addresses inside its own /64.
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
 * Authority: WP-787; EC-824; D-24635 (§3 amended by D-24642); D-24441 and
 * D-20503 (the pattern copied).
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
 *   The key (an IPv6 address grouped to its /64 by `normalizeRateLimitAddress`),
 *   and where it came from (safe to log; the key itself is not).
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
    return { key: normalizeRateLimitAddress(connectingIp), source: 'cf-connecting-ip' };
  }
  const requestIp = koaContext.request?.ip;
  if (typeof requestIp === 'string' && requestIp !== '') {
    return { key: normalizeRateLimitAddress(requestIp), source: 'request.ip' };
  }
  return { key: 'unknown', source: 'unknown' };
}

/**
 * Normalizes a client address into the rate-limit key it counts against. An
 * IPv6 address becomes its /64 prefix (`2607:fb90:8704:ead::/64`); an
 * IPv4-mapped IPv6 address (`::ffff:198.51.100.4`) becomes the plain IPv4
 * address; anything else — IPv4, or input that does not parse — is returned
 * unchanged.
 *
 * // why: /64 is the smallest IPv6 block a single subscriber is normally
 * assigned, and a host picks addresses inside it at will (privacy addresses), so
 * keying the full address hands a caller a fresh bucket per rotation (D-24642).
 * Hosts sharing one /64 now share a bucket, the same as hosts behind one IPv4
 * NAT address today.
 *
 * @param {string} address - The client address from the header or socket.
 * @returns {string} The rate-limit key for that address.
 */
export function normalizeRateLimitAddress(address) {
  if (!address.includes(':')) {
    return address;
  }
  const groups = expandIpv6Groups(address);
  if (groups === null) {
    // why: a value that does not parse keeps its own bucket rather than being
    // dropped or merged with another key; the caller's process-wide cap still
    // bounds it.
    return address;
  }
  const isIpv4Mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (isIpv4Mapped) {
    return formatIpv4FromGroups(groups[6], groups[7]);
  }
  const prefixGroups = groups.slice(0, 4).map((group) => group.toString(16));
  return `${prefixGroups.join(':')}::/64`;
}

/**
 * Expands an IPv6 address (full or `::`-compressed, optionally ending in an
 * embedded dotted IPv4) into its eight 16-bit groups.
 *
 * @param {string} address - The candidate IPv6 address.
 * @returns {number[] | null} Eight group values, or null when it does not parse.
 */
function expandIpv6Groups(address) {
  const halves = address.split('::');
  if (halves.length > 2) {
    return null;
  }
  if (halves.length === 1) {
    const groups = parseGroupList(halves[0], true);
    if (groups === null || groups.length !== 8) {
      return null;
    }
    return groups;
  }
  const head = parseGroupList(halves[0], false);
  const tail = parseGroupList(halves[1], true);
  if (head === null || tail === null) {
    return null;
  }
  const missingCount = 8 - head.length - tail.length;
  if (missingCount < 1) {
    return null;
  }
  const zeros = new Array(missingCount).fill(0);
  return [...head, ...zeros, ...tail];
}

/**
 * Parses a colon-separated run of IPv6 hex groups. When `canEndWithIpv4` is
 * true, the last part may be a dotted IPv4 address, which counts as two groups.
 *
 * @param {string} text - One side of a `::`, or a whole uncompressed address.
 * @param {boolean} canEndWithIpv4 - Whether this run ends the address.
 * @returns {number[] | null} The group values, or null when a part is invalid.
 */
function parseGroupList(text, canEndWithIpv4) {
  if (text === '') {
    return [];
  }
  const parts = text.split(':');
  const groups = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLastPart = i === parts.length - 1;
    if (isLastPart && canEndWithIpv4 && part.includes('.')) {
      const octets = parseIpv4Octets(part);
      if (octets === null) {
        return null;
      }
      groups.push(octets[0] * 256 + octets[1], octets[2] * 256 + octets[3]);
    } else if (/^[0-9a-f]{1,4}$/i.test(part)) {
      groups.push(Number.parseInt(part, 16));
    } else {
      return null;
    }
  }
  return groups;
}

/**
 * Parses a dotted-quad IPv4 address into its four octets.
 *
 * @param {string} text - The candidate IPv4 address.
 * @returns {number[] | null} Four octets (0–255), or null when it does not parse.
 */
function parseIpv4Octets(text) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (match === null) {
    return null;
  }
  const octets = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
  for (const octet of octets) {
    if (octet > 255) {
      return null;
    }
  }
  return octets;
}

/**
 * Formats the last two groups of an IPv4-mapped IPv6 address as dotted IPv4.
 *
 * @param {number} highGroup - Group 7 (the first two octets).
 * @param {number} lowGroup - Group 8 (the last two octets).
 * @returns {string} The dotted-quad IPv4 address.
 */
function formatIpv4FromGroups(highGroup, lowGroup) {
  const octets = [Math.floor(highGroup / 256), highGroup % 256, Math.floor(lowGroup / 256), lowGroup % 256];
  return octets.join('.');
}
