/**
 * useAnalyticsCapture — the single reactive analytics instrumentation hub
 * (WP-378 / EC-407).
 *
 * Invoked exactly once from `App.vue`'s setup. It observes the existing auth and
 * UIState stores reactively and emits the acquisition/activation/retention events
 * — instrumentation is NOT scattered across match/turn components (the only other
 * in-component emit is `signup-start` on the LoginPage auth surface). Every emit
 * is fire-and-forget via {@link captureAnalyticsEvent}; nothing here throws,
 * blocks, or surfaces to the player.
 *
 * First-match and retention detection are CLIENT-LOCAL for v1 (D-24174):
 * per-device `localStorage` flags/timestamps, explicitly non-authoritative — they
 * re-count on a new device / cleared storage, and a server-derived variant reading
 * session history is a deferred upgrade. Retention fires only for an authenticated
 * user whose last visit is ≥ 1 day old.
 *
 * Layer-boundary contract: imports only same-layer arena-client modules (the
 * emitter, the pure classifier, and two Pinia stores) — nothing from the engine,
 * registry, server, pre-planning, or framework.
 *
 * Authority: WP-378 §Scope (In) §C; EC-407 §Locked Values / §Required Comments;
 * D-24173 (emitter/privacy), D-24174 (client-local detection), D-24175 (channel).
 */

import { onMounted, watch } from 'vue';

import { captureAnalyticsEvent } from '../lib/api/analyticsEmitter';
import { classifyChannel } from '../lib/api/channelClassifier';
import { useAuthStore } from '../stores/auth';
import { useUiStateStore } from '../stores/uiState';

/** `localStorage` key: the timestamp (ms) of the visitor's most recent visit. */
const LAST_VISIT_KEY = 'legendary-arena.analytics.last-visit';
/** `localStorage` flag: this device has completed its first authenticated session. */
const SIGNUP_COMPLETE_FLAG = 'legendary-arena.analytics.signup-complete';
/** `localStorage` flag: this device has recorded its first-ever match start. */
const FIRST_MATCH_STARTED_FLAG = 'legendary-arena.analytics.first-match-started';
/** `localStorage` flag: this device has recorded its first-ever match completion. */
const FIRST_MATCH_COMPLETED_FLAG = 'legendary-arena.analytics.first-match-completed';

/** Retention threshold: a return counts after ≥ 1 day (86_400_000 ms). */
const RETENTION_THRESHOLD_MS = 86_400_000;

/**
 * Reads a boolean `localStorage` flag, tolerating unavailable storage.
 *
 * @param key The flag key.
 * @returns true when the flag has been set; false when unset or unreadable.
 */
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    // why: localStorage can throw (private mode / hardened browser). Treat an
    // unreadable flag as unset — the worst case re-emits a first-* event, which
    // is acceptable for a non-authoritative client-local signal (D-24174).
    return false;
  }
}

/**
 * Sets a `localStorage` flag, tolerating unavailable storage.
 *
 * @param key The flag key.
 */
function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // why: a failed write only means the single-fire guard degrades to
    // per-session — never a thrown error into the reactive callback.
  }
}

/**
 * Reads the prior last-visit stamp to decide whether this visit is a return
 * (≥ 1 day since the last), then stamps the current visit.
 *
 * // why: the staleness decision must read the PRIOR stamp before overwriting it,
 * so it is computed once here at setup (before the auth watcher, which may fire
 * synchronously with `immediate: true`). Retention is emitted later, and only if
 * the visitor is authenticated. Client-local + per-device (D-24174).
 *
 * @param now The current time in ms (`Date.now()`).
 * @returns true when the prior visit was ≥ 1 day ago.
 */
function readAndStampLastVisit(now: number): boolean {
  let wasStale = false;
  try {
    const priorRaw = localStorage.getItem(LAST_VISIT_KEY);
    if (priorRaw !== null) {
      const prior = Number(priorRaw);
      if (Number.isFinite(prior) && now - prior >= RETENTION_THRESHOLD_MS) {
        wasStale = true;
      }
    }
    localStorage.setItem(LAST_VISIT_KEY, String(now));
  } catch {
    // why: unavailable storage → treat as a first visit (not stale); never throw.
  }
  return wasStale;
}

