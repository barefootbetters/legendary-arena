/**
 * The offline page's path rule — Arena Client (WP-894 / D-24851).
 *
 * The offline page lives at `/offline/` (trailing slash), the directory the
 * service worker at `/offline/sw.js` controls. The bare `/offline` is not the
 * offline page: Vite preview serves the root `index.html` there, and it sits
 * outside the worker's scope.
 */

/** The offline page's path, and the service worker's scope. */
export const OFFLINE_PATH_PREFIX = '/offline/';

/**
 * Reports whether a pathname belongs to the offline page.
 *
 * @param pathname - A `window.location.pathname` value, e.g. `/offline/`.
 * @returns True for `/offline/` and any path below it.
 */
export function isOfflinePath(pathname: string): boolean {
  return pathname.startsWith(OFFLINE_PATH_PREFIX);
}
