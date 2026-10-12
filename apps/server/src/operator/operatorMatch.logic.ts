/**
 * Operator-match create-path logic — Server Layer (WP-802 / EC-839 / D-24689 §2).
 *
 * Only the admin-only `POST /api/admin/operator-match/create-with-bot` may set
 * the operator-match flag (`isDebugMatch`) on a match's creation payload. Every
 * public create proxy that forwards caller `setupData` refuses a payload that
 * carries the key, using the helper and message below. The native create route
 * can't read the body (boardgame.io re-parses it), so these refusals are the
 * only flag check on those paths: a future create proxy that forwards caller
 * `setupData` must refuse it the same way (D-24689 §2).
 *
 * Pure: no I/O. Imports nothing from `boardgame.io` or the engine.
 */

/**
 * The full-sentence 400 body a public create proxy returns for a flagged
 * `setupData`.
 */
export const OPERATOR_FLAG_REFUSAL_MESSAGE =
  'This match setup carries isDebugMatch, which only the operator create route may set. ' +
  'Remove the field and create the match again.';

/**
 * Reports whether a caller's `setupData` carries the operator-match flag.
 *
 * @param setupData - The caller-supplied match setup payload.
 * @returns `true` when `setupData` is a non-null object with an own
 *   `isDebugMatch` property, whatever its value.
 */
export function setupDataCarriesOperatorFlag(setupData: unknown): boolean {
  if (setupData === null || typeof setupData !== 'object') {
    return false;
  }
  // why: refuse the key whatever its value. Only a strict `true` turns the flag
  // on at setup, but a public caller has no reason to send the key at all, and
  // refusing any value keeps the rule one obvious check.
  return Object.hasOwn(setupData, 'isDebugMatch');
}
