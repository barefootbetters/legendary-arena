/**
 * Player Feedback & Voting — Pure Logic (WP-604 / EC-639 / D-24414)
 *
 * Side-effect-free helpers for the feedback routes: input validation for a
 * submission, and the projection shaper that turns a persisted record + a vote
 * tally into the redacted public item. No `pg`, no I/O, no boardgame.io — this
 * file is independently unit-testable and never touches a database.
 *
 * The projection shaper is the single site where author PII is stripped: it copies
 * only the public fields onto PublicFeedbackItem and never carries `authorExtId`,
 * `updatedAt`, or `resolutionReason` across the boundary.
 *
 * Layer/boundary: server layer only. Pure helper — no boardgame.io import.
 *
 * Authority: WP-604 §Scope C; EC-639; D-24414.
 */

import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  type FeedbackErrorCode,
  type FeedbackItemRecord,
  type FeedbackStatus,
  type FeedbackType,
  type OperatorFeedbackItem,
  type PublicFeedbackItem,
  type SubmitFeedbackInput,
  type UpdateFeedbackStatusInput,
} from './feedback.types.js';

// why: bound the free-text fields so a submission cannot store an unbounded blob.
// A one-line summary fits comfortably in 200 chars; the body allows a detailed
// report without becoming a denial-of-service vector. Values are locked here, not
// re-derived per call site.
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;

/**
 * The result of validating a submit-feedback body: either the trimmed, typed input,
 * or a closed-set error code identifying the first field that failed. Never throws.
 */
export type ValidateSubmitFeedbackResult =
  | { readonly ok: true; readonly value: SubmitFeedbackInput }
  | { readonly ok: false; readonly code: FeedbackErrorCode };

/**
 * Narrow an unknown value to a FeedbackType, or return null when it is not one of
 * the closed-set kinds.
 *
 * @param candidate The raw `type` value from the request body.
 * @returns The FeedbackType when it matches the closed set, otherwise null.
 */
function asFeedbackType(candidate: unknown): FeedbackType | null {
  for (const feedbackType of FEEDBACK_TYPES) {
    if (candidate === feedbackType) {
      return feedbackType;
    }
  }
  return null;
}

/**
 * Validate a raw request body into a SubmitFeedbackInput. Checks that `type` is one
 * of the closed-set kinds and that `title` / `description` are non-empty strings
 * within their length bounds (trimmed before the length check and before storage).
 * Never throws — a malformed body returns a typed error code the route maps to 400.
 *
 * @param body The parsed JSON request body (unknown shape until validated).
 * @returns `{ ok: true, value }` with the trimmed input, or `{ ok: false, code }`.
 */
export function validateSubmitFeedbackInput(
  body: unknown,
): ValidateSubmitFeedbackResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, code: 'invalid_request' };
  }

  const candidate = body as {
    type?: unknown;
    title?: unknown;
    description?: unknown;
  };

  const feedbackType = asFeedbackType(candidate.type);
  if (feedbackType === null) {
    return { ok: false, code: 'invalid_type' };
  }

  if (typeof candidate.title !== 'string') {
    return { ok: false, code: 'invalid_title' };
  }
  const title = candidate.title.trim();
  if (title === '' || title.length > MAX_TITLE_LENGTH) {
    return { ok: false, code: 'invalid_title' };
  }

  if (typeof candidate.description !== 'string') {
    return { ok: false, code: 'invalid_description' };
  }
  const description = candidate.description.trim();
  if (description === '' || description.length > MAX_DESCRIPTION_LENGTH) {
    return { ok: false, code: 'invalid_description' };
  }

  return {
    ok: true,
    value: { type: feedbackType, title, description },
  };
}

/**
 * Shape a persisted feedback record plus its vote tally into the redacted public
 * item. This is the single PII-stripping site: it copies only the public fields and
 * never carries `authorExtId`, `updatedAt`, or `resolutionReason` outward.
 *
 * @param record The persisted feedback item row.
 * @param voteCount The COUNT projection over legendary.feedback_vote for this item.
 * @param viewerHasVoted Whether the identified viewer holds a vote on this item.
 * @returns The redacted public projection.
 */
