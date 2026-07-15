/**
 * Channel Classifier — Arena Client (WP-378 / EC-407).
 *
 * A pure function mapping a landing's `document.referrer` + URL query params to
 * one of the four traffic-source channels the analytics Traffic Sources widget
 * groups by: `direct` / `search` / `referral` / `paid`. Deterministic, side-effect
 * free, and independently testable — no `fetch`, no storage, no `document`/`window`
 * read (the same-origin host is passed in, not read here).
 *
 * Rule table locked in D-24175. Layer-boundary contract: imports nothing from the
 * engine, registry, server, pre-planning, or framework.
 *
 * Authority: WP-378 §Scope (In) §B; EC-407 §Locked Values (channel rule); D-24175.
 */

/** The four traffic-source channels (a subset of the nine event types). */
export type TrafficChannel = 'direct' | 'search' | 'referral' | 'paid';

/**
 * Host fragments identifying a known search engine. Matched as substrings of the
 * referrer host (so `www.google.com`, `google.co.uk`, `news.google.com` all match
 * `google.`). The trailing dot avoids matching an unrelated host that merely
 * contains the name (e.g. `googleblog.example` does not match `google.`).
 */
const SEARCH_ENGINE_HOST_FRAGMENTS: readonly string[] = [
  'google.',
  'bing.',
  'duckduckgo.',
  'yahoo.',
  'baidu.',
  'yandex.',
  'ecosia.',
  'startpage.',
  'brave.',
];

/** utm_medium values that denote paid acquisition. */
const PAID_UTM_MEDIUMS: readonly string[] = ['cpc', 'ppc', 'paid'];

/**
 * Classifies a landing into its acquisition channel (D-24175).
 *
 * Precedence (paid wins over everything so a paid click whose referrer was
 * stripped is still `paid`):
 *   1. `paid`     — `utm_medium ∈ {cpc, ppc, paid}` OR a `gclid` param is present.
 *   2. `direct`   — no referrer, an unparseable referrer, or a same-origin referrer.
 *   3. `search`   — the referrer host is a known search engine.
 *   4. `referral` — any other external referrer.
 *
 * @param referrer The raw `document.referrer` (empty string when absent).
 * @param params The landing URL's query params (`new URLSearchParams(location.search)`).
 * @param sameOriginHost The current page host (`location.hostname`), used to
 *   detect a same-origin referrer. Passed in so this function stays pure and
 *   testable — it never reads `location` itself.
 * @returns The classified channel.
 */
export function classifyChannel(
  referrer: string,
  params: URLSearchParams,
  sameOriginHost: string,
): TrafficChannel {
  // why: paid is the strongest signal and is checked first — a paid click can
  // arrive with a stripped/empty referrer but a `gclid` or a paid `utm_medium`,
  // and it must not be miscounted as `direct` (D-24175).
  const utmMedium = (params.get('utm_medium') ?? '').toLowerCase();
  if (params.has('gclid') || PAID_UTM_MEDIUMS.includes(utmMedium)) {
    return 'paid';
  }

  if (referrer === '') {
    return 'direct';
  }

  let referrerHost: string;
  try {
    referrerHost = new URL(referrer).hostname.toLowerCase();
  } catch {
    // why: an unparseable referrer is treated as direct — no external source is
    // determinable, and this must never throw.
    return 'direct';
  }

  if (referrerHost === sameOriginHost.toLowerCase()) {
    return 'direct';
  }

  for (const fragment of SEARCH_ENGINE_HOST_FRAGMENTS) {
    if (referrerHost.includes(fragment)) {
      return 'search';
    }
  }

  return 'referral';
}
