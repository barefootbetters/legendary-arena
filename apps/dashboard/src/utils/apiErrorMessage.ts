import type { ApiError } from '../types/index.js';

/**
 * Maps an ApiError to a user-facing message for a widget or page error state.
 *
 * The revenue endpoints under `/api/dash` are admin-session-required, so the
 * most common failure for a signed-out or non-admin viewer is a 401/403.
 * Surfacing the raw "Request failed with status 403." string leaves the viewer
 * with no idea what to do, so auth failures map to an actionable "sign in as an
 * administrator" message. A retry hint is added only when the error is actually
 * retryable (a transient 5xx / network error) — retrying a 403 never helps.
 */
export function describeApiError(error: ApiError | null | undefined): string {
  if (!error) {
    return 'Data could not be loaded.';
  }
  if (error.code === '401' || error.code === '403') {
    return 'Admin session required — sign in as an administrator to view this data.';
  }
  if (error.retryable) {
    return `${error.message} Please retry or check the dashboard status page.`;
  }
  return error.message;
}
