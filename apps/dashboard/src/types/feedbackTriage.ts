/**
 * Feedback Triage — Dashboard Types + Pure Form Logic (WP-605 / EC-640 / D-24416)
 *
 * The dashboard-side contract for the operator feedback triage panel. The dashboard
 * imports nothing from the server, so `FeedbackTriageItem` HAND-MIRRORS the server
 * `OperatorFeedbackItem` (apps/server/src/feedback/feedback.types.ts).
 *
 * MIRROR PIN: any change to the server `OperatorFeedbackItem` MUST update this type
 * (and the field-name keyset assertion in `feedbackTriage.test.ts`), and vice-versa.
 * The two apps share no import, so nothing else binds them.
 *
 * All status-edit validation lives here as a PURE function (`validateStatusEdit`) so
 * it is unit-tested to the dashboard coverage gate — the `.vue` panel is a thin
 * render shell (the dashboard test runner cannot mount `.vue`).
 */

/** Mirror of the server `FeedbackType` closed set. */
export type FeedbackTriageType = 'bug' | 'enhancement' | 'review';

/** Mirror of the server `FeedbackStatus` closed set. */
export type FeedbackTriageStatus =
  | 'under_review'
  | 'planned'
  | 'in_progress'
  | 'shipped'
  | 'declined';

/**
 * The five statuses, in workflow order, for the panel's status dropdown. Mirrors the
 * server `FEEDBACK_STATUSES` array; the keyset/values are pinned by the test.
 */
export const FEEDBACK_TRIAGE_STATUSES: readonly FeedbackTriageStatus[] = [
  'under_review',
  'planned',
  'in_progress',
  'shipped',
  'declined',
] as const;

/** Human labels for each status (the panel renders these, not the raw tokens). */
export const FEEDBACK_STATUS_LABELS: Readonly<Record<FeedbackTriageStatus, string>> = {
  under_review: 'Under review',
  planned: 'Planned',
  in_progress: 'In progress',
  shipped: 'Shipped',
  declined: 'Declined',
};

/**
 * Dashboard mirror of the server `OperatorFeedbackItem`. Operator-only (the
 * dashboard is Hanko + Cloudflare Access gated), so it carries the full record —
 * `authorExtId`, `resolutionReason` — plus the projected `voteCount`.
 */
export interface FeedbackTriageItem {
  readonly id: number;
  readonly feedbackType: FeedbackTriageType;
  readonly title: string;
  readonly description: string;
  readonly authorExtId: string;
  readonly status: FeedbackTriageStatus;
  readonly resolutionReason: string | null;
  readonly voteCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The body the panel PATCHes to `/api/dash/feedback/:id/status`. */
export interface UpdateFeedbackStatusBody {
  readonly status: FeedbackTriageStatus;
  readonly resolutionReason?: string;
}

/** The result of validating an in-progress status edit in the panel. */
export type StatusEditValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * Validate an in-progress status edit before it is PATCHed — mirrors the server's
 * `validateUpdateFeedbackStatusInput` rule so the panel never sends a request the
 * server will reject: `status` must be one of the closed set, and a non-empty
 * reason is required when declining.
 *
 * @param status The chosen status token.
 * @param reason The reason text as typed (may be empty / whitespace).
 * @returns `{ ok: true }` when the edit is submittable, else a message to show.
 */
export function validateStatusEdit(status: string, reason: string): StatusEditValidation {
  const isKnownStatus = FEEDBACK_TRIAGE_STATUSES.some((candidate) => candidate === status);
  if (!isKnownStatus) {
    return { ok: false, message: 'Choose a valid status.' };
  }
  if (status === 'declined' && reason.trim() === '') {
    return { ok: false, message: 'A reason is required when declining an item.' };
  }
  return { ok: true };
}

/**
 * Build the PATCH body for a status edit — the reason is included only when
 * declining (trimmed); every other status sends no reason so the server clears it.
 *
 * @param status The chosen status.
 * @param reason The reason text (used only when status is `declined`).
 * @returns The request body.
 */
export function buildUpdateFeedbackStatusBody(
  status: FeedbackTriageStatus,
  reason: string,
): UpdateFeedbackStatusBody {
  if (status === 'declined') {
    return { status, resolutionReason: reason.trim() };
  }
  return { status };
}
