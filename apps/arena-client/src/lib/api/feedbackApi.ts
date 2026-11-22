/**
 * Feedback API Client — Arena Client (WP-813 / EC-850 / D-24414)
 *
 * Typed `fetch` wrapper for the single WP-604 `POST /api/feedback` endpoint,
 * plus the pure draft validator that mirrors the server's field bounds before a
 * request is sent. Consumed by
 * `apps/arena-client/src/components/FeedbackSection.vue` on `?route=me`.
 *
 * Layer-boundary contract: this module imports nothing from the game engine,
 * the registry, the pre-planning package, the boardgame framework, or any
 * server package (the verification grep in the EC enforces the absence of those
 * imports). The error-code union and the length bounds are a hand-mirror of the
 * server feedback logic module; they are never imported, because the client may
 * not reach across the layer boundary (ARCHITECTURE.md §Layer Boundary).
 *
 * Authority: WP-813 §Scope (In) §A; EC-850 §Locked Values; D-24414 (the
 * feedback system); D-24416 (the dashboard is the sole status writer, so this
 * client never reads or sets status). Mirrors the WP-352 `friendsApi.ts`
 * precedent: a hand-mirrored closed-set error-code array pinned by a test, plus
 * `{ ok: true, value } | { ok: false, status, code }` results.
 */

import { buildApiUrl } from './apiBaseUrl';

/**
 * Canonical readonly array of the feedback kinds a player may submit. Adding a
 * value requires updating both this array and the `FeedbackType` union in the
 * same change (code-style §Drift Detection); the runtime mirror pin in
 * `feedbackApi.test.ts` asserts the exact membership and order.
 *
 * why: this is a client-local mirror of the server feedback types module's
 * `FEEDBACK_TYPES` (cited by name, never by path — the layer boundary forbids
 * importing it). The pin catches an accidental edit to this client mirror only;
 * it does not read the server array and will not fail on server drift. Keep the
 * two in lockstep by hand.
 */
export const FEEDBACK_TYPES = ['bug', 'enhancement', 'review'] as const;

/**
 * Closed set of feedback kinds. Client-local mirror of the server union (see
 * `FEEDBACK_TYPES`).
 */
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

// why: client-local mirror of the server feedback logic module's
// MAX_TITLE_LENGTH. The server is authoritative on the bound — this constant
// only lets the section validate a draft before sending, so an over-long title
// is caught client-side as well as by the server's 400. Kept in lockstep with
// the server module by hand; the runtime pin in feedbackApi.test.ts asserts the
// value.
export const FEEDBACK_TITLE_MAX_LENGTH = 200;

// why: client-local mirror of the server feedback logic module's
// MAX_DESCRIPTION_LENGTH, for the same reason as the title bound above. The
// server stays authoritative; this is a pre-send convenience bound only.
export const FEEDBACK_DESCRIPTION_MAX_LENGTH = 5000;

// why: client-local mirror of the submit-path subset of the server feedback
// types module's `FeedbackErrorCode` union. The submit route (POST
// /api/feedback) can only return these codes in a 400; the status-update codes
// (invalid_status / resolution_reason_required / not_found) belong to the
// dashboard routes and never reach this client. A 401 is handled by HTTP status,
// not by a code. The drift test in feedbackApi.test.ts compares this array
// against a hand-written list, so it catches an accidental edit to this client
// mirror only; it does not read the server union and will not fail on server
// drift. Update this array and that test's list together by hand.
export const FEEDBACK_API_ERROR_CODES = [
  'invalid_request',
  'invalid_type',
  'invalid_title',
  'invalid_description',
  'internal_error',
] as const;

/**
 * Closed set of failure codes the submit route may return in its `{ error }`
 * body. Client-local mirror of the server union subset (see
 * `FEEDBACK_API_ERROR_CODES`).
 */
export type FeedbackApiErrorCode = (typeof FEEDBACK_API_ERROR_CODES)[number];

/**
 * The trimmed, typed body the section sends to `POST /api/feedback`. The author
 * is never in the body — it is the authenticated session's account (D-24414).
 */
export interface FeedbackDraftValue {
  readonly type: FeedbackType;
  readonly title: string;
  readonly description: string;
}

/**
 * The raw draft a player has entered, before trimming and validation. `type` is
 * already a `FeedbackType` (the kind control is a closed-set select); the two
 * free-text fields are whatever the player typed.
 */
