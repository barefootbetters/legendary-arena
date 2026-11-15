/**
 * Registers the offline page's service worker — Arena Client (WP-894 / D-24851).
 *
 * The worker script lives at `/offline/sw.js` and registers with scope
 * `/offline/`, so it never controls the live game at `/`. Every environment
 * input is injected so the function is testable without a browser.
 */

/** What the caller passes in: the build facts and the browser's container. */
export interface OfflineServiceWorkerEnvironment {
  readonly isProductionBuild: boolean;
  readonly buildId: string;
  readonly serviceWorkerContainer: ServiceWorkerContainer | undefined;
}

/** The registration's outcome. */
export type OfflineServiceWorkerRegistrationOutcome =
  | 'registered'
  | 'unsupported'
  | 'skipped-dev'
  | 'failed';

/** The result of {@link registerOfflineServiceWorker}. */
export interface OfflineServiceWorkerRegistrationResult {
  readonly outcome: OfflineServiceWorkerRegistrationOutcome;
  readonly registration: ServiceWorkerRegistration | null;
}

/** The worker script's path. */
export const OFFLINE_SERVICE_WORKER_PATH = '/offline/sw.js';

/** The worker's scope: the offline page's directory, never `/`. */
export const OFFLINE_SERVICE_WORKER_SCOPE = '/offline/';

/**
 * Registers `/offline/sw.js` for this build, scoped to `/offline/`.
 *
 * @param environment - The build facts and the browser's service-worker container.
 * @returns The outcome, with the registration when it was `'registered'`.
 */
export async function registerOfflineServiceWorker(
  environment: OfflineServiceWorkerEnvironment,
): Promise<OfflineServiceWorkerRegistrationResult> {
  if (environment.isProductionBuild !== true) {
    return { outcome: 'skipped-dev', registration: null };
  }
  const container = environment.serviceWorkerContainer;
  if (container === undefined) {
    return { outcome: 'unsupported', registration: null };
  }
  // why: a new script URL per deploy installs a new worker with its own shell
  // cache. A static URL would keep the first build's worker (and its cached
  // shell) forever, because the worker file itself rarely changes.
  const scriptUrl =
    OFFLINE_SERVICE_WORKER_PATH + '?build=' + encodeURIComponent(environment.buildId);
  try {
    const registration = await container.register(scriptUrl, {
      scope: OFFLINE_SERVICE_WORKER_SCOPE,
    });
    return { outcome: 'registered', registration };
  } catch {
    // why: a failed registration only means no offline copy; the page still
    // plays online, and the status line reports the failure to the player.
    return { outcome: 'failed', registration: null };
  }
}
