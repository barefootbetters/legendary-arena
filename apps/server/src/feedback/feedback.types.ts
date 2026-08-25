/**
 * Player Feedback & Voting — Types (WP-604 / EC-639 / D-24414)
 *
 * Durable contracts for the custom-built player-feedback + public-roadmap system:
 * the closed sets for a feedback item's kind and status, the persisted row shape,
 * the redacted public projection, the submit-input shape, and the closed-set error
 * codes. Two Postgres domain tables back these types — legendary.feedback_item
 * (one row per bug/enhancement/review) and legendary.feedback_vote (one row per
 * account per item). The database owns the vote tally (a COUNT projection over the
 * votes table, never a stored column); status is authored only on the operator
 * dashboard (a follow-on WP), never by this packet.
 *
 * Layer/boundary: server layer only. Imports nothing from boardgame.io,
 * @legendary-arena/game-engine (runtime), @legendary-arena/registry, or any UI
 * package. feedback_item / feedback_vote are ordinary domain storage — never
 * runtime G/ctx, never a snapshot, never a save-game (D-24414).
 *
 * Authority: WP-604 §Scope B; EC-639 §Locked Values; D-24414.
 */

/**
 * The kind of a feedback item. Closed set: a bug report, an enhancement request
 * (the only kind that surfaces on the public roadmap), or a review. Mirrored by
 * the FEEDBACK_TYPES canonical array; a drift-detection test asserts they match.
 */
export type FeedbackType = 'bug' | 'enhancement' | 'review';

/**
 * Canonical readonly array mirroring the FeedbackType union. Adding a value
 * requires updating both this array and the union in the same change (code-style
 * §Drift Detection); the drift test in feedback.logic.test.ts enforces it.
 */
export const FEEDBACK_TYPES: readonly FeedbackType[] = [
  'bug',
  'enhancement',
  'review',
] as const;

/**
 * The editorial status of a feedback item. Closed set. A new item is always
 * 'under_review' (the only status this packet writes); the dashboard-triage
 * follow-on WP owns every transition to 'planned' / 'in_progress' / 'shipped' /
 * 'declined'. Mirrored by the FEEDBACK_STATUSES canonical array.
 */
export type FeedbackStatus =
  | 'under_review'
  | 'planned'
  | 'in_progress'
  | 'shipped'
  | 'declined';

/**
 * Canonical readonly array mirroring the FeedbackStatus union. Adding a value
 * requires updating both this array and the union in the same change (code-style
 * §Drift Detection); the drift test in feedback.logic.test.ts enforces it.
 */
export const FEEDBACK_STATUSES: readonly FeedbackStatus[] = [
  'under_review',
  'planned',
  'in_progress',
  'shipped',
  'declined',
] as const;

/**
 * The public roadmap's default status view — the statuses shown to a visitor when
 * no explicit filter is supplied. Deliberately excludes 'under_review' (raw intake)
 * and 'declined' so the public board shows only triaged, forward-looking items.
 */
export const PUBLIC_ROADMAP_STATUSES: readonly FeedbackStatus[] = [
  'planned',
  'in_progress',
  'shipped',
] as const;

/**
 * A persisted feedback item (the legendary.feedback_item row shape, camelCase). The
 * TypeScript fields are camelCase; the underlying columns are snake_case, mapped
 * explicitly at each read site. `resolutionReason` is null until an item is
 * Declined (set by the future triage WP, never here).
 */
export interface FeedbackItemRecord {
  readonly id: number;
  readonly feedbackType: FeedbackType;
  readonly title: string;
  readonly description: string;
  readonly authorExtId: string;
  readonly status: FeedbackStatus;
  readonly resolutionReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * The redacted public projection of a feedback item, returned by GET /api/feedback.
 * Deliberately OMITS `authorExtId` (no PII), `updatedAt`, and `resolutionReason`.
 * `type` renames the record's `feedbackType`. `voteCount` is the COUNT projection
 * over legendary.feedback_vote; `viewerHasVoted` is true only when a session token
 * identified the caller and they hold a vote on this item.
 */
export interface PublicFeedbackItem {
  readonly id: number;
  readonly type: FeedbackType;
  readonly title: string;
  readonly description: string;
  readonly status: FeedbackStatus;
  readonly voteCount: number;
  readonly viewerHasVoted: boolean;
  readonly createdAt: string;
}

/**
 * The validated input for POST /api/feedback. `title` / `description` are trimmed,
 * non-empty, and length-bounded by the validator; `type` is a FeedbackType. The
 * author is never in the body — it is the authenticated session's account.
 */
export interface SubmitFeedbackInput {
  readonly type: FeedbackType;
  readonly title: string;
  readonly description: string;
}

/**
 * Closed-set error codes for the feedback routes. `invalid_request` is a malformed
 * or non-object body / bad path param; `invalid_type` / `invalid_title` /
 * `invalid_description` are the field-level submit-validation failures;
 * `not_found` is a vote against a non-existent item; `internal_error` is the locked
 * 500 envelope (no leaked internals). Session-validation codes (missing_token, …)
 * come from the auth layer and are surfaced verbatim by the routes, separate from
 * this set.
 */
export type FeedbackErrorCode =
  | 'invalid_request'
  | 'invalid_type'
  | 'invalid_title'
  | 'invalid_description'
  | 'not_found'
  | 'internal_error';
