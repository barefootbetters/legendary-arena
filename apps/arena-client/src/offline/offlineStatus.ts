/**
 * The offline page's status line — Arena Client (WP-894 / D-24851).
 *
 * Pure: the page gathers the registration outcome, the worker state and the
 * image warm result, and this module picks the one line the player sees.
 */

/** The registration outcome as the page tracks it (`pending` until it settles). */
export type OfflineRegistrationStatus =
  | 'pending'
  | 'registered'
  | 'unsupported'
  | 'skipped-dev'
  | 'failed';

/** The image warm's counts. */
export interface OfflineWarmCounts {
  readonly total: number;
  readonly cached: number;
  readonly failed: number;
}

/** Everything the status line depends on. */
export interface OfflineStatusInput {
  readonly registrationOutcome: OfflineRegistrationStatus;
  readonly isWorkerActive: boolean;
  readonly hasInstallFailed: boolean;
  readonly warm: OfflineWarmCounts | null;
}

/**
 * Picks the offline page's status line. Failures are checked before Ready, so
 * a failure is never hidden behind a Ready line.
 *
 * @param input - The registration outcome, worker state and warm counts.
 * @returns Exactly one status string.
 */
export function describeOfflineStatus(input: OfflineStatusInput): string {
  if (input.registrationOutcome === 'skipped-dev') {
    return 'Offline copy is built only in production builds';
  }
  if (input.registrationOutcome === 'unsupported') {
    return 'Offline copy unavailable: this browser has no service worker support';
  }
  if (input.registrationOutcome === 'failed') {
    return 'Offline copy unavailable: the service worker could not be registered';
  }
  if (input.hasInstallFailed) {
    return 'Offline copy unavailable: the service worker failed to install';
  }
  const warm = input.warm;
  if (warm !== null && warm.failed > 0) {
    return `Offline copy unavailable: ${warm.failed} card images could not be cached`;
  }
  const isWarmComplete = warm !== null && warm.total > 0 && warm.cached === warm.total;
  if (input.registrationOutcome === 'registered' && input.isWorkerActive && isWarmComplete) {
    return 'Ready offline';
  }
  return 'Preparing offline copy…';
}