export interface FeedbackDraft {
  readonly type: FeedbackType;
  readonly title: string;
  readonly description: string;
}

/**
 * The result of validating a feedback draft: either the trimmed, typed value
 * ready to send, or the first field that is empty or over its length bound.
 */
export type ValidateFeedbackDraftResult =
  | { readonly ok: true; readonly value: FeedbackDraftValue }
  | { readonly ok: false; readonly field: 'title' | 'description' };

/**
 * The result of a submit attempt. The success branch carries the new item's id
 * from the 201 body; the failure branch carries the HTTP status plus a
 * closed-set error code (or `null` for a network failure, a 401, or an
 * unrecognized code — all of which the section maps to copy by status).
 */
export type SubmitFeedbackResult =
  | { readonly ok: true; readonly value: { readonly id: number } }
  | { readonly ok: false; readonly status: number; readonly code: FeedbackApiErrorCode | null };

/**
 * Narrow an unknown response-body `error` value to the closed submit-path
 * error-code set. Returns `null` when the value is absent, not a string, or not
 * one of the known codes.
 *
 * @param raw The raw `error` field from the parsed 400 body.
 * @returns The matched code, or `null`.
 */
function narrowFeedbackApiCode(raw: unknown): FeedbackApiErrorCode | null {
  if (typeof raw !== 'string') {
    return null;
  }
  for (const knownCode of FEEDBACK_API_ERROR_CODES) {
    if (knownCode === raw) {
      return knownCode;
    }
  }
  return null;
}

/**
 * Validate a feedback draft before it is sent. Trims the title and description,
 * then checks each is non-empty and within its length bound, in that order.
 * Returns the trimmed, typed value on success, or the first failing field. Pure:
 * no I/O, no side effects. The server re-validates authoritatively; this only
 * lets the section disable Submit and keep the player from a round-trip that
 * would 400.
 *
 * @param draft The raw draft the player has entered.
 * @returns `{ ok: true, value }` with trimmed fields, or `{ ok: false, field }`.
 */
export function validateFeedbackDraft(
  draft: FeedbackDraft,
): ValidateFeedbackDraftResult {
  const title = draft.title.trim();
  if (title === '' || title.length > FEEDBACK_TITLE_MAX_LENGTH) {
    return { ok: false, field: 'title' };
  }
  const description = draft.description.trim();
  if (
    description === '' ||
    description.length > FEEDBACK_DESCRIPTION_MAX_LENGTH
  ) {
    return { ok: false, field: 'description' };
  }
  return { ok: true, value: { type: draft.type, title, description } };
}

/**
 * Submit one feedback item to `POST /api/feedback`. The body carries exactly the
 * three locked keys (`type`, `title`, `description`); the author comes from the
 * bearer session, never the body. Returns `{ ok: true, value: { id } }` on 201,
 * or the failure branch otherwise. Never throws: a network failure or a JSON
 * parse error becomes `{ ok: false, status: 0, code: null }`.
 *
 * The token is always a non-null string, because the section never calls this
 * while signed out (it renders only the signed-out line then).
 *
 * @param authToken The caller's Hanko bearer token.
 * @param input The trimmed, typed draft value to send.
 * @returns The submit result.
 */
export async function submitFeedback(
  authToken: string,
  input: FeedbackDraftValue,
): Promise<SubmitFeedbackResult> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/feedback'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        type: input.type,
        title: input.title,
        description: input.description,
      }),
    });
  } catch {
    // why: a thrown fetch is a transport-level failure (offline, DNS, CORS
    // preflight). Turn it into the failure branch so the caller renders the
    // generic banner instead of an unhandled rejection; status 0 and a null
    // code mark "the request never reached the server".
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 201) {
    let code: FeedbackApiErrorCode | null = null;
    try {
      const body = (await response.json()) as { error?: unknown };
      code = narrowFeedbackApiCode(body.error);
    } catch {
      // why: a malformed or empty JSON error body still yields a usable
      // failure — the status alone drives the copy, and a null code falls
      // through to the generic banner.
      code = null;
    }
    return { ok: false, status: response.status, code };
  }
  let id = 0;
  try {
    const body = (await response.json()) as { id?: unknown };
    if (typeof body.id === 'number') {
      id = body.id;
    }
  } catch {
    // why: a 201 with an unreadable body is still a success — the item was
    // created. Default the id to 0; the section shows a receipt, not the id.
    id = 0;
  }
  return { ok: true, value: { id } };
}
