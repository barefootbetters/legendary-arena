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
  FEEDBACK_TYPES,
  type FeedbackErrorCode,
  type FeedbackItemRecord,
  type FeedbackType,
  type PublicFeedbackItem,
  type SubmitFeedbackInput,
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