/**
 * Builds the non-PII channel properties for a landing event. Referrer host +
 * utm source/medium only — never an email, handle, display name, or card
 * contents (EC §Guardrails).
 *
 * @param referrer The raw referrer.
 * @param params The landing query params.
 * @returns The properties object, or `undefined` when nothing is known.
 */
function buildChannelProperties(
  referrer: string,
  params: URLSearchParams,
): Record<string, unknown> | undefined {
  const properties: Record<string, unknown> = {};
  if (referrer !== '') {
    try {
      properties.referrer_host = new URL(referrer).hostname;
    } catch {
      // why: an unparseable referrer contributes no host; never throw.
    }
  }
  const utmSource = params.get('utm_source');
  if (utmSource !== null) {
    properties.utm_source = utmSource;
  }
  const utmMedium = params.get('utm_medium');
  if (utmMedium !== null) {
    properties.utm_medium = utmMedium;
  }
  return Object.keys(properties).length > 0 ? properties : undefined;
}

/**
 * Wires the analytics instrumentation. Call once, from `App.vue`'s setup.
 */
export function useAnalyticsCapture(): void {
  const authStore = useAuthStore();
  const uiStateStore = useUiStateStore();

  // why: compute retention staleness from the PRIOR stamp and re-stamp NOW,
  // synchronously at setup — before the `immediate: true` auth watcher below can
  // read it for an already-authenticated (returning) session.
  const lastVisitWasStale = readAndStampLastVisit(Date.now());
  let authHandled = false;

  // why: signup-complete distinguishes a FIRST authenticated session on this
  // device (the `SIGNUP_COMPLETE_FLAG` is unset) from a returning sign-in (flag
  // set) — a returning authed user past the day threshold emits retention-return
  // instead. `immediate: true` also covers a session already authenticated at
  // mount (a bootstrapped returning session); `authHandled` fires this at most
  // once per composable lifetime.
  watch(
    () => authStore.isAuthenticated,
    (isAuthenticated) => {
      if (!isAuthenticated || authHandled) {
        return;
      }
      authHandled = true;
      if (!readFlag(SIGNUP_COMPLETE_FLAG)) {
        captureAnalyticsEvent('signup-complete', authStore.accountId);
        writeFlag(SIGNUP_COMPLETE_FLAG);
      } else if (lastVisitWasStale) {
        captureAnalyticsEvent('retention-return', authStore.accountId);
      }
    },
    { immediate: true },
  );

  // why: the player's first-ever match start / completion, guarded by
  // per-device `localStorage` flags so each fires at most once (D-24174,
  // non-authoritative — re-counts on a new device). Match state is the shared
  // UIState projection: phase 'play' means a match is in progress; a present
  // `gameOver` means it finished.
  watch(
    () => uiStateStore.snapshot,
    (snapshot) => {
      if (snapshot === null) {
        return;
      }
      if (snapshot.game.phase === 'play' && !readFlag(FIRST_MATCH_STARTED_FLAG)) {
        captureAnalyticsEvent('first-match-started', authStore.accountId);
        writeFlag(FIRST_MATCH_STARTED_FLAG);
      }
      if (snapshot.gameOver !== undefined && snapshot.gameOver !== null && !readFlag(FIRST_MATCH_COMPLETED_FLAG)) {
        captureAnalyticsEvent('first-match-completed', authStore.accountId);
        writeFlag(FIRST_MATCH_COMPLETED_FLAG);
      }
    },
    { immediate: true },
  );

  // why: the traffic-source channel is classified from the landing's referrer +
  // UTM params on mount (when `document`/`location` are available) and emitted
  // ANONYMOUSLY (user_id null — the channel is a pre-signup signal). Guarded for
  // the node:test runner where `document`/`location` may be absent.
  onMounted(() => {
    const referrer = typeof document !== 'undefined' ? document.referrer : '';
    const search = typeof location !== 'undefined' ? location.search : '';
    const host = typeof location !== 'undefined' ? location.hostname : '';
    const params = new URLSearchParams(search);
    captureAnalyticsEvent(
      classifyChannel(referrer, params, host),
      null,
      buildChannelProperties(referrer, params),
    );
  });
}