export function toPublicFeedbackItem(
  record: FeedbackItemRecord,
  voteCount: number,
  viewerHasVoted: boolean,
): PublicFeedbackItem {
  return {
    id: record.id,
    type: record.feedbackType,
    title: record.title,
    description: record.description,
    status: record.status,
    voteCount,
    viewerHasVoted,
    createdAt: record.createdAt,
  };
}

// why: bound the operator's Declined reason so a single edit cannot store an
// unbounded blob; a one-paragraph "no, because…" fits comfortably. An over-long
// reason is reported as `resolution_reason_required` (the reason field is
// malformed) to keep the FeedbackErrorCode set closed.
const MAX_RESOLUTION_REASON_LENGTH = 2000;

/**
 * The result of validating a status-update body: either the typed input, or a
 * closed-set error code identifying the failure. Never throws.
 */
export type ValidateUpdateFeedbackStatusResult =
  | { readonly ok: true; readonly value: UpdateFeedbackStatusInput }
  | { readonly ok: false; readonly code: FeedbackErrorCode };

/**
 * Narrow an unknown value to a FeedbackStatus, or return null when it is not one
 * of the closed-set statuses.
 *
 * @param candidate The raw `status` value from the request body.
 * @returns The FeedbackStatus when it matches the closed set, otherwise null.
 */
function asFeedbackStatus(candidate: unknown): FeedbackStatus | null {
  for (const feedbackStatus of FEEDBACK_STATUSES) {
    if (candidate === feedbackStatus) {
      return feedbackStatus;
    }
  }
  return null;
}

/**
 * Validate a raw request body into an UpdateFeedbackStatusInput. Checks that
 * `status` is one of the closed-set statuses and enforces the Declined rule: when
 * `status === 'declined'` a non-empty, length-bounded `resolutionReason` is
 * required; for every other status the reason is normalized to `null` (a move off
 * Declined clears any prior reason). Never throws — a malformed body returns a
 * typed error code the route maps to 400.
 *
 * @param body The parsed JSON request body (unknown shape until validated).
 * @returns `{ ok: true, value }` with the typed input, or `{ ok: false, code }`.
 */
export function validateUpdateFeedbackStatusInput(
  body: unknown,
): ValidateUpdateFeedbackStatusResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, code: 'invalid_request' };
  }

  const candidate = body as { status?: unknown; resolutionReason?: unknown };

  const status = asFeedbackStatus(candidate.status);
  if (status === null) {
    return { ok: false, code: 'invalid_status' };
  }

  // why: a reason is required (and stored) ONLY on Declined; for every other status
  // it is forced to null so a stale reason never lingers when an item leaves the
  // Declined state (D-24416).
  if (status !== 'declined') {
    return { ok: true, value: { status, resolutionReason: null } };
  }

  if (typeof candidate.resolutionReason !== 'string') {
    return { ok: false, code: 'resolution_reason_required' };
  }
  const resolutionReason = candidate.resolutionReason.trim();
  if (
    resolutionReason === '' ||
    resolutionReason.length > MAX_RESOLUTION_REASON_LENGTH
  ) {
    return { ok: false, code: 'resolution_reason_required' };
  }

  return { ok: true, value: { status, resolutionReason } };
}

/**
 * Shape a persisted feedback record plus its vote tally into the operator triage
 * projection. Unlike `toPublicFeedbackItem`, this is operator-only and retains the
 * full record (`authorExtId`, `resolutionReason`, `updatedAt`) — it never reaches a
 * player surface.
 *
 * @param record The persisted feedback item row.
 * @param voteCount The COUNT projection over legendary.feedback_vote for this item.
 * @returns The operator projection.
 */
export function toOperatorFeedbackItem(
  record: FeedbackItemRecord,
  voteCount: number,
): OperatorFeedbackItem {
  return {
    id: record.id,
    feedbackType: record.feedbackType,
    title: record.title,
    description: record.description,
    authorExtId: record.authorExtId,
    status: record.status,
    resolutionReason: record.resolutionReason,
    voteCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
