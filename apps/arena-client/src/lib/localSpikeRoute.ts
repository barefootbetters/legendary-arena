/**
 * Route predicate for the WP-890 local match spike (D-24842).
 *
 * `?route=local-spike` opens the spike page only in a build with the
 * development flag on; otherwise the value falls through like any other
 * unknown `?route=`.
 */

/** The `?route=` value that opens the local match spike. */
export const LOCAL_SPIKE_ROUTE_PARAM = 'local-spike';

/**
 * Decides whether a `?route=` value opens the local match spike.
 *
 * @param routeParam - The `?route=` value, or null when absent or empty.
 * @param isFlagOn - Whether the build has the spike flag on.
 * @returns True only for `local-spike` with the flag on.
 */
export function isLocalSpikeRoute(routeParam: string | null, isFlagOn: boolean): boolean {
  return isFlagOn && routeParam === LOCAL_SPIKE_ROUTE_PARAM;
}
