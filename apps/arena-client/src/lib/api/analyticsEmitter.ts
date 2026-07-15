/**
 * Analytics Client Emitter — Arena Client (WP-378 / EC-407).
 *
 * The producer that feeds the already-built WP-205 analytics pipeline: a
 * fire-and-forget POST to the live `guest` capture endpoint
 * `POST /api/analytics/events` at the moments the nine `AcquisitionEventType`
 * values describe. Once this emits, the dashboard's Traffic Sources / Activation
 * Funnel / Retention Cohorts widgets stop reading "No data captured."
 *
 * Capture is SILENT and fire-and-forget: every failure is caught and swallowed —
 * it NEVER throws into a caller, surfaces to the UI, or blocks a click. The
 * `user_id` is sent RAW (the caller's internal account id, or `null` for an
 * anonymous event); the server computes the SHA-256 digest before INSERT
 * (D-20502) — the client NEVER hashes.
 *
 * Layer-boundary contract: this module imports nothing from the game engine, the
 * card-registry, the pre-planning package, the match-simulation framework, or any
 * server package (the EC grep enforces their absence). The `AcquisitionEventType` union
 * is declared inline as a structural mirror of the server's `ACQUISITION_EVENT_TYPES`
 * closed set (migration 017 CHECK) — importing the server type would cross the
 * layer boundary. The same-layer `apiBaseUrl` seam supplies the base URL.
 *
 * Authority: WP-378 §Scope (In) §A; EC-407 §Locked Values; D-24173 (emitter
 * architecture + privacy posture); D-20501..D-20503 (analytics schema / body /
 * envelope); D-20502 (server-side user_id hashing); WP-161 (`buildApiUrl`).
 */

import { buildApiUrl } from './apiBaseUrl';

/**
 * The nine acquisition/activation/retention event types the capture endpoint
 * accepts. A structural, client-local mirror of the server's frozen
 * `ACQUISITION_EVENT_TYPES` closed set (union + canonical array + SQL CHECK +
 * route validator, D-20501). The layer boundary forbids importing the server
 * union, so it is declared here by hand; only these nine values may be emitted —
 * never a tenth.
 */
export type AcquisitionEventType =
  | 'direct'
  | 'search'
  | 'referral'
  | 'paid'
  | 'signup-start'
  | 'signup-complete'
  | 'first-match-started'
  | 'first-match-completed'
  | 'retention-return';

/** The single capture path on the server (`analytics.routes.ts`). */
const ANALYTICS_EVENTS_PATH = '/api/analytics/events';

/**
 * The `sessionStorage` key holding the opaque per-session analytics id.
 *
 * // why: sessionStorage (not localStorage) so the id is regenerated per browser
 * session — it groups the events of one visit without persisting a durable
 * cross-session identifier. It is NOT the account id and carries no identity.
 */
const ANALYTICS_SESSION_STORAGE_KEY = 'legendary-arena.analytics.session-id';

/**
 * Returns the opaque per-session analytics id, creating it on first read.
 *
 * // why: an opaque `crypto.randomUUID()` groups one browser session's events
 * without carrying identity (it is not the account id). It lives in
 * sessionStorage so it regenerates per session. If sessionStorage is unavailable
 * (private mode, SSR, a hardened browser), a fresh ephemeral id is returned and
 * nothing throws — analytics must never break the app.
 *
 * @returns The session id (a UUID string).
 */
export function getAnalyticsSessionId(): string {
  try {
    const existing = sessionStorage.getItem(ANALYTICS_SESSION_STORAGE_KEY);
    if (existing !== null && existing.length > 0) {
      return existing;
    }
    const next = crypto.randomUUID();
    sessionStorage.setItem(ANALYTICS_SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    // why: sessionStorage / crypto access can throw (private mode, SSR). A
    // best-effort ephemeral id keeps the emitter working without a durable id;
    // analytics never breaks the surface it observes.
    return crypto.randomUUID();
  }
}

/**
 * Captures one analytics event: builds the payload and POSTs it fire-and-forget
 * to the guest capture endpoint. Never awaited, never throws, never surfaces.
 *
 * @param eventType One of the nine `AcquisitionEventType` values.
 * @param userId The RAW internal account id for an authenticated event, or
 *   `null` for an anonymous (pre-signup) event. The server hashes it (D-20502);
 *   the client MUST NOT hash.
 * @param properties Optional channel/funnel metadata (referrer host, utm medium,
 *   …). NO PII — never an email, handle, display name, or card/loadout contents.
 */
export function captureAnalyticsEvent(
  eventType: AcquisitionEventType,
  userId: string | null,
  properties?: Record<string, unknown>,
): void {
  try {
    // why: user_id is the RAW account id (or null) — the client NEVER hashes it;
    // the route boundary computes the SHA-256 digest before INSERT (D-20502).
    const payload: {
      event_type: AcquisitionEventType;
      user_id: string | null;
      session_id: string;
      timestamp: number;
      properties?: Record<string, unknown>;
    } = {
      event_type: eventType,
      user_id: userId,
      session_id: getAnalyticsSessionId(),
      timestamp: Date.now(),
    };
    if (properties !== undefined) {
      payload.properties = properties;
    }

    // why: fire-and-forget — the POST is never awaited so it cannot block a
    // click; `keepalive: true` lets an event fired at navigation time (e.g. the
    // signup CTA) survive the page unload; a rejected fetch is swallowed by the
    // `.catch` so analytics never surfaces to the player or logs a noisy error.
    // The endpoint is `guest`, so no bearer header is attached.
    void fetch(buildApiUrl(ANALYTICS_EVENTS_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // why: swallow — a failed capture must never surface to the UI or reject.
    });
  } catch {
    // why: swallow any synchronous build error (JSON, sessionStorage, crypto) —
    // analytics is best-effort and must never throw into the caller.
  }
}
