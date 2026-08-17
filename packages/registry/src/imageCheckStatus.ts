/**
 * imageCheckStatus.ts
 *
 * Classifies the HTTP status of a card-image reachability probe.
 *
 * why this exists: the registry validator spot-checks card images against the
 * LIVE CDN, which means a green build depends on a third party being healthy
 * for the few seconds the check runs. Treating every non-200 as a failure
 * conflates two completely different findings:
 *
 *   - "this image is not in the bucket"  — a real data defect that must block
 *     publishing, and that will fail identically on every re-run.
 *   - "the CDN did not answer just now"  — says nothing whatsoever about the
 *     data, and passes on the next attempt.
 *
 * Observed 2026-08-17: a card image reported non-200 during CI and returned
 * HTTP 200 when fetched manually seconds later, reddening an unrelated PR.
 * The same class of failure hit `d517dd2` on main the same day.
 *
 * Splitting the two lets the validator retry the transient case and reserve a
 * build failure for the definitive one.
 */

/** What a probe's HTTP status tells us about the image. */
export type ImageCheckStatus = "reachable" | "missing" | "transient";

/**
 * why: the probe reports 0 for a network failure or timeout — there is no HTTP
 * status because no response arrived. That is the single most common shape of
 * a CDN hiccup, so it must be named rather than falling through a numeric
 * comparison as if it were a real status code.
 */
export const NO_RESPONSE_STATUS = 0;

/**
 * why: 408 (Request Timeout) and 429 (Too Many Requests) are 4xx by number but
 * are statements about THIS request's timing, not about whether the resource
 * exists. A bulk spot-check is exactly the workload that earns a 429, and
 * retrying after a backoff is the documented remedy for both.
 */
const TRANSIENT_CLIENT_STATUSES: readonly number[] = [408, 429];

/**
 * Classifies one image probe result.
 *
 * @param httpStatus - The HTTP status code, or `NO_RESPONSE_STATUS` (0) when
 *   the request failed at the network layer or timed out.
 * @returns `reachable` when the image is served; `transient` when the probe
 *   could not get a trustworthy answer and should be retried; `missing` when
 *   the server gave a clear, reproducible answer that the image is not there.
 */
export function classifyImageCheckStatus(httpStatus: number): ImageCheckStatus {
  if (httpStatus === 200) return "reachable";

  if (httpStatus === NO_RESPONSE_STATUS) return "transient";

  // why: every 5xx is the origin or edge failing to serve a request it accepted
  // — a statement about the server's health, never about the object.
  if (httpStatus >= 500) return "transient";

  if (TRANSIENT_CLIENT_STATUSES.includes(httpStatus)) return "transient";

  // why: everything else — 404 and 410 most importantly, but also 403 for an
  // object that is present but not public — is a reproducible answer about
  // THIS resource. Retrying cannot change it, and a build must fail on it,
  // because shipping a card whose art 404s is a visible product defect.
  return "missing";
}
